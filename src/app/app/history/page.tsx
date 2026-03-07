"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type Crop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  finishDate: string | null;
  status: string;
  breed: string | null;
  hatchery: string | null;
};

type CropPlacement = {
  house: {
    id: string;
    name: string;
  };
  birdsPlaced: number;
};

type CropDetails = {
  id: string;
  cropNumber: string;
  placementDate: string;
  placements: CropPlacement[];
};

type DailyRecord = {
  id: string;
  date: string;
  mort: number;
  culls: number;
  feedKg: number;
  waterL: number;
  avgWeightG: number | null;
  notes: string | null;
  house: {
    id: string;
    name: string;
  };
};

type MedicationRecord = {
  id: string;
  startDate: string;
  medicineName: string;
  supplier: string | null;
  housesTreated: string | null;
  birdsTreated: number | null;
  finishDate: string | null;
  administratorName: string | null;
};

type ExportItem = {
  id: string;
  stage: string;
  fileName: string;
  filePath: string;
  createdAt: string;
};

export default function HistoryPage() {
  const [currentFarmId, setCurrentFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [crops, setCrops] = useState<Crop[]>([]);
  const [cropId, setCropId] = useState("");
  const [cropDetails, setCropDetails] = useState<CropDetails | null>(null);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [exportsList, setExportsList] = useState<ExportItem[]>([]);
  const [msg, setMsg] = useState("Loading...");

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    }
  }

  async function loadHistoryCrops(farmId: string) {
    const r = await fetch(`/api/crops/history?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error loading crop history.");
      setCrops([]);
      return;
    }

    setCrops(data);
    setMsg(data.length === 0 ? "No finished crops for this farm." : "");
  }

  async function loadCropDetails(selectedCropId: string) {
    const r = await fetch(`/api/crops/details?cropId=${selectedCropId}`);
    const data = await r.json();
    if (r.ok) setCropDetails(data);
    else setCropDetails(null);
  }

  async function loadDaily(selectedCropId: string) {
    const r = await fetch(`/api/daily-records/list?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setRecords(data);
    else setRecords([]);
  }

  async function loadMedications(selectedCropId: string) {
    const r = await fetch(`/api/medications/list?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setMedications(data);
    else setMedications([]);
  }

  async function loadExports(selectedCropId: string) {
    const r = await fetch(`/api/avara/history?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setExportsList(data);
    else setExportsList([]);
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmId(farmId);
    loadFarmName(farmId);
    loadHistoryCrops(farmId);
  }, []);

  useEffect(() => {
    if (!cropId) {
      setCropDetails(null);
      setRecords([]);
      setMedications([]);
      setExportsList([]);
      return;
    }

    loadCropDetails(cropId);
    loadDaily(cropId);
    loadMedications(cropId);
    loadExports(cropId);
  }, [cropId]);

  const houseSummary = useMemo(() => {
    const grouped: Record<
      string,
      {
        houseName: string;
        birdsPlaced: number;
        mort: number;
        culls: number;
        totalLosses: number;
        birdsAlive: number;
        mortalityPct: number;
      }
    > = {};

    if (cropDetails) {
      for (const p of cropDetails.placements) {
        grouped[p.house.id] = {
          houseName: p.house.name,
          birdsPlaced: p.birdsPlaced,
          mort: 0,
          culls: 0,
          totalLosses: 0,
          birdsAlive: p.birdsPlaced,
          mortalityPct: 0,
        };
      }
    }

    for (const record of records) {
      const item = grouped[record.house.id];
      if (!item) continue;
      item.mort += record.mort;
      item.culls += record.culls;
    }

    for (const key of Object.keys(grouped)) {
      const item = grouped[key];
      item.totalLosses = item.mort + item.culls;
      item.birdsAlive = item.birdsPlaced - item.totalLosses;
      item.mortalityPct =
        item.birdsPlaced > 0 ? (item.totalLosses / item.birdsPlaced) * 100 : 0;
    }

    return Object.values(grouped);
  }, [cropDetails, records]);

  const totals = useMemo(() => {
    const birdsPlaced = houseSummary.reduce((sum, h) => sum + h.birdsPlaced, 0);
    const mort = houseSummary.reduce((sum, h) => sum + h.mort, 0);
    const culls = houseSummary.reduce((sum, h) => sum + h.culls, 0);
    const totalLosses = mort + culls;
    const birdsAlive = birdsPlaced - totalLosses;
    const mortalityPct = birdsPlaced > 0 ? (totalLosses / birdsPlaced) * 100 : 0;

    return { birdsPlaced, mort, culls, totalLosses, birdsAlive, mortalityPct };
  }, [houseSummary]);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>History</h1>

      {currentFarmId && (
        <p>
          <strong>Current Farm:</strong> {farmName || currentFarmId}
        </p>
      )}

      <label>Select finished crop</label>
      <select
        value={cropId}
        onChange={(e) => setCropId(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 20px" }}
      >
        <option value="">-- choose finished crop --</option>
        {crops.map((crop) => (
          <option key={crop.id} value={crop.id}>
            Crop {crop.cropNumber}
            {crop.finishDate ? ` - finished ${new Date(crop.finishDate).toLocaleDateString()}` : ""}
          </option>
        ))}
      </select>

      {msg && <p>{msg}</p>}

      {cropId && cropDetails && (
        <>
          <h2>Crop Summary</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds placed</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mort</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Culls</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Total losses</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds alive</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mortality %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{totals.birdsPlaced}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{totals.mort}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{totals.culls}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{totals.totalLosses}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{totals.birdsAlive}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {totals.mortalityPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Daily Records</h2>
          {records.length === 0 ? (
            <p>No daily records.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Date</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>House</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mort</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Culls</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Feed kg</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Water L</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.house.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.mort}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.culls}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.feedKg}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.waterL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Medication Records</h2>
          {medications.length === 0 ? (
            <p>No medication records.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Start Date</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Medicine</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Supplier</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Houses</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Print</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((record) => (
                  <tr key={record.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(record.startDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.medicineName}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.supplier || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.housesTreated || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.birdsTreated ?? "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      <a href={`/app/medication/print?id=${record.id}`} target="_blank" rel="noreferrer">
                        Print
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Avara Export History</h2>
          {exportsList.length === 0 ? (
            <p>No Avara exports.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Stage</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>File</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Created</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Download</th>
                </tr>
              </thead>
              <tbody>
                {exportsList.map((item) => (
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