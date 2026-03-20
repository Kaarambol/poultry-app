"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

/* ---- TYPES ---- */

type Farm = {
  id: string;
  name: string;
  code: string;
};

type House = {
  id: string;
  name: string;
  code: string | null;
  defaultMaxCo2Ppm: number | null;
  defaultMaxAmmoniaPpm: number | null;
};

type NightCheckRecord = {
  id: string;
  date: string;
  checkTime: string | null;
  checkedByName: string | null;
  humidityPct: number | null;
  co2Ppm: number | null;
  ammoniaPpm: number | null;
  litterScore: number | null;
  wetAreas: boolean;
  capping: boolean;
  litterNotes?: string | null;

  waterSystemOk: boolean;
  feedSystemOk: boolean;
  ventilationOk: boolean;
  alarmOk: boolean;
  generatorOk: boolean;
  lightingOk: boolean;

  birdsOk: boolean;
  cropFillOk: boolean;
  unusualBehaviour: boolean;

  windowsOpen: boolean;
  fridgeTemp: boolean;
  litterSampleTaken: boolean;
  fireExtinguisher: boolean;
  footDipChange: boolean;
  dosatronCheck: boolean;
  vitaminAdd: boolean;
  vaccination: boolean;
  medication: boolean;
  pestControlInspection: boolean;
  waterSanitizer: boolean;
  calibrationWaterMeter: boolean;
  calibrationTempProbe: boolean;
  calibrationHumidityProbe: boolean;
  calibrationWeigher: boolean;

  comments?: string | null;
  house: {
    id: string;
    name: string;
    code: string | null;
  };
};

/* ---- STATUS HELPERS ---- */

function getCo2Status(value: number | null, max: number | null) {
  if (value === null) return "neutral";
  if (!max) return "neutral";
  if (value > max) return "critical";
  if (value > max * 0.85) return "warning";
  return "ok";
}

function getAmmoniaStatus(value: number | null, max: number | null) {
  if (value === null) return "neutral";
  if (!max) return "neutral";
  if (value > max) return "critical";
  if (value > max * 0.75) return "warning";
  return "ok";
}

function getLitterStatus(score: number | null) {
  if (score === null) return "neutral";
  if (score >= 5) return "critical";
  if (score >= 3) return "warning";
  return "ok";
}

function statusColor(status: string) {
  switch (status) {
    case "ok":
      return "#1f7a1f";
    case "warning":
      return "#c77700";
    case "critical":
      return "#b00020";
    default:
      return "#666";
  }
}

/* ---- COMPONENT ---- */

