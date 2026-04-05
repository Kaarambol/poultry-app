"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

type ChartRow = {
  dayNumber: number;
  label: string;
  date: string | null;
  birdsAliveCurrentDay: number;
  dailyMortalityPct: number | null;
  feedPerBird: number | null;
  waterPerBird: number | null;
  weightPercent: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  co2MinPpm: number | null;
  co2MaxPpm: number | null;
  feedTargetG: number | null;
  waterTargetMl: number | null;
  weightTargetG: number | null;
  temperatureTargetC: number | null;
  humidityTargetPct: number | null;
  notes: string | null;
};

type ChartsResponse = {
  house: {
    id: string;
    name: string;
    code: string | null;
    farmId: string;
    farmName: string;
  };
  crop: {
    id: string;
    cropNumber: string;
    placementDate: string;
  };
  birdsPlaced: number;
  thinBirdsTotal: number;
  thin2BirdsTotal: number;
  thinDays: number[];
  thin2Days: number[];
  clearDays: number[];
  chartData: ChartRow[];
};

// Custom plugin: draws vertical red lines at thin/clear day indices
const verticalLinesPlugin = {
  id: "verticalLines",
  afterDraw(chart: any) {
    const lines: { index: number; color: string; dash: number[] }[] =
      chart.options.plugins?.verticalLines?.lines || [];
    if (!lines.length) return;
    const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
    for (const line of lines) {
      const xPos = x.getPixelForTick(line.index);
      if (xPos == null) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = line.color;
      ctx.setLineDash(line.dash);
      ctx.stroke();
      ctx.restore();
    }
  },
};

ChartJS.register(verticalLinesPlugin);

