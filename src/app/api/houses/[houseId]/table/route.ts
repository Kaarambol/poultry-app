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
        temperatureMinC: true,
        temperatureMaxC: true,
        humidityMinPct: true,
        humidityMaxPct: true,
        co2MinPpm: true,
        co2MaxPpm: true,
        notes: true,
      },
    });

    const tableRows = rows.map((row) => {
      const diffDays = Math.floor(
        (new Date(row.date).getTime() - new Date(crop.placementDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return {
        ...row,
        ageDays: diffDays < 0 ? 0 : diffDays,
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
      rows: tableRows,
    });
  } catch (error) {
    console.error("HOUSE TABLE DATA ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading house table data." },
      { status: 500 }
    );
  }
}