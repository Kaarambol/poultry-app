import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();
    const q = String(url.searchParams.get("q") || "").trim();

    if (!farmId) {
      return NextResponse.json(
        { error: "farmId is required." },
        { status: 400 }
      );
    }

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Search query must have at least 2 characters." },
        { status: 400 }
      );
    }

    // Split query into individual words so "water cert" finds "Water Analysis Certificate"
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    const wordConditions = words.flatMap(word => [
      { title: { contains: word, mode: "insensitive" as const } },
      { documentType: { contains: word, mode: "insensitive" as const } },
      { referenceNo: { contains: word, mode: "insensitive" as const } },
      { issuer: { contains: word, mode: "insensitive" as const } },
      { notes: { contains: word, mode: "insensitive" as const } },
      { originalFileName: { contains: word, mode: "insensitive" as const } },
    ]);

    const documents = await prisma.farmDocument.findMany({
      where: {
        farmId,
        OR: wordConditions.length > 0 ? wordConditions : [
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [
        { expiryDate: "asc" },
        { nextReviewDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      query: q,
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("SEARCH FARM DOCUMENTS ERROR:", error);
    return NextResponse.json(
      { error: "Server error while searching farm documents." },
      { status: 500 }
    );
  }
}