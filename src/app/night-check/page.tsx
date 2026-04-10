"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, getHistoryCropId, setCurrentCropId, isViewingHistory } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type NightCheckRecord = {
  id: string;
  date: string;
  checkTime: string | null;
  checkedByName: string | null;
  humidityOk: boolean;
  co2Ok: boolean;
  ammoniaOk: boolean;
  litterOk: boolean;
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
  house: { id: string; name: string; code: string | null };
};

export default function NightCheckPage() {
  const [farmId, setFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [records, setRecords] = useState<NightCheckRecord[]>([]);
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [historyMode, setHistoryMode] = useState(false);

  const [date, setDate] = useState("");
  const [checkTime, setCheckTime] = useState("");
  const [checkedByName, setCheckedByName] = useState("");

  const [humidityOk, setHumidityOk] = useState(false);
  const [co2Ok, setCo2Ok] = useState(false);
  const [ammoniaOk, setAmmoniaOk] = useState(false);
  const [litterOk, setLitterOk] = useState(false);
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
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  useEffect(() => {
    const viewing = isViewingHistory();
    setHistoryMode(viewing);
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

    if (viewing) {
      const histCropId = getHistoryCropId();
      if (histCropId) {
        setCropId(histCropId);
        setCurrentCropId(histCropId);
        loadRecords(histCropId);
      }
    } else {
      loadActiveCrop(id);
    }
  }, []);

  async function loadFarm(id: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    const farm = Array.isArray(data) ? data.find((f: any) => f.id === id) : null;
    if (farm) setFarmName(`${farm.name} (${farm.code})`);
  }

  async function loadMyRole(id: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${id}`);
    const data = await r.json();
    if (r.ok) setMyRole(data.role || "");
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

  async function loadRecords(id: string) {
    const r = await fetch(`/api/night-check/list?cropId=${id}`);
    const data = await r.json();
    if (Array.isArray(data)) setRecords(data);
    else setRecords([]);
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setCheckTime("");
    setCheckedByName("");
    setHumidityOk(false);
    setCo2Ok(false);
    setAmmoniaOk(false);
    setLitterOk(false);
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
    setConfirmOverwrite(false);
  }

  // Check if this date already has a saved night check
  const existingForDate = useMemo(() => {
    if (!date) return false;
    return records.some(
      (r) => new Date(r.date).toISOString().slice(0, 10) === date
    );
  }, [date, records]);

  async function doSave() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/night-check/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId,
          cropId,
          houseId: "ALL",
          date,
          checkTime,
          checkedByName,
          humidityOk,
          co2Ok,
          ammoniaOk,
          litterOk,
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
      setMsg("Night check saved.");
      resetForm();
      if (cropId) loadRecords(cropId);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !date) {
      setMsgType("error");
      setMsg("Choose a date.");
      return;
    }
    if (existingForDate && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    await doSave();
  }

  const canOperate = canOperateUi(myRole) && !historyMode;
  const readOnly = isReadOnlyUi(myRole);

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
        ? "mobile-alert mobile-alert--success"
        : "mobile-alert";

  // One row per date (deduplicated — multiple houses → one row per night)
  const byDate = useMemo(() => {
    const map = new Map<string, NightCheckRecord>();
    for (const r of records) {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [records]);

  function chk(v: boolean) { return v ? "✓" : ""; }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Night Inspection</div>
            <h1 className="page-intro__title">Night Check</h1>
            <p className="page-intro__subtitle">
              One check per night for all houses.
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
              <div style={{ marginTop: 6 }}>Role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode.
          </div>
        )}

        {msg && !confirmOverwrite && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>Add Night Check</h2>
          <form onSubmit={handleSubmit}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setConfirmOverwrite(false); setMsg(""); }}
                  required
                  disabled={!farmId || !canOperate}
                />
              </div>
              <div>
                <label>Check time</label>
                <input
                  type="time"
                  value={checkTime}
                  onChange={(e) => setCheckTime(e.target.value)}
                  disabled={!farmId || !canOperate}
                />
              </div>
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

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Climate checked</h3>
            <div className="mobile-grid mobile-grid--2">
              {[
                { label: "Humidity", value: humidityOk, setter: setHumidityOk },
                { label: "CO2", value: co2Ok, setter: setCo2Ok },
                { label: "Ammonia", value: ammoniaOk, setter: setAmmoniaOk },
                { label: "Litter score", value: litterOk, setter: setLitterOk },
                { label: "Wet areas", value: wetAreas, setter: setWetAreas },
                { label: "Capping", value: capping, setter: setCapping },
              ].map(({ label, value, setter }) => (
                <label key={label} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                    style={{ margin: 0, justifySelf: "start" }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <label style={{ marginTop: 10 }}>Litter notes</label>
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
                { label: "Windows open", value: windowsOpen, setter: setWindowsOpen },
                { label: "Fridge temp", value: fridgeTemp, setter: setFridgeTemp },
                { label: "Litter sample taken", value: litterSampleTaken, setter: setLitterSampleTaken },
                { label: "Fire extinguisher", value: fireExtinguisher, setter: setFireExtinguisher },
                { label: "Foot dip change", value: footDipChange, setter: setFootDipChange },
                { label: "Dosatron check", value: dosatronCheck, setter: setDosatronCheck },
                { label: "Vitamin add", value: vitaminAdd, setter: setVitaminAdd },
                { label: "Vaccination", value: vaccination, setter: setVaccination },
                { label: "Medication", value: medication, setter: setMedication },
                { label: "Pest control", value: pestControlInspection, setter: setPestControlInspection },
                { label: "Water sanitizer", value: waterSanitizer, setter: setWaterSanitizer },
              ].map(({ label, value, setter }) => (
                <label key={label} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                    style={{ margin: 0, justifySelf: "start" }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Bird condition</h3>
            <div className="mobile-grid mobile-grid--2">
              {[
                { label: "Birds OK", value: birdsOk, setter: setBirdsOk },
                { label: "Crop fill OK", value: cropFillOk, setter: setCropFillOk },
                { label: "Unusual behaviour", value: unusualBehaviour, setter: setUnusualBehaviour },
              ].map(({ label, value, setter }) => (
                <label key={label} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                    style={{ margin: 0, justifySelf: "start" }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Calibration</h3>
            <div className="mobile-grid mobile-grid--2">
              {[
                { label: "Water meter", value: calibrationWaterMeter, setter: setCalibrationWaterMeter },
                { label: "Temp probe", value: calibrationTempProbe, setter: setCalibrationTempProbe },
                { label: "Humidity probe", value: calibrationHumidityProbe, setter: setCalibrationHumidityProbe },
                { label: "Weigher", value: calibrationWeigher, setter: setCalibrationWeigher },
              ].map(({ label, value, setter }) => (
                <label key={label} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => setter(e.target.checked)}
                    disabled={!farmId || !canOperate}
                    style={{ margin: 0, justifySelf: "start" }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <label style={{ marginTop: 10 }}>Comments</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              disabled={!farmId || !canOperate}
            />

            {canOperate && (
              <div style={{ marginTop: 16 }}>
                {confirmOverwrite ? (
                  <div style={{ border: "2px solid #f59e0b", borderRadius: 10, padding: "14px 16px", background: "#fffbeb" }}>
                    <p style={{ margin: "0 0 12px", fontWeight: 600, color: "#92400e" }}>
                      Night check for <strong>{date}</strong> already exists.
                    </p>
                    <p style={{ margin: "0 0 14px", color: "#78350f" }}>
                      Do you want to replace it with new data?
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        className="mobile-button"
                        onClick={doSave}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Yes, replace"}
                      </button>
                      <button
                        type="button"
                        className="mobile-button mobile-button--secondary"
                        onClick={() => setConfirmOverwrite(false)}
                      >
                        No, cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="mobile-full-button"
                    type="submit"
                    disabled={saving || !farmId}
                  >
                    {saving ? "Saving..." : "Save Night Check"}
                  </button>
                )}
              </div>
            )}
          </form>
        </div>

        <h2 className="mobile-section-title">History</h2>

        {byDate.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No night checks yet.</p>
          </div>
        ) : (
          <div className="mobile-card" style={{ overflowX: "auto" }}>
            <table className="mobile-table" style={{ fontSize: "0.65rem", whiteSpace: "nowrap", textAlign: "center", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #cbd5e1" }}>
                  <th>Date</th>
                  <th>Time</th>
                  <th>By</th>
                  <th>Hum</th>
                  <th>CO2</th>
                  <th>NH3</th>
                  <th>Litter</th>
                  <th>Wet</th>
                  <th>Cap</th>
                  <th>Birds</th>
                  <th>Crop fill</th>
                  <th>Unusual</th>
                  <th>Water sys</th>
                  <th>Feed sys</th>
                  <th>Vent</th>
                  <th>Alarm</th>
                  <th>Generator</th>
                  <th>Lighting</th>
                  <th>Windows</th>
                  <th>Fridge</th>
                  <th>Litter smpl</th>
                  <th>Fire ext</th>
                  <th>Foot dip</th>
                  <th>Dosatron</th>
                  <th>Vitamin</th>
                  <th>Vacc</th>
                  <th>Medic</th>
                  <th>Pest ctrl</th>
                  <th>H2O san</th>
                  <th>Cal H2O</th>
                  <th>Cal Temp</th>
                  <th>Cal Hum</th>
                  <th>Cal Wgh</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {byDate.map((r) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: "left" }}>{new Date(r.date).toLocaleDateString("en-GB")}</td>
                    <td style={{ textAlign: "left" }}>{r.checkTime || "-"}</td>
                    <td style={{ textAlign: "left" }}>{r.checkedByName || "-"}</td>
                    <td>{chk(r.humidityOk)}</td>
                    <td>{chk(r.co2Ok)}</td>
                    <td>{chk(r.ammoniaOk)}</td>
                    <td>{chk(r.litterOk)}</td>
                    <td>{chk(r.wetAreas)}</td>
                    <td>{chk(r.capping)}</td>
                    <td style={{ color: r.birdsOk ? undefined : "#b00020" }}>{r.birdsOk ? "OK" : "!"}</td>
                    <td style={{ color: r.cropFillOk ? undefined : "#b00020" }}>{r.cropFillOk ? "OK" : "!"}</td>
                    <td style={{ color: r.unusualBehaviour ? "#b00020" : undefined }}>{r.unusualBehaviour ? "!" : ""}</td>
                    <td style={{ color: r.waterSystemOk ? undefined : "#b00020" }}>{r.waterSystemOk ? "OK" : "!"}</td>
                    <td style={{ color: r.feedSystemOk ? undefined : "#b00020" }}>{r.feedSystemOk ? "OK" : "!"}</td>
                    <td style={{ color: r.ventilationOk ? undefined : "#b00020" }}>{r.ventilationOk ? "OK" : "!"}</td>
                    <td style={{ color: r.alarmOk ? undefined : "#b00020" }}>{r.alarmOk ? "OK" : "!"}</td>
                    <td>{r.generatorOk ? "OK" : "–"}</td>
                    <td style={{ color: r.lightingOk ? undefined : "#b00020" }}>{r.lightingOk ? "OK" : "!"}</td>
                    <td>{chk(r.windowsOpen)}</td>
                    <td>{chk(r.fridgeTemp)}</td>
                    <td>{chk(r.litterSampleTaken)}</td>
                    <td>{chk(r.fireExtinguisher)}</td>
                    <td>{chk(r.footDipChange)}</td>
                    <td>{chk(r.dosatronCheck)}</td>
                    <td>{chk(r.vitaminAdd)}</td>
                    <td>{chk(r.vaccination)}</td>
                    <td>{chk(r.medication)}</td>
                    <td>{chk(r.pestControlInspection)}</td>
                    <td>{chk(r.waterSanitizer)}</td>
                    <td>{chk(r.calibrationWaterMeter)}</td>
                    <td>{chk(r.calibrationTempProbe)}</td>
                    <td>{chk(r.calibrationHumidityProbe)}</td>
                    <td>{chk(r.calibrationWeigher)}</td>
                    <td style={{ textAlign: "left" }}>{r.comments || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
