import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cropId = searchParams.get("cropId");
  if (!cropId) {
    return NextResponse.json({ error: "cropId required." }, { status: 400 });
  }

  const crop = await prisma.crop.findUnique({
    where: { id: cropId },
    include: {
      farm: { select: { name: true } },
      placements: {
        include: {
          house: { select: { floorAreaM2: true, name: true } },
        },
      },
      cropHouseConfigs: true,
      daily: { orderBy: { date: "asc" } },
      targetProfile: { include: { days: true } },
    },
  });

  if (!crop) {
    return NextResponse.json({ error: "Crop not found." }, { status: 404 });
  }

  const placements = crop.placements;
  const birdsPlaced = placements.reduce((s, p) => s + p.birdsPlaced, 0);
  const placementDate = crop.placementDate;

  // Compute total floor area
  const totalFloorAreaM2 = placements.reduce((s, p) => {
    const config = crop.cropHouseConfigs.find(c => c.houseId === p.houseId);
    const area = config?.activeFloorAreaM2 ?? p.house.floorAreaM2;
    return s + area;
  }, 0);

  // Group daily records by day number (days from placementDate)
  const dailyMap = new Map<number, typeof crop.daily[number][]>();
  for (const d of crop.daily) {
    const day = daysBetween(placementDate, d.date);
    if (!dailyMap.has(day)) dailyMap.set(day, []);
    dailyMap.get(day)!.push(d);
  }

  // Find max day
  const allDays = Array.from(dailyMap.keys());
  const maxDay = allDays.length > 0 ? Math.max(...allDays) : 0;
  const numWeeks = Math.ceil((maxDay + 1) / 7);

  // Target profile days map
  const targetDayMap = new Map<number, number>();
  if (crop.targetProfile) {
    for (const td of crop.targetProfile.days) {
      if (td.weightTargetG != null) {
        targetDayMap.set(td.dayNumber, td.weightTargetG);
      }
    }
  }

  // Sum aggregated daily records by day
  const dayAgg = new Map<number, { mort: number; culls: number; birdsTotal: number; avgWeightG: number | null }>();
  for (const [day, records] of dailyMap.entries()) {
    const mort = records.reduce((s, r) => s + r.mort, 0);
    const culls = records.reduce((s, r) => s + r.culls, 0);
    const birdsTotal = records.reduce((s, r) => s + r.birdsTotal, 0);
    // average weight: take last record with avgWeightG
    const withWeight = records.filter(r => r.avgWeightG != null);
    const avgWeightG = withWeight.length > 0 ? withWeight[withWeight.length - 1].avgWeightG : null;
    dayAgg.set(day, { mort, culls, birdsTotal, avgWeightG });
  }

  // Build cumulative mort+culls
  let cumMortCulls = 0;

  interface WeekRow {
    week: number;
    dayFrom: number;
    dayTo: number;
    dateFrom: string;
    dateTo: string;
    mort: number;
    culls: number;
    birdsEnd: number;
    avgWeightG: number | null;
    targetWeightG: number | null;
    densityKgM2: number | null;
    cumulativeMortPct: number | null;
  }

  const weeks: WeekRow[] = [];

  for (let w = 0; w < numWeeks; w++) {
    const dayFrom = w * 7;
    const dayTo = dayFrom + 6;
    let mort = 0;
    let culls = 0;
    let birdsEnd = 0;
    let avgWeightG: number | null = null;

    for (let d = dayFrom; d <= dayTo; d++) {
      const agg = dayAgg.get(d);
      if (agg) {
        mort += agg.mort;
        culls += agg.culls;
        birdsEnd = agg.birdsTotal; // last in week
        if (agg.avgWeightG != null) avgWeightG = agg.avgWeightG;
      }
    }

    cumMortCulls += mort + culls;
    const cumulativeMortPct = birdsPlaced > 0 ? parseFloat(((cumMortCulls / birdsPlaced) * 100).toFixed(2)) : null;

    const dateFrom = new Date(placementDate.getTime() + dayFrom * 86400000);
    const dateTo = new Date(placementDate.getTime() + dayTo * 86400000);

    const targetWeightG = targetDayMap.get(dayTo) ?? targetDayMap.get(dayFrom) ?? null;

    let densityKgM2: number | null = null;
    if (avgWeightG != null && totalFloorAreaM2 > 0 && birdsEnd > 0) {
      densityKgM2 = parseFloat(((birdsEnd * avgWeightG / 1000) / totalFloorAreaM2).toFixed(2));
    }

    weeks.push({
      week: w + 1,
      dayFrom,
      dayTo,
      dateFrom: toISO(dateFrom),
      dateTo: toISO(dateTo),
      mort,
      culls,
      birdsEnd,
      avgWeightG,
      targetWeightG,
      densityKgM2,
      cumulativeMortPct,
    });
  }

  // Thin density: density AFTER thin (birds remaining on thinDate * thinWeightG / totalFloorAreaM2)
  let thinDensityKgM2: number | null = null;
  const thinPlacements = placements.filter(p => p.thinDate && p.thinBirds && p.thinWeightG);
  if (thinPlacements.length > 0 && totalFloorAreaM2 > 0) {
    // Find the earliest thinDate
    const thinDate = thinPlacements.reduce<Date>((earliest, p) => {
      const d = p.thinDate!;
      return d < earliest ? d : earliest;
    }, thinPlacements[0].thinDate!);
    const thinDay = daysBetween(placementDate, thinDate);

    // Find birdsTotal on thinDate
    const thinDayAgg = dayAgg.get(thinDay);
    const birdsTotalOnThinDay = thinDayAgg?.birdsTotal ?? 0;
    // Sum thinBirds
    const thinBirdsTotal = thinPlacements.reduce((s, p) => s + (p.thinBirds ?? 0), 0);
    // Weighted avg thinWeightG
    const weightedSum = thinPlacements.reduce((s, p) => s + (p.thinBirds ?? 0) * (p.thinWeightG ?? 0), 0);
    const thinAvgWeightG = thinBirdsTotal > 0 ? weightedSum / thinBirdsTotal : 0;

    const birdsAfterThin = birdsTotalOnThinDay - thinBirdsTotal;
    if (birdsAfterThin > 0 && thinAvgWeightG > 0) {
      thinDensityKgM2 = parseFloat(((birdsAfterThin * thinAvgWeightG / 1000) / totalFloorAreaM2).toFixed(2));
    }
  }

  // Clear density
  let clearDensityKgM2: number | null = null;
  const clearPlacements = placements.filter(p => p.clearDate && p.clearBirds && p.clearWeightG);
  if (clearPlacements.length > 0 && totalFloorAreaM2 > 0) {
    const clearBirdsTotal = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0), 0);
    const weightedSum = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0) * (p.clearWeightG ?? 0), 0);
    const clearAvgWeightG = clearBirdsTotal > 0 ? weightedSum / clearBirdsTotal : 0;
    if (clearBirdsTotal > 0 && clearAvgWeightG > 0) {
      clearDensityKgM2 = parseFloat(((clearBirdsTotal * clearAvgWeightG / 1000) / totalFloorAreaM2).toFixed(2));
    }
  }

  return NextResponse.json({
    cropId: crop.id,
    cropNumber: crop.cropNumber,
    farmName: crop.farm.name,
    birdsPlaced,
    totalFloorAreaM2: parseFloat(totalFloorAreaM2.toFixed(2)),
    weeks,
    thinDensityKgM2,
    clearDensityKgM2,
  });
}
