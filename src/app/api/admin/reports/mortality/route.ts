import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const farmIds = searchParams.getAll("farmId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status") || "ALL";
  const breed = searchParams.get("breed") || "";
  const hatchery = searchParams.get("hatchery") || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (farmIds.length > 0) where.farmId = { in: farmIds };
  if (dateFrom) where.placementDate = { ...(where.placementDate || {}), gte: new Date(dateFrom) };
  if (dateTo) where.placementDate = { ...(where.placementDate || {}), lte: new Date(dateTo) };
  if (status !== "ALL") where.status = status;
  if (breed) where.breed = { contains: breed, mode: "insensitive" };
  if (hatchery) where.hatchery = { contains: hatchery, mode: "insensitive" };

  const crops = await prisma.crop.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      placements: { select: { birdsPlaced: true } },
      daily: {
        select: { date: true, mort: true, culls: true, cullsSmall: true, cullsLeg: true },
      },
    },
    orderBy: [{ farm: { name: "asc" } }, { placementDate: "desc" }],
  });

  const rows = crops.map(crop => {
    const birdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);
    const placementDate = crop.placementDate;

    let mort3day = 0, mort7day = 0, mort14day = 0, mortFinal = 0;
    let deadTotal = 0, cullsTotal = 0, cullsSmall = 0, cullsLeg = 0;

    for (const d of crop.daily) {
      const daysOld = daysBetween(placementDate, d.date);
      const total = d.mort + d.culls;
      if (daysOld <= 3) mort3day += total;
      if (daysOld <= 7) mort7day += total;
      if (daysOld <= 14) mort14day += total;
      mortFinal += total;
      deadTotal += d.mort;
      cullsTotal += d.culls;
      cullsSmall += d.cullsSmall;
      cullsLeg += d.cullsLeg;
    }

    const pct = (v: number) => birdsPlaced > 0 ? parseFloat(((v / birdsPlaced) * 100).toFixed(2)) : null;

    return {
      cropId: crop.id,
      farmName: crop.farm.name,
      cropNumber: crop.cropNumber,
      breed: crop.breed ?? null,
      birdsPlaced,
      placementDate: placementDate.toISOString(),
      status: crop.status,
      mort3day,
      mortPct3day: pct(mort3day),
      mort7day,
      mortPct7day: pct(mort7day),
      mort14day,
      mortPct14day: pct(mort14day),
      mortFinal,
      mortPctFinal: pct(mortFinal),
      deadTotal,
      cullsTotal,
      cullsSmall,
      cullsLeg,
    };
  });

  return NextResponse.json(rows);
}
