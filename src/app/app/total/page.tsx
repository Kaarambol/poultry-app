"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type FinancialSummary = {
  crop: {
    id: string;
    cropNumber: string;
    status: string;
    currency: string;
    chickenPricePerKg: number | null;
    salePricePerKgAllIn: number | null;
    finalBirdsSold: number | null;
    finalAvgWeightKg: number | null;
    finalRevenueGbp: number | null;
    finalNotes: string | null;
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
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");

  const [summary, setSummary] = useState<FinancialSummary | null>(null);

  const [finalBirdsSold, setFinalBirdsSold] = useState("");
  const [finalAvgWeightKg, setFinalAvgWeightKg] = useState("");
  const [finalRevenueGbp, setFinalRevenueGbp] = useState("");
  const [finalNotes, setFinalNotes] = useState("");

  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    } else {
      setFarmName("");
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();

    if (r.ok) {
      setMyRole(data.role || "");
    } else {
      setMyRole("");
    }
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading active crop.");
      setCropId("");
      setCropLabel("");
      setSummary(null);
      return;
    }

    if (!data) {
      setMsgType("info");
      setMsg("No active crop for the current farm.");
      setCropId("");
      setCropLabel("");
      setSummary(null);
      return;
    }

    setCropId(data.id);
    setCropLabel(data.cropNumber);
    setCurrentCropId(data.id);
    await loadSummary(data.id);
    setMsg("");
  }

  async function loadSummary(selectedCropId: string) {
    const r = await fetch(`/api/crops/financial-summary?cropId=${selectedCropId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading financial summary.");
      setSummary(null);
      return;
    }

    setSummary(data);
    setFinalBirdsSold(
      data.crop.finalBirdsSold !== null ? String(data.crop.finalBirdsSold) : ""
    );
    setFinalAvgWeightKg(
      data.crop.finalAvgWeightKg !== null ? String(data.crop.finalAvgWeightKg) : ""
    );
    setFinalRevenueGbp(
      data.crop.finalRevenueGbp !== null ? String(data.crop.finalRevenueGbp) : ""
    );
    setFinalNotes(data.crop.finalNotes || "");
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadActiveCrop(farmId);
  }, []);

  async function saveFinalReal(e: React.FormEvent) {
    e.preventDefault();

    if (!cropId) {
      setMsgType("error");
      setMsg("No active crop selected.");
      return;
    }

    const r = await fetch("/api/crops/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cropId,
        finalBirdsSold,
        finalAvgWeightKg,
        finalRevenueGbp,
        finalNotes,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error saving final crop numbers.");
      return;
    }

    setMsgType("success");
    setMsg("Final crop values saved.");
    await loadSummary(cropId);
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
      ? "mobile-alert mobile-alert--success"
      : "mobile-alert";

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Economics</div>
            <h1 className="page-intro__title">Total & Margin</h1>
            <p className="page-intro__subtitle">
              Compare live estimate and final real crop economics.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Context</div>
              <div>Active crop: {cropLabel || "-"}</div>
              <div style={{ marginTop: 6 }}>Your role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can see totals, but cannot save final values.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {summary && (
          <>
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
                  <div className="mobile-kpi__value">
                    {summary.production.mortalityPct.toFixed(2)}%
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Last avg weight kg</div>
                  <div className="mobile-kpi__value">
                    {summary.production.lastAvgWeightKg !== null
                      ? summary.production.lastAvgWeightKg.toFixed(3)
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-card">
              <h2>Feed Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed kg</div>
                  <div className="mobile-kpi__value">{summary.feed.totalFeedKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Wheat kg</div>
                  <div className="mobile-kpi__value">{summary.feed.totalWheatKg.toFixed(0)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Delivered kg</div>
                  <div className="mobile-kpi__value">
                    {summary.feed.totalDeliveredKg.toFixed(0)}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed cost GBP</div>
                  <div className="mobile-kpi__value">
                    {summary.feed.totalFeedCostGbp.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div className="mobile-card">
                <h2>Live Estimate</h2>
                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Chicken price / kg</strong>
                    <span>
                      {summary.crop.chickenPricePerKg !== null
                        ? `${summary.crop.chickenPricePerKg.toFixed(2)} ${summary.crop.currency}`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Sale price / kg all in</strong>
                    <span>
                      {summary.crop.salePricePerKgAllIn !== null
                        ? `${summary.crop.salePricePerKgAllIn.toFixed(2)} ${summary.crop.currency}`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Estimated revenue</strong>
                    <span>
                      {summary.liveEstimate.estimatedRevenueGbp !== null
                        ? `${summary.liveEstimate.estimatedRevenueGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Estimated margin</strong>
                    <span>
                      {summary.liveEstimate.estimatedMarginGbp !== null
                        ? `${summary.liveEstimate.estimatedMarginGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mobile-card">
                <h2>Final Real</h2>
                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Final birds sold</strong>
                    <span>{summary.crop.finalBirdsSold ?? "-"}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Final avg weight kg</strong>
                    <span>
                      {summary.crop.finalAvgWeightKg !== null
                        ? summary.crop.finalAvgWeightKg.toFixed(3)
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Final revenue</strong>
                    <span>
                      {summary.finalReal.finalRevenueGbp !== null
                        ? `${summary.finalReal.finalRevenueGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Final margin</strong>
                    <span>
                      {summary.finalReal.finalMarginGbp !== null
                        ? `${summary.finalReal.finalMarginGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mobile-card">
              <h2>Save Final Real Values</h2>

              <form onSubmit={saveFinalReal}>
                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Final Birds Sold</label>
                    <input
                      type="number"
                      min="0"
                      value={finalBirdsSold}
                      onChange={(e) => setFinalBirdsSold(e.target.value)}
                      disabled={!canOperate}
                    />
                  </div>

                  <div>
                    <label>Final Avg Weight kg</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={finalAvgWeightKg}
                      onChange={(e) => setFinalAvgWeightKg(e.target.value)}
                      disabled={!canOperate}
                    />
                  </div>
                </div>

                <label>Final Revenue GBP (optional manual override)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalRevenueGbp}
                  onChange={(e) => setFinalRevenueGbp(e.target.value)}
                  disabled={!canOperate}
                />

                <label>Final Notes</label>
                <textarea
                  value={finalNotes}
                  onChange={(e) => setFinalNotes(e.target.value)}
                  disabled={!canOperate}
                />

                {canOperate && (
                  <div className="mobile-sticky-actions">
                    <div className="mobile-sticky-actions__inner">
                      <button className="mobile-full-button" type="submit">
                        Save Final Real Values
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}