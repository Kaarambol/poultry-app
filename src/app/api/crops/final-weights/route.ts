import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const cropId = String(body.cropId || "").trim();
    const weights: { houseId: string; avgWeightG: number }[] = body.weights || [];

    if (!cropId) return NextResponse.json({ error: "cropId required." }, { status: 400 });

    const crop = await prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "No permission." }, { status: 403 });

    for (const w of weights) {
      if (!w.houseId || w.avgWeightG == null) continue;
      const lastRecord = await prisma.dailyRecord.findFirst({
        where: { cropId, houseId: w.houseId },
        orderBy: { date: "desc" },
        select: { id: true },
      });
      if (lastRecord) {
        await prisma.dailyRecord.update({
          where: { id: lastRecord.id },
          data: { avgWeightG: Math.round(w.avgWeightG) },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("FINAL WEIGHTS ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