export default function NightCheckPage() {
  const [farmId, setFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<NightCheckRecord[]>([]);
  const [myRole, setMyRole] = useState<FarmRole>("");

  const [houseId, setHouseId] = useState("");
  const [date, setDate] = useState("");
  const [checkTime, setCheckTime] = useState("");
  const [checkedByName, setCheckedByName] = useState("");

  const [humidityPct, setHumidityPct] = useState("");
  const [co2Ppm, setCo2Ppm] = useState("");
  const [ammoniaPpm, setAmmoniaPpm] = useState("");

  const [litterScore, setLitterScore] = useState("");
  const [wetAreas, setWetAreas] = useState(false);
  const [capping, setCapping] = useState(false);
  const [litterNotes, setLitterNotes] = useState("");

  const [waterSystemOk, setWaterSystemOk] = useState(true);
  const [feedSystemOk, setFeedSystemOk] = useState(true);
  const [ventilationOk, setVentilationOk] = useState(true);
  const [alarmOk, setAlarmOk] = useState(true);
  const [generatorOk, setGeneratorOk] = useState(true);
  const [lightingOk, setLightingOk] = useState(true);

  const [birdsOk, setBirdsOk] = useState(true);
  const [cropFillOk, setCropFillOk] = useState(true);
  const [unusualBehaviour, setUnusualBehaviour] = useState(false);

  const [windowsOpen, setWindowsOpen] = useState(false);
  const [fridgeTemp, setFridgeTemp] = useState(false);
  const [litterSampleTaken, setLitterSampleTaken] = useState(false);

  const [fireExtinguisher, setFireExtinguisher] = useState(false);
  const [footDipChange, setFootDipChange] = useState(false);
  const [dosatronCheck, setDosatronCheck] = useState(false);
  const [vitaminAdd, setVitaminAdd] = useState(false);
  const [vaccination, setVaccination] = useState(false);
  const [medication, setMedication] = useState(false);
  const [pestControlInspection, setPestControlInspection] = useState(false);
  const [waterSanitizer, setWaterSanitizer] = useState(false);

  const [calibrationWaterMeter, setCalibrationWaterMeter] = useState(false);
  const [calibrationTempProbe, setCalibrationTempProbe] = useState(false);
  const [calibrationHumidityProbe, setCalibrationHumidityProbe] = useState(false);
  const [calibrationWeigher, setCalibrationWeigher] = useState(false);

  const [comments, setComments] = useState("");

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = getCurrentFarmId();
    if (!id) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setDate(new Date().toISOString().slice(0, 10));
    setFarmId(id);
    loadFarm(id);
    loadMyRole(id);
    loadActiveCrop(id);
    loadHouses(id);
  }, []);

  async function loadFarm(id: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    const farm = Array.isArray(data) ? data.find((f: Farm) => f.id === id) : null;
    if (farm) setFarmName(`${farm.name} (${farm.code})`);
  }

  async function loadMyRole(id: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${id}`);
    const data = await r.json();
    if (r.ok) {
      setMyRole(data.role || "");
    }
  }

  async function loadActiveCrop(id: string) {
    const r = await fetch(`/api/crops/active?farmId=${id}`);
    const data = await r.json();

    if (r.ok && data) {
      setCropId(data.id);
      setCropLabel(data.cropNumber);
      setCurrentCropId(data.id);
      loadRecords(data.id);
    } else {
      setCropId("");
      setCropLabel("");
    }
  }

  async function loadHouses(id: string) {
    const r = await fetch(`/api/houses/list?farmId=${id}`);
    const data = await r.json();
    if (Array.isArray(data)) setHouses(data);
  }

  async function loadRecords(id: string) {
    const r = await fetch(`/api/night-check/list?cropId=${id}`);
    const data = await r.json();
    if (Array.isArray(data)) {
      setRecords(data);
    } else {
      setRecords([]);
    }
  }

  function resetForm() {
    setHouseId("");
    setDate(new Date().toISOString().slice(0, 10));
    setCheckTime("");
    setCheckedByName("");
    setHumidityPct("");
    setCo2Ppm("");
    setAmmoniaPpm("");
    setLitterScore("");
    setWetAreas(false);
    setCapping(false);
    setLitterNotes("");

    setWaterSystemOk(true);
    setFeedSystemOk(true);
    setVentilationOk(true);
    setAlarmOk(true);
    setGeneratorOk(true);
    setLightingOk(true);

    setBirdsOk(true);
    setCropFillOk(true);
    setUnusualBehaviour(false);

    setWindowsOpen(false);
    setFridgeTemp(false);
    setLitterSampleTaken(false);

    setFireExtinguisher(false);
    setFootDipChange(false);
    setDosatronCheck(false);
    setVitaminAdd(false);
    setVaccination(false);
    setMedication(false);
    setPestControlInspection(false);
    setWaterSanitizer(false);

    setCalibrationWaterMeter(false);
    setCalibrationTempProbe(false);
    setCalibrationHumidityProbe(false);
    setCalibrationWeigher(false);

    setComments("");
  }

  function validateForm() {
    if (!farmId) return "No farm selected.";
    if (!houseId) return "Choose a house.";
    if (!date) return "Choose a date.";

    const humidity = humidityPct === "" ? null : Number(humidityPct);
    const co2 = co2Ppm === "" ? null : Number(co2Ppm);
    const ammonia = ammoniaPpm === "" ? null : Number(ammoniaPpm);
    const litter = litterScore === "" ? null : Number(litterScore);

    if (
      (humidity !== null && Number.isNaN(humidity)) ||
      (co2 !== null && Number.isNaN(co2)) ||
      (ammonia !== null && Number.isNaN(ammonia)) ||
      (litter !== null && Number.isNaN(litter))
    ) {
      return "Numeric fields must contain valid numbers.";
    }

    if (
      (humidity !== null && humidity < 0) ||
      (co2 !== null && co2 < 0) ||
      (ammonia !== null && ammonia < 0)
    ) {
      return "Values cannot be negative.";
    }

    if (litter !== null && (litter < 1 || litter > 6)) {
      return "Litter score must be between 1 and 6.";
    }

    return "";
  }

  async function saveNightCheck(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setMsgType("error");
      setMsg(validationError);
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const r = await fetch("/api/night-check/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farmId,
          cropId,
          houseId,
          date,
          checkTime,
          checkedByName,
          humidityPct: humidityPct === "" ? null : Number(humidityPct),
          co2Ppm: co2Ppm === "" ? null : Number(co2Ppm),
          ammoniaPpm: ammoniaPpm === "" ? null : Number(ammoniaPpm),
          litterScore: litterScore === "" ? null : Number(litterScore),
          wetAreas,
          capping,
          litterNotes,

          waterSystemOk,
          feedSystemOk,
          ventilationOk,
          alarmOk,
          generatorOk,
          lightingOk,

          birdsOk,
          cropFillOk,
          unusualBehaviour,

          windowsOpen,
          fridgeTemp,
          litterSampleTaken,
          fireExtinguisher,
          footDipChange,
          dosatronCheck,
          vitaminAdd,
          vaccination,
          medication,
          pestControlInspection,
          waterSanitizer,
          calibrationWaterMeter,
          calibrationTempProbe,
          calibrationHumidityProbe,
          calibrationWeigher,

          comments,
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        setMsgType("error");
        setMsg(data.error || "Error saving night check.");
        return;
      }

      setMsgType("success");
      setMsg(
        houseId === "ALL"
          ? "Night check saved successfully for all houses."
          : "Night check saved successfully."
      );
      resetForm();

      if (cropId) {
        loadRecords(cropId);
      }
    } finally {
      setSaving(false);
    }
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
        ? "mobile-alert mobile-alert--success"
        : "mobile-alert";

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      if (a.house.name < b.house.name) return -1;
      if (a.house.name > b.house.name) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [records]);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Night Inspection</div>
            <h1 className="page-intro__title">Night Check</h1>
            <p className="page-intro__subtitle">
              Save and review night inspection records for each house.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Farm</div>
              <div>{farmName || "-"}</div>
            </div>
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Active Crop</div>
              <div>{cropLabel || "-"}</div>
              <div style={{ marginTop: 6 }}>Your role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can only see records.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>Add / Update Night Check</h2>

          <form onSubmit={saveNightCheck}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>House</label>
                <select
                  value={houseId}
                  onChange={(e) => setHouseId(e.target.value)}
                  required
                  disabled={!farmId || !canOperate}
                >
                  <option value="">-- choose house --</option>
                  <option value="ALL">All houses</option>
                  {houses.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.name}
                      {house.code ? ` (${house.code})` : ""}
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
                  disabled={!farmId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Check time</label>
                <input
                  type="time"
                  value={checkTime}
                  onChange={(e) => setCheckTime(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>

              <div>
                <label>Checked by</label>
                <input
                  value={checkedByName}
                  onChange={(e) => setCheckedByName(e.target.value)}
                  placeholder="Operator name"
                  disabled={!farmId || !canOperate}
                />
              </div>
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Climate</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Humidity (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>

              <div>
                <label>CO2 (ppm)</label>
                <input
                  type="number"
                  min="0"
                  value={co2Ppm}
                  onChange={(e) => setCo2Ppm(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Ammonia (ppm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={ammoniaPpm}
                  onChange={(e) => setAmmoniaPpm(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>

              <div>
                <label>Litter score (1-6)</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={litterScore}
                  onChange={(e) => setLitterScore(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={wetAreas}
                  onChange={(e) => setWetAreas(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Wet areas
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={capping}
                  onChange={(e) => setCapping(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Capping
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={windowsOpen}
                  onChange={(e) => setWindowsOpen(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Windows open
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={fridgeTemp}
                  onChange={(e) => setFridgeTemp(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Fridge temp
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={litterSampleTaken}
                  onChange={(e) => setLitterSampleTaken(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Litter sample taken
              </label>
            </div>

            <label>Litter notes</label>
            <textarea
              value={litterNotes}
              onChange={(e) => setLitterNotes(e.target.value)}
              disabled={!farmId || !canOperate}
            />

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Systems</h3>

            <div className="mobile-grid mobile-grid--2">
              {[
                { label: "Water system OK", value: waterSystemOk, setter: setWaterSystemOk },
                { label: "Feed system OK", value: feedSystemOk, setter: setFeedSystemOk },
                { label: "Ventilation OK", value: ventilationOk, setter: setVentilationOk },
                { label: "Alarm OK", value: alarmOk, setter: setAlarmOk },
                { label: "Generator OK", value: generatorOk, setter: setGeneratorOk },
                { label: "Lighting OK", value: lightingOk, setter: setLightingOk },
                { label: "Fire extinguisher", value: fireExtinguisher, setter: setFireExtinguisher },
                { label: "Foot dip change", value: footDipChange, setter: setFootDipChange },
                { label: "Dosatron check", value: dosatronCheck, setter: setDosatronCheck },
                { label: "Vitamin add", value: vitaminAdd, setter: setVitaminAdd },
                { label: "Vaccination", value: vaccination, setter: setVaccination },
                { label: "Medication", value: medication, setter: setMedication },
                { label: "Pest control inspection", value: pestControlInspection, setter: setPestControlInspection },
                { label: "Water sanitizer", value: waterSanitizer, setter: setWaterSanitizer },
              ].map(({ label, value, setter }, idx) => (
                <label
                  key={idx}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                  />
                  {label}
                </label>
              ))}
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Bird condition</h3>

            <div className="mobile-grid mobile-grid--2">
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={birdsOk}
                  onChange={(e) => setBirdsOk(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Birds OK
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={cropFillOk}
                  onChange={(e) => setCropFillOk(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Crop fill OK
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={unusualBehaviour}
                  onChange={(e) => setUnusualBehaviour(e.target.checked)}
                  disabled={!farmId || !canOperate}
                />
                Unusual behaviour
              </label>
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Calibration</h3>

            <div className="mobile-grid mobile-grid--2">
              {[
                { label: "Calibration water meter", value: calibrationWaterMeter, setter: setCalibrationWaterMeter },
                { label: "Calibration temp probe", value: calibrationTempProbe, setter: setCalibrationTempProbe },
                { label: "Calibration humidity probe", value: calibrationHumidityProbe, setter: setCalibrationHumidityProbe },
                { label: "Calibration weigher", value: calibrationWeigher, setter: setCalibrationWeigher },
              ].map(({ label, value, setter }, idx) => (
                <label
                  key={idx}
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                  />
                  {label}
                </label>
              ))}
            </div>

            <label>Comments</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={!farmId || !canOperate}
            />

            {canOperate && (
              <div style={{ marginTop: 16 }}>
                <button
                  className="mobile-full-button"
                  type="submit"
                  disabled={saving || !farmId}
                >
                  {saving ? "Saving..." : "Save Night Check"}
                </button>
              </div>
            )}
          </form>
        </div>

        <h2 className="mobile-section-title">Saved Night Checks</h2>

        {sortedRecords.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No night checks yet.</p>
          </div>
        ) : (
          <div className="mobile-card" style={{ overflowX: "auto" }}>
            <table className="mobile-table">
              <thead>
                <tr>
                  <th>House</th>
                  <th>Date</th>
                  <th>Windows</th>
                  <th>Fridge</th>
                  <th>Litter sample</th>
                  <th>Fire exting.</th>
                  <th>Foot dip</th>
                  <th>Dosatron</th>
                  <th>Vitamin</th>
                  <th>Vaccination</th>
                  <th>Medication</th>
                  <th>Pest control</th>
                  <th>Water sanitizer</th>
                  <th>Cal. water meter</th>
                  <th>Cal. temp probe</th>
                  <th>Cal. humidity probe</th>
                  <th>Cal. weigher</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.house.name}
                      {r.house.code ? ` (${r.house.code})` : ""}
                    </td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td>{r.windowsOpen ? "✓" : ""}</td>
                    <td>{r.fridgeTemp ? "✓" : ""}</td>
                    <td>{r.litterSampleTaken ? "✓" : ""}</td>
                    <td>{r.fireExtinguisher ? "✓" : ""}</td>
                    <td>{r.footDipChange ? "✓" : ""}</td>
                    <td>{r.dosatronCheck ? "✓" : ""}</td>
                    <td>{r.vitaminAdd ? "✓" : ""}</td>
                    <td>{r.vaccination ? "✓" : ""}</td>
                    <td>{r.medication ? "✓" : ""}</td>
                    <td>{r.pestControlInspection ? "✓" : ""}</td>
                    <td>{r.waterSanitizer ? "✓" : ""}</td>
                    <td>{r.calibrationWaterMeter ? "✓" : ""}</td>
                    <td>{r.calibrationTempProbe ? "✓" : ""}</td>
                    <td>{r.calibrationHumidityProbe ? "✓" : ""}</td>
                    <td>{r.calibrationWeigher ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sortedRecords.length > 0 && (
          <div className="mobile-record-list" style={{ marginTop: 16 }}>
            {sortedRecords.map((r) => {
              const house = houses.find((h) => h.id === r.house.id);

              const co2Status = getCo2Status(
                r.co2Ppm,
                house?.defaultMaxCo2Ppm ?? null
              );
              const ammoniaStatus = getAmmoniaStatus(
                r.ammoniaPpm,
                house?.defaultMaxAmmoniaPpm ?? null
              );
              const litterStatus = getLitterStatus(r.litterScore);

              const overallStatus =
                [co2Status, ammoniaStatus, litterStatus].includes("critical")
                  ? "critical"
                  : [co2Status, ammoniaStatus, litterStatus].includes("warning")
                    ? "warning"
                    : "ok";

              return (
                <div
                  key={r.id}
                  className="mobile-record-card"
                  style={{
                    borderLeft: `6px solid ${statusColor(overallStatus)}`,
                  }}
                >
                  <h3 className="mobile-record-card__title">
                    {r.house.name}
                    {r.house.code ? ` (${r.house.code})` : ""}
                  </h3>

                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row">
                      <strong>Date</strong>
                      <span>{new Date(r.date).toLocaleDateString()}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Time</strong>
                      <span>{r.checkTime || "-"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Checked by</strong>
                      <span>{r.checkedByName || "-"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Humidity</strong>
                      <span>{r.humidityPct ?? "-"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>CO2</strong>
                      <span style={{ color: statusColor(co2Status) }}>
                        {r.co2Ppm ?? "-"} ppm
                      </span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Ammonia</strong>
                      <span style={{ color: statusColor(ammoniaStatus) }}>
                        {r.ammoniaPpm ?? "-"} ppm
                      </span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Litter</strong>
                      <span style={{ color: statusColor(litterStatus) }}>
                        {r.litterScore ?? "-"}
                      </span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Wet areas</strong>
                      <span>{r.wetAreas ? "Yes" : "No"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Capping</strong>
                      <span>{r.capping ? "Yes" : "No"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Systems</strong>
                      <span>
                        {r.waterSystemOk &&
                        r.feedSystemOk &&
                        r.ventilationOk &&
                        r.alarmOk &&
                        r.generatorOk &&
                        r.lightingOk
                          ? "OK"
                          : "Issue"}
                      </span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Birds</strong>
                      <span>{r.birdsOk ? "OK" : "Observe"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Crop fill</strong>
                      <span>{r.cropFillOk ? "OK" : "Check"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Unusual behaviour</strong>
                      <span>{r.unusualBehaviour ? "Yes" : "No"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Litter notes</strong>
                      <span>{r.litterNotes || "-"}</span>
                    </div>

                    <div className="mobile-record-row">
                      <strong>Comments</strong>
                      <span>{r.comments || "-"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}