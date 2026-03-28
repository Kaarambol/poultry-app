"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TableRow = {
  id: string;
  date: string;
  ageDays: number;
  mort: number;
  culls: number;
  cullsSmall: number;
  cullsLeg: number;
  feedKg: number;
  waterL: number;
  avgWeightG: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityMinPct: number | null;
  humidityMaxPct: number | null;
  co2MinPpm: number | null;
  co2MaxPpm: number | null;
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

function formatCell(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

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

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setHouseId(resolved.houseId);
    }
    init();
  }, [params]);

  useEffect(() => {
    if (!houseId) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/houses/${houseId}/table`);
        const json: TableResponse | { error: string } = await res.json();

        if (!res.ok) {
          throw new Error(
            "error" in json ? json.error : "Failed to load table data."
          );
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
    }

    load();
  }, [houseId]);

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

  return (
    <div className="mobile-page">
      <div className="page-shell">
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

        {rows.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No daily records available yet for this house.</p>
          </div>
        ) : (
          <div className="mobile-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Age</th>
                  <th>Mort</th>
                  <th>Culls</th>
                  <th>Culls Small</th>
                  <th>Culls Leg</th>
                  <th>Temp Min</th>
                  <th>Temp Max</th>
                  <th>Humidity Min</th>
                  <th>Humidity Max</th>
                  <th>CO2 Min</th>
                  <th>CO2 Max</th>
                  <th>Feed Kg</th>
                  <th>Water L</th>
                  <th>Avg Weight G</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const dateStr = new Date(row.date).toISOString().slice(0, 10);
                  const isThin = thinDates.includes(dateStr);
                  const isThin2 = thin2Dates.includes(dateStr);
                  const isClear = clearDates.includes(dateStr);
                  const rowStyle: React.CSSProperties = isClear
                    ? { background: '#ffe0e0', fontWeight: 'bold' }
                    : (isThin || isThin2)
                    ? { background: '#fff0f0' }
                    : {};
                  return (
                  <tr key={row.id} style={rowStyle}>
                    <td>
                      {new Date(row.date).toLocaleDateString()}
                      {isThin && <span style={{ marginLeft: 4, color: '#c00', fontSize: '0.7rem', fontWeight: 'bold' }}>THIN</span>}
                      {isThin2 && <span style={{ marginLeft: 4, color: '#c00', fontSize: '0.7rem', fontWeight: 'bold' }}>THIN2</span>}
                      {isClear && <span style={{ marginLeft: 4, color: '#c00', fontSize: '0.7rem', fontWeight: 'bold' }}>CLEAR</span>}
                    </td>
                    <td>{row.ageDays}</td>
                    <td>{row.mort}</td>
                    <td>{row.culls}</td>
                    <td>{row.cullsSmall}</td>
                    <td>{row.cullsLeg}</td>
                    <td>{formatCell(row.temperatureMinC)}</td>
                    <td>{formatCell(row.temperatureMaxC)}</td>
                    <td>{formatCell(row.humidityMinPct)}</td>
                    <td>{formatCell(row.humidityMaxPct)}</td>
                    <td>{formatCell(row.co2MinPpm)}</td>
                    <td>{formatCell(row.co2MaxPpm)}</td>
                    <td>{formatCell(row.feedKg)}</td>
                    <td>{formatCell(row.waterL)}</td>
                    <td>{formatCell(row.avgWeightG)}</td>
                    <td>{row.notes || "-"}</td>
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