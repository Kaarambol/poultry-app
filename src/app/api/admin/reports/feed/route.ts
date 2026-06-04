import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

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
      feedRecords: {
        select: { feedProduct: true, feedKg: true, wheatKg: true, feedPricePerTonneGbp: true },
      },
    },
    orderBy: [{ farm: { name: "asc" } }, { placementDate: "desc" }],
  });

  const rows: object[] = [];

  for (const crop of crops) {
    const birdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);

    // Group by feedProduct
    const productMap = new Map<string, { feedKg: number; wheatKg: number; weightedPriceSum: number; pricedKg: number; costGbp: number; hasPrices: boolean }>();
    for (const f of crop.feedRecords) {
      if (!productMap.has(f.feedProduct)) {
        productMap.set(f.feedProduct, { feedKg: 0, wheatKg: 0, weightedPriceSum: 0, pricedKg: 0, costGbp: 0, hasPrices: false });
      }
      const entry = productMap.get(f.feedProduct)!;
      entry.feedKg += f.feedKg;
      entry.wheatKg += f.wheatKg;
      if (f.feedPricePerTonneGbp != null) {
        entry.hasPrices = true;
        entry.weightedPriceSum += f.feedKg * f.feedPricePerTonneGbp;
        entry.pricedKg += f.feedKg;
        entry.costGbp += (f.feedKg / 1000) * f.feedPricePerTonneGbp;
      }
    }

    for (const [feedProduct, data] of productMap.entries()) {
      const totalFeedKg = data.feedKg;
      const totalWheatKg = data.wheatKg;
      const totalKg = totalFeedKg + totalWheatKg;
      const totalTonnes = parseFloat((totalKg / 1000).toFixed(3));
      const tonnesPer1000Birds = birdsPlaced > 0 ? parseFloat((totalTonnes / (birdsPlaced / 1000)).toFixed(3)) : null;
      const avgPricePerTonne = data.hasPrices && data.pricedKg > 0 ? parseFloat((data.weightedPriceSum / data.pricedKg).toFixed(2)) : null;
      const totalCostGbp = data.hasPrices ? parseFloat(data.costGbp.toFixed(2)) : null;

      rows.push({
        cropId: crop.id,
        farmName: crop.farm.name,
        cropNumber: crop.cropNumber,
        birdsPlaced,
        placementDate: crop.placementDate.toISOString(),
        feedProduct,
        totalFeedKg: parseFloat(totalFeedKg.toFixed(1)),
        totalWheatKg: parseFloat(totalWheatKg.toFixed(1)),
        totalKg: parseFloat(totalKg.toFixed(1)),
        totalTonnes,
        tonnesPer1000Birds,
        avgPricePerTonne,
        totalCostGbp,
      });
    }
  }

  return NextResponse.json(rows);
}
