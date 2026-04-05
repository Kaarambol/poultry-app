import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{
    houseId: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const { houseId } = await context.params;

    if (!houseId) {
      return NextResponse.json(
        { error: "House id required." },
        { status: 400 }
      );
    }

    const house = await prisma.house.findUnique({
      where: { id: houseId },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!house) {
      return NextResponse.json(
        { error: "House not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, house.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view this house." },
        { status: 403 }
      );
    }

    const crop = await prisma.crop.findFirst({
      where: {
        farmId: house.farmId,
        status: "ACTIVE",
        placements: {
          some: {
            houseId,
            isActive: true,
          },
        },
      },
      orderBy: {
        placementDate: "desc",
      },
      select: {
        id: true,
        cropNumber: true,
        placementDate: true,
        placements: {
          where: { houseId, isActive: true },
          select: { thinDate: true, thin2Date: true, clearDate: true, thinBirds: true, thin2Birds: true, birdsPlaced: true },
        },
        targetProfile: {
          select: {
            days: {
              select: {
                dayNumber: true,
                weightTargetG: true,
                feedTargetG: true,
                waterTargetMl: true,
                temperatureTargetC: true,
              },
            },
          },
        },
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "No active crop found for this house." },
        { status: 404 }
      );
    }

    const rows = await prisma.dailyRecord.findMany({
      where: {
        cropId: crop.id,
        houseId,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        id: true,
        date: true,
        mort: true,
        culls: true,
        cullsSmall: true,
        cullsLeg: true,
        feedKg: true,
        waterL: true,
        avgWeightG: true,
        weightPercent: true,
        birdsTotal: true,
        temperatureMinC: true,
        temperatureMaxC: true,
        humidityMinPct: true,
        humidityMaxPct: true,
        co2MinPpm: true,
        co2MaxPpm: true,
        notes: true,
      },
    });

    // Build day→targets map from target profile
    const targetDayMap: Record<number, { weightTargetG: number | null; feedTargetG: number | null; waterTargetMl: number | null; temperatureTargetC: number | null }> = {};
    for (const d of crop.targetProfile?.days ?? []) {
      targetDayMap[d.dayNumber] = {
        weightTargetG: d.weightTargetG,
        feedTargetG: d.feedTargetG,
        waterTargetMl: d.waterTargetMl,
        temperatureTargetC: d.temperatureTargetC,
      };
    }

    // Aggregate across all placements for this house
    const toStr = (d: Date | null | undefined) => d ? new Date(d).toISOString().slice(0, 10) : null;
    const birdsPlaced     = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);
    const thinBirdsCount  = crop.placements.reduce((s, p) => s + (p.thinBirds  ?? 0), 0);
    const thin2BirdsCount = crop.placements.reduce((s, p) => s + (p.thin2Birds ?? 0), 0);
    // Use the earliest non-null date across placements for each event
    const thinDateStr  = crop.placements.map(p => toStr(p.thinDate)).filter(Boolean).sort()[0]  ?? null;
    const thin2DateStr = crop.placements.map(p => toStr(p.thin2Date)).filter(Boolean).sort()[0] ?? null;
    const clearDateStr = crop.placements.map(p => toStr(p.clearDate)).filter(Boolean).sort()[0] ?? null;

    // Running cumulative total losses (mort + all culls types)
    let cumTotal = 0;

    const tableRows = rows.map((row) => {
      cumTotal += (row.mort || 0) + (row.culls || 0);

      const rowDateStr = new Date(row.date).toISOString().slice(0, 10);
      const diffDays = Math.floor(
        (new Date(row.date).getTime() - new Date(crop.placementDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const ageDays = diffDays < 0 ? 0 : diffDays;
      const targets = targetDayMap[ageDays] ?? { weightTargetG: null, feedTargetG: null, waterTargetMl: null, temperatureTargetC: null };

      // Live birds = placed − cumulative total losses − thin after thin date
      let birds = birdsPlaced - cumTotal;
      if (clearDateStr !== null && rowDateStr >= clearDateStr) {
        birds = 0;
      } else {
        if (thinDateStr  !== null && rowDateStr > thinDateStr)  birds -= thinBirdsCount;
        if (thin2DateStr !== null && rowDateStr > thin2DateStr) birds -= thin2BirdsCount;
      }
      birds = Math.max(0, birds);

      // weight % = avgWeightG / weightTargetG * 100  (use stored weightPercent if available)
      const weightPct = row.weightPercent !== null ? row.weightPercent
        : (row.avgWeightG !== null && targets.weightTargetG) ? Math.round(row.avgWeightG / targets.weightTargetG * 100) : null;

      return {
        ...row,
        ageDays,
        totalMort: cumTotal,
        weightPct,
        weightTargetG: targets.weightTargetG,
        waterTargetMl: targets.waterTargetMl,
        feedTargetG: targets.feedTargetG,
        temperatureTargetC: targets.temperatureTargetC,
        waterPer1000: birds > 0 ? Math.round(row.waterL / birds * 1000 * 10) / 10 : null,
        feedPer1000:  birds > 0 ? Math.round(row.feedKg  / birds * 1000 * 100) / 100 : null,
      };
    });

    const finalRows = tableRows.map((row, i) => {
  const nextRawWeight = i < rows.length - 1 ? rows[i + 1].avgWeightG : null;
  const displayWeight = i === 0 ? 44 : nextRawWeight;
  const tgt = targetDayMap[row.ageDays];
  const displayPct = displayWeight !== null && tgt?.weightTargetG
    ? Math.round(displayWeight / tgt.weightTargetG * 100)
    : null;
  return { ...row, avgWeightG: displayWeight, weightPct: displayPct };
});

    const toDateStr = (d: Date | null) => d ? new Date(d).toISOString().slice(0, 10) : null;

    const thinDates = Array.from(new Set(
      crop.placements.map(p => toDateStr(p.thinDate)).filter(Boolean)
    )) as string[];
    const thin2Dates = Array.from(new Set(
      crop.placements.map(p => toDateStr(p.thin2Date)).filter(Boolean)
    )) as string[];
    const clearDates = Array.from(new Set(
      crop.placements.map(p => toDateStr(p.clearDate)).filter(Boolean)
    )) as string[];

    return NextResponse.json({
      house: {
        id: house.id,
        name: house.name,
        code: house.code,
        farmId: house.farm.id,
        farmName: house.farm.name,
      },
      crop: {
        id: crop.id,
        cropNumber: crop.cropNumber,
        placementDate: crop.placementDate,
      },
      thinDates,
      thin2Dates,
      clearDates,
      rows: finalRows,
    });
  } catch (error) {
    console.error("HOUSE TABLE DATA ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading house table data." },
      { status: 500 }
    );
  }
}