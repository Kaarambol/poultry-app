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
    if (Array.isArray(data)) setHouses(data);
    else setHouses([]);
  }

  async function loadCropDetails(selectedCropId: string) {
    const r = await fetch(`/api/crops/details?cropId=${selectedCropId}`);
    const data = await r.json();
    if (r.ok) setCropDetails(data);
    else setCropDetails(null);
  }

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/daily-records/list?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setRecords(data);
    else setRecords([]);
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

    if (mortNum < 0 || cullsNum < 0 || feedNum < 0 || waterNum < 0 || (weightNum !== null && weightNum < 0)) {
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

    return { birdsPlaced, mort: mortSum, culls: cullsSum, totalLosses, birdsAlive, mortalityPct };
  }, [houseSummary]);

  const recordsWithCalc = useMemo(() => {
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

      const ageDays =
        Math.floor(
          (recordDate.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

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

  const fieldStyle = (hasError: boolean): React.CSSProperties => ({
    width: "100%",
    padding: 10,
    margin: "6px 0 12px",
    border: hasError ? "1px solid #c62828" : "1px solid #ccc",
    borderRadius: 6,
  });

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Daily Entry</h1>

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
          Read-only mode. VIEWER can only see records.
        </p>
      )}

      <form onSubmit={editingId ? updateRecord : saveRecord}>
        <label>House</label>
        <select
          value={houseId}
          onChange={(e) => setHouseId(e.target.value)}
          style={fieldStyle(!houseId && !!msg && msgType === "error")}
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

        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={fieldStyle(!date && !!msg && msgType === "error")}
          required
          disabled={!cropId || !canOperate}
        />

        <label>Mort</label>
        <input
          type="number"
          min="0"
          value={mort}
          onChange={(e) => setMort(e.target.value)}
          style={fieldStyle(Number(mort || 0) < 0)}
          disabled={!cropId || !canOperate}
        />

        <label>Culls</label>
        <input
          type="number"
          min="0"
          value={culls}
          onChange={(e) => setCulls(e.target.value)}
          style={fieldStyle(Number(culls || 0) < 0)}
          disabled={!cropId || !canOperate}
        />

        <label>Feed used (kg)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={feedKg}
          onChange={(e) => setFeedKg(e.target.value)}
          style={fieldStyle(Number(feedKg || 0) < 0)}
          disabled={!cropId || !canOperate}
        />

        <label>Water used (L)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={waterL}
          onChange={(e) => setWaterL(e.target.value)}
          style={fieldStyle(Number(waterL || 0) < 0)}
          disabled={!cropId || !canOperate}
        />

        <label>Average weight (g) - optional</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={avgWeightG}
          onChange={(e) => setAvgWeightG(e.target.value)}
          style={fieldStyle(avgWeightG !== "" && Number(avgWeightG) < 0)}
          disabled={!cropId || !canOperate}
        />

        <label>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...fieldStyle(false), minHeight: 90 }}
          disabled={!cropId || !canOperate}
        />

        {canOperate && (
          <>
            <button style={{ padding: 12, width: "100%" }} type="submit" disabled={!cropId}>
              {editingId ? "Update Daily Record" : "Save Daily Record"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{ padding: 12, width: "100%", marginTop: 10 }}
              >
                Cancel Edit
              </button>
            )}
          </>
        )}
      </form>

      {msg && (
        <p
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background:
              msgType === "error" ? "#ffebee" : msgType === "success" ? "#e8f5e9" : "#eef3f8",
            color:
              msgType === "error" ? "#b71c1c" : msgType === "success" ? "#1b5e20" : "#1f3b57",
            border:
              msgType === "error"
                ? "1px solid #ef9a9a"
                : msgType === "success"
                ? "1px solid #a5d6a7"
                : "1px solid #c5d7ea",
          }}
        >
          {msg}
        </p>
      )}

      {cropId && (
        <>
          <h2 style={{ marginTop: 40 }}>Crop Summary</h2>
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

          <h2>House Summary</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>House</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds placed</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mort</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Culls</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Total losses</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds alive</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mortality %</th>
              </tr>
            </thead>
            <tbody>
              {houseSummary.map((item) => (
                <tr key={item.houseName}>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.houseName}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.birdsPlaced}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.mort}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.culls}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.totalLosses}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.birdsAlive}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {item.mortalityPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Saved Records {houseId ? "(Filtered by selected house)" : ""}</h2>
          {recordsWithCalc.length === 0 ? (
            <p>No records yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Date</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>House</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Age</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mort</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Culls</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Daily Total</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Cum Total</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Feed kg</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Water L</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Weight g</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recordsWithCalc.map((record) => (
                  <tr key={record.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.house.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.ageDays}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.mort}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.culls}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.dailyTotal}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.cumulativeTotal}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.feedKg}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{record.waterL}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {record.avgWeightG ?? "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {canOperate ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            style={{ marginRight: 8 }}
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => deleteRecord(record.id)}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <span>-</span>
                      )}
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