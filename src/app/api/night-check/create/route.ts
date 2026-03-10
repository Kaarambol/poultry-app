import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseBoolean(value: unknown) {
  return value === true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const cropId = String(body.cropId || "").trim();
    const houseId = String(body.houseId || "").trim();
    const date = String(body.date || "").trim();
    const checkTime = String(body.checkTime || "").trim();
    const checkedByName = String(body.checkedByName || "").trim();

    const temperatureMinC = parseOptionalFloat(body.temperatureMinC);
    const temperatureMaxC = parseOptionalFloat(body.temperatureMaxC);
    const humidityPct = parseOptionalFloat(body.humidityPct);
    const co2Ppm = parseOptionalInt(body.co2Ppm);
    const ammoniaPpm = parseOptionalFloat(body.ammoniaPpm);

    const litterScore = parseOptionalInt(body.litterScore);
    const wetAreas = parseBoolean(body.wetAreas);
    const capping = parseBoolean(body.capping);
    const litterNotes = String(body.litterNotes || "").trim();

    const waterSystemOk = parseBoolean(body.waterSystemOk);
    const feedSystemOk = parseBoolean(body.feedSystemOk);
    const ventilationOk = parseBoolean(body.ventilationOk);
    const alarmOk = parseBoolean(body.alarmOk);
    const generatorOk = parseBoolean(body.generatorOk);
    const lightingOk = parseBoolean(body.lightingOk);

    const birdsOk = parseBoolean(body.birdsOk);
    const cropFillOk = parseBoolean(body.cropFillOk);
    const unusualBehaviour = parseBoolean(body.unusualBehaviour);
    const comments = String(body.comments || "").trim();

    if (!farmId || !cropId || !houseId || !date) {
      return NextResponse.json(
        { error: "farmId, cropId, houseId and date are required." },
        { status: 400 }
      );
    }

    if (litterScore !== null && (litterScore < 1 || litterScore > 6)) {
      return NextResponse.json(
        { error: "Litter score must be between 1 and 6." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
    });

    if (!crop || crop.farmId !== farmId) {
      return NextResponse.json(
        { error: "Selected crop does not belong to selected farm." },
        { status: 400 }
      );
    }

    const house = await prisma.house.findUnique({
      where: { id: houseId },
    });

    if (!house || house.farmId !== farmId) {
      return NextResponse.json(
        { error: "Selected house does not belong to selected farm." },
        { status: 400 }
      );
    }

    const record = await prisma.nightCheck.upsert({
      where: {
        cropId_houseId_date: {
          cropId,
          houseId,
          date: new Date(date),
        },
      },
      update: {
        checkTime: checkTime || null,
        checkedByName: checkedByName || null,
        temperatureMinC,
        temperatureMaxC,
        humidityPct,
        co2Ppm,
        ammoniaPpm,
        litterScore,
        wetAreas,
        capping,
        litterNotes: litterNotes || null,
        waterSystemOk,
        feedSystemOk,
        ventilationOk,
        alarmOk,
        generatorOk,
        lightingOk,
        birdsOk,
        cropFillOk,
        unusualBehaviour,
        comments: comments || null,
      },
      create: {
        farmId,
        cropId,
        houseId,
        date: new Date(date),
        checkTime: checkTime || null,
        checkedByName: checkedByName || null,
        temperatureMinC,
        temperatureMaxC,
        humidityPct,
        co2Ppm,
        ammoniaPpm,
        litterScore,
        wetAreas,
        capping,
        litterNotes: litterNotes || null,
        waterSystemOk,
        feedSystemOk,
        ventilationOk,
        alarmOk,
        generatorOk,
        lightingOk,
        birdsOk,
        cropFillOk,
        unusualBehaviour,
        comments: comments || null,
      },
      include: {
        house: true,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("CREATE NIGHT CHECK ERROR:", error);
    return NextResponse.json(
      { error: "Server error while saving night check." },
      { status: 500 }
    );
  }
}