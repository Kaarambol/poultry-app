import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

type RouteContext = { params: Promise<{ cropId: string }> };

// POST — update only thinWeightG / clearWeightG for a placement (never touches dates or bird counts)
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { cropId } = await context.params;
    const body = await req.json();
    const placementId = String(body.placementId || "").trim();
    if (!placementId) return NextResponse.json({ error: "placementId required." }, { status: 400 });

    const placement = await prisma.cropHousePlacement.findUnique({
      where: { id: placementId },
      include: { crop: true },
    });
    if (!placement || placement.cropId !== cropId) {
      return NextResponse.json({ error: "Placement not found." }, { status: 404 });
    }

    const role = await getUserRoleOnFarm(uid, placement.crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const data: { thinWeightG?: number | null; clearWeightG?: number | null } = {};

    if (body.thinWeightG !== undefined) {
      const v = body.thinWeightG === "" || body.thinWeightG === null ? null : Number(body.thinWeightG);
      data.thinWeightG = v !== null && Number.isFinite(v) ? v : null;
    }
    if (body.clearWeightG !== undefined) {
      const v = body.clearWeightG === "" || body.clearWeightG === null ? null : Number(body.clearWeightG);
      data.clearWeightG = v !== null && Number.isFinite(v) ? v : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await prisma.cropHousePlacement.update({ where: { id: placementId }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PLACEMENT WEIGHTS ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
