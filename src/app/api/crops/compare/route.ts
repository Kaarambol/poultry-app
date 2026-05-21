import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MSDAY = 24 * 60 * 60 * 1000;

async function buildCropStats(cropNumber: string, farmId: string) {
  const crop = await prisma.crop.findUnique({
    where: { farmId_cropNumber: { farmId, cropNumber } },
    include: {
      placements: true,
      daily: { orderBy: { date: "asc" } },
      feedRecords: true,
    },
  });

  if (!crop) return null;

  const placementMs = new Date(crop.placementDate).getTime();

  // --- Production ---
  const birdsPlaced  = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);
  const totalMort    = crop.daily.reduce((s, r) => s + r.mort,  0);
  const totalCulls   = crop.daily.reduce((s, r) => s + r.culls, 0);
  const totalLosses  = totalMort + totalCulls;
  const mortalityPct = birdsPlaced > 0 ? (totalLosses / birdsPlaced) * 100 : 0;

  // --- Feed consumed: opening stock + deliveries - closing stock ---
  const feedDeliveredKg  = crop.feedRecords.reduce((s, r) => s + r.feedKg,  0);
  const wheatDeliveredKg = crop.feedRecords.reduce((s, r) => s + r.wheatKg, 0);
  const openingStockKg   = (crop.openingFeedStockKg  ?? 0) + (crop.openingWheatStockKg ?? 0);
  const closingStockKg   = (crop.closingFeedStockKg  ?? 0) + (crop.closingWheatStockKg ?? 0);
  const totalFeedKg      = Math.max(0, openingStockKg + feedDeliveredKg + wheatDeliveredKg - closingStockKg);

  // --- Crop length (weeks) — same formula as Total page ---
  // cropEndMs = latest clearDate capped at today
  const clearTimestamps = crop.placements
    .map(p => p.clearDate ? new Date(p.clearDate).getTime() : null)
    .filter((d): d is number => d !== null);
  const cropEndMs = clearTimestamps.length > 0
    ? Math.min(Date.now(), Math.max(...clearTimestamps))
    : Date.now();
  const ageDays = Math.max(1, Math.floor((cropEndMs - placementMs) / MSDAY));

  // Previous crop: most recently finished crop placed before this one
  const prevCrop = await prisma.crop.findFirst({
    where: {
      farmId,
      status: "finished",
      placementDate: { lt: crop.placementDate },
    },
    orderBy: { placementDate: "desc" },
    select: { finishDate: true },
  });
  const prevFinishMs = prevCrop?.finishDate ? new Date(prevCrop.finishDate).getTime() : null;
  const lengthCropDays = prevFinishMs
    ? Math.max(1, Math.floor((cropEndMs - prevFinishMs) / MSDAY))
    : ageDays + 10;
  const cropLengthWeeks = lengthCropDays / 7;

  // --- Final weight ---
  const weightRecords  = crop.daily.filter(r => r.avgWeightG !== null);
  const lastWeightG    = weightRecords.length > 0 ? weightRecords[weightRecords.length - 1].avgWeightG! : null;
  const finalAvgWeightKg = crop.finalAvgWeightKg ?? (lastWeightG ? lastWeightG / 1000 : null);

  // --- Birds sold ---
  const finalBirdsSold = crop.finalBirdsSold ?? (birdsPlaced - totalLosses);

  // --- FCR: totalConsumedKg / saleWeightKg (factory report) ---
  // Fallback: totalConsumedKg / (birds * avgWeight) when no factory data
  let fcr: number | null = null;
  const saleWeightKg = crop.saleWeightKg ?? null;
  if (saleWeightKg && saleWeightKg > 0 && totalFeedKg > 0) {
    fcr = totalFeedKg / saleWeightKg;
  } else if (finalAvgWeightKg && finalAvgWeightKg > 0 && finalBirdsSold > 0 && totalFeedKg > 0) {
    fcr = totalFeedKg / (finalBirdsSold * finalAvgWeightKg);
  }

  // --- EPEF — uses ageDays (bird age), not lengthCrop ---
  let epef: number | null = null;
  if (fcr && fcr > 0 && ageDays > 0 && finalAvgWeightKg && birdsPlaced > 0) {
    const livabilityPct = ((birdsPlaced - totalLosses) / birdsPlaced) * 100;
    epef = (livabilityPct * finalAvgWeightKg * 100) / (fcr * ageDays);
  }

  // --- Margin ---
  let finalMarginGbp: number | null = null;
  const feedDeliveryCost = await prisma.feedRecord.findMany({ where: { cropId: crop.id } });
  const feedCost = feedDeliveryCost.reduce((s, r) => {
    const fc = r.feedPricePerTonneGbp  ? (r.feedKg  / 1000) * r.feedPricePerTonneGbp  : 0;
    const wc = r.wheatPricePerTonneGbp ? (r.wheatKg / 1000) * r.wheatPricePerTonneGbp : 0;
    return s + fc + wc;
  }, 0);
  if (crop.finalRevenueGbp !== null) {
    finalMarginGbp = crop.finalRevenueGbp - feedCost;
  } else if (
    crop.finalBirdsSold !== null &&
    crop.finalAvgWeightKg !== null &&
    crop.salePricePerKgAllIn !== null
  ) {
    const revenue = crop.finalBirdsSold * crop.finalAvgWeightKg * crop.salePricePerKgAllIn;
    finalMarginGbp = revenue - feedCost;
  }

  // --- Per-house map for clear birds (to compute effective clear birds) ---
  type HouseData = {
    birdsPlaced: number; mort: number; culls: number;
    thinBirds: number; thin2Birds: number; clearBirds: number;
    clearDate: Date | null;
  };
  const houseMap: Record<string, HouseData> = {};
  for (const p of crop.placements) {
    if (!houseMap[p.houseId]) {
      houseMap[p.houseId] = {
        birdsPlaced: 0, mort: 0, culls: 0,
        thinBirds: 0, thin2Birds: 0, clearBirds: 0, clearDate: null,
      };
    }
    const h = houseMap[p.houseId];
    h.birdsPlaced += p.birdsPlaced;
    h.thinBirds   += p.thinBirds  ?? 0;
    h.thin2Birds  += p.thin2Birds ?? 0;
    h.clearBirds  += p.clearBirds ?? 0;
    if (p.clearDate) {
      const cd = new Date(p.clearDate);
      if (!h.clearDate || cd > h.clearDate) h.clearDate = cd;
    }
  }
  for (const r of crop.daily) {
    if (houseMap[r.houseId]) {
      houseMap[r.houseId].mort  += r.mort;
      houseMap[r.houseId].culls += r.culls;
    }
  }

  // --- Weighted average ages at thin / thin2 / clear ---
  let avgAgeThinSum = 0,  avgAgeThinBirds = 0;
  let avgAgeThin2Sum = 0, avgAgeThin2Birds = 0;
  let avgAgeClearSum = 0, avgAgeClearBirds = 0;

  for (const p of crop.placements) {
    if (p.thinBirds && p.thinBirds > 0 && p.thinDate) {
      const age = Math.round((new Date(p.thinDate).getTime() - placementMs) / MSDAY);
      avgAgeThinSum   += p.thinBirds * age;
      avgAgeThinBirds += p.thinBirds;
    }
    if (p.thin2Birds && p.thin2Birds > 0 && p.thin2Date) {
      const age = Math.round((new Date(p.thin2Date).getTime() - placementMs) / MSDAY);
      avgAgeThin2Sum   += p.thin2Birds * age;
      avgAgeThin2Birds += p.thin2Birds;
    }
  }

  for (const h of Object.values(houseMap)) {
    if (!h.clearDate || h.clearDate > new Date()) continue;
    const age = Math.round((h.clearDate.getTime() - placementMs) / MSDAY);
    const effectiveClearBirds = h.clearBirds > 0
      ? h.clearBirds
      : Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds);
    if (effectiveClearBirds > 0) {
      avgAgeClearSum   += effectiveClearBirds * age;
      avgAgeClearBirds += effectiveClearBirds;
    }
  }

  const ageThinDays  = avgAgeThinBirds  > 0 ? avgAgeThinSum  / avgAgeThinBirds  : null;
  const ageThin2Days = avgAgeThin2Birds > 0 ? avgAgeThin2Sum / avgAgeThin2Birds : null;
  const ageClearDays = avgAgeClearBirds > 0 ? avgAgeClearSum / avgAgeClearBirds : null;

  const birdsSoldThin  = crop.placements.reduce((s, p) => s + (p.thinBirds  ?? 0), 0);
  const birdsSoldThin2 = crop.placements.reduce((s, p) => s + (p.thin2Birds ?? 0), 0);
  const birdsSoldClear = crop.placements.reduce((s, p) => s + (p.clearBirds ?? 0), 0);

  return {
    id:            crop.id,
    cropNumber:    crop.cropNumber,
    status:        crop.status,
    breed:         crop.breed,
    placementDate: crop.placementDate,
    finishDate:    crop.finishDate,
    currency:      crop.currency ?? "GBP",
    // production
    birdsPlaced,
    totalMort,
    totalCulls,
    totalLosses,
    mortalityPct,
    // feed (consumed)
    totalFeedKg,
    // length & weight
    cropLengthWeeks,
    finalAvgWeightKg,
    finalBirdsSold,
    // performance
    fcr,
    epef,
    finalMarginGbp,
    // thin / clear (weighted avg ages)
    ageThinDays,
    ageThin2Days,
    ageClearDays,
    birdsSoldThin,
    birdsSoldThin2,
    birdsSoldClear,
  };
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.cookies.get("uid")?.value;
    if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const farmId      = searchParams.get("farmId")      ?? "";
    const cropNumber1 = searchParams.get("cropNumber1") ?? "";
    const cropNumber2 = searchParams.get("cropNumber2") ?? "";

    if (!farmId || !cropNumber1 || !cropNumber2) {
      return NextResponse.json(
        { error: "farmId, cropNumber1 and cropNumber2 are required." },
        { status: 400 }
      );
    }

    const role = await getUserRoleOnFarm(uid, farmId);
    if (!canView(role)) {
      return NextResponse.json({ error: "No access to this farm." }, { status: 403 });
    }

    const [crop1, crop2] = await Promise.all([
      buildCropStats(cropNumber1, farmId),
      buildCropStats(cropNumber2, farmId),
    ]);

    if (!crop1) return NextResponse.json({ error: `Crop ${cropNumber1} not found.` }, { status: 404 });
    if (!crop2) return NextResponse.json({ error: `Crop ${cropNumber2} not found.` }, { status: 404 });

    return NextResponse.json({ crop1, crop2 });
  } catch (error) {
    console.error("CROP COMPARE ERROR:", error);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
