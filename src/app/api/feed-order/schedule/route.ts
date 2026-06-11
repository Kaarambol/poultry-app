import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MS_DAY = 86_400_000;
const TRAILER_KG = 27_000;
const MAX_PER_DAY = 2;
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(d: Date, n: number): Date { return new Date(d.getTime() + n * MS_DAY); }
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date): Date { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }

// First Wednesday on or after d (if d is Wednesday, returns d)
function nextWednesday(from: Date): Date {
  const d = startOfDay(new Date(from));
  const dow = d.getDay();
  const diff = dow <= 3 ? 3 - dow : 10 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

// Last Wednesday STRICTLY BEFORE d — used to find pre-crop order date
function lastWednesdayBefore(d: Date): Date {
  const day = startOfDay(new Date(d));
  const dow = day.getDay();
  const daysBack = ((dow - 3 + 7) % 7) || 7;
  day.setDate(day.getDate() - daysBack);
  return day;
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
  isPast: boolean;
  stockOnOrderDayKg: number;
  totalOrderKg: number;
  totalTrailers: number;
  preDelivery: StockDay[];   // Wed(0)..Sun(+4)
  deliveryWindow: DeliveryDay[]; // Mon(+5)..Fri(+9)
  coverage: StockDay[];          // Sat(+10)..Tue(+13)
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

    // ── Placements (ACTIVE crops only) ───────────────────────────────────────
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

    if (placements.length === 0) {
      return NextResponse.json({ orders: [], warning: "No active placements found." });
    }

    const today = startOfDay(new Date());

    // ── Placement end date ────────────────────────────────────────────────────
    function placementEnd(p: typeof placements[0]): Date {
      const hardMax = addDays(startOfDay(new Date(p.placementDate)), 42);
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

    const placementFeedMaps = placements.map(p => {
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

    // ── Cycle end: furthest placement end ─────────────────────────────────────
    let cycleEnd = today;
    for (const p of placements) {
      const end = placementEnd(p);
      if (end > cycleEnd) cycleEnd = new Date(end);
    }

    // ── DailyRecord bird counts (actual thinning from farm records) ───────────
    const cropIds = [...new Set(placements.map(p => p.cropId))];
    const allDailyRecords = await prisma.dailyRecord.findMany({
      where: { houseId: { in: assignedHouseIds }, cropId: { in: cropIds } },
      select: { houseId: true, cropId: true, date: true, birdsTotal: true },
    });
    const dailyBirdsMap = new Map<string, number>();
    for (const dr of allDailyRecords) {
      const key = `${dr.cropId}:${dr.houseId}:${toISO(startOfDay(new Date(dr.date)))}`;
      dailyBirdsMap.set(key, dr.birdsTotal);
    }

    // Houses with multiple placements: DailyRecord.birdsTotal = whole-house count.
    // Using it per-placement would double/triple count. Skip DailyRecord for these.
    const placementCountPerHouse = new Map<string, number>();
    for (const p of placements) {
      const key = `${p.cropId}:${p.houseId}`;
      placementCountPerHouse.set(key, (placementCountPerHouse.get(key) ?? 0) + 1);
    }

    // ── Daily consumption ─────────────────────────────────────────────────────
    // Returns total consumption AND per-product breakdown.
    // Uses DailyRecord.birdsTotal when available (respects actual thinning/mortality).
    // Falls back to placement data (thinDate/thinBirds) for future dates.
    function dailyData(date: Date): {
      pureFeedKg: number;
      totalKg: number;
      birds: number;
      phases: { product: string; ownWheat: boolean; wheatPct: number }[];
      ageSet: number[];
      consumptionByProduct: Map<string, number>;
    } {
      const d = startOfDay(date);
      let totalKg = 0;
      let pureFeedKg = 0;
      let birds = 0;
      const phaseSet = new Map<string, { ownWheat: boolean; wheatPct: number }>();
      const ageSet: number[] = [];
      const consumptionByProduct = new Map<string, number>();

      placements.forEach((p, idx) => {
        const pd = startOfDay(new Date(p.placementDate));
        const endDate = placementEnd(p);
        if (d < pd || d > endDate) return;

        const age = Math.round((d.getTime() - pd.getTime()) / MS_DAY);

        // Use DailyRecord bird count only when this house has exactly one placement.
        // Multi-placement houses: DailyRecord.birdsTotal is the whole-house sum —
        // using it per-placement would multiply-count birds.
        const houseKey = `${p.cropId}:${p.houseId}`;
        const drKey = `${houseKey}:${toISO(d)}`;
        const isMultiPlacement = (placementCountPerHouse.get(houseKey) ?? 1) > 1;
        let b: number;
        if (!isMultiPlacement && dailyBirdsMap.has(drKey)) {
          b = dailyBirdsMap.get(drKey)!;
        } else {
          b = p.birdsPlaced;
          if (p.thinDate && d >= startOfDay(new Date(p.thinDate))) b -= (p.thinBirds ?? 0);
          if (p.thin2Date && d >= startOfDay(new Date(p.thin2Date))) b -= (p.thin2Birds ?? 0);
          b = Math.max(0, b);
        }

        const { map, maxDay } = placementFeedMaps[idx];
        const feedG = getFeedTargetG(map, maxDay, age);
        const dayKg = b * feedG / 1000;

        const phase = getPhaseForDay(age);
        const wheatPct = phase?.wheatPct ?? 0;
        const ownWheat = phase?.ownWheat ?? false;

        totalKg += dayKg;
        const pureDayKg = ownWheat ? dayKg * (1 - wheatPct / 100) : dayKg;
        pureFeedKg += pureDayKg;
        birds += b;
        if (age >= 0 && age <= 60) ageSet.push(age);

        if (phase) {
          phaseSet.set(phase.feedProduct, { ownWheat: phase.ownWheat, wheatPct: phase.wheatPct });
          // Accumulate per-product consumption (pure feed only)
          consumptionByProduct.set(
            phase.feedProduct,
            (consumptionByProduct.get(phase.feedProduct) ?? 0) + pureDayKg
          );
        }
      });

      return {
        pureFeedKg,
        totalKg,
        birds,
        phases: [...phaseSet.entries()].map(([product, v]) => ({ product, ...v })),
        ageSet,
        consumptionByProduct,
      };
    }

    // ── Sum consumptionByProduct over a range of day offsets ─────────────────
    function consumptionRange(baseDate: Date, fromOffset: number, toOffset: number): Map<string, number> {
      const result = new Map<string, number>();
      for (let i = fromOffset; i <= toOffset; i++) {
        for (const [prod, kg] of dailyData(addDays(baseDate, i)).consumptionByProduct) {
          result.set(prod, (result.get(prod) ?? 0) + kg);
        }
      }
      return result;
    }

    // ── Crop start: earliest placement ────────────────────────────────────────
    const cropStart = placements.reduce((earliest, p) => {
      const pd = startOfDay(new Date(p.placementDate));
      return pd < earliest ? pd : earliest;
    }, startOfDay(new Date(placements[0].placementDate)));

    // ── First ordering Wednesday: last Wednesday BEFORE crop start ────────────
    let wednesday = lastWednesdayBefore(cropStart);

    // ── Today's Wednesday (boundary for isPast flag) ──────────────────────────
    const todayWednesday = nextWednesday(today);

    // ── Per-product stock — always starts at 0 (empty bins at crop start) ─────
    const stockByProduct = new Map<string, number>();
    function totalStock(): number {
      return [...stockByProduct.values()].reduce((s, v) => s + v, 0);
    }

    // ── Last phase product (for closing-bin capacity logic) ───────────────────
    const lastPhaseProduct = feedPhases.length > 0
      ? feedPhases[feedPhases.length - 1].feedProduct
      : null;

    // ── Build trailer loads ───────────────────────────────────────────────────
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
      return {
        date: toISO(date),
        dayOfWeek: DOW_SHORT[date.getDay()],
        ageMin: ageSet.length ? Math.min(...ageSet) : 0,
        ageMax: ageSet.length ? Math.max(...ageSet) : 0,
        birds,
        consumptionKg: Math.round(pureFeedKg),
        stockStartKg: Math.round(stockStart),
        stockEndKg: Math.round(stockStart - pureFeedKg),
      };
    }

    // ── Simulate week by week ─────────────────────────────────────────────────
    const orders: OrderWeek[] = [];

    while (addDays(wednesday, 5) <= cycleEnd) {
      const isPast = wednesday < todayWednesday;

      // ── Consumption breakdown by product ─────────────────────────────────
      // preDelivery: Wed(0)..Sun(+4) — consumed before deliveries arrive
      const preConsumptionByProduct = consumptionRange(wednesday, 0, 4);
      // window: Mon(+5)..Tue(+13) — needs to be covered by stock + deliveries
      const windowConsumptionByProduct = consumptionRange(wednesday, 5, 13);

      const totalWindowKg = [...windowConsumptionByProduct.values()].reduce((s, v) => s + v, 0);

      // No birds in window → skip, still advance stock through Wed..Tue(+6)
      if (totalWindowKg === 0) {
        for (let i = 0; i <= 6; i++) {
          const { consumptionByProduct } = dailyData(addDays(wednesday, i));
          for (const [prod, kg] of consumptionByProduct) {
            stockByProduct.set(prod, (stockByProduct.get(prod) ?? 0) - kg);
          }
        }
        wednesday = addDays(wednesday, 7);
        continue;
      }

      const weekNotes: string[] = [];
      const stockOnOrderDayKg = totalStock();

      // ── Per-product stock at Monday morning ───────────────────────────────
      // = current stock for that product minus what's consumed Wed–Sun
      const stockAtMonByProduct = new Map<string, number>();
      const allProducts = new Set([
        ...preConsumptionByProduct.keys(),
        ...windowConsumptionByProduct.keys(),
      ]);
      for (const prod of allProducts) {
        const current = stockByProduct.get(prod) ?? 0;
        const preUsed = preConsumptionByProduct.get(prod) ?? 0;
        stockAtMonByProduct.set(prod, Math.max(0, current - preUsed));
      }

      // ── Effective bin capacity ────────────────────────────────────────────
      const mondayPhase = dailyData(addDays(wednesday, 5)).phases[0];
      const isLastPhase = lastPhaseProduct !== null && mondayPhase?.product === lastPhaseProduct;
      const effectiveCapKg = isLastPhase ? totalBinCapacityKg : maxOrderKg;

      // ── Per-product shortfall → trailers needed ───────────────────────────
      const trailersNeededByProduct = new Map<string, number>();
      for (const [prod, windowKg] of windowConsumptionByProduct) {
        const available = stockAtMonByProduct.get(prod) ?? 0;
        const shortfall = Math.max(0, windowKg - available);
        if (shortfall > 0) {
          trailersNeededByProduct.set(prod, Math.ceil(shortfall / TRAILER_KG));
        }
      }

      // ── Distribute deliveries Mon–Fri ─────────────────────────────────────
      // Products are delivered in order of when they're first needed (ascending).
      // No phase restriction: a product can be pre-delivered before its phase starts
      // so it's in the bins when birds need it.
      // Max 2 trailers per day total (across all products).
      const DELIVERY_OFFSETS = [5, 6, 7, 8, 9]; // Mon Tue Wed Thu Fri
      type DeliveryEntry = { kg: number; product: string };
      const deliveryByOffset = new Map<number, DeliveryEntry[]>();

      if ([...trailersNeededByProduct.values()].some(v => v > 0)) {
        const trailersLeft = new Map(trailersNeededByProduct);

        // Find the first offset in [5..13] where each product has consumption > 0
        const firstNeededOffset = new Map<string, number>();
        for (const prod of trailersNeededByProduct.keys()) {
          for (let i = 5; i <= 13; i++) {
            if ((dailyData(addDays(wednesday, i)).consumptionByProduct.get(prod) ?? 0) > 0) {
              firstNeededOffset.set(prod, i);
              break;
            }
          }
        }

        // Sort products: earliest first-need offset first
        const sortedProducts = [...trailersNeededByProduct.keys()].sort((a, b) => {
          return (firstNeededOffset.get(a) ?? 999) - (firstNeededOffset.get(b) ?? 999);
        });

        // Total stock at Monday morning for bin capacity check
        let simTotalStock = Math.max(
          0,
          [...stockAtMonByProduct.values()].reduce((s, v) => s + v, 0)
        );

        for (let di = 0; di < DELIVERY_OFFSETS.length; di++) {
          const offset = DELIVERY_OFFSETS[di];
          const day = addDays(wednesday, offset);
          const { pureFeedKg } = dailyData(day);

          let trailersThisDay = 0;
          const dayDeliveries: DeliveryEntry[] = [];

          for (const prod of sortedProducts) {
            const remaining = trailersLeft.get(prod) ?? 0;
            if (remaining <= 0 || trailersThisDay >= MAX_PER_DAY) continue;

            // Per-product capacity: last-phase product can use closing bins
            const prodCapKg = (prod === lastPhaseProduct) ? totalBinCapacityKg : maxOrderKg;

            const canDeliver = Math.min(MAX_PER_DAY - trailersThisDay, remaining);
            const fitInBins = prodCapKg > 0
              ? Math.floor(Math.max(0, prodCapKg - simTotalStock) / TRAILER_KG)
              : canDeliver;
            const actual = Math.min(canDeliver, fitInBins);

            if (actual > 0) {
              dayDeliveries.push({ kg: actual * TRAILER_KG, product: prod });
              trailersLeft.set(prod, remaining - actual);
              trailersThisDay += actual;
              simTotalStock += actual * TRAILER_KG;
            }
          }

          if (dayDeliveries.length > 0) {
            deliveryByOffset.set(offset, dayDeliveries);
          }
          simTotalStock -= pureFeedKg;
        }
      }

      const actualTotalOrderKg = [...deliveryByOffset.values()].flat().reduce((s, e) => s + e.kg, 0);
      const totalTrailers = [...deliveryByOffset.values()].flat().length;

      // ── Build TrailerLoad objects per offset ──────────────────────────────
      const trailersByOffset = new Map<number, TrailerLoad[]>();
      for (const [off, entries] of deliveryByOffset) {
        const loads: TrailerLoad[] = [];
        for (const { kg, product } of entries) {
          loads.push(...buildTrailers(kg, product));
        }
        trailersByOffset.set(off, loads);
      }

      // ── Notes: thin/clear events within this order's window ───────────────
      const periodStart = addDays(wednesday, 1);
      const periodEnd = addDays(wednesday, 13);
      for (const p of placements) {
        if (p.thinDate) {
          const td = startOfDay(new Date(p.thinDate));
          if (td >= periodStart && td <= periodEnd)
            weekNotes.push(`Thin 1 (${toISO(td)}, -${(p.thinBirds ?? 0).toLocaleString()})`);
        }
        if (p.thin2Date) {
          const td2 = startOfDay(new Date(p.thin2Date));
          if (td2 >= periodStart && td2 <= periodEnd)
            weekNotes.push(`Thin 2 (${toISO(td2)}, -${(p.thin2Birds ?? 0).toLocaleString()})`);
        }
        if (p.clearDate) {
          const cd = startOfDay(new Date(p.clearDate));
          if (cd >= periodStart && cd <= periodEnd)
            weekNotes.push(`Clear (${toISO(cd)})`);
        }
      }

      // ── Simulate stock for display (total across all products) ────────────
      let simStock = totalStock();

      // preDelivery: Wed(0)..Sun(+4)
      const preDelivery: StockDay[] = [];
      for (let i = 0; i <= 4; i++) {
        const day = addDays(wednesday, i);
        const sd = buildStockDay(day, simStock);
        preDelivery.push(sd);
        simStock = sd.stockEndKg;
      }

      // deliveryWindow: Mon(+5)..Fri(+9)
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

      // coverage: Sat(+10)..Tue(+13)
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
        isPast,
        stockOnOrderDayKg: Math.round(stockOnOrderDayKg),
        totalOrderKg: Math.round(actualTotalOrderKg),
        totalTrailers,
        preDelivery,
        deliveryWindow,
        coverage,
        stockOnFinalTuesdayKg: Math.round(stockOnFinalTuesdayKg),
        notes: weekNotes,
      });

      // ── Advance stockByProduct to start of next Wednesday ─────────────────
      // For each day Wed(0)..Tue(+6): add deliveries, subtract consumption.
      for (let i = 0; i <= 6; i++) {
        const dayDeliveries = deliveryByOffset.get(i) ?? [];
        for (const { kg, product } of dayDeliveries) {
          stockByProduct.set(product, (stockByProduct.get(product) ?? 0) + kg);
        }
        const { consumptionByProduct } = dailyData(addDays(wednesday, i));
        for (const [prod, kg] of consumptionByProduct) {
          stockByProduct.set(prod, (stockByProduct.get(prod) ?? 0) - kg);
        }
      }
      // Deliveries Wed(+7)..Fri(+9) arrive but aren't consumed this week — pre-stock for next week.
      for (let i = 7; i <= 9; i++) {
        const dayDeliveries = deliveryByOffset.get(i) ?? [];
        for (const { kg, product } of dayDeliveries) {
          stockByProduct.set(product, (stockByProduct.get(product) ?? 0) + kg);
        }
      }

      wednesday = addDays(wednesday, 7);
    }

    return NextResponse.json({
      orders,
      meta: {
        totalBinCapacityTonnes: totalBinCapacityKg / 1000,
        maxOrderTonnes: maxOrderKg / 1000,
        trailerTonnes: TRAILER_KG / 1000,
        cycleEnd: toISO(cycleEnd),
        cropStart: toISO(cropStart),
        activeStockTonnes: 0,
        closingBins: farmBins.filter(b => b.isClosingStock).map(b => b.name),
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    console.error("FEED ORDER SCHEDULE ERROR:", err);
    return NextResponse.json({ error: err?.message ?? "Server error." }, { status: 500 });
  }
}
