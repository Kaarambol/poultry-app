"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi } from "@/lib/ui-permissions";

type Farm = { id: string; name: string; code: string };

type ReportHouse = {
  houseId: string;
  houseName: string;
  birdsPlaced: number;
  mort: number;
  culls: number;
  avgWeight?: number;
};

type ReportData = {
  farm: { id: string; name: string; code: string };
  crop: { id: string; cropNumber: string; placementDate: string; breed: string | null; status: string };
  stage: string;
  houses: ReportHouse[];
};

type ExportItem = {
  id: string;
  stage: string;
  fileName: string;
  filePath: string;
  createdAt: string;
};

const stages = [
  { value: "DAY_3",       label: "Day 3"          },
  { value: "DAY_7",       label: "Day 7"           },
  { value: "DAY_14",      label: "Day 14"          },
  { value: "DAY_21",      label: "Day 21"          },
  { value: "DAY_26",      label: "Day 26"          },
  { value: "DAY_28",      label: "Day 28"          },
  { value: "THIN_35",     label: "Thin / Day 35"   },
  { value: "TOTAL_CLEAR", label: "Total Clear"     },
];

export default function AvaraPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName]   = useState("");
  const [myRole, setMyRole]       = useState<FarmRole>("");
  const [cropId, setCropId]       = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [stage, setStage]         = useState("DAY_3");
  const [report, setReport]       = useState<ReportData | null>(null);
  const [history, setHistory]     = useState<ExportItem[]>([]);
  const [msg, setMsg]             = useState("Loading...");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPlacement, setIsExportingPlacement] = useState(false);

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (Array.isArray(data)) {
      const farm = data.find((f: Farm) => f.id === farmId);
      if (farm) setFarmName(`${farm.name} (${farm.code})`);
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
      loadReport(data.id, stage);
      loadHistory(data.id);
      setMsg("");
    } else {
      setMsg("No active crop found.");
    }
  }

  async function loadReport(selectedCropId: string, selectedStage: string) {
    const r = await fetch(`/api/avara/report?cropId=${selectedCropId}&stage=${selectedStage}`);
    const data = await r.json();
    if (r.ok) setReport(data);
  }

  async function loadHistory(selectedCropId: string) {
    const r = await fetch(`/api/avara/history?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setHistory(data);
  }

  async function exportPlacement() {
    if (!cropId) return;
    setIsExportingPlacement(true);
    setMsg("Generating placement report...");
    try {
      const res = await fetch("/api/avara/placement-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `placement-${cropLabel}-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMsg("Placement report downloaded.");
    } catch (err: any) {
      setMsg("Export failed: " + err.message);
    } finally {
      setIsExportingPlacement(false);
    }
  }

  async function exportExcel() {
    if (!cropId) return;
    setIsExporting(true);
    setMsg("Generating report...");
    try {
      const res = await fetch("/api/avara/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `avara-${cropLabel || cropId}-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMsg("Export successful.");
      loadHistory(cropId);
    } catch (err: any) {
      setMsg("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();
    if (farmId) {
      setCurrentFarmIdState(farmId);
      loadFarmName(farmId);
      loadMyRole(farmId);
      loadActiveCrop(farmId);
    }
  }, []);

  useEffect(() => {
    if (cropId) loadReport(cropId, stage);
  }, [stage, cropId]);

  const canOperate = canOperateUi(myRole);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Weekly Report</div>
            <h1 className="page-intro__title">Week Report</h1>
            <p className="page-intro__subtitle">
              Full crop Excel export — all stages, per house: mortality, culls, weight and CDMR.
            </p>
          </div>
        </div>

        <div className="mobile-card">
          <h2>Preview Stage</h2>
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} disabled={!cropId}>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {cropId && canOperate && (
            <div className="mobile-sticky-actions">
              <button
                className="mobile-full-button"
                onClick={exportPlacement}
                disabled={isExportingPlacement}
                style={{ marginBottom: 8 }}
              >
                {isExportingPlacement ? "Generating..." : "Placement Information"}
              </button>
              <button
                className="mobile-full-button"
                onClick={exportExcel}
                disabled={isExporting}
              >
                {isExporting ? "Generating..." : "Export Full Report (all stages)"}
              </button>
            </div>
          )}
        </div>

        {msg && <div className="mobile-alert" style={{ marginBottom: 16 }}>{msg}</div>}

        {report && (
          <>
            <div className="mobile-card">
              <h2>Preview: {stages.find((s) => s.value === stage)?.label}</h2>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row"><strong>Farm</strong><span>{report.farm.name}</span></div>
                <div className="mobile-record-row"><strong>Crop</strong><span>{report.crop.cropNumber}</span></div>
              </div>
            </div>

            <h2 className="mobile-section-title">House Data</h2>
            <div className="mobile-record-list">
              {report.houses.map((house) => (
                <div key={house.houseId} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">{house.houseName}</h3>
                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row"><strong>Birds Placed</strong><span>{house.birdsPlaced.toLocaleString()}</span></div>
                    <div className="mobile-record-row"><strong>Mortality</strong><span>{house.mort}</span></div>
                    <div className="mobile-record-row"><strong>Culls</strong><span>{house.culls}</span></div>
                    {house.avgWeight != null && (
                      <div className="mobile-record-row"><strong>Avg Weight</strong><span>{(house.avgWeight / 1000).toFixed(3)} kg</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mobile-section-title">Export History</h2>
        <div className="mobile-record-list">
          {history.length === 0 && <p style={{ color: "#999", padding: "12px" }}>No exports yet.</p>}
          {history.map((item) => (
            <div key={item.id} className="mobile-record-card">
              <h3 className="mobile-record-card__title">{item.fileName}</h3>
              <div className="mobile-record-row">
                <strong>Stage</strong><span>{item.stage}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Date</strong><span>{new Date(item.createdAt).toLocaleString("en-GB")}</span>
              </div>
              <div className="mobile-actions" style={{ marginTop: 12 }}>
                <a href={item.filePath} target="_blank" className="mobile-button mobile-button--secondary">
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
