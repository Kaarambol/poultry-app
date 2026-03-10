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

    const documents = await prisma.farmDocument.findMany({
      where: { farmId },
      orderBy: [
        { expiryDate: "asc" },
        { nextReviewDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("LIST FARM DOCUMENTS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading farm documents." },
      { status: 500 }
    );
  }
}