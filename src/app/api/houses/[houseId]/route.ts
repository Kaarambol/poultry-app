import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ houseId: string }> }
) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { houseId } = await params;

    const house = await prisma.house.findUnique({
      where: { id: houseId },
      select: { id: true, farmId: true, code: true },
    });
    if (!house) return NextResponse.json({ error: "House not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, house.farmId);
    if (!canOperate(role)) {
      return NextResponse.json({ error: "No permission to edit house." }, { status: 403 });
    }

    const body = await req.json();

    const name = String(body.name || "").trim();
    const codeRaw = String(body.code || "").trim();
    const floorAreaM2 = Number(body.floorAreaM2);

    if (!name || !Number.isFinite(floorAreaM2) || floorAreaM2 <= 0) {
      return NextResponse.json({ error: "House name and floor area are required." }, { status: 400 });
    }

    const code = codeRaw || house.code || null;

    // Check code uniqueness if changed
    if (code && code !== house.code) {
      const existing = await prisma.house.findFirst({
        where: { farmId: house.farmId, code, id: { not: houseId } },
      });
      if (existing) {
        return NextResponse.json({ error: "This house code already exists for the farm." }, { status: 409 });
      }
    }

    const updated = await prisma.house.update({
      where: { id: houseId },
      data: {
        name,
        code,
        floorAreaM2,
        usableAreaM2: parseOptionalFloat(body.usableAreaM2),
        defaultCapacityBirds: parseOptionalInt(body.defaultCapacityBirds) ?? 0,
        defaultDrinkerLineCount: parseOptionalInt(body.defaultDrinkerLineCount) ?? 0,
        defaultNippleCount: parseOptionalInt(body.defaultNippleCount) ?? 0,
        defaultFeederPanCount: parseOptionalInt(body.defaultFeederPanCount) ?? 0,
        defaultFanCount: parseOptionalInt(body.defaultFanCount) ?? 0,
        defaultHeaterCount: parseOptionalInt(body.defaultHeaterCount) ?? 0,
        defaultMinTempC: parseOptionalFloat(body.defaultMinTempC),
        defaultMaxTempC: parseOptionalFloat(body.defaultMaxTempC),
        defaultTargetHumidityPct: parseOptionalFloat(body.defaultTargetHumidityPct),
        defaultMaxCo2Ppm: parseOptionalInt(body.defaultMaxCo2Ppm),
        defaultMaxAmmoniaPpm: parseOptionalFloat(body.defaultMaxAmmoniaPpm),
        notes: String(body.notes || "").trim() || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE HOUSE ERROR:", error);
    return NextResponse.json({ error: "Server error while updating house." }, { status: 500 });
  }
}
