import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getMaxDayForStage(stage: string) {
  switch (stage) {
    case "DAY_3":
      return 3;
    case "DAY_7":
      return 7;
    case "DAY_14":
      return 14;
    case "DAY_21":
      return 21;
    case "DAY_26":
      return 26;
    case "DAY_28":
      return 28;
    case "THIN_35":
      return 35;
    case "TOTAL_CLEAR":
      return 9999;
    default:
      return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();
    const stage = String(url.searchParams.get("stage") || "").trim();

    if (!cropId || !stage) {
      return NextResponse.json(
        { error: "cropId and stage are required." },
        { status: 400 }
      );
    }

    const maxDay = getMaxDayForStage(stage);
    if (maxDay === null) {
      return NextResponse.json(
        { error: "Invalid stage." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: true,
        placements: {
          include: {
            house: true,
          },
        },
        daily: {
          include: {
            house: true,
          },
          orderBy: [{ houseId: "asc" }, { date: "asc" }],
        },
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    const placementDate = new Date(crop.placementDate);

    const filteredDaily = crop.daily.filter((record) => {
      const recordDate = new Date(record.date);
      const ageDays =
        Math.floor(
          (recordDate.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      return ageDays <= maxDay;
    });

    const houseMap: Record<
      string,
      {
        houseId: string;
        houseName: string;
        birdsPlaced: number;
        mort: number;
        culls: number;
        totalLosses: number;
        birdsAlive: number;
        mortalityPct: number;
        feedKg: number;
        waterL: number;
        firstPlacementDate: Date | null;
        hatcheries: string[];
        flockNumbers: string[];
      }
    > = {};

    for (const placement of crop.placements) {
      if (!houseMap[placement.houseId]) {
        houseMap[placement.houseId] = {
          houseId: placement.houseId,
          houseName: placement.house.name,
          birdsPlaced: 0,
          mort: 0,
          culls: 0,
          totalLosses: 0,
          birdsAlive: 0,
          mortalityPct: 0,
          feedKg: 0,
          waterL: 0,
          firstPlacementDate: null,
          hatcheries: [],
          flockNumbers: [],
        };
      }

      const item = houseMap[placement.houseId];
      item.birdsPlaced += placement.birdsPlaced;

      if (!item.firstPlacementDate || new Date(placement.placementDate) < item.firstPlacementDate) {
        item.firstPlacementDate = new Date(placement.placementDate);
      }

      if (placement.hatchery && !item.hatcheries.includes(placement.hatchery)) {
        item.hatcheries.push(placement.hatchery);
      }

      if (placement.flockNumber && !item.flockNumbers.includes(placement.flockNumber)) {
        item.flockNumbers.push(placement.flockNumber);
      }
    }

    for (const record of filteredDaily) {
      const item = houseMap[record.houseId];
      if (!item) continue;

      item.mort += record.mort;
      item.culls += record.culls;
      item.feedKg += record.feedKg;
      item.waterL += record.waterL;
    }

    for (const key of Object.keys(houseMap)) {
      const item = houseMap[key];
      item.totalLosses = item.mort + item.culls;
      item.birdsAlive = item.birdsPlaced - item.totalLosses;
      item.mortalityPct =
        item.birdsPlaced > 0 ? (item.totalLosses / item.birdsPlaced) * 100 : 0;
    }

    const houses = Object.values(houseMap);

    const totals = {
      birdsPlaced: houses.reduce((sum, h) => sum + h.birdsPlaced, 0),
      mort: houses.reduce((sum, h) => sum + h.mort, 0),
      culls: houses.reduce((sum, h) => sum + h.culls, 0),
      totalLosses: houses.reduce((sum, h) => sum + h.totalLosses, 0),
      birdsAlive: houses.reduce((sum, h) => sum + h.birdsAlive, 0),
      feedKg: houses.reduce((sum, h) => sum + h.feedKg, 0),
      waterL: houses.reduce((sum, h) => sum + h.waterL, 0),
      mortalityPct: 0,
    };

    totals.mortalityPct =
      totals.birdsPlaced > 0 ? (totals.totalLosses / totals.birdsPlaced) * 100 : 0;

    return NextResponse.json({
      farm: {
        id: crop.farm.id,
        name: crop.farm.name,
        code: crop.farm.code,
      },
      crop: {
        id: crop.id,
        cropNumber: crop.cropNumber,
        placementDate: crop.placementDate,
        breed: crop.breed,
        hatchery: crop.hatchery,
        status: crop.status,
      },
      stage,
      maxDay,
      totals,
      houses: houses.map((h) => ({
        ...h,
        firstPlacementDate: h.firstPlacementDate,
        hatcheries: h.hatcheries.join(", "),
        flockNumbers: h.flockNumbers.join(", "),
      })),
    });
  } catch (error) {
    console.error("AVARA REPORT ERROR:", error);
    return NextResponse.json(
      { error: "Server error while generating Avara report preview." },
      { status: 500 }
    );
  }
}