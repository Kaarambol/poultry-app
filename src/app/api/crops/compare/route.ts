import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

const MSDAY = 24 * 60 * 60 * 1000;

async function buildCropStats(cropNumber: string, farmId: string) {
  const crop = await prisma.crop.findUnique({
    where: { farmId_cropNumber: { farmId, cropNumber } },
    include: {
      placements: { include: { house: { select: { floorAreaM2: true } } } },
      daily: { orderBy: { date: "asc" } },
      feedRecords: true,
    },
  });

  if (!crop) return null;

  const placementMs = new Date(crop.placementDate).getTime();

  // --- Floor area (sum once per unique house) ---
  const seenHouseIds = new Set<string>();
  let totalFloorAreaM2 = 0;
  for (const p of crop.placements) {
    if (!seenHouseIds.has(p.houseId)) {
      seenHouseIds.add(p.houseId);
      totalFloorAreaM2 += p.house.floorAreaM2;
    }
  }

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
  // Crop length = days from prev crop's last clearDate to this crop's last clearDate
  const prevCrop = await prisma.crop.findFirst({
    where: {
      farmId,
      status: "finished",
      placementDate: { lt: crop.placementDate },
    },
    orderBy: { placementDate: "desc" },
    select: { finishDate: true, placements: { select: { clearDate: true } } },
  });
  const prevClearTimestamps = (prevCrop?.placements ?? [])
    .map(p => p.clearDate ? new Date(p.clearDate).getTime() : null)
    .filter((d): d is number => d !== null);
  const prevLastClearMs = prevClearTimestamps.length > 0
    ? Math.max(...prevClearTimestamps)
    : (prevCrop?.finishDate ? new Date(prevCrop.finishDate).getTime() : null);
  const lengthCropDays = prevLastClearMs
    ? Math.max(1, Math.floor((cropEndMs - prevLastClearMs) / MSDAY))
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

  // --- Weighted average age at sale (same formula as financial-summary) ---
  // Σ(birds × ageAtSaleEvent) / Σ(birds) across thin1, thin2, clear
  let avgAgeWeightedSum = 0;
  let avgAgeTotalBirds  = 0;
  for (const p of crop.placements) {
    if (p.thinBirds && p.thinBirds > 0 && p.thinDate) {
      const age = Math.round((new Date(p.thinDate).getTime() - placementMs) / MSDAY);
      avgAgeWeightedSum += p.thinBirds * age;
      avgAgeTotalBirds  += p.thinBirds;
    }
    if (p.thin2Birds && p.thin2Birds > 0 && p.thin2Date) {
      const age = Math.round((new Date(p.thin2Date).getTime() - placementMs) / MSDAY);
      avgAgeWeightedSum += p.thin2Birds * age;
      avgAgeTotalBirds  += p.thin2Birds;
    }
  }
  // Clear birds — computed per house after houseMap is built (done below, so we'll patch after)
  // We iterate houseMap inline here using placements data directly
  for (const p of crop.placements) {
    if (p.clearDate && new Date(p.clearDate) <= new Date()) {
      const clearAge = Math.round((new Date(p.clearDate).getTime() - placementMs) / MSDAY);
      const houseMort  = crop.daily.filter(r => r.houseId === p.houseId).reduce((s, r) => s + r.mort + r.culls, 0);
      const houseThin  = crop.placements.filter(pl => pl.houseId === p.houseId).reduce((s, pl) => s + (pl.thinBirds ?? 0) + (pl.thin2Birds ?? 0), 0);
      const housePlace = crop.placements.filter(pl => pl.houseId === p.houseId).reduce((s, pl) => s + pl.birdsPlaced, 0);
      const houseClr   = crop.placements.filter(pl => pl.houseId === p.houseId).reduce((s, pl) => s + (pl.clearBirds ?? 0), 0);
      const effectiveClearBirds = houseClr > 0
        ? houseClr
        : Math.max(0, housePlace - houseMort - houseThin);
      // Only count once per house (use the first clearDate placement encountered)
      const isFirstClearPlacement = crop.placements.find(
        pl => pl.houseId === p.houseId && pl.clearDate
      )?.id === p.id;
      if (isFirstClearPlacement && effectiveClearBirds > 0) {
        avgAgeWeightedSum += effectiveClearBirds * clearAge;
        avgAgeTotalBirds  += effectiveClearBirds;
      }
    }
  }
  const avgAge: number | null = avgAgeTotalBirds > 0 ? avgAgeWeightedSum / avgAgeTotalBirds : null;

  // --- EPEF — same formula as financial-summary ---
  // EPEF = (survivalPct × avgBirdWeightKg / (avgAge × FCR)) × 100
  // avgBirdWeightKg = saleWeightKg / finalBirdsSold (factory report)
  const survivalPct = 100 - mortalityPct;
  const avgBirdWeightKg: number | null =
    saleWeightKg && crop.finalBirdsSold && crop.finalBirdsSold > 0
      ? saleWeightKg / crop.finalBirdsSold
      : finalAvgWeightKg;
  let epef: number | null = null;
  if (fcr && fcr > 0 && avgAge !== null && avgAge > 0 && avgBirdWeightKg && birdsPlaced > 0) {
    epef = (survivalPct * avgBirdWeightKg / (avgAge * fcr)) * 100;
  }

  // --- Margin (pence per m² per week, same as Total page) ---
  let finalMarginGbp: number | null = null;
  const deliveryCostGbp = crop.feedRecords.reduce((s, r) => {
    const fc = r.feedPricePerTonneGbp  ? (r.feedKg  / 1000) * r.feedPricePerTonneGbp  : 0;
    const wc = r.wheatPricePerTonneGbp ? (r.wheatKg / 1000) * r.wheatPricePerTonneGbp : 0;
    return s + fc + wc;
  }, 0);

  // Opening stock: paid in previous crop, consumed this crop → add to cost
  // Closing stock: delivered this crop but not consumed → subtract from cost
  // Price = last ordered feed record (most recent delivery date)
  const feedRecordsByDateDesc = [...crop.feedRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastFeedPrice = feedRecordsByDateDesc.find(r => r.feedPricePerTonneGbp != null)?.feedPricePerTonneGbp ?? null;
  const lastWheatPrice = feedRecordsByDateDesc.find(r => r.wheatPricePerTonneGbp != null)?.wheatPricePerTonneGbp ?? null;

  const openingStockCost =
    (lastFeedPrice  ? (crop.openingFeedStockKg  ?? 0) / 1000 * lastFeedPrice  : 0) +
    (lastWheatPrice ? (crop.openingWheatStockKg ?? 0) / 1000 * lastWheatPrice : 0);
  const closingStockCost =
    (lastFeedPrice  ? (crop.closingFeedStockKg  ?? 0) / 1000 * lastFeedPrice  : 0) +
    (lastWheatPrice ? (crop.closingWheatStockKg ?? 0) / 1000 * lastWheatPrice : 0);

  const feedCost = deliveryCostGbp + openingStockCost - closingStockCost;
  const chickCost = crop.chickenPricePerKg != null ? birdsPlaced * crop.chickenPricePerKg : null;
  if (crop.finalRevenueGbp !== null && chickCost !== null) {
    finalMarginGbp = crop.finalRevenueGbp - chickCost - feedCost;
  } else if (
    crop.finalBirdsSold !== null &&
    crop.finalAvgWeightKg !== null &&
    crop.salePricePerKgAllIn !== null &&
    chickCost !== null
  ) {
    const revenue = crop.finalBirdsSold * crop.finalAvgWeightKg * crop.salePricePerKgAllIn;
    finalMarginGbp = revenue - chickCost - feedCost;
  }
  // Margin per m² per week (pence) = (grossMarginGbp × 100) / floorAreaM2 / cropLengthWeeks
  const marginPencePerM2Week: number | null =
    finalMarginGbp !== null && totalFloorAreaM2 > 0 && cropLengthWeeks > 0
      ? (finalMarginGbp * 100) / totalFloorAreaM2 / cropLengthWeeks
      : null;

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
    marginPencePerM2Week,
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
