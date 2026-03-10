import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const where: {
      cropId: string;
      date?: Date;
    } = { cropId };

    if (date) {
      where.date = new Date(date);
    }

    const records = await prisma.nightCheck.findMany({
      where,
      include: {
        house: true,
      },
      orderBy: [{ date: "desc" }, { house: { name: "asc" } }],
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("LIST NIGHT CHECK ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading night checks." },
      { status: 500 }
    );
  }
}