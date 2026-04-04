"use client";

import { useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";

type CropStats = {
  id: string;
  cropNumber: string;
  status: string;
  breed: string | null;
  placementDate: string;
  finishDate: string | null;
  currency: string;
  birdsPlaced: number;
  totalMort: number;
  totalCulls: number;
  totalLosses: number;
  mortalityPct: number;
  totalFeedKg: number;
  cropLengthDays: number | null;
  finalAvgWeightKg: number | null;
  finalBirdsSold: number | null;
  fcr: number | null;
  epef: number | null;
  finalMarginGbp: number | null;
  ageThinDays: number | null;
  ageThin2Days: number | null;
  ageClearDays: number | null;
  birdsSoldThin: number;
  birdsSoldThin2: number;
  birdsSoldClear: number;
};

function fmt(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined) return "—";
  return Number.isFinite(v) ? v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "—";
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB");
}

function Row({
  label,
  v1,
  v2,
  highlight,
  unit,
}: {
  label: string;
  v1: string;
  v2: string;
  highlight?: boolean;
  unit?: string;
}) {
  const suf = unit ? ` ${unit}` : "";
  return (
    <tr style={{ borderBottom: "1px solid #f0f4f8" }}>
      <td style={{ padding: "8px 6px", color: "#555", fontSize: "0.82rem", width: "38%" }}>{label}</td>
      <td
        style={{
          padding: "8px 6px",
          textAlign: "right",
          fontWeight: highlight ? 700 : 500,
          fontSize: "0.88rem",
          color: highlight ? "#1d4ed8" : "#1e293b",
        }}
      >
        {v1}{suf}
      </td>
      <td
        style={{
          padding: "8px 6px",
          textAlign: "right",
          fontWeight: highlight ? 700 : 500,
          fontSize: "0.88rem",
          color: highlight ? "#1d4ed8" : "#1e293b",
        }}
      >
        {v2}{suf}
      </td>
    </tr>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={3}
        style={{
          padding: "10px 6px 4px",
          fontSize: "0.72rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#94a3b8",
          borderBottom: "2px solid #e2e8f0",
        }}
      >
        {label}
      </td>
    </tr>
  );
}

