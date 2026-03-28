import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
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
      },
    });

    if (!crop) {
      return NextResponse.json({ error: "Crop not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, crop.farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view night checks." },
        { status: 403 }
      );
    }

    const records = await prisma.nightCheck.findMany({
      where: {
        cropId,
      },
      orderBy: [{ houseId: "asc" }, { date: "desc" }],
      include: {
        house: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return NextResponse.json(
      records.map((record) => ({
        id: record.id,
        date: record.date,
        checkTime: record.checkTime,
        checkedByName: record.checkedByName,
        humidityPct: record.humidityPct,
        co2Ppm: record.co2Ppm,
        ammoniaPpm: record.ammoniaPpm,
        humidityOk: record.humidityOk,
        co2Ok: record.co2Ok,
        ammoniaOk: record.ammoniaOk,
        litterScore: record.litterScore,
        litterOk: record.litterOk,
        wetAreas: record.wetAreas,
        capping: record.capping,
        litterNotes: record.litterNotes,

        waterSystemOk: record.waterSystemOk,
        feedSystemOk: record.feedSystemOk,
        ventilationOk: record.ventilationOk,
        alarmOk: record.alarmOk,
        generatorOk: record.generatorOk,
        lightingOk: record.lightingOk,

        birdsOk: record.birdsOk,
        cropFillOk: record.cropFillOk,
        unusualBehaviour: record.unusualBehaviour,

        windowsOpen: record.windowsOpen,
        fridgeTemp: record.fridgeTemp,
        litterSampleTaken: record.litterSampleTaken,

        fireExtinguisher: record.fireExtinguisher,
        footDipChange: record.footDipChange,
        dosatronCheck: record.dosatronCheck,
        vitaminAdd: record.vitaminAdd,
        vaccination: record.vaccination,
        medication: record.medication,
        pestControlInspection: record.pestControlInspection,
        waterSanitizer: record.waterSanitizer,

        calibrationWaterMeter: record.calibrationWaterMeter,
        calibrationTempProbe: record.calibrationTempProbe,
        calibrationHumidityProbe: record.calibrationHumidityProbe,
        calibrationWeigher: record.calibrationWeigher,

        comments: record.comments,
        house: record.house,
      }))
    );
  } catch (error) {
    console.error("LIST NIGHT CHECKS ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading night checks." },
      { status: 500 }
    );
  }
}