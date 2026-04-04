import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserRoleOnFarm, canView } from "@/lib/permissions";

async function buildCropStats(cropNumber: string, farmId: string) {
  const crop = await prisma.crop.findUnique({
    where: { farmId_cropNumber: { farmId, cropNumber } },
    include: {
      placements: true,
      daily: { orderBy: { date: "asc" } },
    },
  });

  if (!crop) return null;

  // --- Production ---
  const birdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);
  const totalMort   = crop.daily.reduce((s, r) => s + r.mort, 0);
  const totalCulls  = crop.daily.reduce((s, r) => s + r.culls, 0);
  const totalLosses = totalMort + totalCulls;
  const mortalityPct = birdsPlaced > 0 ? (totalLosses / birdsPlaced) * 100 : 0;

  // --- Feed (from daily records) ---
  const totalFeedKg = crop.daily.reduce((s, r) => s + r.feedKg, 0);

  // --- Crop length ---
  const placementDate = new Date(crop.placementDate);
  const endDate = crop.finishDate
    ? new Date(crop.finishDate)
    : crop.daily.length > 0
    ? new Date(crop.daily[crop.daily.length - 1].date)
    : null;
  const cropLengthDays = endDate
    ? Math.round((endDate.getTime() - placementDate.getTime()) / 86400000)
    : null;

  // --- Final weight ---
  const weightRecords = crop.daily.filter((r) => r.avgWeightG !== null);
  const lastWeightG   = weightRecords.length > 0
    ? weightRecords[weightRecords.length - 1].avgWeightG!
    : null;
  const finalAvgWeightKg = crop.finalAvgWeightKg ?? (lastWeightG ? lastWeightG / 1000 : null);

  // --- Birds sold (final) ---
  const finalBirdsSold = crop.finalBirdsSold ?? (birdsPlaced - totalLosses);

  // --- FCR ---
  let fcr: number | null = null;
  if (finalAvgWeightKg && finalAvgWeightKg > 0 && finalBirdsSold > 0 && totalFeedKg > 0) {
    fcr = totalFeedKg / (finalBirdsSold * finalAvgWeightKg);
  }

  // --- EPEF ---
  // EPEF = (livability% × avgWeightKg × 100) / (FCR × cropLengthDays)
  let epef: number | null = null;
  if (fcr && fcr > 0 && cropLengthDays && cropLengthDays > 0 && finalAvgWeightKg && birdsPlaced > 0) {
    const livabilityPct = ((birdsPlaced - totalLosses) / birdsPlaced) * 100;
    epef = (livabilityPct * finalAvgWeightKg * 100) / (fcr * cropLengthDays);
  }

  // --- Margin ---
  let finalMarginGbp: number | null = null;
  if (crop.finalRevenueGbp !== null) {
    // Use stored revenue minus feed cost from feed records
    const feedDeliveryCost = await prisma.feedRecord.findMany({ where: { cropId: crop.id } });
    const feedCost = feedDeliveryCost.reduce((s, r) => {
      const fc = r.feedPricePerTonneGbp ? (r.feedKg / 1000) * r.feedPricePerTonneGbp : 0;
      const wc = r.wheatPricePerTonneGbp ? (r.wheatKg / 1000) * r.wheatPricePerTonneGbp : 0;
      return s + fc + wc;
    }, 0);
    finalMarginGbp = crop.finalRevenueGbp - feedCost;
  } else if (
    crop.finalBirdsSold !== null &&
    crop.finalAvgWeightKg !== null &&
    crop.salePricePerKgAllIn !== null
  ) {
    const feedDeliveryCost = await prisma.feedRecord.findMany({ where: { cropId: crop.id } });
    const feedCost = feedDeliveryCost.reduce((s, r) => {
      const fc = r.feedPricePerTonneGbp ? (r.feedKg / 1000) * r.feedPricePerTonneGbp : 0;
      const wc = r.wheatPricePerTonneGbp ? (r.wheatKg / 1000) * r.wheatPricePerTonneGbp : 0;
      return s + fc + wc;
    }, 0);
    const revenue = crop.finalBirdsSold * crop.finalAvgWeightKg * crop.salePricePerKgAllIn;
    finalMarginGbp = revenue - feedCost;
  }

  // --- Thin / Clear per crop ---
  // Thin 1: earliest thinDate
  const thin1Dates  = crop.placements.map((p) => p.thinDate).filter(Boolean) as Date[];
  const thin2Dates  = crop.placements.map((p) => p.thin2Date).filter(Boolean) as Date[];
  const clearDates  = crop.placements.map((p) => p.clearDate).filter(Boolean) as Date[];

  const earliest = (dates: Date[]) =>
    dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;

  const thin1Date  = earliest(thin1Dates);
  const thin2Date  = earliest(thin2Dates);
  const clearDate  = earliest(clearDates);

  const dateDiff = (d: Date | null) =>
    d ? Math.round((d.getTime() - placementDate.getTime()) / 86400000) : null;

  const ageThinDays  = dateDiff(thin1Date);
  const ageThin2Days = dateDiff(thin2Date);
  const ageClearDays = dateDiff(clearDate);

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
    // feed
    totalFeedKg,
    // length & weight
    cropLengthDays,
    finalAvgWeightKg,
    finalBirdsSold,
    // performance
    fcr,
    epef,
    finalMarginGbp,
    // thin / clear
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
