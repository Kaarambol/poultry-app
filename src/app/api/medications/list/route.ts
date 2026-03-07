import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const records = await prisma.medicationRecord.findMany({
      where: { cropId },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("LIST MEDICATIONS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading medication records." },
      { status: 500 }
    );
  }
}