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

const METRIC_COLORS: Record<string, string> = {
  water:  "#2563eb",  // blue
  feed:   "#ca8a04",  // amber/yellow
  weight: "#111827",  // black
};

const HOUSE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#0284c7",
];

// Crop A = solid, Crop B = dashed
const CROP_DASH = [undefined, "6 3"];

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
  type TargetMaps = {
    weight: Map<number, number>;
    water:  Map<number, number>;
    feed:   Map<number, number>;
    temp:   Map<number, number>;
  };
  // Load global template once as fallback for any missing per-crop targets
  const globalTemplate = await prisma.targetProfile.findFirst({
    where: { farmId, scope: "GLOBAL_TEMPLATE" },
    include: { days: { orderBy: { dayNumber: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  const globalMaps: TargetMaps = { weight: new Map(), water: new Map(), feed: new Map(), temp: new Map() };
  if (globalTemplate) {
    for (const d of globalTemplate.days) {
      if (d.weightTargetG)      globalMaps.weight.set(d.dayNumber, d.weightTargetG);
      if (d.waterTargetMl)      globalMaps.water.set(d.dayNumber, d.waterTargetMl);
      if (d.feedTargetG)        globalMaps.feed.set(d.dayNumber, d.feedTargetG);
      if (d.temperatureTargetC) globalMaps.temp.set(d.dayNumber, d.temperatureTargetC);
    }
  }

  const targetMaps = new Map<string, TargetMaps>();
  for (const crop of crops) {
    const cropProfile = await prisma.targetProfile.findFirst({
      where: { cropId: crop.id },
      include: { days: { orderBy: { dayNumber: "asc" } } },
    });
    // Start with global template values, override with crop-specific where set
    const maps: TargetMaps = {
      weight: new Map(globalMaps.weight),
      water:  new Map(globalMaps.water),
      feed:   new Map(globalMaps.feed),
      temp:   new Map(globalMaps.temp),
    };
    if (cropProfile) {
      for (const d of cropProfile.days) {
        if (d.weightTargetG)      maps.weight.set(d.dayNumber, d.weightTargetG);
        if (d.waterTargetMl)      maps.water.set(d.dayNumber, d.waterTargetMl);
        if (d.feedTargetG)        maps.feed.set(d.dayNumber, d.feedTargetG);
        if (d.temperatureTargetC) maps.temp.set(d.dayNumber, d.temperatureTargetC);
      }
    }
    targetMaps.set(crop.id, maps);
  }

  // Helper: build Map<day, birdsRemovedOnThatDay> for a given set of placements
  const buildThinMap = (placements: typeof crops[0]["placements"], placementDate: Date, houseId?: string) => {
    const m = new Map<number, number>();
    const filtered = houseId ? placements.filter(p => p.houseId === houseId) : placements;
    for (const p of filtered) {
      const addThin = (date: Date | null | undefined, birds: number | null | undefined) => {
        if (!date || !birds) return;
        const d = Math.floor((new Date(date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24));
        if (d >= 1) m.set(d, (m.get(d) ?? 0) + birds);
      };
      addThin(p.thinDate,  p.thinBirds);
      addThin(p.thin2Date, p.thin2Birds);
    }
    return m;
  };

  // Helper: cumulative thin birds removed up to and including a given day
  const cumulativeThin = (thinMap: Map<number, number>, day: number) => {
    let total = 0;
    for (const [d, birds] of thinMap) {
      if (d <= day) total += birds;
    }
    return total;
  };

  // ── Multi-house mode: one series per house (single crop, single metric) ──
  if (view === "multi") {
    const houseIds = (searchParams.get("houseIds") ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (houseIds.length === 0) {
      return NextResponse.json({ error: "houseIds required for multi view." }, { status: 400 });
    }
    const crop = crops[0];
    const placementDate = new Date(crop.placementDate);
    const cropTargets = targetMaps.get(crop.id) ?? { weight: new Map(), water: new Map(), feed: new Map(), temp: new Map() };

    type DayAggM = {
      totalBirds: number; waterL: number; feedKg: number;
      weightSum: number; weightCount: number;
      tempMinSum: number; tempMaxSum: number; tempCount: number;
    };

    const multiSeries: Array<{
      id: string; label: string; color: string; unit: string;
      axis: "left" | "right"; metric: string; cropId: string;
      strokeDash: string | undefined; data: Array<{ day: number; value: number | null }>;
    }> = [];

    for (let hi = 0; hi < houseIds.length; hi++) {
      const houseId = houseIds[hi];
      const houseName = houseMap.get(houseId) ?? houseId;
      const color = HOUSE_COLORS[hi % HOUSE_COLORS.length];

      const daily = await prisma.dailyRecord.findMany({
        where: { cropId: crop.id, houseId },
        orderBy: { date: "asc" },
        select: {
          date: true, houseId: true, mort: true, culls: true,
          feedKg: true, waterL: true, avgWeightG: true,
          temperatureMinC: true, temperatureMaxC: true,
        },
      });

      const houseBirds = crop.placements
        .filter(p => p.houseId === houseId)
        .reduce((s, p) => s + p.birdsPlaced, 0);

      // thin events for this house: day → birds removed
      const thinMap = buildThinMap(crop.placements, placementDate, houseId);

      // Compute running birds per day exactly like the table:
      // birds = birdsPlaced - cumMort - cumCulls - thin(only after thin day, not on thin day)
      let cumLosses = 0;
      const birdsByDay = new Map<number, number>();
      for (const rec of daily) {
        const day = Math.floor(
          (new Date(rec.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (day < 1) continue;
        cumLosses += (rec.mort || 0) + (rec.culls || 0);
        let birds = houseBirds - cumLosses;
        // subtract thin only after thin date (same as table: rowDateStr > thinDateStr)
        let cumThinAfter = 0;
        for (const [td, tb] of thinMap) { if (td < day) cumThinAfter += tb; }
        birds = Math.max(0, birds - cumThinAfter);
        // On thin day: feed/water consumed before thin → use pre-thin count (add thinToday back)
        const thinToday = thinMap.get(day) ?? 0;
        birdsByDay.set(day, birds + thinToday);
      }

      const byDay = new Map<number, DayAggM>();
      for (const rec of daily) {
        const day = Math.floor(
          (new Date(rec.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (day < 1 || day > 60) continue;
        const birds = birdsByDay.get(day) ?? 0;
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

      for (const met of metrics) {
        if (met === "temperature") {
          const data: Array<{ day: number; value: number | null }> = [];
          for (let d = 1; d <= 42; d++) {
            const agg = byDay.get(d);
            const val = agg && agg.tempCount > 0
              ? +(((agg.tempMinSum + agg.tempMaxSum) / 2) / agg.tempCount).toFixed(1)
              : null;
            data.push({ day: d, value: val });
          }
          multiSeries.push({ id: `${houseId}-temp`, label: houseName, color, unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: undefined, data });
        } else {
          const data: Array<{ day: number; value: number | null }> = [];
          for (let d = 1; d <= 42; d++) {
            const agg = byDay.get(d);
            let val: number | null = null;
            if (agg && agg.totalBirds > 0) {
              if (met === "water")  val = +((agg.waterL / agg.totalBirds) * 1000).toFixed(2);
              if (met === "feed")   val = +((agg.feedKg / agg.totalBirds) * 1000).toFixed(3);
              if (met === "weight" && agg.weightCount > 0) {
                const avgG = agg.weightSum / agg.weightCount;
                const targetG = cropTargets.weight.get(d - 1);
                val = targetG && targetG > 0 ? +(avgG / targetG * 100).toFixed(1) : +(avgG).toFixed(0);
              }
            }
            data.push({ day: d, value: val });
          }
          multiSeries.push({ id: `${houseId}-${met}`, label: houseName, color, unit: METRIC_UNITS[met] ?? "", axis: METRIC_AXIS[met] ?? "left", metric: met, cropId: crop.id, strokeDash: undefined, data });
        }
      }
    }

    // Add single target series for multi-house mode (one target, same for all houses)
    for (const met of metrics) {
      if (met === "temperature" && cropTargets.temp.size > 0) {
        const tData = Array.from({ length: 42 }, (_, i) => {
          const d = i + 1;
          const t = cropTargets.temp.get(d);
          return { day: d, value: t != null ? +(t).toFixed(1) : null };
        });
        multiSeries.push({ id: "target-temp", label: "Temp target", color: "#86efac", unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: "4 3", data: tData });
      } else if (met === "water" && cropTargets.water.size > 0) {
        const tData = Array.from({ length: 42 }, (_, i) => {
          const d = i + 1;
          const t = cropTargets.water.get(d);
          return { day: d, value: t != null ? +(t).toFixed(1) : null };
        });
        multiSeries.push({ id: "target-water", label: "Water target", color: "#93c5fd", unit: "L/1000", axis: "left", metric: "water", cropId: crop.id, strokeDash: "4 3", data: tData });
      } else if (met === "feed" && cropTargets.feed.size > 0) {
        const tData = Array.from({ length: 42 }, (_, i) => {
          const d = i + 1;
          const t = cropTargets.feed.get(d);
          return { day: d, value: t != null ? +(t).toFixed(1) : null };
        });
        multiSeries.push({ id: "target-feed", label: "Feed target", color: "#fcd34d", unit: "kg/1000", axis: "left", metric: "feed", cropId: crop.id, strokeDash: "4 3", data: tData });
      }
    }

    return NextResponse.json({
      series: multiSeries,
      crops: crops.map(c => ({ id: c.id, label: `Crop ${c.cropNumber}`, placementDate: c.placementDate, status: c.status })),
      houses,
    });
  }

  // ── Standard mode ──
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
    const cropTargets   = targetMaps.get(crop.id) ?? { weight: new Map(), water: new Map(), feed: new Map(), temp: new Map() };

    const whereHouse = view === "avg" ? {} : { houseId: view };
    const daily = await prisma.dailyRecord.findMany({
      where: { cropId: crop.id, ...whereHouse },
      orderBy: [{ houseId: "asc" }, { date: "asc" }],
      select: {
        date: true, houseId: true, mort: true, culls: true,
        feedKg: true, waterL: true, avgWeightG: true,
        temperatureMinC: true, temperatureMaxC: true,
      },
    });

    const placementBirds = new Map<string, number>();
    for (const p of crop.placements) {
      placementBirds.set(p.houseId, (placementBirds.get(p.houseId) ?? 0) + p.birdsPlaced);
    }

    // thin events per house
    const thinMapByHouse = new Map<string, Map<number, number>>();
    for (const p of crop.placements) {
      if (!thinMapByHouse.has(p.houseId)) thinMapByHouse.set(p.houseId, new Map());
      const m = thinMapByHouse.get(p.houseId)!;
      const addThin = (date: Date | null | undefined, birds: number | null | undefined) => {
        if (!date || !birds) return;
        const d = Math.floor((new Date(date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24));
        if (d >= 1) m.set(d, (m.get(d) ?? 0) + birds);
      };
      addThin(p.thinDate, p.thinBirds);
      addThin(p.thin2Date, p.thin2Birds);
    }

    // Compute running birds per house per day (same formula as table)
    const cumLossesByHouse = new Map<string, number>();
    const birdsByHouseDay = new Map<string, number>(); // key: `${houseId}:${day}`
    for (const rec of daily) {
      const day = Math.floor(
        (new Date(rec.date).getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (day < 1) continue;
      const prev = cumLossesByHouse.get(rec.houseId) ?? 0;
      const cum = prev + (rec.mort || 0) + (rec.culls || 0);
      cumLossesByHouse.set(rec.houseId, cum);
      const housePlaced = placementBirds.get(rec.houseId) ?? 0;
      const houseThinMap = thinMapByHouse.get(rec.houseId) ?? new Map<number, number>();
      let cumThinAfter = 0;
      for (const [td, tb] of houseThinMap) { if (td < day) cumThinAfter += tb; }
      const thinToday = houseThinMap.get(day) ?? 0;
      const birds = Math.max(0, housePlaced - cum - cumThinAfter) + thinToday;
      birdsByHouseDay.set(`${rec.houseId}:${day}`, birds);
    }

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
      const birds = birdsByHouseDay.get(`${rec.houseId}:${day}`) ?? 0;
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

    const cropLabel  = `Crop ${crop.cropNumber}`;
    const cropDash   = CROP_DASH[ci] ?? CROP_DASH[0];
    const cropSuffix = crops.length > 1 ? ` (${cropLabel})` : "";

    for (const met of metrics) {
      if (met === "temperature") {
        // Always show min + max as separate lines
        const dataMin: Array<{ day: number; value: number | null }> = [];
        const dataMax: Array<{ day: number; value: number | null }> = [];
        for (let d = 1; d <= 42; d++) {
          const agg = byDay.get(d);
          dataMin.push({ day: d, value: agg && agg.tempCount > 0 ? +(agg.tempMinSum / agg.tempCount).toFixed(1) : null });
          dataMax.push({ day: d, value: agg && agg.tempCount > 0 ? +(agg.tempMaxSum / agg.tempCount).toFixed(1) : null });
        }
        series.push({ id: `${crop.id}-temp-min`, label: `Temp min${cropSuffix}`, color: "#2563eb", unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: cropDash, data: dataMin });
        series.push({ id: `${crop.id}-temp-max`, label: `Temp max${cropSuffix}`, color: "#dc2626", unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: cropDash ? "2 2" : "4 2", data: dataMax });
        // Temperature target line
        if (cropTargets.temp.size > 0) {
          const tData = Array.from({ length: 42 }, (_, i) => {
            const d = i + 1;
            const t = cropTargets.temp.get(d);
            return { day: d, value: t != null ? +(t).toFixed(1) : null };
          });
          series.push({ id: `${crop.id}-temp-target`, label: `Temp target${cropSuffix}`, color: "#86efac", unit: "°C", axis: "right", metric: "temperature", cropId: crop.id, strokeDash: "4 3", data: tData });
        }
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
              const targetG = cropTargets.weight.get(d - 1); // weight entered on day d is from day d-1
              val = targetG && targetG > 0 ? +(avgG / targetG * 100).toFixed(1) : +(avgG).toFixed(0);
            }
          }
          data.push({ day: d, value: val });
        }
        series.push({
          id:         `${crop.id}-${met}`,
          label:      `${METRIC_LABELS[met] ?? met}${cropSuffix}`,
          color:      METRIC_COLORS[met] ?? "#64748b",
          unit:       METRIC_UNITS[met] ?? "",
          axis:       METRIC_AXIS[met] ?? "left",
          metric:     met,
          cropId:     crop.id,
          strokeDash: cropDash,
          data,
        });

        // Add target line for water / feed
        if (met === "water" && cropTargets.water.size > 0) {
          const tData = Array.from({ length: 42 }, (_, i) => {
            const d = i + 1;
            const t = cropTargets.water.get(d);
            return { day: d, value: t != null ? +(t).toFixed(1) : null };
          });
          series.push({ id: `${crop.id}-water-target`, label: `Water target${cropSuffix}`, color: "#93c5fd", unit: "L/1000", axis: "left", metric: "water", cropId: crop.id, strokeDash: "4 3", data: tData });
        }
        if (met === "feed" && cropTargets.feed.size > 0) {
          const tData = Array.from({ length: 42 }, (_, i) => {
            const d = i + 1;
            const t = cropTargets.feed.get(d);
            return { day: d, value: t != null ? +(t).toFixed(1) : null };
          });
          series.push({ id: `${crop.id}-feed-target`, label: `Feed target${cropSuffix}`, color: "#fcd34d", unit: "kg/1000", axis: "left", metric: "feed", cropId: crop.id, strokeDash: "4 3", data: tData });
        }
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
