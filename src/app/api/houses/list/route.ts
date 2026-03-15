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

    const farmId = String(req.nextUrl.searchParams.get("farmId") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);

    if (!canView(role)) {
      return NextResponse.json(
        { error: "You do not have permission to view houses." },
        { status: 403 }
      );
    }

    const houses = await prisma.house.findMany({
      where: {
        farmId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
        floorAreaM2: true,
        usableAreaM2: true,
        defaultCapacityBirds: true,
        defaultDrinkerLineCount: true,
        defaultNippleCount: true,
        defaultFeederPanCount: true,
        defaultFanCount: true,
        defaultHeaterCount: true,
        defaultMinTempC: true,
        defaultMaxTempC: true,
        defaultTargetHumidityPct: true,
        defaultMaxCo2Ppm: true,
        defaultMaxAmmoniaPpm: true,
        notes: true,
      },
    });

    return NextResponse.json(houses);
  } catch (error) {
    console.error("LIST HOUSES ERROR:", error);

    return NextResponse.json(
      { error: "Server error while loading houses." },
      { status: 500 }
    );
  }
}