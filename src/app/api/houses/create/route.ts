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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const name = String(body.name || "").trim();
    const codeRaw = String(body.code || "").trim();
    const floorAreaM2 = Number(body.floorAreaM2);

    const usableAreaM2 = parseOptionalFloat(body.usableAreaM2);
    const defaultCapacityBirds = parseOptionalInt(body.defaultCapacityBirds) ?? 0;
    const defaultDrinkerLineCount =
      parseOptionalInt(body.defaultDrinkerLineCount) ?? 0;
    const defaultNippleCount = parseOptionalInt(body.defaultNippleCount) ?? 0;
    const defaultFeederPanCount =
      parseOptionalInt(body.defaultFeederPanCount) ?? 0;
    const defaultFanCount = parseOptionalInt(body.defaultFanCount) ?? 0;
    const defaultHeaterCount = parseOptionalInt(body.defaultHeaterCount) ?? 0;
    const defaultMinTempC = parseOptionalFloat(body.defaultMinTempC);
    const defaultMaxTempC = parseOptionalFloat(body.defaultMaxTempC);
    const defaultTargetHumidityPct = parseOptionalFloat(
      body.defaultTargetHumidityPct
    );
    const defaultMaxCo2Ppm = parseOptionalInt(body.defaultMaxCo2Ppm);
    const defaultMaxAmmoniaPpm = parseOptionalFloat(body.defaultMaxAmmoniaPpm);
    const notes = String(body.notes || "").trim() || null;

    if (!farmId || !name || !Number.isFinite(floorAreaM2) || floorAreaM2 <= 0) {
      return NextResponse.json(
        { error: "farmId, house name and floor area are required." },
        { status: 400 }
      );
    }

    if (
      usableAreaM2 !== null &&
      (!Number.isFinite(usableAreaM2) || usableAreaM2 <= 0)
    ) {
      return NextResponse.json(
        { error: "usableAreaM2 must be greater than zero when provided." },
        { status: 400 }
      );
    }

    if (
      defaultCapacityBirds < 0 ||
      defaultDrinkerLineCount < 0 ||
      defaultNippleCount < 0 ||
      defaultFeederPanCount < 0 ||
      defaultFanCount < 0 ||
      defaultHeaterCount < 0
    ) {
      return NextResponse.json(
        { error: "Numeric equipment values cannot be negative." },
        { status: 400 }
      );
    }

    const code =
      codeRaw ||
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30) ||
      null;

    if (code) {
      const existingCode = await prisma.house.findFirst({
        where: {
          farmId,
          code,
        },
      });

      if (existingCode) {
        return NextResponse.json(
          { error: "This house code already exists for the selected farm." },
          { status: 409 }
        );
      }
    }

    const house = await prisma.house.create({
      data: {
        farmId,
        name,
        code,
        floorAreaM2,
        usableAreaM2,
        defaultCapacityBirds,
        defaultDrinkerLineCount,
        defaultNippleCount,
        defaultFeederPanCount,
        defaultFanCount,
        defaultHeaterCount,
        defaultMinTempC,
        defaultMaxTempC,
        defaultTargetHumidityPct,
        defaultMaxCo2Ppm,
        defaultMaxAmmoniaPpm,
        notes,
      },
    });

    return NextResponse.json(house);
  } catch (error) {
    console.error("CREATE HOUSE ERROR:", error);
    return NextResponse.json(
      { error: "Server error while creating house." },
      { status: 500 }
    );
  }
}