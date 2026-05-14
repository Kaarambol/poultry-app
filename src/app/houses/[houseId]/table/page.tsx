"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getHistoryCropId, isViewingHistory } from "@/lib/app-context";

type TableRow = {
  id: string;
  date: string;
  ageDays: number;
  mort: number;
  culls: number;
  cullsSmall: number;
  cullsLeg: number;
  totalMort: number;
  feedKg: number;
  waterL: number;
  avgWeightG: number | null;
  weightPct: number | null;
  weightTargetG: number | null;
  waterTargetMl: number | null;
  waterPer1000: number | null;
  feedTargetG: number | null;
  feedPer1000: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  temperatureTargetC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  co2MinPpm: number | null;
  co2MaxPpm: number | null;
  ammoniaPpm: number | null;
  litterScore: number | null;
  hoursDarkness: number;
  checkTime: string;
  notes: string | null;
};

type TableResponse = {
  house: {
    id: string;
    name: string;
    code: string | null;
    farmId: string;
    farmName: string;
  };
  crop: {
    id: string;
    cropNumber: string;
    placementDate: string;
  };
  thinDates: string[];
  thin2Dates: string[];
  clearDates: string[];
  rows: TableRow[];
};

type EditValues = {
  mort: string;
  cullsSmall: string;
  cullsLeg: string;
  waterL: string;
  feedKg: string;
  avgWeightG: string;
  temperatureMinC: string;
  temperatureMaxC: string;
  humidityMinPct: string;
  humidityMaxPct: string;
  co2MinPpm: string;
  co2MaxPpm: string;
  ammoniaPpm: string;
  litterScore: string;
};

