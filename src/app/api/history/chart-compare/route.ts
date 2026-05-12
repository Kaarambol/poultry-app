import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/history/chart-compare
// ?farmId=X&cropIds=a,b&metrics=water,feed,weight,temperature&view=avg|<houseId>

const METRIC_UNITS: Record<string, string> = {
  water:       "L / 1000",
  feed:        "kg / 1000",
  weight:      "% target",
  temperature: "°C",
};

const METRIC_LABELS: Record<string, string> = {
  water:       "Water",
  feed:        "Feed",
  weight:      "Weight %",
  temperature: "Temperature",
};

// Which Y-axis each metric belongs to
export const METRIC_AXIS: Record<string, "left" | "right"> = {
  water:       "left",
  feed:        "left",
  weight:      "right",
  temperature: "right",
};

const CROP_COLORS = [
  ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"],  // blues — Crop A
  ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"],  // purples — Crop B
];

const METRIC_DASH: Record<string, string | undefined> = {
  water:       undefined,
  feed:        "6 3",
  weight:      undefined,
  temperature: "2 4",
};

export async function GET(req: NextRequest) {
  const uid = req.cookies.get("uid")?.value;
  if (!uid) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const farmId  = searchParams.get("farmId") ?? "";
  const cropIds = (searchParams.get("cropIds") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const metrics = (searchParams.get("metrics") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const view    = searchParams.get("view") ?? "avg";

  if (!farmId || cropIds.length === 0) {
    return NextResponse.json({ error: "farmId and cropIds required." }, { status: 400 });
  }
  if (metrics.length === 0) {
    return NextResponse.json({ error: "metrics required." }, { status: 400 });
  }

  // Load crops + placements
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

  // Houses available (union across crops)
  const houseMap = new Map<string, string>();
  for (const crop of crops) {
    for (const p of crop.placements) houseMap.set(p.house.id, p.house.name);
  }
  const houses = Array.from(houseMap.entries()).map(([id, name]) => ({ id, name }));

  // Load target profiles per crop (crop-specific → fallback to farm global template)
  const targetMaps = new Map<string, Map<number, number>>();
  for (const crop of crops) {
    let profile = await prisma.targetProfile.findFirst({
      where: { cropId: crop.id },
      include: { days: { orderBy: { dayNumber: "asc" } } },
    });
    if (!profile || profile.days.length === 0) {
      profile = await prisma.targetProfile.findFirst({
        where: { farmId, scope: "GLOBAL_TEMPLATE" },
        include: { days: { orderBy: { dayNumber: "asc" } } },
        orderBy: { updatedAt: "desc" },
      });
    }
    const map = new Map<number, number>();
    if (profile) {
      for (const d of profile.days) {
        if (d.weightTargetG) map.set(d.dayNumber, d.weightTargetG);
      }
    }
    targetMaps.set(crop.id, map);
  }

  const series: Array<{
    id: string;
    label: string;
    color: string;
    unit: string;
    axis: "left" | "right";
    metric: string;
    cropId: string;
    strokeDash: string | undefined;
    data: Array<{ day: number; value: number | null }>;
  }> = [];

  for (let ci = 0; ci < crops.length; ci++) {
    const crop          = crops[ci];
    const placementDate = new Date(crop.placementDate);
    const colorSet      = CROP_COLORS[ci] ?? CROP_COLORS[0];
    const targetMap     = targetMaps.get(crop.id) ?? new Map<number, number>();

    const whereHouse = view === "avg" ? {} : { houseId: view };
    const daily = await prisma.dailyRecord.findMany({
      where: { cropId: crop.id, ...whereHouse },
      orderBy: { date: "asc" },
      select: {
        date: true, houseId: true, birdsTotal: true,
        feedKg: true, waterL: true, avgWeightG: true,
        temperatureMinC: true, temperatureMaxC: true,
      },
    });

    const placementBirds = new Map<string, number>();
    for (const p of crop.placements) {
      placementBirds.set(p.houseId, (placementBirds.get(p.houseId) ?? 0) + p.birdsPlaced);
    }
    const totalBirdsPlaced = crop.placements.reduce((s, p) => s + p.birdsPlaced, 0);

    type DayAgg = {
      totalBirds: number; waterL: number; feedKg: number;
      weightSum: number; weightCount: number;
      tempMinSum: number; tempMaxSum: number; tempCount: number;
    };
    const byDay = new Map<number, DayAgg>();

    for (const rec of daily) {
      const day = Math.floor(
        (new Date(rec.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (day < 1 || day > 60) continue;
      const birds = rec.birdsTotal > 0 ? rec.birdsTotal : (placementBirds.get(rec.houseId) ?? totalBirdsPlaced);
      const ex = byDay.get(day);
      if (ex) {
        ex.totalBirds += birds; ex.waterL += rec.waterL; ex.feedKg += rec.feedKg;
        if (rec.avgWeightG != null) { ex.weightSum += rec.avgWeightG; ex.weightCount++; }
        if (rec.temperatureMinC != null && rec.temperatureMaxC != null) {
          ex.tempMinSum += rec.temperatureMinC; ex.tempMaxSum += rec.temperatureMaxC; ex.tempCount++;
        }
      } else {
        byDay.set(day, {
          totalBirds: birds, waterL: rec.waterL, feedKg: rec.feedKg,
          weightSum: rec.avgWeightG ?? 0, weightCount: rec.avgWeightG != null ? 1 : 0,
          tempMinSum: rec.temperatureMinC ?? 0, tempMaxSum: rec.temperatureMaxC ?? 0,
          tempCount: (rec.temperatureMinC != null && rec.temperatureMaxC != null) ? 1 : 0,
        });
      }
    }

    const cropLabel = `Crop ${crop.cropNumber}`;
    let colorIdx = 0;

    for (const met of metrics) {
      const color     = colorSet[colorIdx++ % colorSet.length];
      const strokeDash = METRIC_DASH[met];

      if (met === "temperature" && crops.length === 1) {
        // 1-crop mode: min + max lines
        const dataMin: Array<{ day: number; value: number | null }> = [];
        const dataMax: Array<{ day: number; value: number | null }> = [];
        for (let d = 1; d <= 42; d++) {
          const agg = byDay.get(d);
          dataMin.push({ day: d, value: agg && agg.tempCount > 0 ? +(agg.tempMinSum / agg.tempCount).toFixed(1) : null });
          dataMax.push({ day: d, value: agg && agg.tempCount > 0 ? +(agg.tempMaxSum / agg.tempCount).toFixed(1) : null });
        }
        series.push({ id: `${crop.id}-temp-min`, label: `${cropLabel} – Temp min`, color, unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash, data: dataMin });
        series.push({ id: `${crop.id}-temp-max`, label: `${cropLabel} – Temp max`, color: colorSet[colorIdx++ % colorSet.length], unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: "2 4", data: dataMax });
      } else {
        const data: Array<{ day: number; value: number | null }> = [];
        for (let d = 1; d <= 42; d++) {
          const agg = byDay.get(d);
          let val: number | null = null;
          if (agg && agg.totalBirds > 0) {
            if (met === "water")  val = +((agg.waterL / agg.totalBirds) * 1000).toFixed(2);
            if (met === "feed")   val = +((agg.feedKg / agg.totalBirds) * 1000).toFixed(3);
            if (met === "weight" && agg.weightCount > 0) {
              const avgG    = agg.weightSum / agg.weightCount;
              const targetG = targetMap.get(d);
              val = targetG && targetG > 0 ? +(avgG / targetG * 100).toFixed(1) : +(avgG).toFixed(0);
            }
            if (met === "temperature" && agg.tempCount > 0) {
              val = +((agg.tempMinSum + agg.tempMaxSum) / (2 * agg.tempCount)).toFixed(1);
            }
          }
          data.push({ day: d, value: val });
        }
        series.push({
          id: `${crop.id}-${met}`,
          label: `${cropLabel} – ${METRIC_LABELS[met] ?? met}`,
          color,
          unit: METRIC_UNITS[met] ?? "",
          axis: METRIC_AXIS[met] ?? "left",
          metric: met,
          cropId: crop.id,
          strokeDash,
          data,
        });
      }
    }
  }

  return NextResponse.json({
    series,
    crops: crops.map(c => ({
      id: c.id, label: `Crop ${c.cropNumber}`,
      placementDate: c.placementDate, status: c.status,
    })),
    houses,
  });
}
