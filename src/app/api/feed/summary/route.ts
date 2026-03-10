import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const FEED_PRODUCTS = [
  "STARTER_CRUMB_185",
  "REARER_PELLET_385",
  "GROWER_PELLET_485",
  "FINISHER_PELLET_585",
  "WHEAT",
] as const;

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

    const records = await prisma.feedRecord.findMany({
      where: { cropId },
      orderBy: [{ date: "asc" }],
    });

    const byProduct = FEED_PRODUCTS.map((product) => {
      const productRecords = records.filter((item) => item.feedProduct === product);

      const feedKg = productRecords.reduce((sum, item) => sum + item.feedKg, 0);
      const wheatKg = productRecords.reduce((sum, item) => sum + item.wheatKg, 0);

      const totalCostGbp = productRecords.reduce((sum, item) => {
        const feedCost = item.feedPricePerTonneGbp
          ? (item.feedKg / 1000) * item.feedPricePerTonneGbp
          : 0;
        const wheatCost = item.wheatPricePerTonneGbp
          ? (item.wheatKg / 1000) * item.wheatPricePerTonneGbp
          : 0;

        return sum + feedCost + wheatCost;
      }, 0);

      return {
        feedProduct: product,
        feedKg,
        wheatKg,
        totalKg: feedKg + wheatKg,
        totalCostGbp,
        recordsCount: productRecords.length,
      };
    });

    const totalFeedKg = records.reduce((sum, item) => sum + item.feedKg, 0);
    const totalWheatKg = records.reduce((sum, item) => sum + item.wheatKg, 0);
    const totalDeliveredKg = totalFeedKg + totalWheatKg;

    const totalCostGbp = records.reduce((sum, item) => {
      const feedCost = item.feedPricePerTonneGbp
        ? (item.feedKg / 1000) * item.feedPricePerTonneGbp
        : 0;
      const wheatCost = item.wheatPricePerTonneGbp
        ? (item.wheatKg / 1000) * item.wheatPricePerTonneGbp
        : 0;

      return sum + feedCost + wheatCost;
    }, 0);

    return NextResponse.json({
      totals: {
        totalFeedKg,
        totalWheatKg,
        totalDeliveredKg,
        totalCostGbp,
        recordsCount: records.length,
      },
      byProduct,
    });
  } catch (error) {
    console.error("FEED SUMMARY ERROR:", error);
    return NextResponse.json(
      { error: "Server error while loading feed summary." },
      { status: 500 }
    );
  }
}