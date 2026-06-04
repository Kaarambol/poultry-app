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
      placements: true,
      daily: { select: { mort: true, culls: true } },
      feedRecords: { select: { feedKg: true, wheatKg: true } },
    },
    orderBy: [{ farm: { name: "asc" } }, { placementDate: "desc" }],
  });

  const rows = crops.map(crop => {
    const placements = crop.placements;
    const birdsPlaced = placements.reduce((s, p) => s + p.birdsPlaced, 0);
    const placementDate = crop.placementDate;

    // Thin 1
    const thinPlacements = placements.filter(p => p.thinDate && p.thinBirds);
    let thinDate: Date | null = null;
    let thinBirds = 0;
    let thinWeightGNum: number | null = null;
    if (thinPlacements.length > 0) {
      thinDate = thinPlacements.reduce<Date>((earliest, p) => {
        const d = p.thinDate!;
        return d < earliest ? d : earliest;
      }, thinPlacements[0].thinDate!);
      thinBirds = thinPlacements.reduce((s, p) => s + (p.thinBirds ?? 0), 0);
      // weighted avg weight
      const weightedSum = thinPlacements.reduce((s, p) => s + (p.thinBirds ?? 0) * (p.thinWeightG ?? 0), 0);
      const weightBirds = thinPlacements.filter(p => p.thinWeightG).reduce((s, p) => s + (p.thinBirds ?? 0), 0);
      thinWeightGNum = weightBirds > 0 ? weightedSum / weightBirds : null;
    }

    // Thin 2
    const thin2Placements = placements.filter(p => p.thin2Date && p.thin2Birds);
    let thin2Date: Date | null = null;
    let thin2Birds = 0;
    if (thin2Placements.length > 0) {
      thin2Date = thin2Placements.reduce<Date>((earliest, p) => {
        const d = p.thin2Date!;
        return d < earliest ? d : earliest;
      }, thin2Placements[0].thin2Date!);
      thin2Birds = thin2Placements.reduce((s, p) => s + (p.thin2Birds ?? 0), 0);
    }

    // Clear
    const clearPlacements = placements.filter(p => p.clearDate && p.clearBirds);
    let clearDate: Date | null = null;
    let clearBirds = 0;
    let clearWeightGNum: number | null = null;
    if (clearPlacements.length > 0) {
      clearDate = clearPlacements.reduce<Date>((latest, p) => {
        const d = p.clearDate!;
        return d > latest ? d : latest;
      }, clearPlacements[0].clearDate!);
      clearBirds = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0), 0);
      const weightedSum = clearPlacements.reduce((s, p) => s + (p.clearBirds ?? 0) * (p.clearWeightG ?? 0), 0);
      const weightBirds = clearPlacements.filter(p => p.clearWeightG).reduce((s, p) => s + (p.clearBirds ?? 0), 0);
      clearWeightGNum = weightBirds > 0 ? weightedSum / weightBirds : null;
    }

    const totalMort = crop.daily.reduce((s, d) => s + d.mort, 0);
    const totalCulls = crop.daily.reduce((s, d) => s + d.culls, 0);
    const totalFeedKg = crop.feedRecords.reduce((s, f) => s + f.feedKg + f.wheatKg, 0);

    const thinAge = thinDate ? daysBetween(placementDate, thinDate) : null;
    const thin2Age = thin2Date ? daysBetween(placementDate, thin2Date) : null;
    const clearAge = clearDate ? daysBetween(placementDate, clearDate) : null;

    const thinPct = birdsPlaced > 0 && thinBirds > 0 ? parseFloat(((thinBirds / birdsPlaced) * 100).toFixed(2)) : null;
    const thin2Pct = birdsPlaced > 0 && thin2Birds > 0 ? parseFloat(((thin2Birds / birdsPlaced) * 100).toFixed(2)) : null;
    const clearPct = birdsPlaced > 0 && clearBirds > 0 ? parseFloat(((clearBirds / birdsPlaced) * 100).toFixed(2)) : null;
    const mortPct = birdsPlaced > 0 ? parseFloat((((totalMort + totalCulls) / birdsPlaced) * 100).toFixed(2)) : null;

    const totalFeedT = parseFloat((totalFeedKg / 1000).toFixed(3));

    let fcr: number | null = null;
    let epef: number | null = null;
    let adg: number | null = null;

    if (clearBirds > 0 && clearWeightGNum && clearWeightGNum > 0) {
      const clearWeightKg = clearWeightGNum / 1000;
      const liveWeightKg = clearBirds * clearWeightKg;
      if (liveWeightKg > 0) {
        fcr = parseFloat((totalFeedKg / liveWeightKg).toFixed(3));
      }
      if (clearAge && clearAge > 0 && fcr) {
        const livabilityPct = birdsPlaced > 0 ? (clearBirds / birdsPlaced) * 100 : 0;
        epef = parseFloat(((livabilityPct * clearWeightKg * 100) / (fcr * clearAge * 10)).toFixed(1));
      }
      if (clearAge && clearAge > 0) {
        adg = parseFloat((clearWeightGNum / clearAge).toFixed(1));
      }
    }

    return {
      cropId: crop.id,
      farmName: crop.farm.name,
      cropNumber: crop.cropNumber,
      breed: crop.breed ?? null,
      hatchery: crop.hatchery ?? null,
      status: crop.status,
      birdsPlaced,
      placementDate: placementDate.toISOString(),
      // Thin 1
      thinDate: thinDate ? thinDate.toISOString() : null,
      thinAge,
      thinBirds: thinBirds || null,
      thinWeightG: thinWeightGNum != null ? Math.round(thinWeightGNum) : null,
      thinPct,
      // Thin 2
      thin2Date: thin2Date ? thin2Date.toISOString() : null,
      thin2Age,
      thin2Birds: thin2Birds || null,
      thin2Pct,
      // Clear
      clearDate: clearDate ? clearDate.toISOString() : null,
      clearAge,
      clearBirds: clearBirds || null,
      clearWeightG: clearWeightGNum != null ? Math.round(clearWeightGNum) : null,
      clearPct,
      // Mortality
      totalMort,
      totalCulls,
      mortPct,
      // Feed
      totalFeedT,
      fcr,
      epef,
      adg,
    };
  });

  return NextResponse.json(rows);
}
