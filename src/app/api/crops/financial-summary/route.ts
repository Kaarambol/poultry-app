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

    const weightRecords = crop.daily.filter((r) => r.avgWeightG !== null);
    const lastWeightRecord =
      weightRecords.length > 0 ? weightRecords[weightRecords.length - 1] : null;

    const liveAvgWeightKg = lastWeightRecord?.avgWeightG
      ? lastWeightRecord.avgWeightG / 1000
      : null;

    const liveEstimatedRevenueGbp =
      liveAvgWeightKg !== null && crop.salePricePerKgAllIn !== null
        ? birdsAlive * liveAvgWeightKg * crop.salePricePerKgAllIn
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
      },
      production: {
        birdsPlaced,
        mort,
        culls,
        totalLosses,
        birdsAlive,
        mortalityPct,
        lastAvgWeightKg: liveAvgWeightKg,
        totalFloorAreaM2,
      },
      feed: {
        totalFeedKg,
        totalWheatKg,
        totalDeliveredKg,
        totalFeedCostGbp,
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