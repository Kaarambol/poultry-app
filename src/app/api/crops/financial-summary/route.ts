import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Sum floor area once per unique house (placements can have multiple batches per house)
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
      feedUsedKg: number;       // from daily records (actual consumption)
      lastAvgWeightG: number | null;
    };

    const houseCalcMap: Record<string, HouseCalc> = {};

    // Aggregate thinning / placement data per house
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

    // Aggregate daily records per house (mort, culls, feed used, last weight)
    for (const r of crop.daily) {
      const h = houseCalcMap[r.houseId];
      if (!h) continue;
      h.mort        += r.mort;
      h.culls       += r.culls;
      h.feedUsedKg  += r.feedKg;
      if (r.avgWeightG !== null) h.lastAvgWeightG = r.avgWeightG;
    }

    // Current live birds per house (after mort, culls, and thinning)
    const houseList = Object.values(houseCalcMap).map((h) => ({
      ...h,
      currentBirds: h.isCleared
        ? 0
        : Math.max(0, h.birdsPlaced - h.mort - h.culls - h.thinBirds - h.thin2Birds),
      // For FCR: all surviving birds (live + already sold via thin)
      birdsForFCR: h.isCleared
        ? h.clearBirds   // cleared birds still count for FCR denominator
        : Math.max(0, h.birdsPlaced - h.mort - h.culls),
    }));

    // Weighted avg weight: only houses with live birds AND a weight reading
    const housesForWeight = houseList.filter((h) => h.currentBirds > 0 && h.lastAvgWeightG !== null);
    const totalWeightedBirds  = housesForWeight.reduce((s, h) => s + h.currentBirds, 0);
    const totalWeightedG      = housesForWeight.reduce((s, h) => s + h.currentBirds * h.lastAvgWeightG!, 0);
    const liveAvgWeightKg: number | null =
      totalWeightedBirds > 0 ? totalWeightedG / totalWeightedBirds / 1000 : null;

    // Total feed USED across all houses (from daily records)
    const totalFeedUsedKg = houseList.reduce((s, h) => s + h.feedUsedKg, 0);

    // Current live birds on farm
    const currentLiveBirds = houseList.reduce((s, h) => s + h.currentBirds, 0);

    // FCR = total feed used / (all surviving birds incl. thin sold × avg weight)
    // After thin: denominator includes thin birds + live birds (all weighed together)
    const housesForFCR = houseList.filter((h) => h.birdsForFCR > 0 && h.lastAvgWeightG !== null);
    const totalFCRWeightKg = housesForFCR.reduce(
      (s, h) => s + h.birdsForFCR * (h.lastAvgWeightG! / 1000), 0
    );
    const liveFCR: number | null =
      totalFCRWeightKg > 0 ? totalFeedUsedKg / totalFCRWeightKg : null;

    // Age in days — always counts to TODAY (crop is ACTIVE until explicitly finished)
    const ageDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(crop.placementDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    // Last clearance date — shown as info only, does NOT stop the age counter
    const clearDates = crop.placements
      .map(p => p.clearDate ? new Date(p.clearDate).getTime() : null)
      .filter((d): d is number => d !== null);
    const cropEndDate = clearDates.length > 0
      ? new Date(Math.max(...clearDates)).toISOString().slice(0, 10)
      : null;

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
        cropEndDate,
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
    });
  } catch (error) {
    console.error("CROP FINANCIAL SUMMARY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading financial summary." },
      { status: 500 }
    );
  }
}