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

    const crops = await prisma.crop.findMany({
      where: { farmId },
      orderBy: { placementDate: "desc" },
    });

    return NextResponse.json(crops);
  } catch (error) {
    console.error("LIST CROPS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading crops." },
      { status: 500 }
    );
  }
}