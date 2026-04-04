import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canOperate } from "@/lib/permissions";

function parseOptionalFloat(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const existing = await prisma.feedRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });

    const role = await getUserRoleOnFarm(uid, existing.farmId);
    if (!canOperate(role)) return NextResponse.json({ error: "No permission." }, { status: 403 });

    const date        = String(body.date || "").trim();
    const feedProduct = String(body.feedProduct || "").trim();
    const ticketNumber = String(body.ticketNumber || "").trim();
    const supplier    = String(body.supplier || "").trim();
    const notes       = String(body.notes || "").trim();
    const houseIdRaw  = String(body.houseId || "").trim();
    const feedKg      = Number(body.feedKg ?? 0);
    const wheatKg     = Number(body.wheatKg ?? 0);
    const feedPricePerTonneGbp  = parseOptionalFloat(body.feedPricePerTonneGbp);
    const wheatPricePerTonneGbp = parseOptionalFloat(body.wheatPricePerTonneGbp);

    if (!date || !feedProduct || !ticketNumber) {
      return NextResponse.json({ error: "date, feedProduct and ticketNumber are required." }, { status: 400 });
    }

    const updated = await prisma.feedRecord.update({
      where: { id },
      data: {
        date: new Date(date),
        feedProduct,
        feedKg,
        wheatKg,
        ticketNumber,
        feedPricePerTonneGbp,
        wheatPricePerTonneGbp,
        supplier: supplier || null,
        notes: notes || null,
        houseId: houseIdRaw || null,
      },
      include: { house: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE FEED RECORD ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
