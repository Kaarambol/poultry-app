import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const farmId = String(body.farmId || "").trim();
    const name = String(body.name || "").trim();
    const floorAreaM2 = Number(body.floorAreaM2);

    if (!farmId || !name || !floorAreaM2 || floorAreaM2 <= 0) {
      return NextResponse.json(
        { error: "farmId, house name and floor area are required." },
        { status: 400 }
      );
    }

    const house = await prisma.house.create({
      data: {
        farmId,
        name,
        floorAreaM2,
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