"use client";

import { useEffect, useState, useMemo } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
  floorArea?: number; // Added for margin calculation
};

type FinancialSummary = {
  crop: {
    id: string;
    cropNumber: string;
    status: string;
    currency: string;
    placementDate: string; // Needed for age/length crop
    chickenPricePerKg: number | null; // Purchase price of chick
    salePricePerKgAllIn: number | null;
    finalBirdsSold: number | null;
    finalAvgWeightKg: number | null;
    finalRevenueGbp: number | null;
    finalNotes: string | null;
    updatedAt?: string; // Date of last save
  };
  production: {
    birdsPlaced: number;
    mort: number;
    culls: number;
    totalLosses: number;
    birdsAlive: number;
    mortalityPct: number;
    lastAvgWeightKg: number | null;
  };
  feed: {
    totalFeedKg: number;
    totalWheatKg: number;
    totalDeliveredKg: number;
    totalFeedCostGbp: number;
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

  const [prevCropFinishDate, setPrevCropFinishDate] = useState<string | null>(null);

  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  // --- Calculations ---

  const metrics = useMemo(() => {
    if (!summary) return null;

    const birdsPlaced = summary.production.birdsPlaced;
    const birdsAlive = summary.production.birdsAlive;
    const totalFeedKg = summary.feed.totalFeedKg;
    const avgWeightKg = summary.production.lastAvgWeightKg || 0;
    
    // Calculate Age
    const start = new Date(summary.crop.placementDate);
    const today = new Date();
    const age = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    // FCR (Feed Conversion Ratio)
    const totalWeightGain = birdsAlive * avgWeightKg;
    const fcr = totalWeightGain > 0 ? totalFeedKg / totalWeightGain : 0;

    // EPEF (European Production Efficiency Factor)
    const survivalPct = (birdsAlive / birdsPlaced) * 100;
    const epef = (age > 0 && fcr > 0)
      ? (survivalPct * avgWeightKg * 100) / (age * fcr)
      : 0;

    // Length of crop in weeks = (today − previous crop finish date) / 7
    // For first crop (no previous finish date): use (age + 10) / 7
    let lengthCrop: number;
    if (prevCropFinishDate) {
      const prevEnd = new Date(prevCropFinishDate);
      const daysSincePrev = Math.max(1, Math.floor((today.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24)));
      lengthCrop = daysSincePrev / 7;
    } else {
      lengthCrop = (age + 10) / 7;
    }

    const floorArea = farmData?.floorArea || 1; // Default to 1 to avoid division by zero
    
    const chickCost = birdsPlaced * (summary.crop.chickenPricePerKg || 0);
    const feedCost = summary.feed.totalFeedCostGbp;
    const totalSales = birdsAlive * avgWeightKg * (summary.crop.salePricePerKgAllIn || 0);
    
    const activeMargin = (totalSales - feedCost - chickCost) / lengthCrop / floorArea;

    return { age, fcr, epef, lengthCrop, activeMargin, chickCost, totalSales };
  }, [summary, farmData, prevCropFinishDate]);

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
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();
    if (r.ok && data) {
      setCropId(data.id);
      setCropLabel(data.cropNumber);
      setCurrentCropId(data.id);
      await loadSummary(data.id);
      setMsg("");

      // Load previous crop's finish date for lengthCrop calculation
      const hr = await fetch(`/api/crops/history?farmId=${farmId}`);
      const history = await hr.json();
      if (Array.isArray(history) && history.length > 0 && history[0].finishDate) {
        setPrevCropFinishDate(history[0].finishDate);
      } else {
        setPrevCropFinishDate(null);
      }
    } else {
      setMsg("No active crop found.");
      setSummary(null);
    }
  }

  async function loadSummary(selectedCropId: string) {
    const r = await fetch(`/api/crops/financial-summary?cropId=${selectedCropId}`);
    const data = await r.json();
    if (r.ok) {
      setSummary(data);
      // Auto-fill fields if empty
      if (!finalBirdsSold) setFinalBirdsSold(data.crop.finalBirdsSold?.toString() || "");
      if (!finalAvgWeightKg) setFinalAvgWeightKg(data.crop.finalAvgWeightKg?.toString() || "");
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
    }
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
              <div>Crop: {cropLabel} | Role: {myRole}</div>
            </div>
          </div>
        </div>

        {msg && <div className={`mobile-alert mobile-alert--${msgType}`}>{msg}</div>}

        {summary && metrics && (
          <>
            {/* New EPEF & Efficiency Card */}
            <div className="mobile-card">
              <h2>Efficiency Metrics (EPEF)</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Current Age</div>
                  <div className="mobile-kpi__value">{metrics.age} days</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">FCR (Conversion)</div>
                  <div className="mobile-kpi__value">{metrics.fcr.toFixed(3)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">EPEF Index</div>
                  <div className="mobile-kpi__value" style={{color: 'var(--primary)', fontWeight: 'bold'}}>
                    {metrics.epef.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            {/* New Daily Margin Analysis Card */}
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
                  <strong>Length of Crop (Calc)</strong>
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

            {/* Existing Production Summary */}
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
            <div className="mobile-card">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}