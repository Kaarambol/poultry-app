"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type ReportHouse = {
  houseId: string;
  houseName: string;
  birdsPlaced: number;
  mort: number;
  culls: number;
  totalLosses: number;
  birdsAlive: number;
  mortalityPct: number;
  feedKg: number;
  waterL: number;
};

type ReportData = {
  farm: {
    id: string;
    name: string;
    code: string;
  };
  crop: {
    id: string;
    cropNumber: string;
    placementDate: string;
    breed: string | null;
    hatchery: string | null;
    status: string;
  };
  stage: string;
  maxDay: number;
  totals: {
    birdsPlaced: number;
    mort: number;
    culls: number;
    totalLosses: number;
    birdsAlive: number;
    feedKg: number;
    waterL: number;
    mortalityPct: number;
  };
  houses: ReportHouse[];
};

type ExportItem = {
  id: string;
  stage: string;
  fileName: string;
  filePath: string;
  createdAt: string;
};

type ActiveCrop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  breed: string | null;
  hatchery: string | null;
  status: string;
};

const stages = [
  { value: "DAY_3", label: "Day 3" },
  { value: "DAY_7", label: "Day 7" },
  { value: "DAY_14", label: "Day 14" },
  { value: "DAY_21", label: "Day 21" },
  { value: "DAY_26", label: "Day 26" },
  { value: "DAY_28", label: "Day 28" },
  { value: "THIN_35", label: "Thin / Day 35" },
  { value: "TOTAL_CLEAR", label: "Total Clear" },
];

export default function AvaraPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [stage, setStage] = useState("DAY_3");
  const [report, setReport] = useState<ReportData | null>(null);
  const [history, setHistory] = useState<ExportItem[]>([]);
  const [msg, setMsg] = useState("Loading...");

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
      setMsg(data.error || "Error loading active crop.");
      setCropId("");
      setCropLabel("");
      setReport(null);
      setHistory([]);
      return;
    }

    if (!data) {
      setMsg("No active crop for the current farm.");
      setCropId("");
      setCropLabel("");
      setReport(null);
      setHistory([]);
      return;
    }

    const crop = data as ActiveCrop;
    setCropId(crop.id);
    setCropLabel(crop.cropNumber);
    setCurrentCropId(crop.id);
    setMsg("");
    await loadReport(crop.id, stage);
    await loadHistory(crop.id);
  }

  async function loadReport(selectedCropId: string, selectedStage: string) {
    const r = await fetch(
      `/api/avara/report?cropId=${selectedCropId}&stage=${selectedStage}`
    );
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      setReport(null);
      return;
    }

    setReport(data);
    setMsg("");
  }

  async function loadHistory(selectedCropId: string) {
    const r = await fetch(`/api/avara/history?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setHistory(data);
    } else {
      setHistory([]);
    }
  }

  async function exportExcel() {
    if (!cropId || !stage) {
      setMsg("No active crop selected.");
      return;
    }

    setMsg("Exporting...");

    try {
      const r = await fetch("/api/avara/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cropId, stage }),
      });

      const data = await r.json();

      if (!r.ok) {
        setMsg(data.error || "Export error");
        return;
      }

      setMsg(`Excel exported: ${data.fileName}`);
      await loadHistory(cropId);
    } catch {
      setMsg("Export failed.");
    }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadActiveCrop(farmId);
  }, []);

  useEffect(() => {
    if (cropId) {
      loadReport(cropId, stage);
    } else {
      setReport(null);
    }
  }, [stage, cropId]);

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Weekly return</div>
            <h1 className="page-intro__title">Avara Export</h1>
            <p className="page-intro__subtitle">
              Preview weekly return data for the active crop and export the selected stage.
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
            Read-only mode. VIEWER can preview reports and download history, but cannot export new files.
          </div>
        )}

        <div className="mobile-card">
          <h2>Report Stage</h2>
          <label>Choose stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            disabled={!cropId}
          >
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {cropId && canOperate && (
            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button
                  type="button"
                  className="mobile-full-button"
                  onClick={exportExcel}
                >
                  Export Excel
                </button>
              </div>
            </div>
          )}
        </div>

        {msg && (
          <div className="mobile-alert" style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {report && (
          <>
            <div className="mobile-card">
              <h2>Preview</h2>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row">
                  <strong>Farm</strong>
                  <span>
                    {report.farm.name} ({report.farm.code})
                  </span>
                </div>
                <div className="mobile-record-row">
                  <strong>Crop</strong>
                  <span>{report.crop.cropNumber}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Placement date</strong>
                  <span>{new Date(report.crop.placementDate).toLocaleDateString()}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Breed</strong>
                  <span>{report.crop.breed || "-"}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Hatchery</strong>
                  <span>{report.crop.hatchery || "-"}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Stage</strong>
                  <span>{stages.find((s) => s.value === report.stage)?.label || report.stage}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Max day</strong>
                  <span>{report.maxDay}</span>
                </div>
              </div>
            </div>

            <div className="mobile-card">
              <h2>Totals</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds placed</div>
                  <div className="mobile-kpi__value">{report.totals.birdsPlaced}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mort</div>
                  <div className="mobile-kpi__value">{report.totals.mort}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Culls</div>
                  <div className="mobile-kpi__value">{report.totals.culls}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Total losses</div>
                  <div className="mobile-kpi__value">{report.totals.totalLosses}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds alive</div>
                  <div className="mobile-kpi__value">{report.totals.birdsAlive}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mortality %</div>
                  <div className="mobile-kpi__value">{report.totals.mortalityPct.toFixed(2)}%</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed kg</div>
                  <div className="mobile-kpi__value">{report.totals.feedKg.toFixed(2)}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Water L</div>
                  <div className="mobile-kpi__value">{report.totals.waterL.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <h2 className="mobile-section-title">Per House</h2>
            {report.houses.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No house data available.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {report.houses.map((house) => (
                  <div key={house.houseId} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">{house.houseName}</h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Birds placed</strong>
                        <span>{house.birdsPlaced}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Mort</strong>
                        <span>{house.mort}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Culls</strong>
                        <span>{house.culls}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Total losses</strong>
                        <span>{house.totalLosses}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds alive</strong>
                        <span>{house.birdsAlive}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Mortality %</strong>
                        <span>{house.mortalityPct.toFixed(2)}%</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Feed kg</strong>
                        <span>{house.feedKg.toFixed(2)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Water L</strong>
                        <span>{house.waterL.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mobile-section-title">Export History</h2>
            {history.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No export history.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {history.map((item) => (
                  <div key={item.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">{item.fileName}</h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Stage</strong>
                        <span>{stages.find((s) => s.value === item.stage)?.label || item.stage}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Created</strong>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mobile-actions" style={{ marginTop: 12 }}>
                      <a
                        href={item.filePath}
                        target="_blank"
                        rel="noreferrer"
                        className="mobile-button mobile-button--secondary"
                        style={{ textAlign: "center" }}
                      >
                        Open export
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}