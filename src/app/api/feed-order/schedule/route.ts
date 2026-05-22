import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MS_DAY = 86_400_000;

// Returns the next Wednesday on or after the given date
function nextWednesday(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun,1=Mon,...,3=Wed
  const daysUntilWed = day <= 3 ? 3 - day : 10 - day;
  d.setDate(d.getDate() + daysUntilWed);
  return d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DAY);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export interface WeekRow {
  wednesday: string;        // ISO date of the ordering Wednesday
  weekStart: string;        // Thu (day after Wednesday)
  weekEnd: string;          // Wed next week
  ageRangeStart: number;    // min age across active placements (start of week)
  ageRangeEnd: number;      // max age across active placements (end of week)
  totalBirdsAvg: number;    // avg birds active during the week
  weeklyConsumptionKg: number;
  stockBeforeKg: number;    // stock at start of Wednesday (before order)
  orderNeededKg: number;    // how much to order this Wednesday
  orderNeededTonnes: number;
  closingUnlockedKg: number; // closing stock that becomes available if closing bin ordered
  stockAfterKg: number;     // stock after order + closing bin delivery
  notes: string[];
}

// GET /api/feed-order/schedule?farmId=xxx
export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = req.nextUrl.searchParams.get("farmId") ?? "";
    if (!farmId) return NextResponse.json({ error: "farmId required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    // ── 1. Bins assigned to any house on this farm ──────────────────────────
    const binAssignments = await prisma.feedBinAssignment.findMany({
      where: { farmId },
      include: { bin: true },
    });
    const farmBins = await prisma.feedBin.findMany({ where: { farmId }, orderBy: { sortOrder: "asc" } });
    const totalBinCapacityKg = farmBins.reduce((s, b) => s + b.capacityTonnes * 1000, 0);
    const maxOrderKg = farmBins.reduce((s, b) => s + b.capacityTonnes * 0.8 * 1000, 0);

    // Houses that have any bin assignment
    const assignedHouseIds = [...new Set(binAssignments.map(a => a.houseId))];
    if (assignedHouseIds.length === 0) {
      return NextResponse.json({ rows: [], warning: "No house-bin assignments found." });
    }

    // ── 2. Active placements for those houses ──────────────────────────────
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

    // Only consider placements whose crop is ACTIVE (or recently finished within 42 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePlacements = placements.filter(p => {
      const endDate = p.clearDate ?? addDays(new Date(p.placementDate), 42);
      return endDate >= today || p.crop.status === "ACTIVE";
    });

    if (activePlacements.length === 0) {
      return NextResponse.json({ rows: [], warning: "No active placements found for houses with bin assignments." });
    }

    // ── 3. Farm default target profile (fallback) ─────────────────────────
    const farmDefaultProfile = await prisma.targetProfile.findFirst({
      where: { farmId, scope: "GLOBAL_TEMPLATE" },
      include: { days: { orderBy: { dayNumber: "asc" } } },
    });

    // Build a feedTargetG lookup for a profile: day → grams
    function buildFeedMap(days: { dayNumber: number; feedTargetG: number | null }[]): Map<number, number> {
      const map = new Map<number, number>();
      for (const d of days) {
        if (d.feedTargetG != null) map.set(d.dayNumber, d.feedTargetG);
      }
      return map;
    }

    // Interpolate: find closest lower day entry, fallback to last
    function getFeedTargetG(map: Map<number, number>, maxDay: number, ageDay: number): number {
      if (map.has(ageDay)) return map.get(ageDay)!;
      // Walk down
      for (let d = ageDay - 1; d >= 0; d--) {
        if (map.has(d)) return map.get(d)!;
      }
      // Walk up
      for (let d = ageDay + 1; d <= maxDay + 10; d++) {
        if (map.has(d)) return map.get(d)!;
      }
      return 0;
    }

    // Per-placement feed map
    const placementFeedMaps = activePlacements.map(p => {
      const profileDays = p.crop.targetProfile?.days ?? farmDefaultProfile?.days ?? [];
      const map = buildFeedMap(profileDays);
      const maxDay = profileDays.length > 0 ? Math.max(...profileDays.map(d => d.dayNumber)) : 42;
      return { map, maxDay };
    });

    // ── 4. Determine cycle end ─────────────────────────────────────────────
    let cycleEnd = today;
    for (const p of activePlacements) {
      const end = p.clearDate ?? addDays(new Date(p.placementDate), 42);
      if (end > cycleEnd) cycleEnd = new Date(end);
    }
    cycleEnd.setHours(0, 0, 0, 0);

    // ── 5. Daily consumption function ────────────────────────────────────
    function dailyConsumptionKg(date: Date): { kg: number; totalBirds: number } {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      let totalKg = 0;
      let totalBirds = 0;

      activePlacements.forEach((p, idx) => {
        const placementDate = new Date(p.placementDate);
        placementDate.setHours(0, 0, 0, 0);
        const endDate = p.clearDate ? new Date(p.clearDate) : addDays(placementDate, 42);
        endDate.setHours(0, 0, 0, 0);

        if (d < placementDate || d > endDate) return;

        const ageDay = Math.round((d.getTime() - placementDate.getTime()) / MS_DAY);

        // Birds: 100% placed, reduce after thins
        let birds = p.birdsPlaced;
        if (p.thinDate && d >= new Date(new Date(p.thinDate).setHours(0,0,0,0))) {
          birds -= (p.thinBirds ?? 0);
        }
        if (p.thin2Date && d >= new Date(new Date(p.thin2Date).setHours(0,0,0,0))) {
          birds -= (p.thin2Birds ?? 0);
        }
        birds = Math.max(0, birds);

        const { map, maxDay } = placementFeedMaps[idx];
        const feedG = getFeedTargetG(map, maxDay, ageDay);

        totalKg += birds * feedG / 1000;
        totalBirds += birds;
      });

      return { kg: totalKg, totalBirds };
    }

    // ── 6. Load current stock ─────────────────────────────────────────────
    const stockRecord = await prisma.feedOrderStock.findUnique({ where: { farmId } });
    let runningStockKg = (stockRecord?.activeStockTonnes ?? 0) * 1000;
    const closingBinKg = (stockRecord?.closingBinTonnes ?? 0) * 1000;

    // ── 7. Simulate week by week ──────────────────────────────────────────
    const rows: WeekRow[] = [];

    // First Wednesday = this Wednesday or next
    let wednesday = nextWednesday(today);
    // If today IS Wednesday, first order is today
    if (today.getDay() === 3) wednesday = new Date(today);

    // Consume from today until first Wednesday
    {
      let cur = new Date(today);
      while (cur < wednesday) {
        const { kg } = dailyConsumptionKg(cur);
        runningStockKg -= kg;
        cur = addDays(cur, 1);
      }
    }

    let closingUnlockedThisWeek = false;

    while (wednesday <= cycleEnd) {
      const weekStart = addDays(wednesday, 1); // Thursday
      const weekEnd = addDays(wednesday, 7);   // next Wednesday

      // Consumption next 7 days (Thu–Wed)
      let weeklyKg = 0;
      let totalBirdsSum = 0;
      let birdsCount = 0;
      const ageSet: number[] = [];

      for (let i = 1; i <= 7; i++) {
        const day = addDays(wednesday, i);
        const { kg, totalBirds } = dailyConsumptionKg(day);
        weeklyKg += kg;
        totalBirdsSum += totalBirds;
        birdsCount++;

        // Age range: use first active placement for age ref
        for (const p of activePlacements) {
          const pd = new Date(p.placementDate);
          pd.setHours(0, 0, 0, 0);
          const age = Math.round((day.getTime() - pd.getTime()) / MS_DAY);
          if (age >= 0 && age <= 50) ageSet.push(age);
        }
      }

      const avgBirds = birdsCount > 0 ? Math.round(totalBirdsSum / birdsCount) : 0;
      const stockBefore = runningStockKg;

      // Order needed: what's required to cover the week (if stock can't cover it)
      const deficit = weeklyKg - runningStockKg;
      let orderKg = Math.max(0, deficit);

      // Round up to nearest tonne, cap at max order capacity
      orderKg = Math.min(Math.ceil(orderKg / 1000) * 1000, maxOrderKg);

      // Check if closing bin should be unlocked this week
      // (Unlock when stock would run out within this week without it)
      let closingUnlocked = 0;
      if (!closingUnlockedThisWeek && closingBinKg > 0 && runningStockKg < weeklyKg * 1.5) {
        closingUnlocked = closingBinKg;
        closingUnlockedThisWeek = true;
      }

      const stockAfter = runningStockKg + orderKg + closingUnlocked;

      // Notes
      const notes: string[] = [];
      for (const p of activePlacements) {
        if (p.thinDate) {
          const td = new Date(p.thinDate); td.setHours(0,0,0,0);
          if (td >= weekStart && td <= weekEnd) notes.push(`Thin 1 (${toISO(td)}, −${(p.thinBirds??0).toLocaleString()})`);
        }
        if (p.thin2Date) {
          const td2 = new Date(p.thin2Date); td2.setHours(0,0,0,0);
          if (td2 >= weekStart && td2 <= weekEnd) notes.push(`Thin 2 (${toISO(td2)}, −${(p.thin2Birds??0).toLocaleString()})`);
        }
        if (p.clearDate) {
          const cd = new Date(p.clearDate); cd.setHours(0,0,0,0);
          if (cd >= weekStart && cd <= weekEnd) notes.push(`Clear (${toISO(cd)})`);
        }
      }
      if (closingUnlocked > 0) notes.push(`Closing stock +${(closingUnlocked/1000).toFixed(2)}t available`);

      // Consume this week
      for (let i = 1; i <= 7; i++) {
        const day = addDays(wednesday, i);
        const { kg } = dailyConsumptionKg(day);
        runningStockKg -= kg;
      }
      runningStockKg += orderKg + closingUnlocked;

      const ageMin = ageSet.length > 0 ? Math.min(...ageSet) : 0;
      const ageMax = ageSet.length > 0 ? Math.max(...ageSet) : 0;

      rows.push({
        wednesday: toISO(wednesday),
        weekStart: toISO(weekStart),
        weekEnd: toISO(weekEnd),
        ageRangeStart: ageMin,
        ageRangeEnd: ageMax,
        totalBirdsAvg: avgBirds,
        weeklyConsumptionKg: Math.round(weeklyKg),
        stockBeforeKg: Math.round(stockBefore),
        orderNeededKg: Math.round(orderKg),
        orderNeededTonnes: Math.round(orderKg) / 1000,
        closingUnlockedKg: Math.round(closingUnlocked),
        stockAfterKg: Math.round(stockAfter),
        notes,
      });

      wednesday = addDays(wednesday, 7);
    }

    return NextResponse.json({
      rows,
      meta: {
        totalBinCapacityTonnes: totalBinCapacityKg / 1000,
        maxOrderTonnes: maxOrderKg / 1000,
        cycleEnd: toISO(cycleEnd),
        closingBinName: farmBins.find(b => b.id === stockRecord?.closingBinId)?.name ?? null,
        closingBinTonnes: (stockRecord?.closingBinTonnes ?? 0),
        activeStockTonnes: (stockRecord?.activeStockTonnes ?? 0),
      },
    });
  } catch (e: any) {
    console.error("FEED ORDER SCHEDULE ERROR:", e);
    return NextResponse.json({ error: e?.message ?? "Server error." }, { status: 500 });
  }
}
