"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type TargetDay = {
  id?: string;
  dayNumber: number;
  weightTargetG: number | null;
  feedTargetG: number | null;
  waterTargetMl: number | null;
  temperatureTargetC: number | null;
  humidityTargetPct: number | null;
  co2TargetPpm: number | null;
};

type TargetProfile = {
  id: string;
  farmId: string;
  name: string;
  source: string | null;
  isDefault: boolean;
  humidityTargetPct: number | null;
  co2TargetPpm: number | null;
  days: TargetDay[];
};

function buildDefaultDays(): TargetDay[] {
  return Array.from({ length: 39 }, (_, i) => ({
    dayNumber: i + 1,
    weightTargetG: null,
    feedTargetG: null,
    waterTargetMl: null,
    temperatureTargetC: null,
    humidityTargetPct: 55,
    co2TargetPpm: 3000,
  }));
}

export default function CropTargetsPage() {
  const [farmId, setFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");

  const [profileName, setProfileName] = useState("Ross 211 Default Template");
  const [source, setSource] = useState("ROSS_211");
  const [humidityTargetPct, setHumidityTargetPct] = useState("55");
  const [co2TargetPpm, setCo2TargetPpm] = useState("3000");
  const [days, setDays] = useState<TargetDay[]>(buildDefaultDays());

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentFarmId = getCurrentFarmId();

    if (!currentFarmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setFarmId(currentFarmId);
    loadFarmName(currentFarmId);
    loadMyRole(currentFarmId);
    loadTemplate(currentFarmId);
  }, []);

  async function loadFarmName(selectedFarmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === selectedFarmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    }
  }

  async function loadMyRole(selectedFarmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${selectedFarmId}`);
    const data = await r.json();

    if (r.ok) {
      setMyRole(data.role || "");
    } else {
      setMyRole("");
    }
  }

  async function loadTemplate(selectedFarmId: string) {
    const r = await fetch(`/api/target-profiles/template?farmId=${selectedFarmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Could not load target template.");
      return;
    }

    const profile = data as TargetProfile;

    setProfileName(profile.name || "Ross 211 Default Template");
    setSource(profile.source || "ROSS_211");
    setHumidityTargetPct(
      profile.humidityTargetPct !== null && profile.humidityTargetPct !== undefined
        ? String(profile.humidityTargetPct)
        : "55"
    );
    setCo2TargetPpm(
      profile.co2TargetPpm !== null && profile.co2TargetPpm !== undefined
        ? String(profile.co2TargetPpm)
        : "3000"
    );

    const profileDays =
      Array.isArray(profile.days) && profile.days.length > 0
        ? profile.days
        : buildDefaultDays();

    const normalized = buildDefaultDays().map((baseDay) => {
      const existing = profileDays.find((d) => d.dayNumber === baseDay.dayNumber);
      return existing
        ? {
            ...baseDay,
            ...existing,
          }
        : baseDay;
    });

    setDays(normalized);
  }

  function updateDay(
    dayNumber: number,
    field: keyof Omit<TargetDay, "dayNumber" | "id">,
    value: string
  ) {
    setDays((prev) =>
      prev.map((day) =>
        day.dayNumber === dayNumber
          ? {
              ...day,
              [field]: value === "" ? null : Number(value),
            }
          : day
      )
    );
  }

  function applyGlobalHumidityToAll() {
    const humidity = humidityTargetPct === "" ? 55 : Number(humidityTargetPct);
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        humidityTargetPct: Number.isFinite(humidity) ? humidity : 55,
      }))
    );
  }

  function applyGlobalCo2ToAll() {
    const co2 = co2TargetPpm === "" ? 3000 : Number(co2TargetPpm);
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        co2TargetPpm: Number.isFinite(co2) ? Math.trunc(co2) : 3000,
      }))
    );
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();

    if (!farmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const r = await fetch("/api/target-profiles/template", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farmId,
          name: profileName,
          source,
          humidityTargetPct: humidityTargetPct === "" ? 55 : Number(humidityTargetPct),
          co2TargetPpm: co2TargetPpm === "" ? 3000 : Number(co2TargetPpm),
          days,
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        setMsgType("error");
        setMsg(data.error || "Could not save target template.");
        return;
      }

      setMsgType("success");
      setMsg("Crop target template saved. New crops will use this latest version.");
      await loadTemplate(farmId);
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

  const filledDays = useMemo(() => {
    return days.filter(
      (d) =>
        d.weightTargetG !== null ||
        d.feedTargetG !== null ||
        d.waterTargetMl !== null ||
        d.temperatureTargetC !== null
    ).length;
  }, [days]);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Targets</div>
            <h1 className="page-intro__title">Crop Target Settings</h1>
            <p className="page-intro__subtitle">
              This template is used automatically for every new crop. After any edit,
              the latest saved version becomes the default for the next crop.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{farmName || "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Profile coverage</div>
              <div>Filled days: {filledDays}/39</div>
              <div style={{ marginTop: 6 }}>Role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can only view target settings.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/app/crops" className="mobile-button mobile-button--secondary">
              ← Back to Create Crop
            </Link>
          </div>
        </div>

        <div className="mobile-card">
          <form onSubmit={saveTemplate}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Profile name</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={!canOperate}
                />
              </div>

              <div>
                <label>Source</label>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={!canOperate}
                />
              </div>
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Global defaults</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Humidity target (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={humidityTargetPct}
                  onChange={(e) => setHumidityTargetPct(e.target.value)}
                  disabled={!canOperate}
                />
              </div>

              <div>
                <label>CO2 target (ppm)</label>
                <input
                  type="number"
                  min="0"
                  value={co2TargetPpm}
                  onChange={(e) => setCo2TargetPpm(e.target.value)}
                  disabled={!canOperate}
                />
              </div>
            </div>

            {canOperate && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  type="button"
                  className="mobile-button mobile-button--secondary"
                  onClick={applyGlobalHumidityToAll}
                >
                  Apply humidity to all days
                </button>
                <button
                  type="button"
                  className="mobile-button mobile-button--secondary"
                  onClick={applyGlobalCo2ToAll}
                >
                  Apply CO2 to all days
                </button>
              </div>
            )}

            <h3 style={{ marginTop: 24, marginBottom: 10 }}>Day-by-day targets</h3>

            <div className="mobile-record-list">
              {days.map((day) => (
                <div key={day.dayNumber} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">Day {day.dayNumber}</h3>

                  <div className="mobile-grid mobile-grid--2">
                    <div>
                      <label>Weight target (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={day.weightTargetG ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "weightTargetG", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>

                    <div>
                      <label>Feed target (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={day.feedTargetG ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "feedTargetG", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>

                    <div>
                      <label>Water target (ml)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={day.waterTargetMl ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "waterTargetMl", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>

                    <div>
                      <label>Temperature target (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={day.temperatureTargetC ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "temperatureTargetC", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>

                    <div>
                      <label>Humidity target (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={day.humidityTargetPct ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "humidityTargetPct", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>

                    <div>
                      <label>CO2 target (ppm)</label>
                      <input
                        type="number"
                        min="0"
                        value={day.co2TargetPpm ?? ""}
                        onChange={(e) =>
                          updateDay(day.dayNumber, "co2TargetPpm", e.target.value)
                        }
                        disabled={!canOperate}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Target Template"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}