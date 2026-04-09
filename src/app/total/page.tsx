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

    const birdsPlaced   = summary.production.birdsPlaced;
    const currentLiveBirds = summary.production.currentLiveBirds;
    const avgWeightKg   = summary.production.lastAvgWeightKg ?? 0;
    const fcr           = summary.production.liveFCR ?? 0;
    const age           = summary.production.ageDays;

    // EPEF (European Production Efficiency Factor)
    // uses current live birds (after thinning) and pre-computed FCR
    const survivalPct = birdsPlaced > 0 ? (currentLiveBirds / birdsPlaced) * 100 : 0;
    const epef = (age > 0 && fcr > 0 && avgWeightKg > 0)
      ? (survivalPct * avgWeightKg * 100) / (age * fcr)
      : 0;

    // Length of crop in weeks:
    // - First crop (no prev finish date): (age + 10 days) / 7
    // - Subsequent crops: (capped now − prev crop's last clear date) / 7
    // Both use the same capped endpoint as current age (stops at last clear date)
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
    const lengthCrop = lengthCropDays / 7; // in weeks

    const floorArea = summary.production.totalFloorAreaM2 || 1;
    
    const chickCost  = birdsPlaced * (summary.crop.chickenPricePerKg || 0);
    const feedCost   = summary.feed.totalFeedCostGbp;
    const totalSales = currentLiveBirds * avgWeightKg * (summary.crop.salePricePerKgAllIn || 0);
    
    const activeMargin = (totalSales - feedCost - chickCost) / lengthCropDays / floorArea;

    return { age, fcr, epef, lengthCrop, lengthCropDays, activeMargin, chickCost, totalSales };
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
      body: JSON.stringify({ cropId, finalBirdsSold, finalAvgWeightKg, finalRevenueGbp, finalNotes }),
    });
    if (r.ok) {
      setMsgType("success");
      setMsg("Final crop values saved.");
      await loadSummary(cropId);
    } else {
      setMsgType("error");
      setMsg("Error saving final values.");
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
              <h2>Efficiency Metrics (EPEF)</h2>
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
                  <div className="mobile-kpi__label">FCR</div>
                  <div className="mobile-kpi__value">{metrics.fcr > 0 ? metrics.fcr.toFixed(3) : "—"}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">EPEF Index</div>
                  <div className="mobile-kpi__value" style={{color: 'var(--primary)', fontWeight: 'bold'}}>
                    {metrics.epef > 0 ? metrics.epef.toFixed(0) : "—"}
                  </div>
                </div>
              </div>
              {summary.crop.cropEndDate && (
                <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-soft)" }}>
                  Crop end (last clearance): {new Date(summary.crop.cropEndDate).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>

            {/* Sale & Accept Weight */}
            <div className="mobile-card">
              <h2>Sale & Accept Weight</h2>
              <div className="mobile-grid mobile-grid--2">
                <div>
                  <label>Sale Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={saleWeightKg}
                    onChange={e => setSaleWeightKg(e.target.value)}
                    placeholder="e.g. 2.450"
                  />
                </div>
                <div>
                  <label>Accept Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={acceptWeightKg}
                    onChange={e => setAcceptWeightKg(e.target.value)}
                    placeholder="e.g. 2.200"
                  />
                </div>
              </div>
            </div>

            {/* Margin Analysis */}
            <div className="mobile-card">
              <h2>Active Daily Margin Analysis</h2>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row">
                  <strong>Total Chick Cost</strong>
                  <span>{metrics.chickCost.toFixed(2)} GBP</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Current Live Sales Value</strong>
                  <span>{metrics.totalSales.toFixed(2)} GBP</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Length of Crop</strong>
                  <span>{metrics.lengthCrop.toFixed(2)} weeks</span>
                </div>
                <div className="mobile-record-row" style={{borderTop: '2px solid #eee', paddingTop: '8px', marginTop: '8px'}}>
                  <strong style={{fontSize: '1.1rem'}}>Active Margin/m²/Day</strong>
                  <span style={{fontSize: '1.1rem', color: 'var(--primary)'}}>
                    {metrics.activeMargin.toFixed(4)} GBP
                  </span>
                </div>
              </div>
            </div>

            {/* Production Summary */}
            <div className="mobile-card">
              <h2>Production Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds placed</div>
                  <div className="mobile-kpi__value">{summary.production.birdsPlaced}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds alive</div>
                  <div className="mobile-kpi__value">{summary.production.birdsAlive}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mortality %</div>
                  <div className="mobile-kpi__value">{summary.production.mortalityPct.toFixed(2)}%</div>
                </div>
              </div>

              {cropHouses.length > 0 && canOperate && (
                <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 14 }}>
                  <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: "0.9rem" }}>
                    Live weight per house (g) — last day
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {cropHouses.map(h => (
                      <div key={h.houseId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <label style={{ fontWeight: 500, fontSize: "0.85rem", minWidth: 60 }}>{h.houseName}</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="g"
                          value={houseWeightInputs[h.houseId] ?? ""}
                          onChange={e => setHouseWeightInputs(prev => ({ ...prev, [h.houseId]: e.target.value }))}
                          style={{ width: 90, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 6 }}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mobile-button"
                    style={{ marginTop: 12 }}
                    onClick={saveHouseWeights}
                    disabled={weightSaving}
                  >
                    {weightSaving ? "Saving..." : "Save weights & update FCR"}
                  </button>
                </div>
              )}
            </div>

            {/* Existing Feed Summary */}
            <div className="mobile-card">
              <h2>Feed Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed cost GBP</div>
                  <div className="mobile-kpi__value">{summary.feed.totalFeedCostGbp.toFixed(2)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Delivered kg</div>
                  <div className="mobile-kpi__value">{summary.feed.totalDeliveredKg.toFixed(0)}</div>
                </div>
              </div>
            </div>

            {/* Form Section with Restore Button */}
            {cropSaved && (
              <div className="mobile-card" style={{ background: "#d1fae5", border: "2px solid #6ee7b7" }}>
                <h2 style={{ color: "#065f46", margin: 0 }}>Crop Saved</h2>
                <p style={{ color: "#047857", margin: "8px 0 0" }}>
                  This crop has been finalized and saved to history. Start a new crop to continue.
                </p>
              </div>
            )}
            {!cropSaved && <div className="mobile-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2>Save Final Real Values</h2>
                {canOperate && (
                  <button 
                    type="button" 
                    onClick={handleRestore}
                    style={{fontSize: '0.8rem', padding: '4px 8px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px'}}
                  >
                    Restore Last Saved
                  </button>
                )}
              </div>

              <form onSubmit={saveFinalReal}>
                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Final Birds Sold</label>
                    <input type="number" value={finalBirdsSold} onChange={(e) => setFinalBirdsSold(e.target.value)} disabled={!canOperate} />
                  </div>
                  <div>
                    <label>Final Avg Weight kg</label>
                    <input type="number" step="0.001" value={finalAvgWeightKg} onChange={(e) => setFinalAvgWeightKg(e.target.value)} disabled={!canOperate} />
                  </div>
                </div>

                <label>Final Revenue GBP</label>
                <input type="number" step="0.01" value={finalRevenueGbp} onChange={(e) => setFinalRevenueGbp(e.target.value)} disabled={!canOperate} />

                <label>Final Notes</label>
                <textarea value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} disabled={!canOperate} />

                {canOperate && (
                  <div className="mobile-sticky-actions">
                    <button className="mobile-full-button" type="submit">Save Final Real Values</button>
                  </div>
                )}
              </form>
              {summary.crop.updatedAt && (
                <p style={{fontSize: '0.75rem', color: '#888', marginTop: '8px'}}>
                  Last saved: {new Date(summary.crop.updatedAt).toLocaleString()}
                </p>
              )}
            </div>}
          </>
        )}
      </div>
    </div>
  );
}