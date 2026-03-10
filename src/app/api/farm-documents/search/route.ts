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

    const documents = await prisma.farmDocument.findMany({
      where: {
        farmId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { documentType: { contains: q, mode: "insensitive" } },
          { referenceNo: { contains: q, mode: "insensitive" } },
          { issuer: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
          { originalFileName: { contains: q, mode: "insensitive" } },
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