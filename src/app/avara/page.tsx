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

type PlacementRow = {
  id: string;
  batchNo: number;
  houseName: string;
  placementDate: string;
  birdsPlaced: number;
  flockNumber: string | null;
  hatchery: string | null;
  parentAgeWeeks: number | null;
  notes: string | null;
};


const stages = [
  { value: "DAY_3",  label: "Day 3"  },
  { value: "DAY_7",  label: "Day 7"  },
  { value: "DAY_14", label: "Day 14" },
  { value: "DAY_21", label: "Day 21" },
  { value: "DAY_26", label: "Day 26" },
  { value: "DAY_28", label: "Day 28" },
];

export default function AvaraPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName]   = useState("");
  const [myRole, setMyRole]       = useState<FarmRole>("");
  const [cropId, setCropId]       = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [stage, setStage]         = useState("DAY_3");
  const [report, setReport]       = useState<ReportData | null>(null);
  const [msg, setMsg]             = useState("Loading...");
  const [isExporting, setIsExporting]             = useState(false);
  const [isExportingPlacement, setIsExportingPlacement] = useState(false);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);

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
      loadPlacements(data.id);
      setMsg("");
    } else {
      setMsg("No active crop found.");
    }
  }

  async function loadPlacements(selectedCropId: string) {
    const r = await fetch(`/api/crops/details?cropId=${selectedCropId}`);
    const data = await r.json();
    if (r.ok && Array.isArray(data.placements)) {
      const rows: PlacementRow[] = data.placements
        .sort((a: any, b: any) => {
          const hc = (a.house?.name ?? "").localeCompare(b.house?.name ?? "", undefined, { numeric: true, sensitivity: "base" });
          return hc !== 0 ? hc : a.batchNo - b.batchNo;
        })
        .map((p: any) => ({
          id: p.id,
          batchNo: p.batchNo,
          houseName: p.house?.name ?? "—",
          placementDate: p.placementDate,
          birdsPlaced: p.birdsPlaced,
          flockNumber: p.flockNumber,
          hatchery: p.hatchery,
          parentAgeWeeks: p.parentAgeWeeks,
          notes: p.notes,
        }));
      setPlacements(rows);
    }
  }

  async function loadReport(selectedCropId: string, selectedStage: string) {
    const r = await fetch(`/api/avara/report?cropId=${selectedCropId}&stage=${selectedStage}`);
    const data = await r.json();
    if (r.ok) setReport(data);
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

        {placements.length > 0 && (
          <>
            <h2 className="mobile-section-title">Placement Information</h2>
            <div className="mobile-card" style={{ overflowX: "auto", padding: "12px 8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#D9E8F5" }}>
                    {["House", "Batch", "Date", "Birds", "Flock #", "Hatchery", "Par.Age", "Notes"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#1B3A5C", borderBottom: "2px solid #B8CCE0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {placements.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "#FAFCFF" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{p.houseName}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{p.batchNo}</td>
                      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{new Date(p.placementDate).toLocaleDateString("en-GB")}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>{p.birdsPlaced.toLocaleString()}</td>
                      <td style={{ padding: "6px 8px" }}>{p.flockNumber || "—"}</td>
                      <td style={{ padding: "6px 8px" }}>{p.hatchery || "—"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>{p.parentAgeWeeks ?? "—"}</td>
                      <td style={{ padding: "6px 8px", color: "#64748b" }}>{p.notes || "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#EDEDED", fontWeight: 700 }}>
                    <td style={{ padding: "6px 8px" }}>TOTAL</td>
                    <td />
                    <td />
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{placements.reduce((s, p) => s + p.birdsPlaced, 0).toLocaleString()}</td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
