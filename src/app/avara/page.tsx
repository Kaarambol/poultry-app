"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";
// @ts-ignore
import { saveAs } from "file-saver";
import * as ExcelJS from "exceljs";

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
  avgWeight?: number;
};

type ReportData = {
  farm: { id: string; name: string; code: string; };
  crop: {
    id: string;
    cropNumber: string;
    placementDate: string;
    breed: string | null;
    hatchery: string | null;
    status: string;
  };
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

type ActiveCrop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  breed: string | null;
  hatchery: string | null;
  status: string;
  placements: any[];
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
  const [isExporting, setIsExporting] = useState(false);

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

  async function exportExcel() {
    if (!cropId || !report) return;
    setIsExporting(true);
    setMsg("Exporting cumulative data...");

    try {
      // 1. Fetch cumulative data for all previous stages
      const stageDataMap: Record<string, ReportData> = {};
      for (const s of stages) {
        const res = await fetch(`/api/avara/report?cropId=${cropId}&stage=${s.value}`);
        if (res.ok) stageDataMap[s.value] = await res.json();
        if (s.value === stage) break;
      }

      // 2. Fetch Placement data (same as Home Page)
      const cropRes = await fetch(`/api/crops/active?farmId=${currentFarmId}`);
      const activeCropData = await cropRes.json();

      // 3. Load Template
      const resTemplate = await fetch("/templates/avara-tamplate.xlsx");
      const arrayBuffer = await resTemplate.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const ws = workbook.getWorksheet(1);
      if (!ws) throw new Error("Template worksheet error.");

      // 4. Header (Site, Crop, Farm Code)
      ws.getCell("E5").value = report.farm.name;
      ws.getCell("E6").value = report.crop.cropNumber;
      ws.getCell("E7").value = report.farm.code;

      // 5. Per House Mapping (Columns D=4, E=5...)
      report.houses.forEach((h, index) => {
        const col = 4 + index;

        // Fill Tables 1-9 cumulatively
        Object.keys(stageDataMap).forEach((sKey) => {
          const sData = stageDataMap[sKey];
          const hData = sData.houses.find(house => house.houseId === h.houseId);
          if (!hData) return;

          const cdmr = hData.birdsPlaced > 0 ? (hData.mort + hData.culls) / hData.birdsPlaced : 0;

          // Birds Placed & Breed (Update for all tables)
          [9, 10, 26, 27, 46, 47, 66, 67, 106, 107, 126, 127, 146, 147, 166, 167].forEach(row => {
            if (row % 2 !== 0) ws.getRow(row).getCell(col).value = hData.birdsPlaced;
            else ws.getRow(row).getCell(col).value = report.crop.breed || "Ross 308";
          });

          // Table Specific Mapping
          if (sKey === "DAY_3") {
            ws.getRow(13).getCell(col).value = hData.mort;
            ws.getRow(15).getCell(col).value = hData.culls;
            ws.getRow(17).getCell(col).value = cdmr;
            ws.getRow(17).getCell(col).numFmt = '0.0000';
          } 
          if (sKey === "DAY_7") {
            ws.getRow(30).getCell(col).value = hData.mort;
            ws.getRow(32).getCell(col).value = hData.culls;
            ws.getRow(33).getCell(col).value = hData.avgWeight || 0;
            ws.getRow(36).getCell(col).value = cdmr;
            ws.getRow(36).getCell(col).numFmt = '0.0000';
          }
          if (sKey === "DAY_14") {
            ws.getRow(50).getCell(col).value = hData.mort;
            ws.getRow(52).getCell(col).value = hData.culls;
            ws.getRow(53).getCell(col).value = hData.avgWeight || 0;
            ws.getRow(56).getCell(col).value = cdmr;
            ws.getRow(56).getCell(col).numFmt = '0.0000';
          }
          if (sKey === "DAY_21") {
            ws.getRow(70).getCell(col).value = hData.mort;
            ws.getRow(72).getCell(col).value = hData.culls;
            ws.getRow(73).getCell(col).value = hData.avgWeight || 0;
            ws.getRow(77).getCell(col).value = cdmr;
            ws.getRow(77).getCell(col).numFmt = '0.0000';
          }
          if (sKey === "TOTAL_CLEAR") {
            ws.getRow(169).getCell(col).value = hData.mort;
            ws.getRow(171).getCell(col).value = hData.culls;
            ws.getRow(173).getCell(col).value = cdmr;
            ws.getRow(173).getCell(col).numFmt = '0.0000';
          }
        });

        // 6. Placement Information (Source 2 Mapping: Row 204-225)
        const batch = activeCropData.placements?.find((p: any) => p.houseId === h.houseId);
        if (batch) {
          let pRow = 205; 
          if (index >= 4) pRow = 212;
          if (index >= 8) pRow = 219;
          if (index >= 12) pRow = 226;
          
          let pColBase = 2 + (index % 4) * 6; // B, H, N, T

          ws.getCell(pRow - 1, pColBase).value = new Date(report.crop.placementDate).toLocaleDateString("en-GB");
          ws.getCell(pRow + 1, pColBase).value = batch.ptcNumber || ""; 
          ws.getCell(pRow + 1, pColBase + 1).value = batch.birdsPlaced || 0; 
          ws.getCell(pRow + 1, pColBase + 2).value = batch.parentAge || ""; 
          ws.getCell(pRow + 1, pColBase + 3).value = batch.flockCode || ""; 
          ws.getCell(pRow + 1, pColBase + 4).value = batch.hatchery || report.crop.hatchery || "";
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Week_Return_${report.crop.cropNumber}_${stage}.xlsx`);
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
            <div className="page-intro__eyebrow">Weekly Return</div>
            <h1 className="page-intro__title">Week Return</h1>
            <p className="page-intro__subtitle">Cumulative Excel report with placement details.</p>
          </div>
        </div>

        <div className="mobile-card">
          <h2>Select Reporting Stage</h2>
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} disabled={!cropId}>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {cropId && canOperate && (
            <div className="mobile-sticky-actions">
              <button className="mobile-full-button" onClick={exportExcel} disabled={isExporting}>
                {isExporting ? "Processing..." : "Export Excel (Full Crop)"}
              </button>
            </div>
          )}
        </div>

        {msg && <div className="mobile-alert" style={{ marginBottom: 16 }}>{msg}</div>}

        {report && (
          <>
            <div className="mobile-card">
              <h2>Preview: {stages.find(s => s.value === stage)?.label}</h2>
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
                    <div className="mobile-record-row"><strong>Mortality</strong><span>{house.mort}</span></div>
                    <div className="mobile-record-row"><strong>Culls</strong><span>{house.culls}</span></div>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mobile-section-title">Export History</h2>
            <div className="mobile-record-list">
              {history.map((item) => (
                <div key={item.id} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">{item.fileName}</h3>
                  <div className="mobile-record-row"><strong>Date</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>
                  <div className="mobile-actions" style={{ marginTop: 12 }}>
                    <a href={item.filePath} target="_blank" className="mobile-button mobile-button--secondary">Download</a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}