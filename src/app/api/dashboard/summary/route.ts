import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
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
        };
      }

      houseMap[placement.houseId].birdsPlaced += placement.birdsPlaced;
    }

    for (const record of crop.daily) {
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
      crop: {
        id: crop.id,
        cropNumber: crop.cropNumber,
        placementDate: crop.placementDate,
        breed: crop.breed,
        hatchery: crop.hatchery,
        status: crop.status,
      },
      totals,
      houses,
    });
  } catch (error) {
    console.error("DASHBOARD SUMMARY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading dashboard summary." },
      { status: 500 }
    );
  }
}