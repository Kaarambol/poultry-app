"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type House = {
  id: string;
  name: string;
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
  houseId: string;
  house: {
    id: string;
    name: string;
  };
  crop: {
    placementDate: string;
  };
};

type RecordWithCalc = DailyRecord & {
  ageDays: number;
  dailyTotal: number;
  cumulativeTotal: number;
};

export default function DailyPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");

  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [cropDetails, setCropDetails] = useState<CropDetails | null>(null);

  const [houses, setHouses] = useState<House[]>([]);
  const [houseId, setHouseId] = useState("");

  const [date, setDate] = useState("");
  const [mort, setMort] = useState("");
  const [culls, setCulls] = useState("");
  const [feedKg, setFeedKg] = useState("");
  const [waterL, setWaterL] = useState("");
  const [avgWeightG, setAvgWeightG] = useState("");
  const [notes, setNotes] = useState("");

  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const [editingId, setEditingId] = useState("");

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
      return;
    }

    if (!data) {
      setMsgType("info");
      setMsg("No active crop for the current farm.");
      setCropId("");
      setCropLabel("");
      return;
    }

    setCropId(data.id);
    setCropLabel(data.cropNumber);
    setCurrentCropId(data.id);
    setMsg("");
  }

  async function loadHouses(selectedFarmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${selectedFarmId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setHouses(data);
    } else {
      setHouses([]);
    }
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

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/daily-records/list?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setRecords(data);
    } else {
      setRecords([]);
    }
  }

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));

    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadHouses(farmId);
    loadActiveCrop(farmId);
  }, []);

  useEffect(() => {
    if (cropId) {
      loadCropDetails(cropId);
      loadRecords(cropId);
    } else {
      setCropDetails(null);
      setRecords([]);
    }
  }, [cropId]);

  function validateForm() {
    if (!cropId) return "No active crop selected.";
    if (!houseId) return "Choose a house.";
    if (!date) return "Choose a date.";

    const mortNum = Number(mort || 0);
    const cullsNum = Number(culls || 0);
    const feedNum = Number(feedKg || 0);
    const waterNum = Number(waterL || 0);
    const weightNum = avgWeightG === "" ? null : Number(avgWeightG);

    if (
      Number.isNaN(mortNum) ||
      Number.isNaN(cullsNum) ||
      Number.isNaN(feedNum) ||
      Number.isNaN(waterNum) ||
      (weightNum !== null && Number.isNaN(weightNum))
    ) {
      return "Numeric fields must contain valid numbers.";
    }

    if (
      mortNum < 0 ||
      cullsNum < 0 ||
      feedNum < 0 ||
      waterNum < 0 ||
      (weightNum !== null && weightNum < 0)
    ) {
      return "Values cannot be negative.";
    }

    if (cropDetails) {
      const placementDate = new Date(cropDetails.placementDate);
      const recordDate = new Date(date);

      if (recordDate < placementDate) {
        return "Date cannot be earlier than crop placement date.";
      }
    }

    return "";
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setMsgType("error");
      setMsg(validationError);
      return;
    }

    setMsg("");

    const r = await fetch("/api/daily-records/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cropId,
        houseId,
        date,
        mort: Number(mort || 0),
        culls: Number(culls || 0),
        feedKg: Number(feedKg || 0),
        waterL: Number(waterL || 0),
        avgWeightG: avgWeightG === "" ? null : Number(avgWeightG),
        notes,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Daily record saved!");
    clearFormButKeepContext();
    loadRecords(cropId);
  }

  function startEdit(record: DailyRecord) {
    setEditingId(record.id);
    setHouseId(record.house.id);
    setDate(new Date(record.date).toISOString().slice(0, 10));
    setMort(String(record.mort));
    setCulls(String(record.culls));
    setFeedKg(String(record.feedKg));
    setWaterL(String(record.waterL));
    setAvgWeightG(record.avgWeightG !== null ? String(record.avgWeightG) : "");
    setNotes(record.notes || "");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId("");
    clearFormButKeepContext();
    setMsg("");
  }

  async function updateRecord(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setMsgType("error");
      setMsg(validationError);
      return;
    }

    setMsg("");

    const r = await fetch("/api/daily-records/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editingId,
        mort: Number(mort || 0),
        culls: Number(culls || 0),
        feedKg: Number(feedKg || 0),
        waterL: Number(waterL || 0),
        avgWeightG: avgWeightG === "" ? null : Number(avgWeightG),
        notes,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Daily record updated!");
    setEditingId("");
    clearFormButKeepContext();
    loadRecords(cropId);
  }

  async function deleteRecord(id: string) {
    const confirmed = window.confirm("Are you sure you want to delete this record?");
    if (!confirmed) return;

    const r = await fetch("/api/daily-records/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Daily record deleted!");

    if (editingId === id) {
      cancelEdit();
    }

    loadRecords(cropId);
  }

  function clearFormButKeepContext() {
    setMort("");
    setCulls("");
    setFeedKg("");
    setWaterL("");
    setAvgWeightG("");
    setNotes("");
    setDate(new Date().toISOString().slice(0, 10));
  }

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
    const mortSum = houseSummary.reduce((sum, h) => sum + h.mort, 0);
    const cullsSum = houseSummary.reduce((sum, h) => sum + h.culls, 0);
    const totalLosses = mortSum + cullsSum;
    const birdsAlive = birdsPlaced - totalLosses;
    const mortalityPct = birdsPlaced > 0 ? (totalLosses / birdsPlaced) * 100 : 0;

    return {
      birdsPlaced,
      mort: mortSum,
      culls: cullsSum,
      totalLosses,
      birdsAlive,
      mortalityPct,
    };
  }, [houseSummary]);

  const recordsWithCalc = useMemo<RecordWithCalc[]>(() => {
    const filteredRecords = houseId
      ? records.filter((record) => record.houseId === houseId)
      : records;

    const byHouse: Record<string, number> = {};

    const sorted = [...filteredRecords].sort((a, b) => {
      if (a.house.name < b.house.name) return -1;
      if (a.house.name > b.house.name) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return sorted.map((record) => {
      const placementDate = new Date(record.crop.placementDate);
      const recordDate = new Date(record.date);

      const ageDays = Math.floor(
        (recordDate.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const dailyTotal = record.mort + record.culls;

      if (!byHouse[record.houseId]) {
        byHouse[record.houseId] = 0;
      }

      byHouse[record.houseId] += dailyTotal;
      const cumulativeTotal = byHouse[record.houseId];

      return {
        ...record,
        ageDays,
        dailyTotal,
        cumulativeTotal,
      };
    });
  }, [records, houseId]);

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
            <div className="page-intro__eyebrow">Daily operations</div>
            <h1 className="page-intro__title">Daily Entry</h1>
            <p className="page-intro__subtitle">
              Add daily mortality, feed, water and weight data for the active crop.
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
            Read-only mode. VIEWER can only see records.
          </div>
        )}

        <div className="mobile-card">
          <h2>{editingId ? "Edit Daily Record" : "Add Daily Record"}</h2>

          <form onSubmit={editingId ? updateRecord : saveRecord}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>House</label>
                <select
                  value={houseId}
                  onChange={(e) => setHouseId(e.target.value)}
                  required
                  disabled={!cropId || !canOperate}
                >
                  <option value="">-- choose house --</option>
                  {houses.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Mort</label>
                <input
                  type="number"
                  min="0"
                  value={mort}
                  onChange={(e) => setMort(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Culls</label>
                <input
                  type="number"
                  min="0"
                  value={culls}
                  onChange={(e) => setCulls(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Feed used (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feedKg}
                  onChange={(e) => setFeedKg(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Water used (L)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={waterL}
                  onChange={(e) => setWaterL(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Average weight (g) - optional</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={avgWeightG}
                  onChange={(e) => setAvgWeightG(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit" disabled={!cropId}>
                    {editingId ? "Update Daily Record" : "Save Daily Record"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      className="mobile-button mobile-button--secondary"
                      onClick={cancelEdit}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {cropId && (
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
                <p style={{ margin: 0 }}>No house placements found.</p>
              </div>
            ) : (
              <>
                <div className="mobile-record-list" style={{ marginBottom: 16 }}>
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

                <div className="mobile-table-wrap hide-mobile">
                  <table>
                    <thead>
                      <tr>
                        <th>House</th>
                        <th>Birds placed</th>
                        <th>Mort</th>
                        <th>Culls</th>
                        <th>Total losses</th>
                        <th>Birds alive</th>
                        <th>Mortality %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseSummary.map((house) => (
                        <tr key={house.houseName}>
                          <td>{house.houseName}</td>
                          <td>{house.birdsPlaced}</td>
                          <td>{house.mort}</td>
                          <td>{house.culls}</td>
                          <td>{house.totalLosses}</td>
                          <td>{house.birdsAlive}</td>
                          <td>{house.mortalityPct.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mobile-card">
              <h2>Filter Records</h2>
              <label>Filter by house</label>
              <select value={houseId} onChange={(e) => setHouseId(e.target.value)}>
                <option value="">-- all houses --</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </select>
            </div>

            <h2 className="mobile-section-title">
              Saved Daily Records {houseId ? "(filtered by selected house)" : ""}
            </h2>

            {recordsWithCalc.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No records yet.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {recordsWithCalc.map((record) => (
                  <div key={record.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {record.house.name} · {new Date(record.date).toLocaleDateString()}
                    </h3>

                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Age day</strong>
                        <span>{record.ageDays}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Mort</strong>
                        <span>{record.mort}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Culls</strong>
                        <span>{record.culls}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Daily total</strong>
                        <span>{record.dailyTotal}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Cum total</strong>
                        <span>{record.cumulativeTotal}</span>
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

                    {canOperate && (
                      <div className="mobile-actions" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="mobile-button mobile-button--secondary"
                          onClick={() => startEdit(record)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mobile-button mobile-button--danger"
                          onClick={() => deleteRecord(record.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
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