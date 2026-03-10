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

    const records = await prisma.feedRecord.findMany({
      where: { cropId },
      include: {
        house: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("LIST FEED RECORDS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading feed records." },
      { status: 500 }
    );
  }
}