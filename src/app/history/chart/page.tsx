"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import Link from "next/link";

type CropOption = { id: string; cropNumber: string; placementDate: string; status: string };
type HouseOption = { id: string; name: string };
type Series = {
  id: string; label: string; color: string; unit: string;
  axis: "left" | "right"; metric: string; cropId: string;
  strokeDash: string | undefined;
  data: Array<{ day: number; value: number | null }>;
};

const METRICS = [
  { key: "water",       label: "Water",       unit: "L/1000",   axis: "left"  },
  { key: "feed",        label: "Feed",        unit: "kg/1000",  axis: "left"  },
  { key: "weight",      label: "Weight %",    unit: "% target", axis: "right" },
  { key: "temperature", label: "Temperature", unit: "°C",       axis: "right" },
];

function buildChartData(series: Series[]) {
  return Array.from({ length: 42 }, (_, i) => {
    const day = i + 1;
    const row: Record<string, number | null | string> = { day };
    for (const s of series) {
      const pt = s.data.find(p => p.day === day);
      row[s.id] = pt?.value ?? null;
    }
    return row;
  });
}

function fmt(v: number | null | undefined, d = 1) {
  if (v == null) return "—";
  return v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function HistoryChartPage() {
  const [farmId] = useState(() => getCurrentFarmId());
  const [allCrops, setAllCrops] = useState<CropOption[]>([]);
  const [cropMode, setCropMode] = useState<"1" | "2">("1");
  const [cropA, setCropA] = useState("");
  const [cropB, setCropB] = useState("");
  const [view, setView] = useState("avg");
  const [availableHouses, setAvailableHouses] = useState<HouseOption[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["water", "weight"]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasChart, setHasChart] = useState(false);

  useEffect(() => {
    if (!farmId) return;
    fetch(`/api/crops/list?farmId=${farmId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllCrops(data); });
  }, [farmId]);

  // Fetch available houses whenever crop selection changes
  useEffect(() => {
    const ids = [cropA, cropMode === "2" ? cropB : ""].filter(Boolean);
    if (ids.length === 0) { setAvailableHouses([]); setView("avg"); return; }
    fetch(`/api/history/chart-compare?farmId=${farmId}&cropIds=${ids.join(",")}&metrics=water&view=avg`)
      .then(r => r.json())
      .then(data => { setAvailableHouses(Array.isArray(data.houses) ? data.houses : []); })
      .catch(() => setAvailableHouses([]));
  }, [cropA, cropB, cropMode, farmId]);

  function toggleMetric(key: string) {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function handleGenerate() {
    setError(""); setSeries([]); setHasChart(false);
    if (!farmId) { setError("Choose a farm in the top menu."); return; }
    if (!cropA)  { setError("Choose Crop A."); return; }
    if (cropMode === "2" && !cropB) { setError("Choose Crop B."); return; }
    if (selectedMetrics.length === 0) { setError("Choose at least one metric."); return; }

    const cropIds = cropMode === "1" ? cropA : `${cropA},${cropB}`;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/history/chart-compare?farmId=${farmId}&cropIds=${cropIds}&metrics=${selectedMetrics.join(",")}&view=${view}`
      );
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Error loading data."); return; }
      setSeries(data.series ?? []);
      setHasChart(true);
    } catch { setError("Connection error."); }
    finally { setLoading(false); }
  }

  const chartData = buildChartData(series);

  const hasLeft  = series.some(s => s.axis === "left");
  const hasRight = series.some(s => s.axis === "right");

  const cropLabel = (id: string) => {
    const c = allCrops.find(x => x.id === id);
    if (!c) return id;
    const d = new Date(c.placementDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    return `Crop ${c.cropNumber} (${d})${c.status === "ACTIVE" ? " ★" : ""}`;
  };

  // Axis label helpers
  const leftMetrics  = series.filter(s => s.axis === "left");
  const rightMetrics = series.filter(s => s.axis === "right");
  const leftLabel    = [...new Set(leftMetrics.map(s => s.unit))].join(" / ");
  const rightLabel   = [...new Set(rightMetrics.map(s => s.unit))].join(" / ");

  if (!farmId) return (
    <div className="mobile-page"><div className="page-shell">
      <div className="mobile-alert">Choose a farm in the top menu first.</div>
    </div></div>
  );

  return (
    <div className="mobile-page">
      <div className="page-shell">

        {/* Header */}
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">History</div>
            <h1 className="page-intro__title">Chart Comparison</h1>
            <p className="page-intro__subtitle">
              Compare metrics on one chart — water & feed on left axis, weight % & temperature on right axis.
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
            <div className="hist-step-label">Step 1 — How many crops?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["1", "2"] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => { setCropMode(m); setView("avg"); }}
                  style={{
                    padding: "8px 22px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
                    border: cropMode === m ? "2px solid #2563eb" : "1px solid #dbe3ee",
                    background: cropMode === m ? "#eff6ff" : "#fff",
                    color: cropMode === m ? "#1d4ed8" : "#5d6b82",
                  }}
                >
                  {m} crop{m === "2" ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: crop selection */}
          <div style={{ marginBottom: 18 }}>
            <div className="hist-step-label">Step 2 — Select crop{cropMode === "2" ? "s" : ""}</div>
            <div className={cropMode === "2" ? "mobile-grid mobile-grid--2" : ""}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#2563eb", fontWeight: 700 }}>Crop A (blue)</label>
                <select value={cropA} onChange={e => { setCropA(e.target.value); setView("avg"); }}>
                  <option value="">— choose —</option>
                  {allCrops.map(c => <option key={c.id} value={c.id}>{cropLabel(c.id)}</option>)}
                </select>
              </div>
              {cropMode === "2" && (
                <div>
                  <label style={{ fontSize: "0.78rem", color: "#7c3aed", fontWeight: 700 }}>Crop B (purple)</label>
                  <select value={cropB} onChange={e => { setCropB(e.target.value); setView("avg"); }} disabled={!cropA}>
                    <option value="">— choose —</option>
                    {allCrops.filter(c => c.id !== cropA).map(c => <option key={c.id} value={c.id}>{cropLabel(c.id)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: view */}
          {cropA && (
            <div style={{ marginBottom: 18 }}>
              <div className="hist-step-label">Step 3 — View</div>
              <select value={view} onChange={e => setView(e.target.value)}>
                <option value="avg">Average — whole crop</option>
                {availableHouses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              {cropMode === "2" && availableHouses.length > 0 && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>
                  Selecting a house compares the same house between both crops.
                </div>
              )}
            </div>
          )}

          {/* Step 4: metrics */}
          {cropA && (
            <div style={{ marginBottom: 18 }}>
              <div className="hist-step-label">Step 4 — Metrics</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {METRICS.map(m => {
                  const active = selectedMetrics.includes(m.key);
                  const isRight = m.axis === "right";
                  return (
                    <button key={m.key} type="button" onClick={() => toggleMetric(m.key)}
                      style={{
                        padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: "0.82rem",
                        border: active ? `2px solid ${isRight ? "#7c3aed" : "#2563eb"}` : "1px solid #dbe3ee",
                        background: active ? (isRight ? "#f5f3ff" : "#eff6ff") : "#fff",
                        color: active ? (isRight ? "#6d28d9" : "#1d4ed8") : "#5d6b82",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {m.label}
                      <span style={{ fontSize: "0.65rem", marginLeft: 4, opacity: 0.65 }}>{m.unit}</span>
                      <span style={{ fontSize: "0.6rem", marginLeft: 3, opacity: 0.5 }}>
                        {isRight ? "→R" : "←L"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 6 }}>
                L = left axis (water/feed) · R = right axis (weight%/temp)
              </div>
            </div>
          )}

          <button className="mobile-full-button" type="button"
            onClick={handleGenerate} disabled={loading || !cropA}>
            {loading ? "Loading…" : "Generate Chart"}
          </button>

          {error && (
            <div className="mobile-alert mobile-alert--error" style={{ marginTop: 12 }}>{error}</div>
          )}
        </div>

        {/* Chart */}
        {hasChart && series.length === 0 && (
          <div className="mobile-card">
            <p style={{ margin: 0, color: "#64748b" }}>No data found for the selected combination.</p>
          </div>
        )}

        {hasChart && series.length > 0 && (
          <div className="mobile-card" style={{ padding: "16px 8px" }}>
            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              {series.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontWeight: 600 }}>
                  <svg width="22" height="10">
                    <line x1="0" y1="5" x2="22" y2="5"
                      stroke={s.color} strokeWidth="2.5"
                      strokeDasharray={s.strokeDash ?? "none"} />
                  </svg>
                  <span style={{ color: "#1e293b" }}>{s.label}</span>
                  <span style={{ color: "#94a3b8", fontWeight: 400 }}>{s.unit}</span>
                </div>
              ))}
            </div>

            {/* Axis labels */}
            {(hasLeft || hasRight) && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4, paddingLeft: 40 }}>
                {hasLeft  && <span>← {leftLabel}</span>}
                {hasRight && <span style={{ marginLeft: "auto" }}>{rightLabel} →</span>}
              </div>
            )}

            <div style={{ width: "100%", height: 520 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: hasRight ? 56 : 12, bottom: 16, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }}
                    label={{ value: "Day of age", position: "insideBottomRight", offset: -4, fontSize: 10 }} />

                  {hasLeft && (
                    <YAxis yAxisId="left" orientation="left"
                      tick={{ fontSize: 10 }} width={42}
                      domain={["auto", "auto"]}
                    />
                  )}
                  {hasRight && (
                    <YAxis yAxisId="right" orientation="right"
                      tick={{ fontSize: 10 }} width={42}
                      domain={["auto", "auto"]}
                    />
                  )}

                  {/* 100% reference line for weight % */}
                  {series.some(s => s.metric === "weight") && (
                    <ReferenceLine yAxisId="right" y={100}
                      stroke="#94a3b8" strokeDasharray="4 2"
                      label={{ value: "100%", position: "insideTopRight", fontSize: 9, fill: "#94a3b8" }} />
                  )}

                  <Tooltip
                    formatter={(value, name) => {
                      const s = series.find(x => x.id === name);
                      const v = typeof value === "number" ? value : null;
                      return [v != null ? `${fmt(v, 1)} ${s?.unit ?? ""}` : "—", s?.label ?? String(name)];
                    }}
                    labelFormatter={(label) => `Day ${label}`}
                    contentStyle={{ fontSize: "0.78rem" }}
                  />

                  {series.map(s => (
                    <Line
                      key={s.id}
                      yAxisId={s.axis}
                      type="monotone"
                      dataKey={s.id}
                      stroke={s.color}
                      strokeWidth={s.metric === "weight" ? 2.5 : 2}
                      strokeDasharray={s.strokeDash}
                      dot={false}
                      connectNulls={false}
                      name={s.id}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      <style>{`
        .hist-step-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #5d6b82;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );
}
