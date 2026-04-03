import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const cropId = String(req.nextUrl.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      select: {
        id: true,
        farmId: true,
        cropNumber: true,
        placementDate: true,
        breed: true,
        hatchery: true,
        status: true,
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view dashboard data." },
        { status: 403 }
      );
    }

    const placements = await prisma.cropHousePlacement.findMany({
      where: {
        cropId,
      },
      include: {
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { houseId: "asc" },
        { batchNo: "asc" },
        { placementDate: "asc" },
      ],
    });

    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        cropId,
      },
      include: {
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { houseId: "asc" },
        { date: "asc" },
      ],
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
        lastLitterScore: number | null;
        lastAmmoniaPpm: number | null;
      }
    > = {};

    for (const placement of placements) {
      if (!houseMap[placement.houseId]) {
        houseMap[placement.houseId] = {
          houseId: placement.houseId,
          houseName: placement.house?.name || "Unknown house",
          birdsPlaced: 0,
          mort: 0,
          culls: 0,
          totalLosses: 0,
          birdsAlive: 0,
          mortalityPct: 0,
          feedKg: 0,
          waterL: 0,
          lastLitterScore: null,
          lastAmmoniaPpm: null,
        };
      }

      houseMap[placement.houseId].birdsPlaced += placement.birdsPlaced;
    }

    for (const record of dailyRecords) {
      if (!houseMap[record.houseId]) {
        houseMap[record.houseId] = {
          houseId: record.houseId,
          houseName: record.house?.name || "Unknown house",
          birdsPlaced: 0,
          mort: 0,
          culls: 0,
          totalLosses: 0,
          birdsAlive: 0,
          mortalityPct: 0,
          feedKg: 0,
          waterL: 0,
          lastLitterScore: null,
          lastAmmoniaPpm: null,
        };
      }

      const item = houseMap[record.houseId];
      item.mort += record.mort;
      item.culls += record.culls;
      item.feedKg += record.feedKg;
      item.waterL += record.waterL;
      if (record.litterScore !== null) item.lastLitterScore = record.litterScore;
      if (record.ammoniaPpm !== null) item.lastAmmoniaPpm = record.ammoniaPpm;
    }

    for (const key of Object.keys(houseMap)) {
      const item = houseMap[key];
      item.totalLosses = item.mort + item.culls;
      item.birdsAlive = item.birdsPlaced - item.totalLosses;
      item.mortalityPct =
        item.birdsPlaced > 0 ? (item.totalLosses / item.birdsPlaced) * 100 : 0;
    }

    const houses = Object.values(houseMap).sort((a, b) =>
      a.houseName.localeCompare(b.houseName)
    );

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
      totals.birdsPlaced > 0
        ? (totals.totalLosses / totals.birdsPlaced) * 100
        : 0;

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