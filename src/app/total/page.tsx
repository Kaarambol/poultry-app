"use client";

import { useEffect, useState, useMemo } from "react";
import { getCurrentFarmId, setCurrentCropId, isViewingHistory } from "@/lib/app-context";
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
    openingStockKg: number;
    closingStockKg: number;
    deliveredFromTicketsKg: number;
    totalDeliveredKg: number;
    totalConsumedKg: number;
    totalFeedCostGbp: number;
    totalFeedUsedKg: number;
  };
  final: {
    avgAge: number | null;
    fcr: number | null;
    epef: number | null;
    grossMarginGbp: number | null;
    marginPencePerM2Day: number | null;
    revenue: number | null;
    chickCost: number;
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
  const [historyMode, setHistoryMode] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishMsg, setFinishMsg] = useState("");

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

    const floorArea = summary.production.totalFloorAreaM2 || 0;

    // Final metrics (from factory report)
    const fin = summary.final;

    return { age, lengthCrop, lengthCropDays, floorArea,
      finalFcr: fin.fcr, finalEpef: fin.epef,
      finalMargin: fin.marginPencePerM2Day,
      finalGrossMargin: fin.grossMarginGbp,
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
    // First save house weights if any entered
    const weights = cropHouses
      .map(h => ({ houseId: h.houseId, avgWeightG: parseFloat(houseWeightInputs[h.houseId] || "0") }))
      .filter(w => w.avgWeightG > 0);
    if (weights.length > 0) {
      setWeightSaving(true);
      await fetch("/api/crops/final-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropId, weights }),
      });
      setWeightSaving(false);
    }
    // Then save factory report data
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
    setHistoryMode(isViewingHistory());
    const farmId = getCurrentFarmId();
    if (farmId) {
      setCurrentFarmIdState(farmId);
      loadFarmData(farmId);
      loadMyRole(farmId);
      loadActiveCrop(farmId);
    }
  }, []);

  const canOperate = canOperateUi(myRole) && !historyMode;

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
                {historyMode && (
                  <span style={{ marginLeft: 8, background: "#f59e0b", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.8rem", fontWeight: 700 }}>
                    HISTORY
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
                  <div className="mobile-kpi__label">FCR</div>
                  <div className="mobile-kpi__value">
                    {metrics.finalFcr != null ? metrics.finalFcr.toFixed(3) : "—"}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">EPEF</div>
                  <div className="mobile-kpi__value" style={{ color: "var(--primary)", fontWeight: "bold" }}>
                    {metrics.finalEpef != null ? metrics.finalEpef.toFixed(0) : "—"}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Margin p/m²/day</div>
                  <div className="mobile-kpi__value" style={{
                    color: metrics.finalMargin != null && metrics.finalMargin >= 0
                      ? "var(--primary)" : "#e53e3e",
                    fontWeight: "bold"
                  }}>
                    {metrics.finalMargin != null ? metrics.finalMargin.toFixed(2) : "—"}
                  </div>
                </div>
                {metrics.finalGrossMargin != null && (
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Gross Margin £</div>
                    <div className="mobile-kpi__value">{metrics.finalGrossMargin.toFixed(2)}</div>
                  </div>
                )}
                {metrics.finalAvgAge != null && (
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Avg Age (weighted)</div>
                    <div className="mobile-kpi__value">{metrics.finalAvgAge.toFixed(2)} days</div>
                  </div>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-soft)" }}>
                Values from factory report · "—" = data not entered
                {summary.production.totalFloorAreaM2 === 0 && (
                  <span style={{ color: "#b45309" }}> · Set house floor areas in Farm Setup to calculate Margin</span>
                )}
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
                  <div className="mobile-kpi__label">Opening stock kg</div>
                  <div className="mobile-kpi__value">{summary.feed.openingStockKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Delivered kg (tickets)</div>
                  <div className="mobile-kpi__value">{summary.feed.deliveredFromTicketsKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Total delivered kg</div>
                  <div className="mobile-kpi__value">{summary.feed.totalDeliveredKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Closing stock kg</div>
                  <div className="mobile-kpi__value">{summary.feed.closingStockKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Consumed kg</div>
                  <div className="mobile-kpi__value" style={{ fontWeight: 700 }}>{summary.feed.totalConsumedKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed cost GBP</div>
                  <div className="mobile-kpi__value">{summary.feed.totalFeedCostGbp.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Factory Report */}
            <div className="mobile-card">
              <h2>Factory Report</h2>
              <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
                Enter data from the factory report to calculate final FCR, EPEF and Margin.
              </p>
              <form onSubmit={saveFinalReal}>
                {/* Live weight per house */}
                {cropHouses.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
                      Live Weight per House (g)
                    </label>
                    <div className="mobile-grid mobile-grid--2">
                      {cropHouses.map(h => (
                        <div key={h.houseId}>
                          <label>{h.houseName}</label>
                          <input
                            type="number"
                            step="1"
                            placeholder="e.g. 2500"
                            value={houseWeightInputs[h.houseId] ?? ""}
                            onChange={e => setHouseWeightInputs(prev => ({ ...prev, [h.houseId]: e.target.value }))}
                            disabled={!canOperate}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    <button className="mobile-full-button" type="submit" disabled={weightSaving}>
                      {weightSaving ? "Saving..." : "Save & Update FCR / EPEF / Margin"}
                    </button>
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

            {!cropSaved && !historyMode && canOperate && (
              <div className="mobile-card" style={{ border: "2px solid #f59e0b" }}>
                <h2 style={{ color: "#92400e", margin: "0 0 8px" }}>Finish Crop</h2>
                {finishMsg && (
                  <div className="mobile-alert mobile-alert--success" style={{ marginBottom: 12 }}>
                    {finishMsg}
                  </div>
                )}
                {showFinishConfirm ? (
                  <div>
                    <p style={{ margin: "0 0 12px", fontWeight: 600 }}>
                      Are you sure you want to finish and save this crop to history?
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
                      Please verify all data has been entered correctly:
                    </p>
                    <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: "0.85rem" }}>
                      <li>Factory report data saved</li>
                      <li>All daily records complete</li>
                      <li>Feed records up to date</li>
                    </ul>
                    <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#b91c1c", fontWeight: 600 }}>
                      This action cannot be undone.
                    </p>
                    <div className="mobile-actions">
                      <button
                        type="button"
                        className="mobile-button"
                        style={{ background: "#b91c1c", color: "#fff" }}
                        onClick={async () => {
                          const r = await fetch("/api/crops/finish", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ cropId }),
                          });
                          if (r.ok) {
                            setShowFinishConfirm(false);
                            setFinishMsg("Crop finished and saved to history.");
                            await loadSummary(cropId);
                          } else {
                            setFinishMsg("Error finishing crop.");
                          }
                        }}
                      >
                        Yes, Finish Crop
                      </button>
                      <button
                        type="button"
                        className="mobile-button mobile-button--secondary"
                        onClick={() => setShowFinishConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mobile-full-button"
                    style={{ background: "#f59e0b", color: "#fff" }}
                    onClick={() => setShowFinishConfirm(true)}
                  >
                    Finish &amp; Save Crop
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}