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

    const exportsList = await prisma.avaraExport.findMany({
      where: { cropId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(exportsList);
  } catch (error) {
    console.error("AVARA HISTORY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading export history." },
      { status: 500 }
    );
  }
}