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

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        placements: { select: { houseId: true, clearDate: true } },
      },
    });
    if (!crop) return NextResponse.json({ error: "Crop not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, crop.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "No permission." }, { status: 403 });

    // Build map: houseId -> clearDate
    const clearDateMap: Record<string, Date> = {};
    for (const p of crop.placements) {
      if (p.clearDate) clearDateMap[p.houseId] = new Date(p.clearDate);
    }

    for (const w of weights) {
      if (!w.houseId || w.avgWeightG == null) continue;

      const clearDate = clearDateMap[w.houseId];
      if (!clearDate) continue; // no clear date set for this house — skip

      // Normalize to midnight UTC
      const dateOnly = new Date(clearDate.toISOString().slice(0, 10) + "T00:00:00.000Z");

      // Find the daily record for this house on the clear date
      const record = await prisma.dailyRecord.findFirst({
        where: { cropId, houseId: w.houseId, date: dateOnly },
        select: { id: true },
      });

      if (record) {
        await prisma.dailyRecord.update({
          where: { id: record.id },
          data: { avgWeightG: Math.round(w.avgWeightG) },
        });
      } else {
        // No record on clear date — create one with just the weight
        await prisma.dailyRecord.create({
          data: {
            cropId,
            houseId: w.houseId,
            date: dateOnly,
            avgWeightG: Math.round(w.avgWeightG),
            mort: 0,
            culls: 0,
            feedKg: 0,
            waterL: 0,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("FINAL WEIGHTS ERROR:", e);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
