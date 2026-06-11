import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MS_DAY = 86_400_000;
const TRAILER_KG = 27_000;
const HALF_KG = 13_500;
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * MS_DAY); }
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }

function nextWednesday(from: Date): Date {
  const d = startOfDay(from);
  const dow = d.getDay();
  const diff = dow <= 3 ? 3 - dow : 10 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

export interface TrailerLoad {
  feeds: { feedProduct: string; tonnes: number }[];
  totalTonnes: number;
}

export interface StockDay {
  date: string;
  dayOfWeek: string;
  ageMin: number;
  ageMax: number;
  birds: number;
  consumptionKg: number;
  stockStartKg: number;
  stockEndKg: number;
}

export interface DeliveryDay {
  date: string;
  dayOfWeek: string;
  ageMin: number;
  ageMax: number;
  birds: number;
  consumptionKg: number;
  stockBeforeKg: number;
  trailers: TrailerLoad[];
  deliveryKg: number;
  stockAfterDeliveryKg: number;
  stockEndKg: number;
  feedProducts: { product: string; ownWheat: boolean; wheatPct: number }[];
}

export interface OrderWeek {
  orderDate: string;
  stockOnOrderDayKg: number;
  totalOrderKg: number;
  totalTrailers: number;
  preDelivery: StockDay[];
  deliveryWindow: DeliveryDay[];
  coverage: StockDay[];
  stockOnFinalTuesdayKg: number;
  notes: string[];
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    // ── Bins ─────────────────────────────────────────────────────────────────
    const farmBins = await prisma.feedBin.findMany({ where: { farmId }, orderBy: { sortOrder: "asc" } });
    const totalBinCapacityKg = farmBins.reduce((s, b) => s + b.capacityTonnes * 1000, 0);
    const maxOrderKg = farmBins
      .filter(b => !b.isClosingStock)
      .reduce((s, b) => s + b.capacityTonnes * 1000, 0);

    const binAssignments = await prisma.feedBinAssignment.findMany({ where: { farmId } });
    const assignedHouseIds = [...new Set(binAssignments.map(a => a.houseId))];
    if (assignedHouseIds.length === 0) {
      return NextResponse.json({ orders: [], warning: "No house-bin assignments found." });
    }

    // ── Active placements (only ACTIVE crops) ────────────────────────────────
    const placements = await prisma.cropHousePlacement.findMany({
      where: {
        houseId: { in: assignedHouseIds },
        crop: { status: "ACTIVE" },
      },
      include: {
        crop: {
          include: {
            targetProfile: { include: { days: { orderBy: { dayNumber: "asc" } } } },
          },
        },
      },
    });

    const today = startOfDay(new Date());

    // Determine end date per placement: min(clearDate | finishDate | placementDate+40, placementDate+40)
    function placementEnd(p: typeof placements[0]): Date {
      const hardMax = addDays(startOfDay(new Date(p.placementDate)), 40);
      if (p.clearDate) {
        const cd = startOfDay(new Date(p.clearDate));
        return cd < hardMax ? cd : hardMax;
      }
      if (p.crop.finishDate) {
        const fd = startOfDay(new Date(p.crop.finishDate));
        return fd < hardMax ? fd : hardMax;
      }
      return hardMax;
    }

    const activePlacements = placements.filter(p => placementEnd(p) >= today);

    if (activePlacements.length === 0) {
      return NextResponse.json({ orders: [], warning: "No active placements found." });
    }

    // ── Feed target profiles ──────────────────────────────────────────────────
    const farmDefaultProfile = await prisma.targetProfile.findFirst({
      where: { farmId, scope: "GLOBAL_TEMPLATE" },
      include: { days: { orderBy: { dayNumber: "asc" } } },
    });

    function buildFeedMap(days: { dayNumber: number; feedTargetG: number | null }[]) {
      const map = new Map<number, number>();
      for (const d of days) { if (d.feedTargetG != null) map.set(d.dayNumber, d.feedTargetG); }
      return map;
    }
    function getFeedTargetG(map: Map<number, number>, maxDay: number, age: number): number {
      if (map.has(age)) return map.get(age)!;
      for (let d = age - 1; d >= 0; d--) { if (map.has(d)) return map.get(d)!; }
      for (let d = age + 1; d <= maxDay + 10; d++) { if (map.has(d)) return map.get(d)!; }
      return 0;
    }

    const placementFeedMaps = activePlacements.map(p => {
      const days = p.crop.targetProfile?.days ?? farmDefaultProfile?.days ?? [];
      return { map: buildFeedMap(days), maxDay: days.length > 0 ? Math.max(...days.map(d => d.dayNumber)) : 42 };
    });

    // ── Feed phases ───────────────────────────────────────────────────────────
    const phaseTemplate = await prisma.feedPhaseTemplate.findUnique({
      where: { farmId },
      include: { phases: { orderBy: { sortOrder: "asc" } } },
    });
    const feedPhases = phaseTemplate?.phases ?? [];

    function getPhaseForDay(age: number) {
      for (const phase of feedPhases) {
        const end = phase.dayTo ?? 999;
        if (age >= phase.dayFrom && age <= end) return phase;
      }
      return feedPhases[feedPhases.length - 1] ?? null;
    }

    // ── Cycle end ─────────────────────────────────────────────────────────────
    let cycleEnd = today;
    for (const p of activePlacements) {
      const end = placementEnd(p);
      if (end > cycleEnd) cycleEnd = new Date(end);
    }

    // ── Daily consumption ─────────────────────────────────────────────────────
    function dailyData(date: Date): {
      pureFeedKg: number;
      totalKg: number;
      birds: number;
      phases: { product: string; ownWheat: boolean; wheatPct: number }[];
      ageSet: number[];
    } {
      const d = startOfDay(date);
      let totalKg = 0;
      let pureFeedKg = 0;
      let birds = 0;
      const phaseSet = new Map<string, { ownWheat: boolean; wheatPct: number }>();
      const ageSet: number[] = [];

      activePlacements.forEach((p, idx) => {
        const pd = startOfDay(new Date(p.placementDate));
        const endDate = placementEnd(p);
        if (d < pd || d > endDate) return;

        const age = Math.round((d.getTime() - pd.getTime()) / MS_DAY);
        let b = p.birdsPlaced;
        if (p.thinDate && d >= startOfDay(new Date(p.thinDate))) b -= (p.thinBirds ?? 0);
        if (p.thin2Date && d >= startOfDay(new Date(p.thin2Date))) b -= (p.thin2Birds ?? 0);
        b = Math.max(0, b);

        const { map, maxDay } = placementFeedMaps[idx];
        const feedG = getFeedTargetG(map, maxDay, age);
        const dayKg = b * feedG / 1000;

        const phase = getPhaseForDay(age);
        const wheatPct = phase?.wheatPct ?? 0;
        const ownWheat = phase?.ownWheat ?? false;

        totalKg += dayKg;
        pureFeedKg += ownWheat ? dayKg * (1 - wheatPct / 100) : dayKg;
        birds += b;
        if (age >= 0 && age <= 60) ageSet.push(age);

        if (phase) phaseSet.set(phase.feedProduct, { ownWheat: phase.ownWheat, wheatPct: phase.wheatPct });
      });

      return {
        pureFeedKg,
        totalKg,
        birds,
        phases: [...phaseSet.entries()].map(([product, v]) => ({ product, ...v })),
        ageSet,
      };
    }

    // ── Current stock ─────────────────────────────────────────────────────────
    const stockRecord = await prisma.feedOrderStock.findUnique({ where: { farmId } });
    const currentStockKg = (stockRecord?.activeStockTonnes ?? 0) * 1000;

    // ── First ordering Wednesday: first Wednesday on or after today ──────────
    // Start from today's known stock and burn forward — never project backward,
    // as that would ignore past deliveries and give a completely wrong base stock.
    let wednesday = nextWednesday(today);

    // ── Project stock forward from today to first Wednesday ───────────────────
    let runningStockKg = currentStockKg;
    for (let cur = new Date(today); cur < wednesday; cur = addDays(cur, 1)) {
      runningStockKg -= dailyData(cur).pureFeedKg;
    }

    // ── Build trailer loads for a delivery ────────────────────────────────────
    function buildTrailers(orderKg: number, product: string): TrailerLoad[] {
      if (orderKg <= 0) return [];
      const count = Math.round(orderKg / TRAILER_KG);
      return Array.from({ length: count }, () => ({
        feeds: [{ feedProduct: product, tonnes: TRAILER_KG / 1000 }],
        totalTonnes: TRAILER_KG / 1000,
      }));
    }

    // ── Build a StockDay entry ────────────────────────────────────────────────
    function buildStockDay(date: Date, stockStart: number): StockDay {
      const { pureFeedKg, birds, ageSet } = dailyData(date);
      const consumption = Math.round(pureFeedKg);
      return {
        date: toISO(date),
        dayOfWeek: DOW_SHORT[date.getDay()],
        ageMin: ageSet.length ? Math.min(...ageSet) : 0,
        ageMax: ageSet.length ? Math.max(...ageSet) : 0,
        birds,
        consumptionKg: consumption,
        stockStartKg: Math.round(stockStart),
        stockEndKg: Math.round(stockStart - pureFeedKg),
      };
    }

    // ── Simulate week by week ─────────────────────────────────────────────────
    const orders: OrderWeek[] = [];
    const lastPhaseProduct = feedPhases.length > 0
      ? feedPhases[feedPhases.length - 1].feedProduct
      : null;

    // Only generate an order if Monday (+5) is on or before the last day birds need feed
    while (addDays(wednesday, 5) <= cycleEnd) {
      const weekNotes: string[] = [];
      const stockOnOrderDayKg = runningStockKg;

      // preDelivery: Thu(+1), Fri(+2), Sat(+3), Sun(+4)
      // deliveryWindow: Mon(+5) through Fri(+9)
      // coverage: Sat(+10), Sun(+11), Mon(+12), Tue(+13)

      // ── Total consumption Mon(+5)..Tue(+13) = 9 days ─────────────────────
      let totalNeededKg = 0;
      for (let i = 5; i <= 13; i++) {
        totalNeededKg += dailyData(addDays(wednesday, i)).pureFeedKg;
      }

      // No birds eating this week → no order needed, just advance and skip
      if (totalNeededKg === 0) {
        wednesday = addDays(wednesday, 7);
        continue;
      }

      // ── Stock at Monday morning (burn Wed + Thu + Fri + Sat + Sun) ────────
      let stockAtMonMorningKg = runningStockKg;
      for (let i = 0; i <= 4; i++) { // Wed(0), Thu(+1), Fri(+2), Sat(+3), Sun(+4)
        stockAtMonMorningKg -= dailyData(addDays(wednesday, i)).pureFeedKg;
      }
      // Clamp to 0: if stock runs out before Monday that's already a problem,
      // but we should not double-count missing stock as extra shortfall.
      const stockAtMonClamped = Math.max(0, stockAtMonMorningKg);

      // ── Effective bin capacity: include closing bins on last feed phase ────
      const mondayPhase = dailyData(addDays(wednesday, 5)).phases[0];
      const isLastPhase = lastPhaseProduct !== null && mondayPhase?.product === lastPhaseProduct;
      const effectiveCapKg = isLastPhase ? totalBinCapacityKg : maxOrderKg;
      // 0 means no bins configured → no physical cap

      // ── This week's shortfall → how many trailers total to order ────────
      const shortfallKg = Math.max(0, totalNeededKg - stockAtMonClamped);
      let weekTrailersRemaining = Math.ceil(shortfallKg / TRAILER_KG);

      // ── Distribute trailers evenly across Mon–Fri ────────────────────────
      // Product = whatever phase is active on each delivery day.
      // Even spread: ceil(remaining/daysLeft), max 2/day, respect bin cap.
      const DELIVERY_OFFSETS = [5, 6, 7, 8, 9]; // Mon Tue Wed Thu Fri
      const MAX_PER_DAY = 2;
      type DeliveryEntry = { kg: number; product: string };
      const deliveryByOffset = new Map<number, DeliveryEntry>();
      let simForDist = stockAtMonClamped;

      for (let di = 0; di < DELIVERY_OFFSETS.length && weekTrailersRemaining > 0; di++) {
        const offset = DELIVERY_OFFSETS[di];
        const day = addDays(wednesday, offset);
        const { phases, pureFeedKg } = dailyData(day);
        const product = phases[0]?.product ?? "FINISHER_PELLET_585";

        const daysRemaining = DELIVERY_OFFSETS.length - di;
        const evenToday = Math.ceil(weekTrailersRemaining / daysRemaining);

        let fitInBins = weekTrailersRemaining;
        if (effectiveCapKg > 0) {
          fitInBins = Math.floor(Math.max(0, effectiveCapKg - simForDist) / TRAILER_KG);
        }

        const trailersToday = Math.min(MAX_PER_DAY, evenToday, fitInBins, weekTrailersRemaining);
        const deliverKg = trailersToday * TRAILER_KG;
        if (deliverKg > 0) {
          deliveryByOffset.set(offset, { kg: deliverKg, product });
          simForDist += deliverKg;
          weekTrailersRemaining -= trailersToday;
        }
        simForDist -= pureFeedKg;
      }

      // Build trailer loads per delivery day
      const trailersByOffset = new Map<number, TrailerLoad[]>();
      for (const [off, { kg, product }] of deliveryByOffset) {
        trailersByOffset.set(off, buildTrailers(kg, product));
      }
      const actualTotalOrderKg = [...deliveryByOffset.values()].reduce((s, e) => s + e.kg, 0);
      const totalTrailers = [...trailersByOffset.values()].reduce((s, t) => s + t.length, 0);

      // ── Build notes ───────────────────────────────────────────────────────
      const periodStart = addDays(wednesday, 1);
      const periodEnd = addDays(wednesday, 13);
      for (const p of activePlacements) {
        if (p.thinDate) {
          const td = startOfDay(new Date(p.thinDate));
          if (td >= periodStart && td <= periodEnd) weekNotes.push(`Thin 1 (${toISO(td)}, -${(p.thinBirds ?? 0).toLocaleString()})`);
        }
        if (p.thin2Date) {
          const td2 = startOfDay(new Date(p.thin2Date));
          if (td2 >= periodStart && td2 <= periodEnd) weekNotes.push(`Thin 2 (${toISO(td2)}, -${(p.thin2Birds ?? 0).toLocaleString()})`);
        }
        if (p.clearDate) {
          const cd = startOfDay(new Date(p.clearDate));
          if (cd >= periodStart && cd <= periodEnd) weekNotes.push(`Clear (${toISO(cd)})`);
        }
      }

      // ── Simulate stock through all 13 days ────────────────────────────────
      let simStock = runningStockKg;

      // preDelivery: Thu(+1..+4)
      const preDelivery: StockDay[] = [];
      for (let i = 1; i <= 4; i++) {
        const day = addDays(wednesday, i);
        const sd = buildStockDay(day, simStock);
        preDelivery.push(sd);
        simStock = sd.stockEndKg;
      }

      // deliveryWindow: Mon(+5..+9)
      const deliveryWindow: DeliveryDay[] = [];
      for (let i = 5; i <= 9; i++) {
        const day = addDays(wednesday, i);
        const { pureFeedKg, birds, phases, ageSet } = dailyData(day);

        const delivTrailers = trailersByOffset.get(i) ?? [];
        const delivActualKg = delivTrailers.reduce((s, t) => s + t.totalTonnes * 1000, 0);

        const stockBefore = simStock;
        const stockAfterDelivery = stockBefore + delivActualKg;
        const stockEnd = stockAfterDelivery - pureFeedKg;

        deliveryWindow.push({
          date: toISO(day),
          dayOfWeek: DOW_SHORT[day.getDay()],
          ageMin: ageSet.length ? Math.min(...ageSet) : 0,
          ageMax: ageSet.length ? Math.max(...ageSet) : 0,
          birds,
          consumptionKg: Math.round(pureFeedKg),
          stockBeforeKg: Math.round(stockBefore),
          trailers: delivTrailers,
          deliveryKg: Math.round(delivActualKg),
          stockAfterDeliveryKg: Math.round(stockAfterDelivery),
          stockEndKg: Math.round(stockEnd),
          feedProducts: phases,
        });

        simStock = stockEnd;
      }

      // coverage: Sat(+10..+13)
      const coverage: StockDay[] = [];
      for (let i = 10; i <= 13; i++) {
        const day = addDays(wednesday, i);
        const sd = buildStockDay(day, simStock);
        coverage.push(sd);
        simStock = sd.stockEndKg;
      }

      const stockOnFinalTuesdayKg = coverage[coverage.length - 1]?.stockEndKg ?? 0;

      orders.push({
        orderDate: toISO(wednesday),
        stockOnOrderDayKg: Math.round(stockOnOrderDayKg),
        totalOrderKg: Math.round(actualTotalOrderKg),
        totalTrailers,
        preDelivery,
        deliveryWindow,
        coverage,
        stockOnFinalTuesdayKg: Math.round(stockOnFinalTuesdayKg),
        notes: weekNotes,
      });

      // ── Advance running stock to start of next Wednesday ─────────────────
      // runningStockKg = stock at start of current Wednesday (before Wed consumption).
      // Must subtract Wed(0)..Tue(6) and add deliveries Mon(5)..Tue(6).
      // Deliveries at Wed(+7), Thu(+8), Fri(+9) pre-add now; consumption subtracted
      // in next iteration (Wed at i=0, Thu/Fri in preDelivery loop).
      for (let i = 0; i <= 6; i++) {
        runningStockKg += (deliveryByOffset.get(i)?.kg ?? 0); // only Mon(5)/Tue(6) are non-zero
        runningStockKg -= dailyData(addDays(wednesday, i)).pureFeedKg;
      }
      runningStockKg += (deliveryByOffset.get(7)?.kg ?? 0);
      runningStockKg += (deliveryByOffset.get(8)?.kg ?? 0);
      runningStockKg += (deliveryByOffset.get(9)?.kg ?? 0);

      wednesday = addDays(wednesday, 7);
    }

    return NextResponse.json({
      orders,
      meta: {
        totalBinCapacityTonnes: totalBinCapacityKg / 1000,
        maxOrderTonnes: maxOrderKg / 1000,
        trailerTonnes: TRAILER_KG / 1000,
        cycleEnd: toISO(cycleEnd),
        activeStockTonnes: stockRecord?.activeStockTonnes ?? 0,
        closingBins: farmBins.filter(b => b.isClosingStock).map(b => b.name),
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("FEED ORDER SCHEDULE ERROR:", err);
    return NextResponse.json({ error: err?.message ?? "Server error." }, { status: 500 });
  }
}
