import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const farmId = String(req.nextUrl.searchParams.get("farmId") || "").trim();
    if (!farmId) return NextResponse.json({ error: "farmId is required." }, { status: 400 });

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) return NextResponse.json({ error: "No access." }, { status: 403 });

    // All crops for this farm that have at least one medication record
    const crops = await prisma.crop.findMany({
      where: { farmId },
      include: {
        medications: {
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { placementDate: "desc" },
    });

    const result = crops
      .filter((c) => c.medications.length > 0)
      .map((c) => ({
        cropId:        c.id,
        cropNumber:    c.cropNumber,
        placementDate: c.placementDate,
        finishDate:    c.finishDate,
        status:        c.status,
        records:       c.medications,
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("LIST ALL MEDICATIONS ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