function formatCell(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function rowToEditValues(row: TableRow): EditValues {
  return {
    mort:            String(row.mort ?? ""),
    cullsSmall:      String(row.cullsSmall ?? ""),
    cullsLeg:        String(row.cullsLeg ?? ""),
    waterL:          String(row.waterL ?? ""),
    feedKg:          String(row.feedKg ?? ""),
    avgWeightG:      row.avgWeightG !== null ? String(row.avgWeightG) : "",
    temperatureMinC: row.temperatureMinC !== null ? String(row.temperatureMinC) : "",
    temperatureMaxC: row.temperatureMaxC !== null ? String(row.temperatureMaxC) : "",
    humidityMinPct:  row.humidityMinPct !== null ? String(row.humidityMinPct) : "",
    humidityMaxPct:  row.humidityMaxPct !== null ? String(row.humidityMaxPct) : "",
    co2MinPpm:       row.co2MinPpm !== null ? String(row.co2MinPpm) : "",
    co2MaxPpm:       row.co2MaxPpm !== null ? String(row.co2MaxPpm) : "",
    ammoniaPpm:      row.ammoniaPpm !== null ? String(row.ammoniaPpm) : "",
    litterScore:     row.litterScore !== null ? String(row.litterScore) : "",
  };
}

const NUM_INPUT_STYLE: React.CSSProperties = {
  width: 54,
  padding: "2px 4px",
  fontSize: "0.55rem",
  border: "1px solid #93c5fd",
  borderRadius: 3,
  textAlign: "center",
};

export default function HouseTablePage({
  params,
}: {
  params: Promise<{ houseId: string }>;
}) {
  const [houseId, setHouseId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [houseCode, setHouseCode] = useState<string | null>(null);
  const [cropLabel, setCropLabel] = useState("");
  const [rows, setRows] = useState<TableRow[]>([]);
  const [thinDates, setThinDates] = useState<string[]>([]);
  const [thin2Dates, setThin2Dates] = useState<string[]>([]);
  const [clearDates, setClearDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyMode, setHistoryMode] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const searchParams = useSearchParams();

  const loadData = useCallback(async (resolvedHouseId: string) => {
    try {
      setLoading(true);
      setError("");

      const cropIdFromUrl     = searchParams.get("cropId") || "";
      const cropIdFromHistory = isViewingHistory() ? getHistoryCropId() : "";
      const resolvedCropId    = cropIdFromUrl || cropIdFromHistory;
      const url = resolvedCropId
        ? `/api/houses/${resolvedHouseId}/table?cropId=${resolvedCropId}`
        : `/api/houses/${resolvedHouseId}/table`;

      const res  = await fetch(url);
      const json: TableResponse | { error: string } = await res.json();

      if (!res.ok) {
        throw new Error("error" in json ? json.error : "Failed to load table data.");
      }

      const payload = json as TableResponse;
      setHouseName(payload.house.name);
      setHouseCode(payload.house.code);
      setCropLabel(`Crop ${payload.crop.cropNumber}`);
      setThinDates(payload.thinDates || []);
      setThin2Dates(payload.thin2Dates || []);
      setClearDates(payload.clearDates || []);
      setRows(payload.rows || []);
    } catch (err: any) {
      setError(err.message || "Failed to load table data.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setHouseId(resolved.houseId);
      setHistoryMode(isViewingHistory());
    }
    init();
  }, [params]);

  useEffect(() => {
    if (!houseId) return;
    loadData(houseId);
  }, [houseId, loadData]);

  function startEdit(row: TableRow) {
    setEditingId(row.id);
    setEditValues(rowToEditValues(row));
    setSaveMsg("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues(null);
    setSaveMsg("");
  }

  async function saveEdit(rowId: string, existingNotes: string | null) {
    if (!editValues) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const body = {
        id:              rowId,
        mort:            editValues.mort            || 0,
        cullsSmall:      editValues.cullsSmall      || 0,
        cullsLeg:        editValues.cullsLeg        || 0,
        waterL:          editValues.waterL          || 0,
        feedKg:          editValues.feedKg          || 0,
        avgWeightG:      editValues.avgWeightG      !== "" ? editValues.avgWeightG      : null,
        temperatureMinC: editValues.temperatureMinC !== "" ? editValues.temperatureMinC : null,
        temperatureMaxC: editValues.temperatureMaxC !== "" ? editValues.temperatureMaxC : null,
        humidityMinPct:  editValues.humidityMinPct  !== "" ? editValues.humidityMinPct  : null,
        humidityMaxPct:  editValues.humidityMaxPct  !== "" ? editValues.humidityMaxPct  : null,
        co2MinPpm:       editValues.co2MinPpm       !== "" ? editValues.co2MinPpm       : null,
        co2MaxPpm:       editValues.co2MaxPpm       !== "" ? editValues.co2MaxPpm       : null,
        ammoniaPpm:      editValues.ammoniaPpm      !== "" ? editValues.ammoniaPpm      : null,
        litterScore:     editValues.litterScore     !== "" ? editValues.litterScore     : null,
        notes:           existingNotes || "",
      };

      const res  = await fetch("/api/daily-records/update", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveMsg(data.error || "Save failed.");
        return;
      }

      setEditingId(null);
      setEditValues(null);
      await loadData(houseId);
    } catch {
      setSaveMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function setField(field: keyof EditValues, value: string) {
    setEditValues(prev => prev ? { ...prev, [field]: value } : prev);
  }

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-card">
            <p style={{ margin: 0 }}>Loading table...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-alert mobile-alert--error">{error}</div>
          <Link href="/dashboard" className="mobile-button mobile-button--secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const thStyle: React.CSSProperties = {
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: 1.25,
    fontSize: "0.5rem",
    padding: "4px 3px",
    verticalAlign: "bottom",
    textAlign: "center",
    minWidth: 36,
    border: "1px solid #d1d5db",
  };

  // Column colour groups
  // Target columns: very pale blue-grey, dark text
  const thTarget: React.CSSProperties = { ...thStyle, background: "#e8edf2", color: "#1e293b" };
  const tdTarget: React.CSSProperties = { background: "#f4f7fa", color: "#1e293b" };
  // Actual measurement columns: very pale yellow
  const thActual: React.CSSProperties = { ...thStyle, background: "#fef9c3", color: "#1e293b" };
  const tdActual: React.CSSProperties = { background: "#fefce8", color: "#1e293b" };
  // Performance / ratio columns: very pale red
  const thPerf: React.CSSProperties = { ...thStyle, background: "#ffd6d6", color: "#1e293b" };
  const tdPerf: React.CSSProperties = { background: "#fff1f2", color: "#1e293b" };


  return (
    <div className="mobile-page" style={{ maxWidth: "100%", margin: "20px 0", padding: "0 8px 28px" }}>
      <div className="page-shell" style={{ maxWidth: "100%" }}>
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">House table</div>
            <h1 className="page-intro__title">
              {houseName}
              {houseCode ? ` (${houseCode})` : ""}
            </h1>
            <p className="page-intro__subtitle">
              {cropLabel} · Daily records table
            </p>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div className="mobile-actions">
            <Link href="/dashboard" className="mobile-button mobile-button--secondary">
              Back to Dashboard
            </Link>
            <Link
              href={`/houses/${houseId}/charts`}
              className="mobile-button mobile-button--secondary"
            >
              Open Charts
            </Link>
          </div>
        </div>

        {saveMsg && (
          <div className="mobile-alert mobile-alert--error" style={{ marginBottom: 8 }}>
            {saveMsg}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No daily records available yet for this house.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <style>{`.house-table td, .house-table th { border: 1px solid #e5e7eb; } .house-table td { padding: 3px 3px; }`}</style>
            <table className="house-table" style={{ fontSize: "0.55rem", borderCollapse: "collapse", width: "max-content", minWidth: "100%", textAlign: "center" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Age (days)</th>
                  <th style={thStyle}>Mortality</th>
                  <th style={thStyle}>Culls Total</th>
                  <th style={thStyle}>Cumulative Mortality</th>
                  <th style={thStyle}>Culls Small</th>
                  <th style={thStyle}>Culls Leg</th>
                  <th style={thActual}>Avg Weight (g)</th>
                  <th style={thPerf}>Weight %</th>
                  <th style={thTarget}>Weight Target (g)</th>
                  <th style={thTarget}>Water Target (ml)</th>
                  <th style={thPerf}>Water per 1000</th>
                  <th style={thTarget}>Feed Target (g)</th>
                  <th style={thPerf}>Feed per 1000</th>
                  <th style={thActual}>Water Consumption (L)</th>
                  <th style={thActual}>Feed (kg)</th>
                  <th style={thActual}>Temp Max (°C)</th>
                  <th style={thActual}>Temp Min (°C)</th>
                  <th style={thTarget}>Temp Target (°C)</th>
                  <th style={thActual}>Humidity Max (%)</th>
                  <th style={thActual}>Humidity Min (%)</th>
                  <th style={thActual}>CO₂ Max (ppm)</th>
                  <th style={thActual}>CO₂ Min (ppm)</th>
                  <th style={thStyle}>Ammonia (ppm)</th>
                  <th style={thStyle}>Litter Score</th>
                  <th style={thStyle}>Hours Darkness (h)</th>
                  <th style={thStyle}>Check Time</th>
                  <th style={thStyle}>Notes</th>
                  {!historyMode && <th style={thStyle}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dateStr  = new Date(row.date).toISOString().slice(0, 10);
                  const isThin   = thinDates.includes(dateStr);
                  const isThin2  = thin2Dates.includes(dateStr);
                  const isClear  = clearDates.includes(dateStr);
                  const rowStyle: React.CSSProperties = isClear
                    ? { background: "#ffe0e0", fontWeight: "bold" }
                    : isThin || isThin2
                    ? { background: "#fff0f0" }
                    : {};

                  const isEditing = editingId === row.id;
                  const ev        = editValues;
                  // Only apply column colours on normal rows; thin/clear rows keep their red tint
                  const isEvent = isThin || isThin2 || isClear;
                  const ca = isEvent ? {} : tdActual;
                  const ct = isEvent ? {} : tdTarget;
                  const cp = isEvent ? {} : tdPerf;

                  return (
                    <tr key={row.id} style={rowStyle}>
                      {/* Date — never editable */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(row.date).toLocaleDateString("en-GB")}
                        {isThin  && <span style={{ marginLeft: 3, color: "#c00", fontWeight: "bold" }}>T</span>}
                        {isThin2 && <span style={{ marginLeft: 3, color: "#c00", fontWeight: "bold" }}>T2</span>}
                        {isClear && <span style={{ marginLeft: 3, color: "#c00", fontWeight: "bold" }}>C</span>}
                      </td>

                      {/* Age — computed, never editable */}
                      <td>{row.ageDays}</td>

                      {/* Mort */}
                      <td>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.mort}
                            onChange={e => setField("mort", e.target.value)} />
                        ) : row.mort}
                      </td>

                      {/* Culls (= sm + leg, computed) */}
                      <td>{row.culls}</td>

                      {/* Total mort (cumulative, computed) */}
                      <td>{row.totalMort}</td>

                      {/* Culls Small */}
                      <td>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.cullsSmall}
                            onChange={e => setField("cullsSmall", e.target.value)} />
                        ) : row.cullsSmall}
                      </td>

                      {/* Culls Leg */}
                      <td>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.cullsLeg}
                            onChange={e => setField("cullsLeg", e.target.value)} />
                        ) : row.cullsLeg}
                      </td>

                      {/* Avg Weight g — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.avgWeightG}
                            onChange={e => setField("avgWeightG", e.target.value)} />
                        ) : formatCell(row.avgWeightG)}
                      </td>

                      {/* Wt % — performance (red) */}
                      <td style={cp}>{row.weightPct !== null ? `${row.weightPct}%` : "-"}</td>

                      {/* Wt Target — target (blue-grey) */}
                      <td style={ct}>{formatCell(row.weightTargetG)}</td>

                      {/* H₂O Target — target (blue-grey) */}
                      <td style={ct}>{formatCell(row.waterTargetMl)}</td>

                      {/* H₂O /1000 — performance (red) */}
                      <td style={cp}>{formatCell(row.waterPer1000)}</td>

                      {/* Feed Target — target (blue-grey) */}
                      <td style={ct}>{formatCell(row.feedTargetG)}</td>

                      {/* Feed /1000 — performance (red) */}
                      <td style={cp}>{formatCell(row.feedPer1000)}</td>

                      {/* H₂O L — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" step="0.1" value={ev.waterL}
                            onChange={e => setField("waterL", e.target.value)} />
                        ) : formatCell(row.waterL)}
                      </td>

                      {/* Feed kg — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" step="0.1" value={ev.feedKg}
                            onChange={e => setField("feedKg", e.target.value)} />
                        ) : formatCell(row.feedKg)}
                      </td>

                      {/* Tmp Max — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" step="0.1" value={ev.temperatureMaxC}
                            onChange={e => setField("temperatureMaxC", e.target.value)} />
                        ) : formatCell(row.temperatureMaxC)}
                      </td>

                      {/* Tmp Min — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" step="0.1" value={ev.temperatureMinC}
                            onChange={e => setField("temperatureMinC", e.target.value)} />
                        ) : formatCell(row.temperatureMinC)}
                      </td>

                      {/* Tmp Target — target (blue-grey) */}
                      <td style={ct}>{formatCell(row.temperatureTargetC)}</td>

                      {/* Hum Max — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" max="100" step="0.1" value={ev.humidityMaxPct}
                            onChange={e => setField("humidityMaxPct", e.target.value)} />
                        ) : formatCell(row.humidityMaxPct)}
                      </td>

                      {/* Hum Min — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" max="100" step="0.1" value={ev.humidityMinPct}
                            onChange={e => setField("humidityMinPct", e.target.value)} />
                        ) : formatCell(row.humidityMinPct)}
                      </td>

                      {/* CO₂ Max — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.co2MaxPpm}
                            onChange={e => setField("co2MaxPpm", e.target.value)} />
                        ) : formatCell(row.co2MaxPpm)}
                      </td>

                      {/* CO₂ Min — actual (yellow) */}
                      <td style={ca}>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" value={ev.co2MinPpm}
                            onChange={e => setField("co2MinPpm", e.target.value)} />
                        ) : formatCell(row.co2MinPpm)}
                      </td>

                      {/* NH₃ ppm */}
                      <td>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" step="0.1" value={ev.ammoniaPpm}
                            onChange={e => setField("ammoniaPpm", e.target.value)} />
                        ) : formatCell(row.ammoniaPpm)}
                      </td>

                      {/* Litter score */}
                      <td>
                        {isEditing && ev ? (
                          <input style={NUM_INPUT_STYLE} type="number" min="0" max="5" step="1" value={ev.litterScore}
                            onChange={e => setField("litterScore", e.target.value)} />
                        ) : formatCell(row.litterScore)}
                      </td>

                      {/* Hours Darkness */}
                      <td>{row.hoursDarkness ?? 6}</td>

                      {/* Check Time */}
                      <td>{row.checkTime || "07:30"}</td>

                      {/* Notes — not editable inline */}
                      <td>{row.notes || "-"}</td>

                      {/* Actions column — only in active crop */}
                      {!historyMode && (
                        <td style={{ whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(row.id, row.notes)}
                                disabled={saving}
                                style={{ fontSize: "0.55rem", padding: "2px 6px", marginRight: 3,
                                  background: "#16a34a", color: "#fff", border: "none",
                                  borderRadius: 3, cursor: "pointer" }}
                              >
                                {saving ? "…" : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                style={{ fontSize: "0.55rem", padding: "2px 6px",
                                  background: "#dc2626", color: "#fff", border: "none",
                                  borderRadius: 3, cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(row)}
                              disabled={editingId !== null}
                              style={{ fontSize: "0.55rem", padding: "2px 6px",
                                background: "#2563eb", color: "#fff", border: "none",
                                borderRadius: 3, cursor: "pointer",
                                opacity: editingId !== null ? 0.4 : 1 }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
        )}
      </div>
    </div>
  );
}
