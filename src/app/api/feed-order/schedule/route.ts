import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MS_DAY = 86_400_000;
const TRAILER_T = 27;          // tonnes per trailer
const HALF_TRAILER_T = 13.5;   // half trailer (split delivery)
const FRIDAY_TARGET_PCT = 0.85; // on Friday, bins should be 85% full

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

// Next Monday on or after `from`
function nextMonday(from: Date): Date {
  const d = startOfDay(from);
  const dow = d.getDay(); // 0=Sun,1=Mon
  const diff = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export interface DeliveryRow {
  deliveryDate: string;          // ISO — Monday or Friday
  trailers: TrailerLoad[];       // what's on each trailer
  totalOrderKg: number;          // sum of all trailers
  stockBeforeKg: number;         // stock when delivery arrives
  stockAfterKg: number;
  notes: string[];
}

export interface TrailerLoad {
  feeds: { feedProduct: string; kg: number; tonnes: number }[];
  totalTonnes: number;           // always 27
}

export interface DayRow {
  date: string;
  dayOfWeek: string;
  ageMin: number;
  ageMax: number;
  birds: number;
  totalConsumptionKg: number;    // including wheat
  pureConsumptionKg: number;     // excluding own-wheat (what comes from feed bins)
  stockStartKg: number;
  feedProducts: { product: string; ownWheat: boolean; wheatPct: number }[];
}

export interface WeekSchedule {
  orderWednesday: string;
  deliveries: DeliveryRow[];     // Monday + optional Friday
  days: DayRow[];                // Thu–Wed (7 days)
  weeklyConsumptionKg: number;   // pure feed consumption (bin draw-down)
  stockOnWednesdayKg: number;
  stockOnFridayAfterDeliveryKg: number;
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
      .reduce((s, b) => s + b.capacityTonnes * 0.8 * 1000, 0);

    const binAssignments = await prisma.feedBinAssignment.findMany({ where: { farmId } });
    const assignedHouseIds = [...new Set(binAssignments.map(a => a.houseId))];
    if (assignedHouseIds.length === 0) {
      return NextResponse.json({ weeks: [], warning: "No house-bin assignments found." });
    }

    // ── Active placements ─────────────────────────────────────────────────────
    const placements = await prisma.cropHousePlacement.findMany({
      where: { houseId: { in: assignedHouseIds } },
      include: {
        crop: {
          include: {
            targetProfile: { include: { days: { orderBy: { dayNumber: "asc" } } } },
          },
        },
      },
    });

    const today = startOfDay(new Date());
    const activePlacements = placements.filter(p => {
      const endDate = p.clearDate ? startOfDay(new Date(p.clearDate)) : addDays(new Date(p.placementDate), 42);
      return endDate >= today || p.crop.status === "ACTIVE";
    });

    if (activePlacements.length === 0) {
      return NextResponse.json({ weeks: [], warning: "No active placements found." });
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
      const end = p.clearDate ? startOfDay(new Date(p.clearDate)) : addDays(new Date(p.placementDate), 42);
      if (end > cycleEnd) cycleEnd = new Date(end);
    }

    // ── Daily consumption (pure feed from bins only) ──────────────────────────
    // Returns kg that must come from feed bins (total - own wheat portion)
    function dailyData(date: Date): {
      pureFeedKg: number;
      totalKg: number;
      birds: number;
      phases: { product: string; ownWheat: boolean; wheatPct: number }[];
    } {
      const d = startOfDay(date);
      let totalKg = 0;
      let pureFeedKg = 0;
      let birds = 0;
      const phaseSet = new Map<string, { ownWheat: boolean; wheatPct: number }>();

      activePlacements.forEach((p, idx) => {
        const pd = startOfDay(new Date(p.placementDate));
        const endDate = p.clearDate ? startOfDay(new Date(p.clearDate)) : addDays(pd, 42);
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
        // If ownWheat: bins hold only pure feed (no wheat), so pure = dayKg * (1 - wheatPct/100)
        // If !ownWheat: feed is already mixed (wheat included), so pure = dayKg
        pureFeedKg += ownWheat ? dayKg * (1 - wheatPct / 100) : dayKg;
        birds += b;

        if (phase) phaseSet.set(phase.feedProduct, { ownWheat: phase.ownWheat, wheatPct: phase.wheatPct });
      });

      return {
        pureFeedKg,
        totalKg,
        birds,
        phases: [...phaseSet.entries()].map(([product, v]) => ({ product, ...v })),
      };
    }

    // ── Current stock ─────────────────────────────────────────────────────────
    const stockRecord = await prisma.feedOrderStock.findUnique({ where: { farmId } });
    let runningStockKg = (stockRecord?.activeStockTonnes ?? 0) * 1000;

    // ── Consume today to next Wednesday ──────────────────────────────────────
    // Find the next ordering Wednesday
    const todayDow = today.getDay();
    const daysToWed = todayDow <= 3 ? 3 - todayDow : 10 - todayDow;
    const firstWednesday = addDays(today, daysToWed);

    // Burn stock from today up to (but not including) Wednesday
    for (let cur = new Date(today); cur < firstWednesday; cur = addDays(cur, 1)) {
      const { pureFeedKg } = dailyData(cur);
      runningStockKg -= pureFeedKg;
    }

    // ── Simulate week by week ─────────────────────────────────────────────────
    const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const weeks: WeekSchedule[] = [];
    let wednesday = new Date(firstWednesday);
    if (today.getDay() === 3) wednesday = new Date(today);

    while (wednesday <= cycleEnd) {
      const weekNotes: string[] = [];
      const thursday = addDays(wednesday, 1);
      const friday = addDays(wednesday, 2);
      const monday = nextMonday(thursday); // next Monday after Wednesday

      // ── Days Thu–Wed (7 days for display) ────────────────────────────────
      const dayRows: DayRow[] = [];
      let weeklyPureFeedKg = 0;

      for (let i = 1; i <= 7; i++) {
        const day = addDays(wednesday, i);
        const { pureFeedKg, totalKg, birds, phases } = dailyData(day);
        const ageSet: number[] = [];
        for (const p of activePlacements) {
          const pd = startOfDay(new Date(p.placementDate));
          const age = Math.round((day.getTime() - pd.getTime()) / MS_DAY);
          if (age >= 0 && age <= 60) ageSet.push(age);
        }
        dayRows.push({
          date: toISO(day),
          dayOfWeek: DOW_SHORT[day.getDay()],
          ageMin: ageSet.length ? Math.min(...ageSet) : 0,
          ageMax: ageSet.length ? Math.max(...ageSet) : 0,
          birds,
          totalConsumptionKg: Math.round(totalKg),
          pureConsumptionKg: Math.round(pureFeedKg),
          stockStartKg: 0, // filled in below
          feedProducts: phases,
        });
        weeklyPureFeedKg += pureFeedKg;
      }

      // ── Notes for this week ───────────────────────────────────────────────
      const weekStart = thursday;
      const weekEnd = addDays(wednesday, 7);
      for (const p of activePlacements) {
        if (p.thinDate) {
          const td = startOfDay(new Date(p.thinDate));
          if (td >= weekStart && td <= weekEnd) weekNotes.push(`Thin 1 (${toISO(td)}, −${(p.thinBirds ?? 0).toLocaleString()})`);
        }
        if (p.thin2Date) {
          const td2 = startOfDay(new Date(p.thin2Date));
          if (td2 >= weekStart && td2 <= weekEnd) weekNotes.push(`Thin 2 (${toISO(td2)}, −${(p.thin2Birds ?? 0).toLocaleString()})`);
        }
        if (p.clearDate) {
          const cd = startOfDay(new Date(p.clearDate));
          if (cd >= weekStart && cd <= weekEnd) weekNotes.push(`Clear (${toISO(cd)})`);
        }
      }

      // ── Calculate what to order ───────────────────────────────────────────
      // Thu-Sun (4 days) must be covered by current stock before Monday delivery
      let thuSunNeeded = 0;
      for (let i = 1; i <= 4; i++) {
        thuSunNeeded += dailyData(addDays(wednesday, i)).pureFeedKg;
      }
      // Mon-Fri (5 days) consumption
      let monFriNeeded = 0;
      for (let i = 5; i <= 9; i++) {
        monFriNeeded += dailyData(addDays(wednesday, i)).pureFeedKg;
      }
      // Sat-Mon (need stock from Fri to last until Tue morning, conservative)
      let satTueNeeded = 0;
      for (let i = 10; i <= 13; i++) { // Sat,Sun,Mon,Tue
        satTueNeeded += dailyData(addDays(wednesday, i)).pureFeedKg;
      }

      // Total needed this week (Mon delivery covers Mon–Fri + Sat–Tue buffer)
      // Stock on Wednesday = runningStockKg
      // Must survive Thu–Sun on existing stock
      const stockAfterThuSun = runningStockKg - thuSunNeeded;

      // What we need on Monday morning to cover Mon–Tue of next week (conservative: +1 day buffer)
      const monDeliveryNeeded = monFriNeeded + satTueNeeded - Math.max(0, stockAfterThuSun);

      // Round up to full trailers (27t each), cap at bin capacity
      const monOrderKg = Math.min(
        Math.ceil(Math.max(0, monDeliveryNeeded) / (TRAILER_T * 1000)) * TRAILER_T * 1000,
        maxOrderKg
      );

      // ── Build trailer loads for Monday ───────────────────────────────────
      // Find which feed products are needed Mon onwards, handle phase transitions
      function buildTrailers(orderKg: number, startDay: Date): TrailerLoad[] {
        if (orderKg <= 0) return [];
        const trailers: TrailerLoad[] = [];
        let remaining = orderKg;

        // Build a sorted list of (feedProduct, kg needed) segments
        // based on phase transitions starting from startDay
        type Segment = { feedProduct: string; neededKg: number };
        const segments: Segment[] = [];
        let cur = new Date(startDay);
        const horizon = addDays(startDay, 14);

        while (cur < horizon && remaining > 0) {
          const { pureFeedKg, phases } = dailyData(cur);
          const product = phases[0]?.product ?? "FINISHER_PELLET_585";
          const last = segments[segments.length - 1];
          if (last && last.feedProduct === product) {
            last.neededKg += pureFeedKg;
          } else {
            segments.push({ feedProduct: product, neededKg: pureFeedKg });
          }
          cur = addDays(cur, 1);
        }

        // Now fill trailers from segments
        let segIdx = 0;
        let segUsed = 0;

        while (remaining > 0 && segIdx < segments.length) {
          const seg = segments[segIdx];
          const trailerKg = TRAILER_T * 1000;
          const halfKg = HALF_TRAILER_T * 1000;

          const segLeft = seg.neededKg - segUsed;

          if (segLeft <= 0) { segIdx++; segUsed = 0; continue; }

          // Check if this segment ends before the trailer is full (phase transition)
          // If segLeft < halfKg and next segment exists → split trailer
          if (segLeft < halfKg && segIdx + 1 < segments.length && remaining >= trailerKg) {
            // Half trailer current phase + half next phase
            const firstKg = halfKg;
            const secondKg = halfKg;
            trailers.push({
              feeds: [
                { feedProduct: seg.feedProduct, kg: firstKg, tonnes: HALF_TRAILER_T },
                { feedProduct: segments[segIdx + 1].feedProduct, kg: secondKg, tonnes: HALF_TRAILER_T },
              ],
              totalTonnes: TRAILER_T,
            });
            remaining -= trailerKg;
            segUsed = 0;
            segIdx++;
            segments[segIdx].neededKg -= secondKg;
          } else {
            // Full trailer of current phase
            const useKg = Math.min(trailerKg, remaining);
            // Round to 27t full trailer
            const actualKg = useKg >= trailerKg ? trailerKg : halfKg;
            trailers.push({
              feeds: [{ feedProduct: seg.feedProduct, kg: actualKg, tonnes: actualKg / 1000 }],
              totalTonnes: actualKg / 1000,
            });
            remaining -= actualKg;
            segUsed += actualKg;
            if (segUsed >= seg.neededKg) { segIdx++; segUsed = 0; }
          }
        }

        return trailers;
      }

      const monTrailers = buildTrailers(monOrderKg, monday);
      const monOrderActualKg = monTrailers.reduce((s, t) => s + t.totalTonnes * 1000, 0);

      // ── Friday delivery check ─────────────────────────────────────────────
      // On Friday, bins should be at 85% of capacity
      // stockOnFriday (before Fri delivery) = stock after Mon delivery minus Mon–Thu consumption
      const stockAfterMon = stockAfterThuSun + monOrderActualKg;
      let stockOnFriday = stockAfterMon;
      for (let i = 5; i <= 8; i++) { // Mon(5)..Thu(8) = 4 days
        stockOnFriday -= dailyData(addDays(wednesday, i)).pureFeedKg;
      }

      const fridayTarget = totalBinCapacityKg * FRIDAY_TARGET_PCT;
      const fridayDeficit = fridayTarget - stockOnFriday;
      let friOrderKg = 0;
      let friTrailers: TrailerLoad[] = [];

      if (fridayDeficit > 0) {
        friOrderKg = Math.min(
          Math.ceil(fridayDeficit / (TRAILER_T * 1000)) * TRAILER_T * 1000,
          maxOrderKg - monOrderActualKg,
        );
        if (friOrderKg > 0) {
          friTrailers = buildTrailers(friOrderKg, friday);
          friOrderKg = friTrailers.reduce((s, t) => s + t.totalTonnes * 1000, 0);
        }
      }

      // ── Build deliveries array ────────────────────────────────────────────
      const deliveries: DeliveryRow[] = [];
      const stockOnMondayMorning = stockAfterThuSun;

      if (monTrailers.length > 0) {
        deliveries.push({
          deliveryDate: toISO(monday),
          trailers: monTrailers,
          totalOrderKg: monOrderActualKg,
          stockBeforeKg: Math.round(stockOnMondayMorning),
          stockAfterKg: Math.round(stockOnMondayMorning + monOrderActualKg),
          notes: [],
        });
      }

      if (friTrailers.length > 0) {
        const stockBeforeFri = stockOnFriday;
        deliveries.push({
          deliveryDate: toISO(friday),
          trailers: friTrailers,
          totalOrderKg: friOrderKg,
          stockBeforeKg: Math.round(stockBeforeFri),
          stockAfterKg: Math.round(stockBeforeFri + friOrderKg),
          notes: [`Friday target: ${(FRIDAY_TARGET_PCT * 100).toFixed(0)}% capacity`],
        });
      }

      // ── Fill in stockStartKg for day rows ─────────────────────────────────
      let simStockForDays = runningStockKg;
      for (let i = 0; i < dayRows.length; i++) {
        const day = addDays(wednesday, i + 1);

        // Monday delivery arrives before consumption this day
        if (toISO(day) === toISO(monday) && monOrderActualKg > 0) {
          simStockForDays += monOrderActualKg;
        }
        // Friday delivery arrives before consumption this day
        if (toISO(day) === toISO(friday) && friOrderKg > 0) {
          simStockForDays += friOrderKg;
        }

        dayRows[i].stockStartKg = Math.round(simStockForDays);
        simStockForDays -= dayRows[i].pureConsumptionKg;
      }

      weeks.push({
        orderWednesday: toISO(wednesday),
        deliveries,
        days: dayRows,
        weeklyConsumptionKg: Math.round(weeklyPureFeedKg),
        stockOnWednesdayKg: Math.round(runningStockKg),
        stockOnFridayAfterDeliveryKg: Math.round(stockOnFriday + friOrderKg),
        notes: weekNotes,
      });

      // ── Advance running stock for next week ───────────────────────────────
      for (let i = 1; i <= 7; i++) {
        const day = addDays(wednesday, i);
        if (toISO(day) === toISO(monday)) runningStockKg += monOrderActualKg;
        if (toISO(day) === toISO(friday)) runningStockKg += friOrderKg;
        runningStockKg -= dailyData(day).pureFeedKg;
      }

      wednesday = addDays(wednesday, 7);
    }

    return NextResponse.json({
      weeks,
      meta: {
        totalBinCapacityTonnes: totalBinCapacityKg / 1000,
        maxOrderTonnes: maxOrderKg / 1000,
        cycleEnd: toISO(cycleEnd),
        activeStockTonnes: stockRecord?.activeStockTonnes ?? 0,
        trailerTonnes: TRAILER_T,
        closingBins: farmBins.filter(b => b.isClosingStock).map(b => b.name),
      },
    });
  } catch (e: any) {
    console.error("FEED ORDER SCHEDULE ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}
