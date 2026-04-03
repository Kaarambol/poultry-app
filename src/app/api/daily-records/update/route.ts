import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";
import { writeChangeLog } from "@/lib/change-log";

function parseOptionalFloat(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInt(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "Not logged in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Record id is required." },
        { status: 400 }
      );
    }

    const baseRecord = await prisma.dailyRecord.findUnique({
      where: { id },
      include: {
        crop: true,
        house: true,
      },
    });

    if (!baseRecord) {
      return NextResponse.json(
        { error: "Daily record not found." },
        { status: 404 }
      );
    }

    const role = await getUserRoleOnFarm(uid, baseRecord.crop.farmId);

    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to modify data." },
        { status: 403 }
      );
    }

    if (baseRecord.crop.status === "FINISHED") {
      return NextResponse.json(
        { error: "Cannot update daily records in a finished crop." },
        { status: 409 }
      );
    }

    const mort = Number(body.mort || 0);
    const cullsSmall = Number(body.cullsSmall || 0);
    const cullsLeg = Number(body.cullsLeg || 0);
    const culls = cullsSmall + cullsLeg;
    const feedKg = Number(body.feedKg || 0);
    const waterL = Number(body.waterL || 0);

    const avgWeightG = parseOptionalFloat(body.avgWeightG);
    const weightPercent = parseOptionalFloat(body.weightPercent);
    const temperatureMinC = parseOptionalFloat(body.temperatureMinC);
    const temperatureMaxC = parseOptionalFloat(body.temperatureMaxC);
    const humidityMinPct = parseOptionalFloat(body.humidityMinPct);
    const humidityMaxPct = parseOptionalFloat(body.humidityMaxPct);
    const co2MinPpm = parseOptionalInt(body.co2MinPpm);
    const co2MaxPpm = parseOptionalInt(body.co2MaxPpm);

    const litterScore = parseOptionalInt(body.litterScore);
    const ammoniaPpm = parseOptionalFloat(body.ammoniaPpm);

    const notes = String(body.notes || "").trim();

    if (
      mort < 0 ||
      cullsSmall < 0 ||
      cullsLeg < 0 ||
      feedKg < 0 ||
      waterL < 0 ||
      (avgWeightG !== null && avgWeightG < 0) ||
      (weightPercent !== null && weightPercent < 0) ||
      (temperatureMinC !== null && temperatureMinC < 0) ||
      (temperatureMaxC !== null && temperatureMaxC < 0) ||
      (humidityMinPct !== null && humidityMinPct < 0) ||
      (humidityMaxPct !== null && humidityMaxPct < 0) ||
      (co2MinPpm !== null && co2MinPpm < 0) ||
      (co2MaxPpm !== null && co2MaxPpm < 0)
    ) {
      return NextResponse.json(
        { error: "Values cannot be negative." },
        { status: 400 }
      );
    }

    if (
      temperatureMinC !== null &&
      temperatureMaxC !== null &&
      temperatureMinC > temperatureMaxC
    ) {
      return NextResponse.json(
        { error: "Temperature min cannot be greater than temperature max." },
        { status: 400 }
      );
    }

    if (
      humidityMinPct !== null &&
      humidityMaxPct !== null &&
      humidityMinPct > humidityMaxPct
    ) {
      return NextResponse.json(
        { error: "Humidity min cannot be greater than humidity max." },
        { status: 400 }
      );
    }

    if (
      co2MinPpm !== null &&
      co2MaxPpm !== null &&
      co2MinPpm > co2MaxPpm
    ) {
      return NextResponse.json(
        { error: "CO2 min cannot be greater than CO2 max." },
        { status: 400 }
      );
    }

    const cropWithPlacements = await prisma.crop.findUnique({
      where: { id: baseRecord.cropId },
      include: {
        placements: {
          where: {
            houseId: baseRecord.houseId,
            isActive: true,
          },
        },
      },
    });

    const birdsTotal =
      cropWithPlacements?.placements.reduce(
        (sum, placement) => sum + placement.birdsPlaced,
        0
      ) ?? baseRecord.birdsTotal ?? 0;

    const updated = await prisma.dailyRecord.update({
      where: { id },
      data: {
        birdsTotal,
        mort,
        cullsSmall,
        cullsLeg,
        culls,
        feedKg,
        waterL,
        avgWeightG,
        weightPercent,
        temperatureMinC,
        temperatureMaxC,
        humidityMinPct,
        humidityMaxPct,
        co2MinPpm,
        co2MaxPpm,
        litterScore,
        ammoniaPpm,
        notes: notes || null,
      },
      include: {
        house: true,
      },
    });

    await writeChangeLog({
      farmId: baseRecord.crop.farmId,
      userId: uid,
      action: "UPDATE_DAILY",
      description: `Updated daily record for ${updated.house.name} on ${new Date(updated.date).toLocaleDateString()}.`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE DAILY RECORD ERROR:", error);

    return NextResponse.json(
      { error: "Server error while updating daily record." },
      { status: 500 }
    );
  }
}