"use client";

import Link from "next/link";
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

    if (r.ok) {
      setCropDetails(data);
    } else {
      setCropDetails(null);
    }
  }

  async function loadDaily(selectedCropId: string) {
    const r = await fetch(`/api/daily-records/list?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setRecords(data);
    } else {
      setRecords([]);
    }
  }

  async function loadMedications(selectedCropId: string) {
    const r = await fetch(`/api/medications/list?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setMedications(data);
    } else {
      setMedications([]);
    }
  }

  async function loadExports(selectedCropId: string) {
    const r = await fetch(`/api/avara/history?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setExportsList(data);
    } else {
      setExportsList([]);
    }
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
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Archive and review</div>
            <h1 className="page-intro__title">History</h1>
            <p className="page-intro__subtitle">
              Review finished crops, daily records, medication history and export files.
            </p>
            <div style={{ marginTop: 12 }}>
              <Link href="/history/compare" className="mobile-button mobile-button--secondary">
                Porównaj cropy →
              </Link>
            </div>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">History items</div>
              <div>Finished crops: {crops.length}</div>
              <div style={{ marginTop: 6 }}>Selected crop: {cropId || "-"}</div>
            </div>
          </div>
        </div>

        <div className="mobile-card">
          <h2>Select Finished Crop</h2>
          <label>Choose crop</label>
          <select value={cropId} onChange={(e) => setCropId(e.target.value)}>
            <option value="">-- choose finished crop --</option>
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                Crop {crop.cropNumber}
                {crop.finishDate
                  ? ` - finished ${new Date(crop.finishDate).toLocaleDateString()}`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {msg && (
          <div className="mobile-alert" style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {cropId && cropDetails && (
          <>
            <div className="mobile-card">
              <h2>Crop Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds placed</div>
                  <div className="mobile-kpi__value">{totals.birdsPlaced}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mort</div>
                  <div className="mobile-kpi__value">{totals.mort}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Culls</div>
                  <div className="mobile-kpi__value">{totals.culls}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Total losses</div>
                  <div className="mobile-kpi__value">{totals.totalLosses}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Birds alive</div>
                  <div className="mobile-kpi__value">{totals.birdsAlive}</div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Mortality %</div>
                  <div className="mobile-kpi__value">{totals.mortalityPct.toFixed(2)}%</div>
                </div>
              </div>
            </div>

            <h2 className="mobile-section-title">House Summary</h2>
            {houseSummary.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No house summary available.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {houseSummary.map((house) => (
                  <div key={house.houseName} className="mobile-record-card">
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
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mobile-section-title">Daily Records</h2>
            {records.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No daily records.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {records.map((record) => (
                  <div key={record.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {record.house.name} · {new Date(record.date).toLocaleDateString()}
                    </h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Mort</strong>
                        <span>{record.mort}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Culls</strong>
                        <span>{record.culls}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Feed kg</strong>
                        <span>{record.feedKg}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Water L</strong>
                        <span>{record.waterL}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Weight g</strong>
                        <span>{record.avgWeightG ?? "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Notes</strong>
                        <span>{record.notes || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mobile-section-title">Medication Records</h2>
            {medications.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No medication records.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {medications.map((record) => (
                  <div key={record.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {record.medicineName} · {new Date(record.startDate).toLocaleDateString()}
                    </h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Supplier</strong>
                        <span>{record.supplier || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Houses treated</strong>
                        <span>{record.housesTreated || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds treated</strong>
                        <span>{record.birdsTreated ?? "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Finish date</strong>
                        <span>
                          {record.finishDate
                            ? new Date(record.finishDate).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Administrator</strong>
                        <span>{record.administratorName || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mobile-section-title">Avara Export History</h2>
            {exportsList.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No export history.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {exportsList.map((item) => (
                  <div key={item.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">{item.fileName}</h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Stage</strong>
                        <span>{item.stage}</span>
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