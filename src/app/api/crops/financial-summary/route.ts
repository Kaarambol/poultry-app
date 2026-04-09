import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const MSDAY = 24 * 60 * 60 * 1000;

function getFeedPriority(productName: string): number {
  const name = (productName || "").toLowerCase();
  if (name.includes("starter")) return 1;
  if (name.includes("rearer")) return 2;
  if (name.includes("grower")) return 3;
  if (name.includes("finisher")) return 4;
  if (name.includes("withdraw") || name.includes("final")) return 5;
  return 3; // default: treat as grower
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cropId = String(url.searchParams.get("cropId") || "").trim();

    if (!cropId) {
      return NextResponse.json(
        { error: "cropId is required." },
        { status: 400 }
      );
    }

    const crop = await prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        farm: {
          select: {
            feedPrice1: true, feedPrice2: true, feedPrice3: true,
            feedPrice4: true, feedPrice5: true, wheatPrice: true,
            chickenPrice: true,
          },
        },
        placements: {
          include: { house: { select: { floorAreaM2: true } } },
        },
        daily: {
          orderBy: [{ date: "asc" }],
        },
        feedRecords: true,
      },
    });

    if (!crop) {
      return NextResponse.json(
        { error: "Crop not found." },
        { status: 404 }
      );
    }

    // Sum floor area once per unique house
    const seenHouseIds = new Set<string>();
    let totalFloorAreaM2 = 0;
    for (const p of crop.placements) {
      if (!seenHouseIds.has(p.houseId)) {
        seenHouseIds.add(p.houseId);
        totalFloorAreaM2 += p.house.floorAreaM2;
      }
    }

    const birdsPlaced = crop.placements.reduce((sum, p) => sum + p.birdsPlaced, 0);
    const mort = crop.daily.reduce((sum, r) => sum + r.mort, 0);
    const culls = crop.daily.reduce((sum, r) => sum + r.culls, 0);
    const totalLosses = mort + culls;
    const birdsAlive = birdsPlaced - totalLosses;
    const mortalityPct = birdsPlaced > 0 ? (totalLosses / birdsPlaced) * 100 : 0;

    const totalFeedKg = crop.feedRecords.reduce((sum, r) => sum + r.feedKg, 0);
    const totalWheatKg = crop.feedRecords.reduce((sum, r) => sum + r.wheatKg, 0);
    const openingStockKg = (crop.openingFeedStockKg ?? 0) + (crop.openingWheatStockKg ?? 0);
    const closingStockKg = (crop.closingFeedStockKg ?? 0) + (crop.closingWheatStockKg ?? 0);
    const deliveredFromTicketsKg = totalFeedKg + totalWheatKg;
    // Delivered = opening stock + all ticket deliveries
    const totalDeliveredKg = openingStockKg + deliveredFromTicketsKg;
    // Consumed = opening + delivered from tickets - closing stock
    const totalConsumedKg = Math.max(0, totalDeliveredKg - closingStockKg);

    const totalFeedCostGbp = crop.feedRecords.reduce((sum, r) => {
      const feedCost = r.feedPricePerTonneGbp
        ? (r.feedKg / 1000) * r.feedPricePerTonneGbp
        : 0;
      const wheatCost = r.wheatPricePerTonneGbp
        ? (r.wheatKg / 1000) * r.wheatPricePerTonneGbp
        : 0;
      return sum + feedCost + wheatCost;
    }, 0);

    // --- Per-house calculations for weight, FCR (using actual feed consumed) ---
    type HouseCalc = {
      birdsPlaced: number;
      thinBirds: number;
      thin2Birds: number;
      clearBirds: number;
      isCleared: boolean;
      mort: number;
      culls: number;
      feedUsedKg: number;
      lastAvgWeightG: number | null;
    };

    const houseCalcMap: Record<string, HouseCalc> = {};

    for (const p of crop.placements) {
      if (!houseCalcMap[p.houseId]) {
        houseCalcMap[p.houseId] = {
          birdsPlaced: 0, thinBirds: 0, thin2Birds: 0, clearBirds: 0,
          isCleared: false, mort: 0, culls: 0, feedUsedKg: 0, lastAvgWeightG: null,
        };
      }
      const h = houseCalcMap[p.houseId];
      h.birdsPlaced += p.birdsPlaced;
      h.thinBirds   += p.thinBirds  ?? 0;
      h.thin2Birds  += p.thin2Birds ?? 0;
      h.clearBirds  += p.clearBirds ?? 0;
      if (p.clearDate) h.isCleared = true;
    }

    for (const r of crop.daily) {
      const h = houseCalcMap[r.houseId];
      if (!h) continue;
      h.mort        += r.mort;
      h.culls       += r.culls;
      h.feedUsedKg  += r.feedKg;
      if (r.avgWeightG !== null) h.lastAvgWeightG = r.avgWeightG;
    }

    const houseList = Object.values(houseCalcMap).map((h) => ({
      ...h,
      currentBirds: h.isCleared
        ? 0
        : Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds),
      birdsForFCR: h.isCleared
        ? h.clearBirds
        : Math.max(0, h.birdsPlaced - h.mort - h.culls),
    }));

    const housesForWeight = houseList.filter((h) => h.currentBirds > 0 && h.lastAvgWeightG !== null);
    const totalWeightedBirds  = housesForWeight.reduce((s, h) => s + h.currentBirds, 0);
    const totalWeightedG      = housesForWeight.reduce((s, h) => s + h.currentBirds * h.lastAvgWeightG!, 0);
    const liveAvgWeightKg: number | null =
      totalWeightedBirds > 0 ? totalWeightedG / totalWeightedBirds / 1000 : null;

    const totalFeedUsedKg = houseList.reduce((s, h) => s + h.feedUsedKg, 0);
    const currentLiveBirds = houseList.reduce((s, h) => s + h.currentBirds, 0);

    const housesForFCR = houseList.filter((h) => h.birdsForFCR > 0 && h.lastAvgWeightG !== null);
    const totalFCRWeightKg = housesForFCR.reduce(
      (s, h) => s + h.birdsForFCR * (h.lastAvgWeightG! / 1000), 0
    );
    const liveFCR: number | null =
      totalFCRWeightKg > 0 ? totalFeedUsedKg / totalFCRWeightKg : null;

    // Last clearance date — caps the age counter
    const clearDates = crop.placements
      .map(p => p.clearDate ? new Date(p.clearDate).getTime() : null)
      .filter((d): d is number => d !== null);
    const cropEndDate = clearDates.length > 0
      ? new Date(Math.max(...clearDates)).toISOString().slice(0, 10)
      : null;

    const endMs = cropEndDate
      ? Math.min(Date.now(), new Date(cropEndDate).getTime() + MSDAY)
      : Date.now();
    const ageDays = Math.max(
      1,
      Math.floor((endMs - new Date(crop.placementDate).getTime()) / MSDAY)
    );

    // =========================================================
    // AVERAGE AGE — weighted average of all birds at sale date
    // Formula: Σ(birds × ageAtSaleEvent) / Σ(birds)
    // Same as XLS Total sheet K5:O13 weighted calc
    // For clear: if clearBirds not recorded, compute remaining live birds
    //   = birdsPlaced - mort - culls - thinBirds - thin2Birds (from houseCalcMap)
    // =========================================================
    const placementMs = new Date(crop.placementDate).getTime();
    let avgAgeWeightedSum = 0;
    let avgAgeTotalBirds = 0;

    // Thin / thin2 events — iterate placements
    for (const p of crop.placements) {
      if (p.thinBirds && p.thinBirds > 0 && p.thinDate) {
        const thinAge = Math.round((new Date(p.thinDate).getTime() - placementMs) / MSDAY);
        avgAgeWeightedSum += p.thinBirds * thinAge;
        avgAgeTotalBirds  += p.thinBirds;
      }
      if (p.thin2Birds && p.thin2Birds > 0 && p.thin2Date) {
        const thin2Age = Math.round((new Date(p.thin2Date).getTime() - placementMs) / MSDAY);
        avgAgeWeightedSum += p.thin2Birds * thin2Age;
        avgAgeTotalBirds  += p.thin2Birds;
      }
    }

    // Clear events — per house (use houseCalcMap which has totals per house)
    for (const [houseId, hCalc] of Object.entries(houseCalcMap)) {
      if (!hCalc.isCleared) continue;
      // Find the clear date for this house
      const clearP = crop.placements.find(p => p.houseId === houseId && p.clearDate);
      if (!clearP?.clearDate) continue;
      const clearAge = Math.round((new Date(clearP.clearDate).getTime() - placementMs) / MSDAY);
      // If clearBirds recorded use it, otherwise compute remaining live birds
      const effectiveClearBirds = hCalc.clearBirds > 0
        ? hCalc.clearBirds
        : Math.max(0, hCalc.birdsPlaced - hCalc.mort - hCalc.culls - hCalc.thinBirds - hCalc.thin2Birds);
      if (effectiveClearBirds > 0) {
        avgAgeWeightedSum += effectiveClearBirds * clearAge;
        avgAgeTotalBirds  += effectiveClearBirds;
      }
    }

    const avgAge: number | null = avgAgeTotalBirds > 0 ? avgAgeWeightedSum / avgAgeTotalBirds : null;

    // =========================================================
    // FINAL metrics — calculated from factory report data
    // Available once saleWeightKg / acceptWeightKg are entered
    // =========================================================
    const saleWeightKg   = crop.saleWeightKg   ?? null;
    const acceptWeightKg = crop.acceptWeightKg ?? null;
    const finalBirdsSoldN = crop.finalBirdsSold ?? null;

    // Final FCR: totalConsumedKg / (finalBirdsSold × saleWeightKg)
    const finalFCR: number | null =
      finalBirdsSoldN && saleWeightKg && totalConsumedKg > 0
        ? totalConsumedKg / (finalBirdsSoldN * saleWeightKg)
        : null;

    // Final EPEF: (survivalPct × saleWeightKg × 100) / (avgAge × finalFCR)
    const finalSurvivalPct =
      finalBirdsSoldN && birdsPlaced > 0
        ? (finalBirdsSoldN / birdsPlaced) * 100
        : null;
    const finalEPEF: number | null =
      finalSurvivalPct && saleWeightKg && avgAge && finalFCR && finalFCR > 0
        ? (finalSurvivalPct * saleWeightKg * 100) / (avgAge * finalFCR)
        : null;

    // Final gross margin: uses acceptWeightKg for revenue
    const finalRevenue: number | null =
      finalBirdsSoldN && acceptWeightKg && crop.salePricePerKgAllIn
        ? finalBirdsSoldN * acceptWeightKg * crop.salePricePerKgAllIn
        : null;
    const finalChickCost = birdsPlaced * (crop.chickenPricePerKg ?? 0);
    const finalGrossMarginGbp: number | null =
      finalRevenue !== null
        ? finalRevenue - totalFeedCostGbp - finalChickCost
        : null;

    return NextResponse.json({
      crop: {
        id: crop.id,
        cropNumber: crop.cropNumber,
        status: crop.status,
        currency: crop.currency || "GBP",
        placementDate: crop.placementDate,
        chickenPricePerKg: crop.chickenPricePerKg,
        salePricePerKgAllIn: crop.salePricePerKgAllIn,
        finalBirdsSold: crop.finalBirdsSold,
        finalAvgWeightKg: crop.finalAvgWeightKg,
        finalRevenueGbp: crop.finalRevenueGbp,
        finalNotes: crop.finalNotes,
        saleWeightKg: crop.saleWeightKg,
        acceptWeightKg: crop.acceptWeightKg,
        cropEndDate,
        updatedAt: crop.finishDate,
      },
      production: {
        birdsPlaced,
        mort,
        culls,
        totalLosses,
        birdsAlive,
        mortalityPct,
        currentLiveBirds,
        lastAvgWeightKg: liveAvgWeightKg,
        liveFCR,
        ageDays,
        totalFloorAreaM2,
      },
      feed: {
        totalFeedKg,
        totalWheatKg,
        openingStockKg,
        closingStockKg,
        deliveredFromTicketsKg,
        totalDeliveredKg,
        totalConsumedKg,
        totalFeedCostGbp,
        totalFeedUsedKg,
      },
      final: {
        avgAge,
        fcr: finalFCR,
        epef: finalEPEF,
        grossMarginGbp: finalGrossMarginGbp,
        revenue: finalRevenue,
        chickCost: finalChickCost,
      },
    });
  } catch (error) {
    console.error("CROP FINANCIAL SUMMARY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading financial summary." },
      { status: 500 }
    );
  }
}
