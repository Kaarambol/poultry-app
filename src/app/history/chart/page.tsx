"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";

type CropOption = {
  id: string;
  cropNumber: string;
  placementDate: string;
  status: string;
};

type HouseOption = {
  id: string;
  name: string;
};

type Series = {
  id: string;
  label: string;
  color: string;
  unit: string;
  metric: string;
  cropId: string;
  data: Array<{ day: number; value: number | null }>;
};

const METRICS = [
  { key: "water",       label: "Water",       unit: "L / 1000" },
  { key: "feed",        label: "Feed",        unit: "kg / 1000" },
  { key: "weight",      label: "Weight",      unit: "g / bird" },
  { key: "temperature", label: "Temperature", unit: "°C" },
];

// Group series by metric for separate chart panels
function groupByMetric(series: Series[]): Record<string, Series[]> {
  const groups: Record<string, Series[]> = {};
  for (const s of series) {
    if (!groups[s.metric]) groups[s.metric] = [];
    groups[s.metric].push(s);
  }
  return groups;
}

// Merge series data into chart-friendly format: [{day:1, "seriesId": val, ...}]
function buildChartData(seriesGroup: Series[]): Record<string, number | null>[] {
  const rows: Record<string, number | null>[] = [];
  for (let d = 1; d <= 42; d++) {
    const row: Record<string, number | null> = { day: d };
    for (const s of seriesGroup) {
      const point = s.data.find(p => p.day === d);
      row[s.id] = point?.value ?? null;
    }
    rows.push(row);
  }
  return rows;
}

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export default function HistoryChartPage() {
  const [farmId] = useState(() => getCurrentFarmId());
  const [allCrops, setAllCrops] = useState<CropOption[]>([]);

  // Mode
  const [cropMode, setCropMode] = useState<"1" | "2">("1");

  // Crop selection
  const [cropA, setCropA] = useState("");
  const [cropB, setCropB] = useState("");

  // View (avg or houseId)
  const [view, setView] = useState("avg");
  const [availableHouses, setAvailableHouses] = useState<HouseOption[]>([]);

  // Metrics
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["water"]);   // multi for 1-crop
  const [selectedMetric,  setSelectedMetric]  = useState("water");               // single for 2-crop

  // Results
  const [series, setSeries]   = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [hasChart, setHasChart] = useState(false);

  // Load all crops for this farm
  useEffect(() => {
    if (!farmId) return;
    fetch(`/api/crops/list?farmId=${farmId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllCrops(data);
      });
  }, [farmId]);

  // When crops change, fetch available houses
  useEffect(() => {
    const ids = cropMode === "1" ? [cropA] : [cropA, cropB];
    const valid = ids.filter(Boolean);
    if (valid.length === 0) { setAvailableHouses([]); setView("avg"); return; }
    fetch(`/api/history/chart-compare?farmId=${farmId}&cropIds=${valid.join(",")}&metrics=water&view=avg`)
      .then(r => r.json())
      .then(data => {
        if (data.houses) setAvailableHouses(data.houses);
        else setAvailableHouses([]);
      })
      .catch(() => setAvailableHouses([]));
  }, [cropA, cropB, cropMode, farmId]);

  function toggleMetric(key: string) {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleGenerate() {
    setError("");
    setSeries([]);
    setHasChart(false);

    if (!farmId) { setError("Choose a farm in the top menu."); return; }
    if (!cropA)  { setError("Choose Crop A."); return; }
    if (cropMode === "2" && !cropB) { setError("Choose Crop B."); return; }
    if (cropMode === "1" && selectedMetrics.length === 0) { setError("Choose at least one metric."); return; }

    const cropIds = cropMode === "1" ? cropA : `${cropA},${cropB}`;
    const metricsParam = cropMode === "1"
      ? `metrics=${selectedMetrics.join(",")}`
      : `metric=${selectedMetric}`;

    setLoading(true);
    try {
      const r = await fetch(
        `/api/history/chart-compare?farmId=${farmId}&cropIds=${cropIds}&${metricsParam}&view=${view}`
      );
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Error loading data."); return; }
      setSeries(data.series ?? []);
      setHasChart(true);
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  }

  const grouped = groupByMetric(series);

  const cropLabel = (id: string) => {
    const c = allCrops.find(x => x.id === id);
    if (!c) return id;
    const d = new Date(c.placementDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    return `Crop ${c.cropNumber} (${d})${c.status === "ACTIVE" ? " ★" : ""}`;
  };

  if (!farmId) {
    return (
      <div className="mobile-page"><div className="page-shell">
        <div className="mobile-alert">Choose a farm in the top menu first.</div>
      </div></div>
    );
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">

        {/* Header */}
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">History</div>
            <h1 className="page-intro__title">Chart Comparison</h1>
            <p className="page-intro__subtitle">
              Compare water, feed, weight and temperature across crops — per 1000 birds.
            </p>
            <div style={{ marginTop: 10 }}>
              <Link href="/history" className="mobile-button mobile-button--secondary" style={{ display: "inline-flex" }}>
                ← Back to History
              </Link>
            </div>
          </div>
        </div>

        {/* Config card */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>

          {/* Step 1: mode */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", marginBottom: 8 }}>
              Step 1 — How many crops?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["1", "2"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setCropMode(m); setView("avg"); }}
                  style={{
                    padding: "8px 22px",
                    borderRadius: 8,
                    border: cropMode === m ? "2px solid #2563eb" : "1px solid #dbe3ee",
                    background: cropMode === m ? "#eff6ff" : "#fff",
                    color: cropMode === m ? "#1d4ed8" : "#5d6b82",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  {m} crop{m === "2" ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: crop selection */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", marginBottom: 8 }}>
              Step 2 — Select crop{cropMode === "2" ? "s" : ""}
            </div>
            <div className={cropMode === "2" ? "mobile-grid mobile-grid--2" : ""}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#2563eb", fontWeight: 700 }}>Crop A</label>
                <select value={cropA} onChange={e => { setCropA(e.target.value); setView("avg"); }}>
                  <option value="">— choose crop —</option>
                  {allCrops.map(c => (
                    <option key={c.id} value={c.id}>{cropLabel(c.id)}</option>
                  ))}
                </select>
              </div>
              {cropMode === "2" && (
                <div>
                  <label style={{ fontSize: "0.78rem", color: "#7c3aed", fontWeight: 700 }}>Crop B</label>
                  <select value={cropB} onChange={e => { setCropB(e.target.value); setView("avg"); }}
                    disabled={!cropA}>
                    <option value="">— choose crop —</option>
                    {allCrops.filter(c => c.id !== cropA).map(c => (
                      <option key={c.id} value={c.id}>{cropLabel(c.id)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: view */}
          {cropA && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", marginBottom: 8 }}>
                Step 3 — View
              </div>
              <select value={view} onChange={e => setView(e.target.value)}>
                <option value="avg">Average — whole crop</option>
                {availableHouses.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              {availableHouses.length > 0 && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>
                  {cropMode === "2"
                    ? "Same house compared between both crops."
                    : "Average or specific house within this crop."}
                </div>
              )}
            </div>
          )}

          {/* Step 4: metrics */}
          {cropA && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", marginBottom: 8 }}>
                Step 4 — {cropMode === "1" ? "Metrics (choose any)" : "Metric (choose one)"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {METRICS.map(m => {
                  const active = cropMode === "1"
                    ? selectedMetrics.includes(m.key)
                    : selectedMetric === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => cropMode === "1" ? toggleMetric(m.key) : setSelectedMetric(m.key)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: 8,
                        border: active ? "2px solid #2563eb" : "1px solid #dbe3ee",
                        background: active ? "#eff6ff" : "#fff",
                        color: active ? "#1d4ed8" : "#5d6b82",
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      {m.label}
                      <span style={{ fontSize: "0.65rem", marginLeft: 4, opacity: 0.7 }}>{m.unit}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate */}
          <button
            className="mobile-full-button"
            type="button"
            onClick={handleGenerate}
            disabled={loading || !cropA}
          >
            {loading ? "Loading…" : "Generate Chart"}
          </button>

          {error && (
            <div className="mobile-alert mobile-alert--error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>

        {/* Charts */}
        {hasChart && series.length === 0 && (
          <div className="mobile-card">
            <p style={{ margin: 0, color: "#64748b" }}>No data found for the selected combination.</p>
          </div>
        )}

        {hasChart && Object.entries(grouped).map(([metric, metricSeries]) => {
          const chartData   = buildChartData(metricSeries);
          const metricInfo  = METRICS.find(m => m.key === metric);
          const title       = metricInfo?.label ?? metric;
          const unit        = metricInfo?.unit ?? "";

          return (
            <div key={metric} className="mobile-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{title}</h2>
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{unit}</span>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                {metricSeries.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 600 }}>
                    <span style={{ width: 14, height: 4, background: s.color, display: "inline-block", borderRadius: 2 }} />
                    {s.label}
                  </div>
                ))}
              </div>

              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10 }}
                      label={{ value: "Day", position: "insideBottomRight", offset: -4, fontSize: 10 }}
                      tickCount={10}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const s = metricSeries.find(x => x.id === name);
                        const v = typeof value === "number" ? value : null;
                        return [v != null ? `${fmt(v)} ${s?.unit ?? ""}` : "—", s?.label ?? String(name)];
                      }}
                      labelFormatter={(label) => `Day ${label}`}
                      contentStyle={{ fontSize: "0.78rem" }}
                    />
                    {metricSeries.map(s => (
                      <Line
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        name={s.id}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
