import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    const url = new URL(req.url);
    const farmId = String(url.searchParams.get("farmId") || "").trim();

    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    if (!farmId) return NextResponse.json({ error: "farmId is required." }, { status: 400 });

    const farmAccess = await prisma.farmUser.findFirst({
      where: { farmId, userId: uid },
    });

    if (!farmAccess) return NextResponse.json({ error: "No access." }, { status: 403 });

    const crop = await prisma.crop.findFirst({
      where: { farmId, status: "ACTIVE" },
      orderBy: { placementDate: "desc" },
      include: {
        placements: {
          include: {
            house: true
          }
        }
      }
    });

    if (!crop) return NextResponse.json(null);

    // Fetching daily records. Including fields for thinning and clearance detection.
    const dailyRecords = await (prisma as any).dailyRecord.findMany({
      where: { cropId: crop.id },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json({
      ...crop,
      dailyRecords
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}