export default function CropComparePage() {
  const [num1, setNum1] = useState("");
  const [num2, setNum2] = useState("");
  const [result, setResult] = useState<{ crop1: CropStats; crop2: CropStats } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);

    const farmId = getCurrentFarmId();
    if (!farmId) {
      setError("Select a farm in the top menu first.");
      return;
    }
    if (!num1.trim() || !num2.trim()) {
      setError("Enter two crop numbers.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(
        `/api/crops/compare?farmId=${farmId}&cropNumber1=${encodeURIComponent(num1.trim())}&cropNumber2=${encodeURIComponent(num2.trim())}`
      );
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Error loading data.");
        return;
      }
      setResult(data);
    } catch {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  }

  const c1 = result?.crop1;
  const c2 = result?.crop2;
  const currency = c1?.currency ?? "GBP";

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">History</div>
            <h1 className="page-intro__title">Crop Comparison</h1>
            <p className="page-intro__subtitle">
              Enter two crop numbers to compare their results side by side.
            </p>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCompare}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Crop A</label>
                <input
                  type="text"
                  placeholder="e.g. 3009"
                  value={num1}
                  onChange={(e) => setNum1(e.target.value)}
                />
              </div>
              <div>
                <label>Crop B</label>
                <input
                  type="text"
                  placeholder="e.g. 3008"
                  value={num2}
                  onChange={(e) => setNum2(e.target.value)}
                />
              </div>
            </div>
            <button className="mobile-full-button" type="submit" disabled={loading}>
              {loading ? "Loading..." : "Compare"}
            </button>
          </form>
          {error && (
            <div className="mobile-alert mobile-alert--error" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>

        {c1 && c2 && (
          <div className="mobile-card">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 280 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #2563eb" }}>
                    <th style={{ padding: "8px 6px", textAlign: "left", fontSize: "0.78rem", color: "#64748b" }}>
                      Metric
                    </th>
                    <th
                      style={{
                        padding: "8px 6px",
                        textAlign: "right",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: "#2563eb",
                        background: "#f0f7ff",
                        borderRadius: "4px 4px 0 0",
                      }}
                    >
                      {c1.cropNumber}
                    </th>
                    <th
                      style={{
                        padding: "8px 6px",
                        textAlign: "right",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: "#7c3aed",
                        background: "#f5f3ff",
                        borderRadius: "4px 4px 0 0",
                      }}
                    >
                      {c2.cropNumber}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* General */}
                  <SectionHeader label="General" />
                  <Row label="Status"          v1={c1.status}         v2={c2.status} />
                  <Row label="Breed"           v1={c1.breed ?? "—"}   v2={c2.breed ?? "—"} />
                  <Row label="Placement date"  v1={fmtDate(c1.placementDate)} v2={fmtDate(c2.placementDate)} />
                  <Row label="Finish date"     v1={fmtDate(c1.finishDate)}    v2={fmtDate(c2.finishDate)} />
                  <Row label="Crop length"     v1={fmt(c1.cropLengthDays)}    v2={fmt(c2.cropLengthDays)} unit="days" highlight />

                  {/* Birds */}
                  <SectionHeader label="Birds" />
                  <Row label="Birds placed"    v1={fmt(c1.birdsPlaced)}    v2={fmt(c2.birdsPlaced)} highlight />
                  <Row label="Mortality"       v1={fmt(c1.totalMort)}      v2={fmt(c2.totalMort)} />
                  <Row label="Culls"           v1={fmt(c1.totalCulls)}     v2={fmt(c2.totalCulls)} />
                  <Row label="Total losses"    v1={fmt(c1.totalLosses)}    v2={fmt(c2.totalLosses)} />
                  <Row label="Mortality %"     v1={fmt(c1.mortalityPct, 2)} v2={fmt(c2.mortalityPct, 2)} unit="%" highlight />
                  <Row label="Birds sold (final)" v1={fmt(c1.finalBirdsSold)} v2={fmt(c2.finalBirdsSold)} />

                  {/* Feed */}
                  <SectionHeader label="Feed" />
                  <Row label="Total feed"      v1={fmt(c1.totalFeedKg, 0)} v2={fmt(c2.totalFeedKg, 0)} unit="kg" highlight />
                  <Row label="Avg final weight" v1={fmt(c1.finalAvgWeightKg, 3)} v2={fmt(c2.finalAvgWeightKg, 3)} unit="kg" />
                  <Row label="FCR"             v1={fmt(c1.fcr, 3)}         v2={fmt(c2.fcr, 3)} highlight />

                  {/* Performance */}
                  <SectionHeader label="Performance" />
                  <Row label="EPEF"            v1={fmt(c1.epef, 1)}         v2={fmt(c2.epef, 1)} highlight />
                  <Row label={`Margin (${currency})`} v1={fmt(c1.finalMarginGbp, 2)} v2={fmt(c2.finalMarginGbp, 2)} highlight />

                  {/* Thinning & Clearance */}
                  <SectionHeader label="Thinning / Clearance" />
                  {(c1.ageThinDays !== null || c2.ageThinDays !== null) && (
                    <Row label="Age at thin 1"   v1={fmt(c1.ageThinDays)}  v2={fmt(c2.ageThinDays)}  unit="days" />
                  )}
                  {(c1.birdsSoldThin > 0 || c2.birdsSoldThin > 0) && (
                    <Row label="Birds sold thin 1" v1={fmt(c1.birdsSoldThin)} v2={fmt(c2.birdsSoldThin)} />
                  )}
                  {(c1.ageThin2Days !== null || c2.ageThin2Days !== null) && (
                    <Row label="Age at thin 2"   v1={fmt(c1.ageThin2Days)} v2={fmt(c2.ageThin2Days)} unit="days" />
                  )}
                  {(c1.birdsSoldThin2 > 0 || c2.birdsSoldThin2 > 0) && (
                    <Row label="Birds sold thin 2" v1={fmt(c1.birdsSoldThin2)} v2={fmt(c2.birdsSoldThin2)} />
                  )}
                  {(c1.ageClearDays !== null || c2.ageClearDays !== null) && (
                    <Row label="Age at clearance" v1={fmt(c1.ageClearDays)} v2={fmt(c2.ageClearDays)} unit="days" highlight />
                  )}
                  {(c1.birdsSoldClear > 0 || c2.birdsSoldClear > 0) && (
                    <Row label="Birds sold clear" v1={fmt(c1.birdsSoldClear)} v2={fmt(c2.birdsSoldClear)} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
