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
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityPct: number | null;
  co2Ppm: number | null;
  ammoniaPpm: number | null;
  litterScore: number | null;
  wetAreas: boolean;
  capping: boolean;
  waterSystemOk: boolean;
  feedSystemOk: boolean;
  ventilationOk: boolean;
  alarmOk: boolean;
  generatorOk: boolean;
  lightingOk: boolean;
  birdsOk: boolean;
  cropFillOk: boolean;
  unusualBehaviour: boolean;
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
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const id = getCurrentFarmId();
    if (!id) return;

    setFarmId(id);
    loadFarm(id);
    loadActiveCrop(id);
    loadHouses(id);
  }, []);

  async function loadFarm(id: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    const farm = data.find((f: Farm) => f.id === id);
    if (farm) setFarmName(`${farm.name} (${farm.code})`);
  }

  async function loadActiveCrop(id: string) {
    const r = await fetch(`/api/crops/active?farmId=${id}`);
    const data = await r.json();
    if (data) {
      setCropId(data.id);
      setCropLabel(data.cropNumber);
      setCurrentCropId(data.id);
      loadRecords(data.id);
    }
  }

  async function loadHouses(id: string) {
    const r = await fetch(`/api/houses/list?farmId=${id}`);
    const data = await r.json();
    setHouses(data);
  }

  async function loadRecords(id: string) {
    const r = await fetch(`/api/night-check/list?cropId=${id}`);
    const data = await r.json();
    setRecords(data);
  }

  /* ---- UI ---- */

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Night Inspection</div>
            <h1 className="page-intro__title">Night Check</h1>
            <p className="page-intro__subtitle">
              Visual status overview for all houses.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Farm</div>
              <div>{farmName}</div>
            </div>
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Active Crop</div>
              <div>{cropLabel}</div>
            </div>
          </div>
        </div>

        {records.length === 0 && (
          <div className="mobile-card">
            <p>No night checks yet.</p>
          </div>
        )}

        <div className="mobile-record-list">
          {records.map((r) => {
            const house = houses.find((h) => h.id === r.house.id);

            const co2Status = getCo2Status(r.co2Ppm, house?.defaultMaxCo2Ppm ?? null);
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}