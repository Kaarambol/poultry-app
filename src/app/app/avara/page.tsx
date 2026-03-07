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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cropId) {
      loadReport(cropId, stage);
    } else {
      setReport(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Avara Weekly Return</h1>

      {currentFarmId && (
        <p>
          <strong>Current Farm:</strong> {farmName || currentFarmId}
        </p>
      )}

      <p>
        <strong>Active Crop:</strong> {cropLabel || "-"}
      </p>

      <p>
        <strong>Your role:</strong> {myRole || "-"}
      </p>

      {readOnly && (
        <p
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#eef3f8",
            border: "1px solid #c5d7ea",
            color: "#1f3b57",
          }}
        >
          Read-only mode. VIEWER can preview reports and download history, but cannot export new files.
        </p>
      )}

      <label>Report stage</label>
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 20px" }}
        disabled={!cropId}
      >
        {stages.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {cropId && canOperate && (
        <button
          type="button"
          onClick={exportExcel}
          style={{ padding: 12, width: "100%", marginBottom: 20 }}
        >
          Export Excel
        </button>
      )}

      {msg && <p>{msg}</p>}

      {report && (
        <>
          <h2>Preview</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Farm
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.farm.name} ({report.farm.code})
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Crop
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.crop.cropNumber}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Stage
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{report.stage}</td>
              </tr>
            </tbody>
          </table>

          <h2>Totals</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds placed
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mort
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Culls
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Total losses
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds alive
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mortality %
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Feed kg
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Water L
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.birdsPlaced}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.mort}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.culls}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.totalLosses}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.birdsAlive}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.mortalityPct.toFixed(2)}%
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.feedKg.toFixed(2)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {report.totals.waterL.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Export History</h2>
          {history.length === 0 ? (
            <p>No exports yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Stage
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    File
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Created
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Download
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.stage}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.fileName}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      <a href={item.filePath} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}