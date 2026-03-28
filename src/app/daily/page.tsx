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
  thinDate: string | null;
  thinBirds: number | null;
  thin2Date: string | null;
  thin2Birds: number | null;
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
  cullsSmall: number;
  cullsLeg: number;
  feedKg: number;
  waterL: number;
  avgWeightG: number | null;
  weightPercent: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  co2MinPpm: number | null;
  co2MaxPpm: number | null;
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
  const [cullsSmall, setCullsSmall] = useState("");
  const [cullsLeg, setCullsLeg] = useState("");
  const [feedKg, setFeedKg] = useState("");
  const [waterL, setWaterL] = useState("");
  const [avgWeightG, setAvgWeightG] = useState("");

  const [temperatureMinC, setTemperatureMinC] = useState("");
  const [temperatureMaxC, setTemperatureMaxC] = useState("");
  const [humidityMinPct, setHumidityMinPct] = useState("");
  const [humidityMaxPct, setHumidityMaxPct] = useState("");
  const [co2MinPpm, setCo2MinPpm] = useState("");
  const [co2MaxPpm, setCo2MaxPpm] = useState("");

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
    const cullsSmallNum = Number(cullsSmall || 0);
    const cullsLegNum = Number(cullsLeg || 0);
    const feedNum = Number(feedKg || 0);
    const waterNum = Number(waterL || 0);
    const weightNum = avgWeightG === "" ? null : Number(avgWeightG);
    const tempMinNum = temperatureMinC === "" ? null : Number(temperatureMinC);
    const tempMaxNum = temperatureMaxC === "" ? null : Number(temperatureMaxC);
    const humMinNum = humidityMinPct === "" ? null : Number(humidityMinPct);
    const humMaxNum = humidityMaxPct === "" ? null : Number(humidityMaxPct);
    const co2MinNum = co2MinPpm === "" ? null : Number(co2MinPpm);
    const co2MaxNum = co2MaxPpm === "" ? null : Number(co2MaxPpm);

    if (
      Number.isNaN(mortNum) ||
      Number.isNaN(cullsSmallNum) ||
      Number.isNaN(cullsLegNum) ||
      Number.isNaN(feedNum) ||
      Number.isNaN(waterNum) ||
      (weightNum !== null && Number.isNaN(weightNum)) ||
      (tempMinNum !== null && Number.isNaN(tempMinNum)) ||
      (tempMaxNum !== null && Number.isNaN(tempMaxNum)) ||
      (humMinNum !== null && Number.isNaN(humMinNum)) ||
      (humMaxNum !== null && Number.isNaN(humMaxNum)) ||
      (co2MinNum !== null && Number.isNaN(co2MinNum)) ||
      (co2MaxNum !== null && Number.isNaN(co2MaxNum))
    ) {
      return "Numeric fields must contain valid numbers.";
    }

    if (
      mortNum < 0 ||
      cullsSmallNum < 0 ||
      cullsLegNum < 0 ||
      feedNum < 0 ||
      waterNum < 0 ||
      (weightNum !== null && weightNum < 0) ||
      (tempMinNum !== null && tempMinNum < 0) ||
      (tempMaxNum !== null && tempMaxNum < 0) ||
      (humMinNum !== null && humMinNum < 0) ||
      (humMaxNum !== null && humMaxNum < 0) ||
      (co2MinNum !== null && co2MinNum < 0) ||
      (co2MaxNum !== null && co2MaxNum < 0)
    ) {
      return "Values cannot be negative.";
    }

    if (tempMinNum !== null && tempMaxNum !== null && tempMinNum > tempMaxNum) {
      return "Temperature min cannot be greater than temperature max.";
    }

    if (humMinNum !== null && humMaxNum !== null && humMinNum > humMaxNum) {
      return "Humidity min cannot be greater than humidity max.";
    }

    if (co2MinNum !== null && co2MaxNum !== null && co2MinNum > co2MaxNum) {
      return "CO2 min cannot be greater than CO2 max.";
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
        cullsSmall: Number(cullsSmall || 0),
        cullsLeg: Number(cullsLeg || 0),
        feedKg: Number(feedKg || 0),
        waterL: Number(waterL || 0),
        avgWeightG: avgWeightG === "" ? null : Number(avgWeightG),
        temperatureMinC: temperatureMinC === "" ? null : Number(temperatureMinC),
        temperatureMaxC: temperatureMaxC === "" ? null : Number(temperatureMaxC),
        humidityMinPct: humidityMinPct === "" ? null : Number(humidityMinPct),
        humidityMaxPct: humidityMaxPct === "" ? null : Number(humidityMaxPct),
        co2MinPpm: co2MinPpm === "" ? null : Number(co2MinPpm),
        co2MaxPpm: co2MaxPpm === "" ? null : Number(co2MaxPpm),
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
    setCullsSmall(String(record.cullsSmall || 0));
    setCullsLeg(String(record.cullsLeg || 0));
    setFeedKg(String(record.feedKg));
    setWaterL(String(record.waterL));
    setAvgWeightG(record.avgWeightG !== null ? String(record.avgWeightG) : "");
    setTemperatureMinC(record.temperatureMinC !== null ? String(record.temperatureMinC) : "");
    setTemperatureMaxC(record.temperatureMaxC !== null ? String(record.temperatureMaxC) : "");
    setHumidityMinPct(record.humidityMinPct !== null ? String(record.humidityMinPct) : "");
    setHumidityMaxPct(record.humidityMaxPct !== null ? String(record.humidityMaxPct) : "");
    setCo2MinPpm(record.co2MinPpm !== null ? String(record.co2MinPpm) : "");
    setCo2MaxPpm(record.co2MaxPpm !== null ? String(record.co2MaxPpm) : "");
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
        cullsSmall: Number(cullsSmall || 0),
        cullsLeg: Number(cullsLeg || 0),
        feedKg: Number(feedKg || 0),
        waterL: Number(waterL || 0),
        avgWeightG: avgWeightG === "" ? null : Number(avgWeightG),
        temperatureMinC: temperatureMinC === "" ? null : Number(temperatureMinC),
        temperatureMaxC: temperatureMaxC === "" ? null : Number(temperatureMaxC),
        humidityMinPct: humidityMinPct === "" ? null : Number(humidityMinPct),
        humidityMaxPct: humidityMaxPct === "" ? null : Number(humidityMaxPct),
        co2MinPpm: co2MinPpm === "" ? null : Number(co2MinPpm),
        co2MaxPpm: co2MaxPpm === "" ? null : Number(co2MaxPpm),
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
    setCullsSmall("");
    setCullsLeg("");
    setFeedKg("");
    setWaterL("");
    setAvgWeightG("");
    setTemperatureMinC("");
    setTemperatureMaxC("");
    setHumidityMinPct("");
    setHumidityMaxPct("");
    setCo2MinPpm("");
    setCo2MaxPpm("");
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
        if (!grouped[p.house.id]) {
          grouped[p.house.id] = {
            houseName: p.house.name,
            birdsPlaced: 0,
            mort: 0,
            culls: 0,
            totalLosses: 0,
            birdsAlive: 0,
            mortalityPct: 0,
          };
        }
        grouped[p.house.id].birdsPlaced += p.birdsPlaced;
      }
    }

    for (const record of records) {
      const item = grouped[record.house.id];
      if (!item) continue;
      item.mort += record.mort;
      item.culls += record.culls;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (const key of Object.keys(grouped)) {
      const item = grouped[key];
      item.totalLosses = item.mort + item.culls;

      let thinned = 0;
      if (cropDetails) {
        for (const p of cropDetails.placements) {
          if (p.house.id !== key) continue;
          if (p.thinBirds && p.thinDate && new Date(p.thinDate) <= today) thinned += p.thinBirds;
          if (p.thin2Birds && p.thin2Date && new Date(p.thin2Date) <= today) thinned += p.thin2Birds;
        }
      }

      item.birdsAlive = item.birdsPlaced - item.totalLosses - thinned;
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
              Add daily mortality, feed, water, weight and environment data for the active crop.
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

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <h2>Crop Setup</h2>
          <p style={{ marginTop: 0 }}>Manage thin and clear dates per house.</p>
          <div className="mobile-actions">
           {/* NAPRAWIONY LINK - USUNIĘTO /app */}
           <a href="/thin-clear" className="mobile-button mobile-button--secondary">
            Thin / Clear Setup
           </a>
         </div>
       </div>
       
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
                <input type="number" min="0" value={mort} onChange={(e) => setMort(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>Culls Small</label>
                <input type="number" min="0" value={cullsSmall} onChange={(e) => setCullsSmall(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Culls Leg</label>
                <input type="number" min="0" value={cullsLeg} onChange={(e) => setCullsLeg(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>Average weight (g)</label>
                <input type="number" min="0" step="0.01" value={avgWeightG} onChange={(e) => setAvgWeightG(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Feed used (kg)</label>
                <input type="number" min="0" step="0.01" value={feedKg} onChange={(e) => setFeedKg(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>Water used (L)</label>
                <input type="number" min="0" step="0.01" value={waterL} onChange={(e) => setWaterL(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <h3 style={{ marginTop: 16, marginBottom: 10 }}>Environment</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Temp min (°C)</label>
                <input type="number" min="0" step="0.1" value={temperatureMinC} onChange={(e) => setTemperatureMinC(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>Temp max (°C)</label>
                <input type="number" min="0" step="0.1" value={temperatureMaxC} onChange={(e) => setTemperatureMaxC(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Humidity min (%)</label>
                <input type="number" min="0" step="0.1" value={humidityMinPct} onChange={(e) => setHumidityMinPct(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>Humidity max (%)</label>
                <input type="number" min="0" step="0.1" value={humidityMaxPct} onChange={(e) => setHumidityMaxPct(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>CO2 min (ppm)</label>
                <input type="number" min="0" value={co2MinPpm} onChange={(e) => setCo2MinPpm(e.target.value)} disabled={!cropId || !canOperate} />
              </div>

              <div>
                <label>CO2 max (ppm)</label>
                <input type="number" min="0" value={co2MaxPpm} onChange={(e) => setCo2MaxPpm(e.target.value)} disabled={!cropId || !canOperate} />
              </div>
            </div>

            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!cropId || !canOperate} />

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
                <div className="mobile-kpi"><div className="mobile-kpi__label">Birds placed</div><div className="mobile-kpi__value">{totals.birdsPlaced}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Mort</div><div className="mobile-kpi__value">{totals.mort}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Culls</div><div className="mobile-kpi__value">{totals.culls}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Total losses</div><div className="mobile-kpi__value">{totals.totalLosses}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Birds alive</div><div className="mobile-kpi__value">{totals.birdsAlive}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Mortality %</div><div className="mobile-kpi__value">{totals.mortalityPct.toFixed(2)}%</div></div>
              </div>
            </div>

            <h2 className="mobile-section-title">House Summary</h2>
            {houseSummary.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No house placements found.</p>
              </div>
            ) : (
              <div className="mobile-record-list" style={{ marginBottom: 16 }}>
                {houseSummary.map((house) => (
                  <div key={house.houseName} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">{house.houseName}</h3>
                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row"><strong>Birds placed</strong><span>{house.birdsPlaced}</span></div>
                      <div className="mobile-record-row"><strong>Mort</strong><span>{house.mort}</span></div>
                      <div className="mobile-record-row"><strong>Culls</strong><span>{house.culls}</span></div>
                      <div className="mobile-record-row"><strong>Total losses</strong><span>{house.totalLosses}</span></div>
                      <div className="mobile-record-row"><strong>Birds alive</strong><span>{house.birdsAlive}</span></div>
                      <div className="mobile-record-row"><strong>Mortality %</strong><span>{house.mortalityPct.toFixed(2)}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
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
                      <div className="mobile-record-row"><strong>Age day</strong><span>{record.ageDays}</span></div>
                      <div className="mobile-record-row"><strong>Mort</strong><span>{record.mort}</span></div>
                      <div className="mobile-record-row"><strong>Culls</strong><span>{record.culls}</span></div>
                      <div className="mobile-record-row"><strong>Daily total</strong><span>{record.dailyTotal}</span></div>
                      <div className="mobile-record-row"><strong>Cum total</strong><span>{record.cumulativeTotal}</span></div>
                      <div className="mobile-record-row"><strong>Feed kg</strong><span>{record.feedKg}</span></div>
                      <div className="mobile-record-row"><strong>Water L</strong><span>{record.waterL}</span></div>
                      <div className="mobile-record-row"><strong>Weight g</strong><span>{record.avgWeightG ?? "-"}</span></div>
                      <div className="mobile-record-row"><strong>Temp min/max</strong><span>{record.temperatureMinC ?? "-"} / {record.temperatureMaxC ?? "-"}</span></div>
                      <div className="mobile-record-row"><strong>Humidity min/max</strong><span>{record.humidityMinPct ?? "-"} / {record.humidityMaxPct ?? "-"}</span></div>
                      <div className="mobile-record-row"><strong>CO2 min/max</strong><span>{record.co2MinPpm ?? "-"} / {record.co2MaxPpm ?? "-"}</span></div>
                      <div className="mobile-record-row"><strong>Notes</strong><span>{record.notes || "-"}</span></div>
                    </div>

                    {canOperate && (
                      <div className="mobile-actions" style={{ marginTop: 12 }}>
                        <button type="button" className="mobile-button mobile-button--secondary" onClick={() => startEdit(record)}>
                          Edit
                        </button>
                        <button type="button" className="mobile-button mobile-button--danger" onClick={() => deleteRecord(record.id)}>
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