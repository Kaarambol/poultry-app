import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const cropId = String(body.cropId || "").trim();
    const saleWeightKg   = body.saleWeightKg   != null && body.saleWeightKg   !== "" ? Number(body.saleWeightKg)   : null;
    const acceptWeightKg = body.acceptWeightKg != null && body.acceptWeightKg !== "" ? Number(body.acceptWeightKg) : null;

    if (!cropId) return NextResponse.json({ error: "cropId required." }, { status: 400 });

    const crop = await prisma.crop.findUnique({ where: { id: cropId }, select: { farmId: true } });
    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "No permission." }, { status: 403 });

    await prisma.crop.update({
      where: { id: cropId },
      data: { saleWeightKg, acceptWeightKg },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SALE DATA ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
