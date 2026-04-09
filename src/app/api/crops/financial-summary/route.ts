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
    const totalDeliveredKg = totalFeedKg + totalWheatKg;

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

    const liveEstimatedRevenueGbp =
      liveAvgWeightKg !== null && crop.salePricePerKgAllIn !== null
        ? currentLiveBirds * liveAvgWeightKg * crop.salePricePerKgAllIn
        : null;

    const liveEstimatedMarginGbp =
      liveEstimatedRevenueGbp !== null
        ? liveEstimatedRevenueGbp - totalFeedCostGbp
        : null;

    const finalRevenueGbp =
      crop.finalRevenueGbp !== null
        ? crop.finalRevenueGbp
        : crop.finalBirdsSold !== null &&
          crop.finalAvgWeightKg !== null &&
          crop.salePricePerKgAllIn !== null
        ? crop.finalBirdsSold * crop.finalAvgWeightKg * crop.salePricePerKgAllIn
        : null;

    const finalMarginGbp =
      finalRevenueGbp !== null ? finalRevenueGbp - totalFeedCostGbp : null;

    // =========================================================
    // N-1 SECTION — all metrics calculated on yesterday's data
    // =========================================================

    // N-1 cutoff: yesterday, capped at clearDate - 1 day (data stops the day before clear)
    const n1EndMs = cropEndDate
      ? Math.min(Date.now() - MSDAY, new Date(cropEndDate).getTime() - MSDAY)
      : Date.now() - MSDAY;
    const n1AgeDays = Math.max(
      1,
      Math.floor((n1EndMs - new Date(crop.placementDate).getTime()) / MSDAY)
    );

    // N-1 daily records only
    const n1Daily = crop.daily.filter(r => new Date(r.date).getTime() <= n1EndMs);
    const totalFeedConsumedN1 = n1Daily.reduce((s, r) => s + r.feedKg, 0);

    // Per-house N-1 aggregated structure
    type HouseN1 = {
      birdsPlaced: number;
      thinBirds: number; thinDate: Date | null;
      thin2Birds: number; thin2Date: Date | null;
      clearBirds: number; clearDate: Date | null; isCleared: boolean;
      mort: number; culls: number; lastWeightG: number | null;
    };
    const houseN1Map: Record<string, HouseN1> = {};

    for (const p of crop.placements) {
      if (!houseN1Map[p.houseId]) {
        houseN1Map[p.houseId] = {
          birdsPlaced: 0,
          thinBirds: 0, thinDate: null,
          thin2Birds: 0, thin2Date: null,
          clearBirds: 0, clearDate: null, isCleared: false,
          mort: 0, culls: 0, lastWeightG: null,
        };
      }
      const h = houseN1Map[p.houseId];
      h.birdsPlaced += p.birdsPlaced;
      h.thinBirds   += p.thinBirds  ?? 0;
      if (p.thinDate  && !h.thinDate)  h.thinDate  = new Date(p.thinDate);
      h.thin2Birds  += p.thin2Birds ?? 0;
      if (p.thin2Date && !h.thin2Date) h.thin2Date = new Date(p.thin2Date);
      h.clearBirds  += p.clearBirds ?? 0;
      if (p.clearDate) { h.isCleared = true; h.clearDate = new Date(p.clearDate); }
    }

    for (const r of n1Daily) {
      const h = houseN1Map[r.houseId];
      if (!h) continue;
      h.mort   += r.mort;
      h.culls  += r.culls;
      if (r.avgWeightG !== null) h.lastWeightG = r.avgWeightG;
    }

    // Helper: last known weight for a house at or before a given timestamp
    const allDailyRecords = crop.daily;
    function getWeightAtDate(houseId: string, targetMs: number): number | null {
      let w: number | null = null;
      for (const r of allDailyRecords) {
        if (r.houseId === houseId && new Date(r.date).getTime() <= targetMs && r.avgWeightG !== null) {
          w = r.avgWeightG;
        }
      }
      return w;
    }

    // N-1 theoretical revenue + FCR denominator
    // Thin/clear birds: actual sale at weight on that date
    // Live birds: theoretical "sold yesterday" at yesterday's weight
    let n1TheoreticalRevenue: number | null = null;
    let n1FCRDenominatorKg = 0;
    const salePrice = crop.salePricePerKgAllIn;

    if (salePrice !== null) {
      n1TheoreticalRevenue = 0;
      for (const [houseId, h] of Object.entries(houseN1Map)) {
        if (h.isCleared && h.clearBirds > 0 && h.clearDate) {
          const wG = getWeightAtDate(houseId, h.clearDate.getTime());
          if (wG) {
            const wKg = wG / 1000;
            n1TheoreticalRevenue += h.clearBirds * wKg * salePrice;
            n1FCRDenominatorKg   += h.clearBirds * wKg;
          }
        } else {
          // Thin1 (actual)
          if (h.thinBirds > 0 && h.thinDate) {
            const wG = getWeightAtDate(houseId, h.thinDate.getTime());
            if (wG) {
              const wKg = wG / 1000;
              n1TheoreticalRevenue += h.thinBirds * wKg * salePrice;
              n1FCRDenominatorKg   += h.thinBirds * wKg;
            }
          }
          // Thin2 (actual)
          if (h.thin2Birds > 0 && h.thin2Date) {
            const wG = getWeightAtDate(houseId, h.thin2Date.getTime());
            if (wG) {
              const wKg = wG / 1000;
              n1TheoreticalRevenue += h.thin2Birds * wKg * salePrice;
              n1FCRDenominatorKg   += h.thin2Birds * wKg;
            }
          }
          // Live birds — theoretical sale at yesterday's weight
          const liveBirds = Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds);
          if (liveBirds > 0 && h.lastWeightG) {
            const wKg = h.lastWeightG / 1000;
            n1TheoreticalRevenue += liveBirds * wKg * salePrice;
            n1FCRDenominatorKg   += liveBirds * wKg;
          }
        }
      }
    }

    // N-1 FCR
    const n1FCR: number | null =
      n1FCRDenominatorKg > 0 && totalFeedConsumedN1 > 0
        ? totalFeedConsumedN1 / n1FCRDenominatorKg
        : null;

    // N-1 EPEF — use weighted avg weight of live houses
    const n1TotalMort  = Object.values(houseN1Map).reduce((s, h) => s + h.mort,  0);
    const n1TotalCulls = Object.values(houseN1Map).reduce((s, h) => s + h.culls, 0);
    const n1SurvivalPct = birdsPlaced > 0
      ? ((birdsPlaced - n1TotalMort - n1TotalCulls) / birdsPlaced) * 100
      : 0;

    const liveHousesN1 = Object.values(houseN1Map).filter(h => !h.isCleared && h.lastWeightG !== null);
    const totalLiveBirdsN1 = liveHousesN1.reduce(
      (s, h) => s + Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds), 0
    );
    let n1AvgWeightKg: number | null = null;
    if (totalLiveBirdsN1 > 0) {
      const weightedSum = liveHousesN1.reduce((s, h) => {
        const live = Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds);
        return s + live * h.lastWeightG!;
      }, 0);
      n1AvgWeightKg = weightedSum / totalLiveBirdsN1 / 1000;
    } else if (liveHousesN1.length > 0) {
      n1AvgWeightKg = liveHousesN1.reduce((s, h) => s + h.lastWeightG!, 0) / liveHousesN1.length / 1000;
    }

    const n1EPEF =
      n1AgeDays > 0 && n1FCR && n1FCR > 0 && n1AvgWeightKg
        ? (n1SurvivalPct * n1AvgWeightKg * 100) / (n1AgeDays * n1FCR)
        : null;

    // FIFO feed cost — consumed N-1 kg walked through delivery queue by priority
    const farmPrices: Record<number, number | null> = {
      1: crop.farm.feedPrice1,
      2: crop.farm.feedPrice2,
      3: crop.farm.feedPrice3,
      4: crop.farm.feedPrice4,
      5: crop.farm.feedPrice5,
      6: crop.farm.wheatPrice,
    };

    type FeedBatch = { kg: number; pricePerKg: number; priority: number; dateMs: number };
    const feedQueue: FeedBatch[] = [];

    for (const r of crop.feedRecords) {
      const priority = getFeedPriority(r.feedProduct);
      const pricePerTonne = r.feedPricePerTonneGbp ?? farmPrices[priority] ?? null;
      if (r.feedKg > 0 && pricePerTonne !== null) {
        feedQueue.push({
          kg: r.feedKg,
          pricePerKg: pricePerTonne / 1000,
          priority,
          dateMs: new Date(r.date).getTime(),
        });
      }
      const wheatPricePerTonne = r.wheatPricePerTonneGbp ?? farmPrices[6] ?? null;
      if (r.wheatKg > 0 && wheatPricePerTonne !== null) {
        feedQueue.push({
          kg: r.wheatKg,
          pricePerKg: wheatPricePerTonne / 1000,
          priority: 6,
          dateMs: new Date(r.date).getTime(),
        });
      }
    }

    feedQueue.sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.dateMs - b.dateMs
    );

    let remaining = totalFeedConsumedN1;
    let consumedFeedCostN1 = 0;
    for (const batch of feedQueue) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, batch.kg);
      consumedFeedCostN1 += consumed * batch.pricePerKg;
      remaining -= consumed;
    }

    // N-1 chick cost and gross margin
    const n1ChickCost = birdsPlaced * (crop.chickenPricePerKg ?? 0);
    const n1GrossMarginGbp =
      n1TheoreticalRevenue !== null
        ? n1TheoreticalRevenue - consumedFeedCostN1 - n1ChickCost
        : null;

    // =========================================================
    // AVERAGE AGE — weighted average of all birds at sale date
    // Formula: Σ(birds × ageAtSaleEvent) / Σ(birds)
    // Same as XLS Total sheet K5:O13 weighted calc
    // =========================================================
    const placementMs = new Date(crop.placementDate).getTime();
    let avgAgeWeightedSum = 0;
    let avgAgeTotalBirds = 0;

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
      if (p.clearBirds && p.clearBirds > 0 && p.clearDate) {
        const clearAge = Math.round((new Date(p.clearDate).getTime() - placementMs) / MSDAY);
        avgAgeWeightedSum += p.clearBirds * clearAge;
        avgAgeTotalBirds  += p.clearBirds;
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

    // Final FCR: totalFeedUsed / (finalBirdsSold × saleWeightKg)
    const finalFCR: number | null =
      finalBirdsSoldN && saleWeightKg && totalFeedUsedKg > 0
        ? totalFeedUsedKg / (finalBirdsSoldN * saleWeightKg)
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
        totalDeliveredKg,
        totalFeedCostGbp,
        totalFeedUsedKg,
      },
      liveEstimate: {
        estimatedRevenueGbp: liveEstimatedRevenueGbp,
        estimatedMarginGbp: liveEstimatedMarginGbp,
      },
      finalReal: {
        finalRevenueGbp,
        finalMarginGbp,
      },
      n1: {
        ageDays: n1AgeDays,
        totalFeedConsumedKg: totalFeedConsumedN1,
        consumedFeedCostGbp: consumedFeedCostN1,
        theoreticalRevenue: n1TheoreticalRevenue,
        chickCost: n1ChickCost,
        grossMarginGbp: n1GrossMarginGbp,
        fcr: n1FCR,
        epef: n1EPEF,
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
