import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate, canView } from "@/lib/permissions";
import { ensureFarmDefaultTargetTemplate } from "@/lib/target-profile-template";

type TargetDayInput = {
  dayNumber: number;
  weightTargetG?: number | null;
  feedTargetG?: number | null;
  waterTargetMl?: number | null;
  temperatureTargetC?: number | null;
  humidityTargetPct?: number | null;
  co2TargetPpm?: number | null;
};

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

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const farmId = String(req.nextUrl.searchParams.get("farmId") || "").trim();
    if (!farmId) {
      return NextResponse.json({ error: "farmId is required." }, { status: 400 });
    }

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view target settings." },
        { status: 403 }
      );
    }

    const template = await ensureFarmDefaultTargetTemplate(prisma, farmId);

    return NextResponse.json(template);
  } catch (error) {
    console.error("GET TARGET TEMPLATE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading target template." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const name = String(body.name || "Ross 211 Default Template").trim();
    const source = String(body.source || "ROSS_211").trim();
    const humidityTargetPct = parseOptionalFloat(body.humidityTargetPct) ?? 55;
    const co2TargetPpm = parseOptionalInt(body.co2TargetPpm) ?? 3000;
    const days = Array.isArray(body.days) ? (body.days as TargetDayInput[]) : [];

    if (!farmId) {
      return NextResponse.json({ error: "farmId is required." }, { status: 400 });
    }

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canOperate(role)) {
      return NextResponse.json(
        { error: "You do not have permission to update target settings." },
        { status: 403 }
      );
    }

    if (!days.length) {
      return NextResponse.json(
        { error: "At least one target day is required." },
        { status: 400 }
      );
    }

    const template = await ensureFarmDefaultTargetTemplate(prisma, farmId);

    const normalizedDays = days
      .map((day) => ({
        dayNumber: Number(day.dayNumber),
        weightTargetG: parseOptionalFloat(day.weightTargetG),
        feedTargetG: parseOptionalFloat(day.feedTargetG),
        waterTargetMl: parseOptionalFloat(day.waterTargetMl),
        temperatureTargetC: parseOptionalFloat(day.temperatureTargetC),
        humidityTargetPct:
          parseOptionalFloat(day.humidityTargetPct) ?? humidityTargetPct,
        co2TargetPpm: parseOptionalInt(day.co2TargetPpm) ?? co2TargetPpm,
      }))
      .filter((day) => Number.isFinite(day.dayNumber) && day.dayNumber > 0)
      .sort((a, b) => a.dayNumber - b.dayNumber);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.targetProfileDay.deleteMany({
        where: { profileId: template.id },
      });

      return tx.targetProfile.update({
        where: { id: template.id },
        data: {
          name,
          source,
          humidityTargetPct,
          co2TargetPpm,
          isDefault: true,
          days: {
            create: normalizedDays.map((day) => ({
              dayNumber: day.dayNumber,
              weightTargetG: day.weightTargetG,
              feedTargetG: day.feedTargetG,
              waterTargetMl: day.waterTargetMl,
              temperatureTargetC: day.temperatureTargetC,
              humidityTargetPct: day.humidityTargetPct,
              co2TargetPpm: day.co2TargetPpm,
            })),
          },
        },
        include: {
          days: {
            orderBy: { dayNumber: "asc" },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE TARGET TEMPLATE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while updating target template." },
      { status: 500 }
    );
  }
}