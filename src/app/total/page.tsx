"use client";

import { useEffect, useState, useMemo } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
  floorAreaM2?: number;
};

type FinancialSummary = {
  crop: {
    id: string;
    cropNumber: string;
    status: string;
    currency: string;
    placementDate: string;
    chickenPricePerKg: number | null;
    salePricePerKgAllIn: number | null;
    finalBirdsSold: number | null;
    finalAvgWeightKg: number | null;
    finalRevenueGbp: number | null;
    finalNotes: string | null;
    saleWeightKg: number | null;
    acceptWeightKg: number | null;
    cropEndDate: string | null;
    updatedAt?: string;
  };
  production: {
    birdsPlaced: number;
    mort: number;
    culls: number;
    totalLosses: number;
    birdsAlive: number;
    mortalityPct: number;
    currentLiveBirds: number;
    lastAvgWeightKg: number | null;
    liveFCR: number | null;
    ageDays: number;
    totalFloorAreaM2: number;
  };
  feed: {
    totalFeedKg: number;
    totalWheatKg: number;
    totalDeliveredKg: number;
    totalFeedCostGbp: number;
    totalFeedUsedKg: number;
  };
  liveEstimate: {
    estimatedRevenueGbp: number | null;
    estimatedMarginGbp: number | null;
  };
  finalReal: {
    finalRevenueGbp: number | null;
    finalMarginGbp: number | null;
  };
  final: {
    avgAge: number | null;
    fcr: number | null;
    epef: number | null;
    grossMarginGbp: number | null;
    revenue: number | null;
    chickCost: number;
  };
  n1: {
    ageDays: number;
    totalFeedConsumedKg: number;
    consumedFeedCostGbp: number;
    theoreticalRevenue: number | null;
    chickCost: number;
    grossMarginGbp: number | null;
    fcr: number | null;
    epef: number | null;
  };
};

