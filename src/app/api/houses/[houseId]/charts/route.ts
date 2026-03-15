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
    const cropIdFromQuery = String(req.nextUrl.searchParams.get("cropId") || "").trim();

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

    let cropId = cropIdFromQuery;

    if (!cropId) {
      const activeCrop = await prisma.crop.findFirst({
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
        },
      });

      if (!activeCrop) {
        return NextResponse.json(
          { error: "No active crop found for this house." },
          { status: 404 }
        );
      }

      cropId = activeCrop.id;
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: {
          where: {
            houseId,
            isActive: true,
          },
          orderBy: {
            placementDate: "asc",
          },
        },
        targetProfile: {
          include: {
            days: {
              orderBy: { dayNumber: "asc" },
            },
          },
        },
      },
    });

    if (!crop || crop.farmId !== house.farmId) {
      return NextResponse.json(
        { error: "Crop not found for this farm." },
        { status: 404 }
      );
    }

    const daily = await prisma.dailyRecord.findMany({
      where: {
        cropId,
        houseId,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        id: true,
        date: true,
        birdsTotal: true,
        mort: true,
        culls: true,
        cullsSmall: true,
        cullsLeg: true,
        feedKg: true,
        waterL: true,
        avgWeightG: true,
        temperatureMinC: true,
        temperatureMaxC: true,
        humidityMinPct: true,
        humidityMaxPct: true,
        co2MinPpm: true,
        co2MaxPpm: true,
        notes: true,
      },
    });

    const birdsPlaced = crop.placements.reduce(
      (sum, placement) => sum + placement.birdsPlaced,
      0
    );

    const housePlacementDate =
      crop.placements.length > 0
        ? crop.placements[0].placementDate
        : crop.placementDate;

    const targetMap = new Map(
      (crop.targetProfile?.days || []).map((day) => [day.dayNumber, day])
    );

    let previousBirdsAlive = birdsPlaced;

    const actualByDay = new Map<
      number,
      {
        id: string;
        date: Date;
        dayNumber: number;
        birdsTotal: number;
        birdsAlivePreviousDay: number;
        birdsAliveCurrentDay: number;
        mort: number;
        culls: number;
        cullsSmall: number;
        cullsLeg: number;
        dailyLosses: number;
        dailyMortalityPct: number;
        feedKg: number;
        waterL: number;
        avgWeightG: number | null;
        weightPercent: number | null;
        temperatureMinC: number | null;
        temperatureMaxC: number | null;
        humidityMinPct: number | null;
        humidityMaxPct: number | null;
        co2MinPpm: number | null;
        co2MaxPpm: number | null;
        notes: string | null;
      }
    >();

    for (const d of daily) {
      const placementDate = new Date(housePlacementDate);
      const recordDate = new Date(d.date);

      // DAY 1 = placement date itself
      const dayNumber =
        Math.floor(
          (recordDate.getTime() - placementDate.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      const safeDayNumber = dayNumber < 1 ? 1 : dayNumber;

      const dailyLosses = d.mort + d.culls;

      const dailyMortalityPct =
        previousBirdsAlive > 0
          ? (dailyLosses / previousBirdsAlive) * 100
          : 0;

      const currentBirdsAlive = previousBirdsAlive - dailyLosses;
      const target = targetMap.get(safeDayNumber);

      const weightPercent =
        d.avgWeightG !== null &&
        target?.weightTargetG !== null &&
        target?.weightTargetG !== undefined &&
        target.weightTargetG > 0
          ? (d.avgWeightG / target.weightTargetG) * 100
          : null;

      actualByDay.set(safeDayNumber, {
        id: d.id,
        date: recordDate,
        dayNumber: safeDayNumber,
        birdsTotal: d.birdsTotal,
        birdsAlivePreviousDay: previousBirdsAlive,
        birdsAliveCurrentDay: currentBirdsAlive,
        mort: d.mort,
        culls: d.culls,
        cullsSmall: d.cullsSmall,
        cullsLeg: d.cullsLeg,
        dailyLosses,
        dailyMortalityPct,
        feedKg: d.feedKg,
        waterL: d.waterL,
        avgWeightG: d.avgWeightG,
        weightPercent,
        temperatureMinC: d.temperatureMinC,
        temperatureMaxC: d.temperatureMaxC,
        humidityMinPct: d.humidityMinPct,
        humidityMaxPct: d.humidityMaxPct,
        co2MinPpm: d.co2MinPpm,
        co2MaxPpm: d.co2MaxPpm,
        notes: d.notes,
      });

      previousBirdsAlive = currentBirdsAlive;
    }

    let carriedAlive = birdsPlaced;

    const chartData = Array.from({ length: 45 }, (_, index) => {
      const dayNumber = index + 1;
      const actual = actualByDay.get(dayNumber);
      const target = targetMap.get(dayNumber);

      if (actual) {
        carriedAlive = actual.birdsAliveCurrentDay;
      }

      const aliveForTarget = carriedAlive > 0 ? carriedAlive : 0;

      const scaledFeedTarget =
        target?.feedTargetG !== null && target?.feedTargetG !== undefined
          ? (target.feedTargetG * aliveForTarget) / 1000
          : null;

      const scaledWaterTarget =
        target?.waterTargetMl !== null && target?.waterTargetMl !== undefined
          ? (target.waterTargetMl * aliveForTarget) / 1000
          : null;

      const calculatedTemperatureTarget = Number(
        (32.5 - (dayNumber - 1) * 0.3).toFixed(2)
      );

      return {
        dayNumber,
        label: `Day ${dayNumber}`,
        date: actual?.date ?? null,
        birdsAliveCurrentDay: actual?.birdsAliveCurrentDay ?? aliveForTarget,
        dailyMortalityPct: actual?.dailyMortalityPct ?? null,
        feedKg: actual?.feedKg ?? null,
        waterL: actual?.waterL ?? null,
        weightPercent: actual?.weightPercent ?? null,
        temperatureMinC: actual?.temperatureMinC ?? null,
        temperatureMaxC: actual?.temperatureMaxC ?? null,
        humidityMinPct: actual?.humidityMinPct ?? null,
        humidityMaxPct: actual?.humidityMaxPct ?? null,
        co2MinPpm: actual?.co2MinPpm ?? null,
        co2MaxPpm: actual?.co2MaxPpm ?? null,
        feedTargetScaled: scaledFeedTarget,
        waterTargetScaled: scaledWaterTarget,
        weightTargetG: target?.weightTargetG ?? null,
        temperatureTargetC: calculatedTemperatureTarget,
        humidityTargetPct:
          target?.humidityTargetPct ??
          crop.targetProfile?.humidityTargetPct ??
          55,
        notes: actual?.notes ?? null,
      };
    });

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
      birdsPlaced,
      chartData,
    });
  } catch (error) {
    console.error("HOUSE CHART DATA ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading house chart data." },
      { status: 500 }
    );
  }
}