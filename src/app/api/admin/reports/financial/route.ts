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
  // Default to FINISHED unless status=ALL
  if (status === "ALL") {
    // no filter
  } else {
    where.status = status;
  }
  if (status !== "ALL" && status !== "FINISHED") {
    // already set above
  } else if (status !== "ALL") {
    where.status = "FINISHED";
  }
  if (breed) where.breed = { contains: breed, mode: "insensitive" };
  if (hatchery) where.hatchery = { contains: hatchery, mode: "insensitive" };

  // Default to FINISHED only
  if (!where.status && status !== "ALL") {
    where.status = "FINISHED";
  }

  const crops = await prisma.crop.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      placements: {
        select: { birdsPlaced: true, clearDate: true, clearBirds: true, clearWeightG: true },
      },
      feedRecords: {
        select: { feedKg: true, feedPricePerTonneGbp: true },
      },
    },
    orderBy: [{ farm: { name: "asc" } }, { placementDate: "desc" }],
  });

  const rows = crops.map(crop => {
    const birdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);

    // Clear aggregation
    const clearPlacements = crop.placements.filter(p => p.clearDate && p.clearBirds);
    const clearDate = clearPlacements.length > 0
      ? clearPlacements.reduce<Date>((latest, p) => {
          const d = p.clearDate!;
          return d > latest ? d : latest;
        }, clearPlacements[0].clearDate!)
      : null;
    const clearBirds = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0), 0);
    const weightedSum = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0) * (p.clearWeightG ?? 0), 0);
    const weightBirds = clearPlacements.filter(p => p.clearWeightG).reduce((s, p) => s + (p.clearBirds ?? 0), 0);
    const clearWeightG = weightBirds > 0 ? Math.round(weightedSum / weightBirds) : null;

    const totalLiveWeightKg = clearBirds > 0 && clearWeightG ? parseFloat((clearBirds * clearWeightG / 1000).toFixed(2)) : null;

    // Revenue
    let revenueGbp: number | null = crop.finalRevenueGbp ?? null;
    if (revenueGbp == null && clearBirds > 0 && clearWeightG && crop.salePricePerKgAllIn) {
      revenueGbp = parseFloat((clearBirds * clearWeightG / 1000 * crop.salePricePerKgAllIn).toFixed(2));
    }

    const pricePerKg = crop.chickenPricePerKg ?? crop.salePricePerKgAllIn ?? null;

    // Feed cost
    const feedRecordsWithPrice = crop.feedRecords.filter(f => f.feedPricePerTonneGbp != null);
    const feedCostGbp = feedRecordsWithPrice.length > 0
      ? parseFloat(feedRecordsWithPrice.reduce((s, f) => s + (f.feedKg / 1000) * f.feedPricePerTonneGbp!, 0).toFixed(2))
      : null;

    const marginGbp = revenueGbp != null && feedCostGbp != null
      ? parseFloat((revenueGbp - feedCostGbp).toFixed(2))
      : null;

    const marginPct = marginGbp != null && revenueGbp && revenueGbp > 0
      ? parseFloat(((marginGbp / revenueGbp) * 100).toFixed(2))
      : null;

    const gbpPerBird = marginGbp != null && clearBirds > 0
      ? parseFloat((marginGbp / clearBirds).toFixed(2))
      : null;

    const gbpPerKg = marginGbp != null && totalLiveWeightKg && totalLiveWeightKg > 0
      ? parseFloat((marginGbp / totalLiveWeightKg).toFixed(2))
      : null;

    return {
      cropId: crop.id,
      farmName: crop.farm.name,
      cropNumber: crop.cropNumber,
      breed: crop.breed ?? null,
      birdsPlaced,
      placementDate: crop.placementDate.toISOString(),
      clearDate: clearDate ? clearDate.toISOString() : null,
      clearBirds: clearBirds || null,
      clearWeightG,
      totalLiveWeightKg,
      revenueGbp,
      pricePerKg,
      feedCostGbp,
      marginGbp,
      marginPct,
      gbpPerBird,
      gbpPerKg,
    };
  });

  return NextResponse.json(rows);
}
