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

    // If the crop has no cloned target profile, fall back to the farm's global template
    let targetProfileDays = crop.targetProfile?.days ?? [];
    let profileHumidityDefault = crop.targetProfile?.humidityTargetPct ?? null;

    if (targetProfileDays.length === 0) {
      const farmTemplate = await prisma.targetProfile.findFirst({
        where: { farmId: house.farmId, scope: "GLOBAL_TEMPLATE" },
        include: { days: { orderBy: { dayNumber: "asc" } } },
        orderBy: { updatedAt: "desc" },
      });
      if (farmTemplate) {
        targetProfileDays = farmTemplate.days;
        profileHumidityDefault = farmTemplate.humidityTargetPct ?? null;
      }
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
      targetProfileDays.map((day) => [day.dayNumber, day])
    );

    // Build map: dayNumber → birds removed by thinning on that day (for chartData else branch)
    const thinEventsMap = new Map<number, number>();
    for (const p of crop.placements) {
      const addThin = (date: Date | null | undefined, birds: number | null | undefined) => {
        if (!date || !birds) return;
        const d = Math.floor(
          (new Date(date).getTime() - new Date(housePlacementDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (d >= 1) thinEventsMap.set(d, (thinEventsMap.get(d) || 0) + birds);
      };
      addThin(p.thinDate, p.thinBirds);
      addThin(p.thin2Date, p.thin2Birds);
    }

    // Helper: cumulative thinned birds up to and including a given date string (YYYY-MM-DD)
    const getCumulativeThinned = (recordDateStr: string): number => {
      let total = 0;
      for (const p of crop.placements) {
        if (p.thinBirds && p.thinDate) {
          if (new Date(p.thinDate).toISOString().slice(0, 10) <= recordDateStr) total += p.thinBirds;
        }
        if (p.thin2Birds && p.thin2Date) {
          if (new Date(p.thin2Date).toISOString().slice(0, 10) <= recordDateStr) total += p.thin2Birds;
        }
      }
      return total;
    };

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

      // DAY 1 = first day after placement
      const dayNumber = Math.floor(
        (recordDate.getTime() - placementDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const safeDayNumber = dayNumber < 1 ? 1 : dayNumber;

      const dailyLosses = d.mort + d.culls;

      const dailyMortalityPct =
        previousBirdsAlive > 0
          ? (dailyLosses / previousBirdsAlive) * 100
          : 0;

      const thinOnThisDay = thinEventsMap.get(safeDayNumber) || 0;
      const currentBirdsAlive = Math.max(0, previousBirdsAlive - dailyLosses - thinOnThisDay);
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
      } else {
        // No daily record but thin may have happened on this day
        const thinOnThisDay = thinEventsMap.get(dayNumber) || 0;
        if (thinOnThisDay > 0) carriedAlive = Math.max(0, carriedAlive - thinOnThisDay);
      }

      const calculatedTemperatureTarget = Number(
        (32.5 - (dayNumber - 1) * 0.3).toFixed(2)
      );

      // actual per-bird values — directly comparable to per-bird targets
      const birdsAlive = actual?.birdsAliveCurrentDay ?? carriedAlive;
      const feedPerBird =
        actual?.feedKg != null && birdsAlive > 0
          ? (actual.feedKg * 1000) / birdsAlive
          : null;
      const waterPerBird =
        actual?.waterL != null && birdsAlive > 0
          ? (actual.waterL * 1000) / birdsAlive
          : null;

      return {
        dayNumber,
        label: `Day ${dayNumber}`,
        date: actual?.date ?? null,
        birdsAliveCurrentDay: birdsAlive,
        dailyMortalityPct: actual?.dailyMortalityPct ?? null,
        feedPerBird,
        waterPerBird,
        weightPercent: actual?.weightPercent ?? null,
        temperatureMinC: actual?.temperatureMinC ?? null,
        temperatureMaxC: actual?.temperatureMaxC ?? null,
        humidityMinPct: actual?.humidityMinPct ?? null,
        humidityMaxPct: actual?.humidityMaxPct ?? null,
        co2MinPpm: actual?.co2MinPpm ?? null,
        co2MaxPpm: actual?.co2MaxPpm ?? null,
        feedTargetG: target?.feedTargetG ?? null,
        waterTargetMl: target?.waterTargetMl ?? null,
        weightTargetG: target?.weightTargetG ?? null,
        temperatureTargetC: calculatedTemperatureTarget,
        humidityTargetPct:
          target?.humidityTargetPct ??
          profileHumidityDefault ??
          55,
        notes: actual?.notes ?? null,
      };
    });

    const toDay = (date: Date | null) => {
      if (!date) return null;
      const diff = Math.floor(
        (new Date(date).getTime() - new Date(housePlacementDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return diff >= 1 ? diff : null;
    };

    const thinDays = Array.from(new Set(
      crop.placements.map(p => toDay(p.thinDate)).filter((d): d is number => d !== null)
    ));
    const thin2Days = Array.from(new Set(
      crop.placements.map(p => toDay(p.thin2Date)).filter((d): d is number => d !== null)
    ));
    const clearDays = Array.from(new Set(
      crop.placements.map(p => toDay(p.clearDate)).filter((d): d is number => d !== null)
    ));

    const thinBirdsTotal = crop.placements.reduce((s, p) => s + (p.thinBirds || 0), 0);
    const thin2BirdsTotal = crop.placements.reduce((s, p) => s + (p.thin2Birds || 0), 0);

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
      thinBirdsTotal,
      thin2BirdsTotal,
      thinDays,
      thin2Days,
      clearDays,
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