import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    const houses = await prisma.house.findMany({
      where: { farmId },
      orderBy: [{ name: "asc" }],
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