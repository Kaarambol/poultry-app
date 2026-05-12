import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/history/chart-compare
// ?farmId=X&cropIds=a,b&metric=water&view=avg|<houseId>
// ?farmId=X&cropIds=a&metrics=water,feed,weight,temperature&view=avg|<houseId>

const SERIES_COLORS: string[][] = [
  ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"], // blues for crop A
  ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"], // purples for crop B
];

const METRIC_UNITS: Record<string, string> = {
  water:       "L / 1000 birds",
  feed:        "kg / 1000 birds",
  weight:      "g / bird",
  temperature: "°C",
};

const METRIC_LABELS: Record<string, string> = {
  water:       "Water",
  feed:        "Feed",
  weight:      "Weight",
  temperature: "Temperature",
};

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const farmId   = searchParams.get("farmId") ?? "";
  const cropIds  = (searchParams.get("cropIds") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const metric   = searchParams.get("metric") ?? "";         // single metric (2-crop mode)
  const metrics  = (searchParams.get("metrics") ?? "").split(",").map(s => s.trim()).filter(Boolean); // multi (1-crop mode)
  const view     = searchParams.get("view") ?? "avg";        // "avg" or houseId

  if (!farmId || cropIds.length === 0) {
    return NextResponse.json({ error: "farmId and cropIds required." }, { status: 400 });
  }

  const effectiveMetrics = metric ? [metric] : metrics;
  if (effectiveMetrics.length === 0) {
    return NextResponse.json({ error: "metric(s) required." }, { status: 400 });
  }

  // Load crops with placements
  const crops = await prisma.crop.findMany({
    where: { id: { in: cropIds }, farmId },
    include: {
      placements: {
        include: { house: { select: { id: true, name: true } } },
        orderBy: { placementDate: "asc" },
      },
    },
  });

  if (crops.length === 0) {
    return NextResponse.json({ error: "No crops found." }, { status: 404 });
  }

  // Collect all houses across crops (for frontend dropdowns)
  const houseMap = new Map<string, string>();
  for (const crop of crops) {
    for (const p of crop.placements) {
      houseMap.set(p.house.id, p.house.name);
    }
  }
  const houses = Array.from(houseMap.entries()).map(([id, name]) => ({ id, name }));

  const series: Array<{
    id: string;
    label: string;
    color: string;
    unit: string;
    metric: string;
    cropId: string;
    data: Array<{ day: number; value: number | null }>;
  }> = [];

  for (let ci = 0; ci < crops.length; ci++) {
    const crop = crops[ci];
    const placementDate = new Date(crop.placementDate);

    // Get daily records — filtered by house if view !== "avg"
    const whereHouse = view === "avg" ? {} : { houseId: view };
    const daily = await prisma.dailyRecord.findMany({
      where: { cropId: crop.id, ...whereHouse },
      orderBy: { date: "asc" },
      select: {
        date: true,
        houseId: true,
        birdsTotal: true,
        feedKg: true,
        waterL: true,
        avgWeightG: true,
        temperatureMinC: true,
        temperatureMaxC: true,
      },
    });

    // Get placements for birds-placed per house
    const placementBirds = new Map<string, number>();
    for (const p of crop.placements) {
      placementBirds.set(p.houseId, (placementBirds.get(p.houseId) ?? 0) + p.birdsPlaced);
    }
    const totalBirdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);

    // Group daily records by day-of-age, aggregate across houses
    type DayAgg = {
      totalBirds: number;
      waterL: number;
      feedKg: number;
      weightSum: number;
      weightCount: number;
      tempMinSum: number;
      tempMaxSum: number;
      tempCount: number;
    };

    const byDay = new Map<number, DayAgg>();

    for (const rec of daily) {
      const day = Math.floor(
        (new Date(rec.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (day < 1 || day > 60) continue;

      const birds = rec.birdsTotal > 0 ? rec.birdsTotal : (placementBirds.get(rec.houseId) ?? totalBirdsPlaced);

      const existing = byDay.get(day);
      if (existing) {
        existing.totalBirds  += birds;
        existing.waterL      += rec.waterL;
        existing.feedKg      += rec.feedKg;
        if (rec.avgWeightG != null) { existing.weightSum += rec.avgWeightG; existing.weightCount++; }
        if (rec.temperatureMinC != null && rec.temperatureMaxC != null) {
          existing.tempMinSum += rec.temperatureMinC;
          existing.tempMaxSum += rec.temperatureMaxC;
          existing.tempCount++;
        }
      } else {
        byDay.set(day, {
          totalBirds:  birds,
          waterL:      rec.waterL,
          feedKg:      rec.feedKg,
          weightSum:   rec.avgWeightG ?? 0,
          weightCount: rec.avgWeightG != null ? 1 : 0,
          tempMinSum:  rec.temperatureMinC ?? 0,
          tempMaxSum:  rec.temperatureMaxC ?? 0,
          tempCount:   (rec.temperatureMinC != null && rec.temperatureMaxC != null) ? 1 : 0,
        });
      }
    }

    const cropLabel = `Crop ${crop.cropNumber}`;
    const colorSet  = SERIES_COLORS[ci] ?? SERIES_COLORS[0];
    let colorIdx    = 0;

    for (const met of effectiveMetrics) {
      const color = colorSet[colorIdx++ % colorSet.length];

      if (met === "temperature") {
        // For 1-crop mode: split into min and max lines
        if (cropIds.length === 1) {
          const dataMin: Array<{ day: number; value: number | null }> = [];
          const dataMax: Array<{ day: number; value: number | null }> = [];
          for (let d = 1; d <= 42; d++) {
            const agg = byDay.get(d);
            dataMin.push({ day: d, value: agg && agg.tempCount > 0 ? parseFloat((agg.tempMinSum / agg.tempCount).toFixed(1)) : null });
            dataMax.push({ day: d, value: agg && agg.tempCount > 0 ? parseFloat((agg.tempMaxSum / agg.tempCount).toFixed(1)) : null });
          }
          series.push({ id: `${crop.id}-temp-min`, label: `${cropLabel} – Temp min`, color: colorSet[colorIdx++ % colorSet.length], unit: METRIC_UNITS.temperature, metric: "temperature", cropId: crop.id, data: dataMin });
          series.push({ id: `${crop.id}-temp-max`, label: `${cropLabel} – Temp max`, color: colorSet[colorIdx++ % colorSet.length], unit: METRIC_UNITS.temperature, metric: "temperature", cropId: crop.id, data: dataMax });
        } else {
          // 2-crop mode: avg temperature
          const data: Array<{ day: number; value: number | null }> = [];
          for (let d = 1; d <= 42; d++) {
            const agg = byDay.get(d);
            const val = agg && agg.tempCount > 0
              ? parseFloat(((agg.tempMinSum + agg.tempMaxSum) / (2 * agg.tempCount)).toFixed(1))
              : null;
            data.push({ day: d, value: val });
          }
          series.push({ id: `${crop.id}-temperature`, label: `${cropLabel} – Temp avg`, color, unit: METRIC_UNITS.temperature, metric: "temperature", cropId: crop.id, data });
        }
      } else {
        const data: Array<{ day: number; value: number | null }> = [];
        for (let d = 1; d <= 42; d++) {
          const agg = byDay.get(d);
          let val: number | null = null;
          if (agg && agg.totalBirds > 0) {
            if (met === "water")  val = parseFloat(((agg.waterL  / agg.totalBirds) * 1000).toFixed(2));
            if (met === "feed")   val = parseFloat(((agg.feedKg  / agg.totalBirds) * 1000).toFixed(3));
            if (met === "weight" && agg.weightCount > 0) val = parseFloat((agg.weightSum / agg.weightCount).toFixed(0));
          }
          data.push({ day: d, value: val });
        }
        series.push({
          id:     `${crop.id}-${met}`,
          label:  `${cropLabel} – ${METRIC_LABELS[met] ?? met}`,
          color,
          unit:   METRIC_UNITS[met] ?? "",
          metric: met,
          cropId: crop.id,
          data,
        });
      }
    }
  }

  return NextResponse.json({
    series,
    crops: crops.map(c => ({
      id:            c.id,
      label:         `Crop ${c.cropNumber}`,
      placementDate: c.placementDate,
      status:        c.status,
    })),
    houses,
  });
}
