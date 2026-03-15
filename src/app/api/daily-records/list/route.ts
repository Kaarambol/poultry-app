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
        placementDate: true,
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
        { error: "You do not have permission to view daily records." },
        { status: 403 }
      );
    }

    const records = await prisma.dailyRecord.findMany({
      where: {
        cropId,
      },
      orderBy: [
        { houseId: "asc" },
        { date: "asc" },
      ],
      include: {
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      records.map((record) => ({
        id: record.id,
        date: record.date,
        birdsTotal: record.birdsTotal,
        mort: record.mort,
        culls: record.culls,
        cullsSmall: record.cullsSmall,
        cullsLeg: record.cullsLeg,
        feedKg: record.feedKg,
        waterL: record.waterL,
        avgWeightG: record.avgWeightG,
        weightPercent: record.weightPercent,
        temperatureMinC: record.temperatureMinC,
        temperatureMaxC: record.temperatureMaxC,
        humidityMinPct: record.humidityMinPct,
        humidityMaxPct: record.humidityMaxPct,
        co2MinPpm: record.co2MinPpm,
        co2MaxPpm: record.co2MaxPpm,
        notes: record.notes,
        houseId: record.houseId,
        house: record.house,
        crop: {
          placementDate: crop.placementDate,
        },
      }))
    );
  } catch (error) {
    console.error("LIST DAILY RECORDS ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading daily records." },
      { status: 500 }
    );
  }
}