export default function TotalPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmData, setFarmData] = useState<Farm | null>(null);
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [summary, setSummary] = useState<FinancialSummary | null>(null);

  const [finalBirdsSold, setFinalBirdsSold] = useState("");
  const [finalAvgWeightKg, setFinalAvgWeightKg] = useState("");
  const [finalRevenueGbp, setFinalRevenueGbp] = useState("");
  const [finalNotes, setFinalNotes] = useState("");

  const [saleWeightKg, setSaleWeightKg] = useState("");
  const [acceptWeightKg, setAcceptWeightKg] = useState("");
  const [cropSaved, setCropSaved] = useState(false);

  const [prevCropFinishDate, setPrevCropFinishDate] = useState<string | null>(null);
  const [cropHouses, setCropHouses] = useState<{ houseId: string; houseName: string }[]>([]);
  const [houseWeightInputs, setHouseWeightInputs] = useState<Record<string, string>>({});
  const [weightSaving, setWeightSaving] = useState(false);

  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  // --- Calculations ---

  const metrics = useMemo(() => {
    if (!summary) return null;

    const age = summary.production.ageDays;

    // Length of crop in weeks (capped at cropEndDate, same as ageDays)
    const cropEndMs = summary.crop.cropEndDate
      ? Math.min(Date.now(), new Date(summary.crop.cropEndDate).getTime() + 24 * 60 * 60 * 1000)
      : Date.now();
    let lengthCropDays: number;
    if (prevCropFinishDate) {
      const prevEnd = new Date(prevCropFinishDate).getTime();
      lengthCropDays = Math.max(1, Math.floor((cropEndMs - prevEnd) / (1000 * 60 * 60 * 24)));
    } else {
      lengthCropDays = age + 10;
    }
    const lengthCrop = lengthCropDays / 7;

    const floorArea = summary.production.totalFloorAreaM2 || 1;

    // N-1 metrics (live estimates)
    const n1 = summary.n1;
    const n1Margin = n1.grossMarginGbp !== null && lengthCropDays > 0 && floorArea > 0
      ? n1.grossMarginGbp / lengthCropDays / floorArea
      : null;

    // Final metrics (from factory report)
    const fin = summary.final;
    const finalMargin = fin.grossMarginGbp !== null && lengthCropDays > 0 && floorArea > 0
      ? fin.grossMarginGbp / lengthCropDays / floorArea
      : null;

    return { age, lengthCrop, lengthCropDays, floorArea,
      n1Fcr: n1.fcr, n1Epef: n1.epef, n1Margin,
      finalFcr: fin.fcr, finalEpef: fin.epef, finalMargin,
      finalAvgAge: fin.avgAge,
    };
  }, [summary, prevCropFinishDate]);

  // --- Functions ---

  async function loadFarmData(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (Array.isArray(data)) {
      const farm = data.find((f: Farm) => f.id === farmId);
      setFarmData(farm || null);
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();
    if (r.ok) setMyRole(data.role || "");
  }

  async function loadActiveCrop(farmId: string) {
    const [rActive, rHistory] = await Promise.all([
      fetch(`/api/crops/active?farmId=${farmId}`),
      fetch(`/api/crops/history?farmId=${farmId}`),
    ]);

    const active = rActive.ok ? await rActive.json() : null;
    const history = rHistory.ok ? await rHistory.json() : [];
    const historyList = Array.isArray(history) ? history : [];

    if (active) {
      // Active crop found
      setCropId(active.id);
      setCropLabel(active.cropNumber);
      setCropSaved(false);
      setCurrentCropId(active.id);
      await loadSummary(active.id);
      setMsg("");
      // Previous crop = most recent finished crop
      setPrevCropFinishDate(historyList[0]?.finishDate ?? null);
    } else if (historyList.length > 0) {
      // No active crop — show last saved crop
      const last = historyList[0];
      setCropId(last.id);
      setCropLabel(last.cropNumber);
      setCropSaved(true);
      setCurrentCropId(last.id);
      await loadSummary(last.id);
      setMsg("");
      // Previous crop = second in history
      setPrevCropFinishDate(historyList[1]?.finishDate ?? null);
    } else {
      setMsg("No crop found.");
      setSummary(null);
    }
  }

  async function loadSummary(selectedCropId: string) {
    const [rSummary, rCrop] = await Promise.all([
      fetch(`/api/crops/financial-summary?cropId=${selectedCropId}`),
      fetch(`/api/crops/${selectedCropId}`),
    ]);
    const data = await rSummary.json();
    if (rSummary.ok) {
      setSummary(data);
      if (!finalBirdsSold) setFinalBirdsSold(data.crop.finalBirdsSold?.toString() || "");
      if (!finalAvgWeightKg) setFinalAvgWeightKg(data.crop.finalAvgWeightKg?.toString() || "");
      if (!saleWeightKg) setSaleWeightKg(data.crop.saleWeightKg?.toString() || "");
      if (!acceptWeightKg) setAcceptWeightKg(data.crop.acceptWeightKg?.toString() || "");
    }
    if (rCrop.ok) {
      const cropData = await rCrop.json();
      const placements: any[] = cropData.placements || [];
      const seen = new Set<string>();
      const houses: { houseId: string; houseName: string }[] = [];
      for (const p of placements) {
        if (!seen.has(p.houseId)) {
          seen.add(p.houseId);
          houses.push({ houseId: p.houseId, houseName: p.houseName || p.houseId });
        }
      }
      houses.sort((a, b) => a.houseName.localeCompare(b.houseName, undefined, { numeric: true }));
      setCropHouses(houses);
      setHouseWeightInputs(prev => {
        const next: Record<string, string> = {};
        for (const h of houses) next[h.houseId] = prev[h.houseId] ?? "";
        return next;
      });
    }
  }

  const handleRestore = () => {
    if (!summary) return;
    setFinalBirdsSold(summary.crop.finalBirdsSold?.toString() || "");
    setFinalAvgWeightKg(summary.crop.finalAvgWeightKg?.toString() || "");
    setFinalRevenueGbp(summary.crop.finalRevenueGbp?.toString() || "");
    setFinalNotes(summary.crop.finalNotes || "");
    setMsgType("info");
    setMsg(`Restored values from: ${summary.crop.updatedAt ? new Date(summary.crop.updatedAt).toLocaleString() : 'N/A'}`);
  };

  async function saveFinalReal(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/crops/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropId, finalBirdsSold, finalAvgWeightKg, finalRevenueGbp, finalNotes, saleWeightKg, acceptWeightKg }),
    });
    if (r.ok) {
      setMsgType("success");
      setMsg("Factory report saved. FCR / EPEF / Margin updated.");
      await loadSummary(cropId);
    } else {
      setMsgType("error");
      setMsg("Error saving factory report.");
    }
  }

  async function saveHouseWeights() {
    const weights = cropHouses
      .map(h => ({ houseId: h.houseId, avgWeightG: parseFloat(houseWeightInputs[h.houseId] || "0") }))
      .filter(w => w.avgWeightG > 0);
    if (weights.length === 0) return;
    setWeightSaving(true);
    await fetch("/api/crops/final-weights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropId, weights }),
    });
    await loadSummary(cropId);
    setWeightSaving(false);
    setMsgType("success");
    setMsg("Weights saved. FCR updated.");
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();
    if (farmId) {
      setCurrentFarmIdState(farmId);
      loadFarmData(farmId);
      loadMyRole(farmId);
      loadActiveCrop(farmId);
    }
  }, []);

  const canOperate = canOperateUi(myRole);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        {/* Header Section */}
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Economics</div>
            <h1 className="page-intro__title">Total & Margin</h1>
          </div>
          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Context</div>
              <div>
                Crop: {cropLabel}
                {cropSaved && (
                  <span style={{ marginLeft: 8, background: "#d1fae5", color: "#065f46", borderRadius: 6, padding: "2px 8px", fontSize: "0.8rem", fontWeight: 700 }}>
                    CROP SAVED
                  </span>
                )}
                {" "} | Role: {myRole}
              </div>
            </div>
          </div>
        </div>

        {msg && <div className={`mobile-alert mobile-alert--${msgType}`}>{msg}</div>}

        {summary && metrics && (
          <>
            {/* Efficiency Metrics */}
            <div className="mobile-card">
              <h2>Efficiency Metrics</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Current Age</div>
                  <div className="mobile-kpi__value">{metrics.age} days</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Length Crop</div>
                  <div className="mobile-kpi__value">{metrics.lengthCrop.toFixed(2)} weeks</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">FCR {metrics.finalFcr ? "(Final)" : "(Live N-1)"}</div>
                  <div className="mobile-kpi__value">
                    {(metrics.finalFcr ?? metrics.n1Fcr) != null
                      ? (metrics.finalFcr ?? metrics.n1Fcr)!.toFixed(3)
                      : "—"}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">EPEF {metrics.finalEpef ? "(Final)" : "(Live N-1)"}</div>
                  <div className="mobile-kpi__value" style={{ color: "var(--primary)", fontWeight: "bold" }}>
                    {(metrics.finalEpef ?? metrics.n1Epef) != null
                      ? (metrics.finalEpef ?? metrics.n1Epef)!.toFixed(0)
                      : "—"}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Margin/m²/day {metrics.finalMargin != null ? "(Final)" : "(Live N-1)"}</div>
                  <div className="mobile-kpi__value" style={{
                    color: (metrics.finalMargin ?? metrics.n1Margin) != null && (metrics.finalMargin ?? metrics.n1Margin)! >= 0
                      ? "var(--primary)" : "#e53e3e",
                    fontWeight: "bold"
                  }}>
                    {(metrics.finalMargin ?? metrics.n1Margin) != null
                      ? (metrics.finalMargin ?? metrics.n1Margin)!.toFixed(4)
                      : "—"}
                  </div>
                </div>
                {metrics.finalAvgAge != null && (
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Avg Age (weighted)</div>
                    <div className="mobile-kpi__value">{metrics.finalAvgAge.toFixed(2)} days</div>
                  </div>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-soft)" }}>
                Final values use factory report data · Live values use day N-1 data
                {summary.crop.cropEndDate && (
                  <> · Crop end: {new Date(summary.crop.cropEndDate).toLocaleDateString("en-GB")}</>
                )}
              </p>
            </div>

            {/* Production & Feed Summary (merged) */}
            <div className="mobile-card">
              <h2>Production & Feed Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds placed</div>
                  <div className="mobile-kpi__value">{summary.production.birdsPlaced.toLocaleString()}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds alive</div>
                  <div className="mobile-kpi__value">{summary.production.birdsAlive.toLocaleString()}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mortality %</div>
                  <div className="mobile-kpi__value">{summary.production.mortalityPct.toFixed(2)}%</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed cost GBP</div>
                  <div className="mobile-kpi__value">{summary.feed.totalFeedCostGbp.toFixed(2)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Delivered kg</div>
                  <div className="mobile-kpi__value">{summary.feed.totalDeliveredKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Consumed kg (N-1)</div>
                  <div className="mobile-kpi__value">{summary.n1.totalFeedConsumedKg.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Factory Report */}
            <div className="mobile-card">
              <h2>Factory Report</h2>
              <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                Enter data from the factory report to calculate final FCR, EPEF and Margin.
                Live weight per house is entered in the Dashboard table.
              </p>
              <form onSubmit={saveFinalReal}>
                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Sale Weight (kg) — for EPEF & FCR</label>
                    <input type="number" step="0.001" value={saleWeightKg} onChange={e => setSaleWeightKg(e.target.value)} placeholder="e.g. 2.450" disabled={!canOperate} />
                  </div>
                  <div>
                    <label>Accept Weight (kg) — for Margin</label>
                    <input type="number" step="0.001" value={acceptWeightKg} onChange={e => setAcceptWeightKg(e.target.value)} placeholder="e.g. 2.200" disabled={!canOperate} />
                  </div>
                  <div>
                    <label>Total Birds Sold</label>
                    <input type="number" value={finalBirdsSold} onChange={e => setFinalBirdsSold(e.target.value)} disabled={!canOperate} />
                  </div>
                  <div>
                    <label>Average Birds Weight (kg)</label>
                    <input type="number" step="0.001" value={finalAvgWeightKg} onChange={e => setFinalAvgWeightKg(e.target.value)} disabled={!canOperate} />
                  </div>
                </div>
                <label>Notes</label>
                <textarea value={finalNotes} onChange={e => setFinalNotes(e.target.value)} disabled={!canOperate} />
                {canOperate && (
                  <div className="mobile-sticky-actions">
                    <button className="mobile-full-button" type="submit">Save & Update FCR / EPEF / Margin</button>
                  </div>
                )}
              </form>
            </div>

            {cropSaved && (
              <div className="mobile-card" style={{ background: "#d1fae5", border: "2px solid #6ee7b7" }}>
                <h2 style={{ color: "#065f46", margin: 0 }}>Crop Saved</h2>
                <p style={{ color: "#047857", margin: "8px 0 0" }}>
                  This crop has been finalized and saved to history.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}