export default function HouseChartsPage({
  params,
}: {
  params: Promise<{ houseId: string }>;
}) {
  const [houseId, setHouseId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [houseCode, setHouseCode] = useState<string | null>(null);
  const [cropLabel, setCropLabel] = useState("");
  const [data, setData] = useState<ChartRow[]>([]);
  const [birdsPlaced, setBirdsPlaced] = useState(0);
  const [thinBirdsTotal, setThinBirdsTotal] = useState(0);
  const [thin2BirdsTotal, setThin2BirdsTotal] = useState(0);
  const [thinDays, setThinDays] = useState<number[]>([]);
  const [thin2Days, setThin2Days] = useState<number[]>([]);
  const [clearDays, setClearDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setHouseId(resolved.houseId);
    }
    init();
  }, [params]);

  useEffect(() => {
    if (!houseId) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/houses/${houseId}/charts`);
        const json: ChartsResponse | { error: string } = await res.json();

        if (!res.ok) {
          throw new Error(
            "error" in json ? json.error : "Failed to load chart data."
          );
        }

        const payload = json as ChartsResponse;
        setHouseName(payload.house.name);
        setHouseCode(payload.house.code);
        setCropLabel(`Crop ${payload.crop.cropNumber}`);
        setBirdsPlaced(payload.birdsPlaced || 0);
        setThinBirdsTotal(payload.thinBirdsTotal || 0);
        setThin2BirdsTotal(payload.thin2BirdsTotal || 0);
        setThinDays(payload.thinDays || []);
        setThin2Days(payload.thin2Days || []);
        setClearDays(payload.clearDays || []);
        setData(payload.chartData || []);
      } catch (err: any) {
        setError(err.message || "Failed to load chart data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [houseId]);

  function buildLines() {
    const lines: { index: number; color: string; dash: number[] }[] = [];
    for (const d of thinDays) {
      const idx = d - 1;
      if (idx >= 0 && idx < 45) lines.push({ index: idx, color: "#dc2626", dash: [6, 3] });
    }
    for (const d of thin2Days) {
      const idx = d - 1;
      if (idx >= 0 && idx < 45) lines.push({ index: idx, color: "#dc2626", dash: [6, 3] });
    }
    for (const d of clearDays) {
      const idx = d - 1;
      if (idx >= 0 && idx < 45) lines.push({ index: idx, color: "#7f1d1d", dash: [4, 2] });
    }
    return lines;
  }

  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        verticalLines: { lines: buildLines() },
      },
    };
  }

  const labels = data.map((d) => d.label);

  function lineDataset(
    label: string,
    values: (number | null)[],
    color: string,
    dashed = false
  ) {
    return {
      label,
      data: values,
      borderColor: color,
      backgroundColor: color,
      tension: 0.25,
      spanGaps: true,
      borderDash: dashed ? [6, 6] : undefined,
    };
  }

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-card">
            <p style={{ margin: 0 }}>Loading charts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-alert mobile-alert--error">{error}</div>
          <Link href="/dashboard" className="mobile-button mobile-button--secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">House charts</div>
            <h1 className="page-intro__title">
              {houseName}
              {houseCode ? ` (${houseCode})` : ""}
            </h1>
            <p className="page-intro__subtitle">
              {cropLabel} · 45 day view
            </p>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <Link href="/dashboard" className="mobile-button mobile-button--secondary">
            Back to Dashboard
          </Link>
          <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#555' }}>
            <strong>Birds Placed:</strong> {birdsPlaced.toLocaleString()}
            {thinDays.length > 0 && (
              <> | <strong>Thin 1:</strong> {thinBirdsTotal > 0 ? `${thinBirdsTotal.toLocaleString()} birds (day ${thinDays[0]})` : <span style={{color:'red'}}>day {thinDays[0]} — birds count missing!</span>}</>
            )}
            {thin2Days.length > 0 && (
              <> | <strong>Thin 2:</strong> {thin2BirdsTotal > 0 ? `${thin2BirdsTotal.toLocaleString()} birds (day ${thin2Days[0]})` : <span style={{color:'red'}}>day {thin2Days[0]} — birds count missing!</span>}</>
            )}
          </div>
        </div>

        {data.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No chart data available.</p>
          </div>
        ) : (
          <>
            <div className="mobile-card">
              <h2>Weight %</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Weight %",
                        data.map((d) => d.weightPercent),
                        "#000000"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>Feed (g/bird)</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Feed Actual (g/bird)",
                        data.map((d) => d.feedPerBird),
                        "#2563eb"
                      ),
                      lineDataset(
                        "Feed Target (g/bird)",
                        data.map((d) => d.feedTargetG),
                        "#dc2626"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>Water (ml/bird)</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Water Actual (ml/bird)",
                        data.map((d) => d.waterPerBird),
                        "#2563eb"
                      ),
                      lineDataset(
                        "Water Target (ml/bird)",
                        data.map((d) => d.waterTargetMl),
                        "#dc2626"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>Temperature</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Temp Min",
                        data.map((d) => d.temperatureMinC),
                        "#2563eb"
                      ),
                      lineDataset(
                        "Temp Max",
                        data.map((d) => d.temperatureMaxC),
                        "#dc2626"
                      ),
                      lineDataset(
                        "Temp Target",
                        data.map((d) => d.temperatureTargetC),
                        "#000000"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>Humidity</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Humidity Min",
                        data.map((d) => d.humidityMinPct),
                        "#2563eb"
                      ),
                      lineDataset(
                        "Humidity Max",
                        data.map((d) => d.humidityMaxPct),
                        "#dc2626"
                      ),
                      lineDataset(
                        "Humidity Target",
                        data.map((d) => d.humidityTargetPct),
                        "#000000"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>CO₂</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "CO2 Min",
                        data.map((d) => d.co2MinPpm),
                        "#2563eb"
                      ),
                      lineDataset(
                        "CO2 Max",
                        data.map((d) => d.co2MaxPpm),
                        "#dc2626"
                      ),
                    ],
                  }}
                />
              </div>
            </div>

            <div className="mobile-card">
              <h2>Daily Mortality %</h2>
              <div style={{ height: 640 }}>
                <Line
                  options={baseOptions()}
                  data={{
                    labels,
                    datasets: [
                      lineDataset(
                        "Daily Mortality %",
                        data.map((d) => d.dailyMortalityPct),
                        "#000000"
                      ),
                    ],
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}