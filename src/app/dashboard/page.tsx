"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type ActiveCrop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  breed: string | null;
  hatchery: string | null;
  status: string;
};

type WeeklySnap = {
  day: number;
  ammoniaPpm: number | null;
  co2MaxPpm: number | null;
  litterScore: number | null;
};

type DashboardHouse = {
  houseId: string;
  houseName: string;
  birdsPlaced: number;
  mort: number;
  culls: number;
  totalLosses: number;
  birdsAlive: number;
  mortalityPct: number;
  feedKg: number;
  waterL: number;
  lastLitterScore: number | null;
  lastAmmoniaPpm: number | null;
  weeklySnapshots: WeeklySnap[];
};

type DashboardData = {
  crop: ActiveCrop;
  totals: {
    birdsPlaced: number;
    mort: number;
    culls: number;
    totalLosses: number;
    birdsAlive: number;
    feedKg: number;
    waterL: number;
    mortalityPct: number;
  };
  houses: DashboardHouse[];
};

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "-";
}

function formatDecimal(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

export default function DashboardPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [activeCrop, setActiveCrop] = useState<ActiveCrop | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) {
      setFarmName("");
      return;
    }

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    setFarmName(farm ? `${farm.name} (${farm.code})` : "");
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setActiveCrop(null);
      setDashboard(null);
      setMsg(data.error || "Error loading active crop.");
      return;
    }

    if (!data) {
      setActiveCrop(null);
      setDashboard(null);
      setMsg("No active crop for the current farm.");
      return;
    }

    setActiveCrop(data);
    setCurrentCropId(data.id);
    setMsg("");

    const dashboardResponse = await fetch(
      `/api/dashboard/summary?cropId=${data.id}`
    );
    const dashboardData = await dashboardResponse.json();

    if (!dashboardResponse.ok) {
      setDashboard(null);
      setMsg(dashboardData.error || "Error loading dashboard.");
      return;
    }

    setDashboard(dashboardData);
  }

  useEffect(() => {
    async function loadPage() {
      try {
        const farmId = getCurrentFarmId();

        if (!farmId) {
          setMsg("Choose a farm in the top menu first.");
          setLoading(false);
          return;
        }

        setCurrentFarmIdState(farmId);
        await loadFarmName(farmId);
        await loadActiveCrop(farmId);
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, []);

  const ageDays = useMemo(() => {
    if (!activeCrop?.placementDate) return null;

    const placement = new Date(activeCrop.placementDate);
    const today = new Date();

    const diff = Math.floor(
      (today.getTime() - placement.getTime()) / (1000 * 60 * 60 * 24)
    );

    return diff >= 0 ? diff : 0;
  }, [activeCrop]);

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-card">
            <p style={{ margin: 0 }}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Live overview</div>
            <h1 className="page-intro__title">Active Crop Dashboard</h1>
            <p className="page-intro__subtitle">
              Quick view of the active crop, totals and per-house performance.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Active crop</div>
              <div>{activeCrop?.cropNumber || "-"}</div>
              <div style={{ marginTop: 6 }}>Age: {ageDays ?? "-"} days</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mobile-alert" style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {activeCrop && dashboard && (
          <>
            <div className="mobile-grid mobile-grid--2">
              <div className="mobile-card">
                <h2>Active Crop</h2>
                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Crop Number</strong>
                    <span>{activeCrop.cropNumber}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Placement Date</strong>
                    <span>
                      {new Date(activeCrop.placementDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Age</strong>
                    <span>{ageDays ?? "-"} days</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Breed</strong>
                    <span>{activeCrop.breed || "-"}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Hatchery</strong>
                    <span>{activeCrop.hatchery || "-"}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Status</strong>
                    <span>{activeCrop.status}</span>
                  </div>
                </div>
              </div>

              <div className="mobile-card">
                <h2>Crop Totals</h2>
                <div className="mobile-kpi-grid">
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Birds placed</div>
                    <div className="mobile-kpi__value">
                      {formatNumber(dashboard.totals.birdsPlaced)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Mort</div>
                    <div className="mobile-kpi__value">
                      {formatNumber(dashboard.totals.mort)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Culls</div>
                    <div className="mobile-kpi__value">
                      {formatNumber(dashboard.totals.culls)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Total losses</div>
                    <div className="mobile-kpi__value">
                      {formatNumber(dashboard.totals.totalLosses)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Birds alive</div>
                    <div className="mobile-kpi__value">
                      {formatNumber(dashboard.totals.birdsAlive)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Mortality %</div>
                    <div className="mobile-kpi__value">
                      {formatDecimal(dashboard.totals.mortalityPct)}%
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Feed kg</div>
                    <div className="mobile-kpi__value">
                      {formatDecimal(dashboard.totals.feedKg)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Water L</div>
                    <div className="mobile-kpi__value">
                      {formatDecimal(dashboard.totals.waterL)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="mobile-section-title">Per House</h2>

            {dashboard.houses.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No house data available.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {dashboard.houses.map((house) => (
                  <div key={house.houseId} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">{house.houseName}</h3>

                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Birds placed</strong>
                        <span>{formatNumber(house.birdsPlaced)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Mort</strong>
                        <span>{formatNumber(house.mort)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Culls</strong>
                        <span>{formatNumber(house.culls)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Total losses</strong>
                        <span>{formatNumber(house.totalLosses)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds alive</strong>
                        <span>{formatNumber(house.birdsAlive)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Mortality %</strong>
                        <span>{formatDecimal(house.mortalityPct)}%</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Feed kg</strong>
                        <span>{formatDecimal(house.feedKg)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Water L</strong>
                        <span>{formatDecimal(house.waterL)}</span>
                      </div>
                      {house.lastLitterScore !== null && (
                        <div className="mobile-record-row">
                          <strong>Litter score</strong>
                          <span>{house.lastLitterScore}</span>
                        </div>
                      )}
                      {house.lastAmmoniaPpm !== null && (
                        <div className="mobile-record-row">
                          <strong>Ammonia (ppm)</strong>
                          <span>{house.lastAmmoniaPpm}</span>
                        </div>
                      )}
                    </div>

                    {/* Weekly environment table */}
                    {house.weeklySnapshots && house.weeklySnapshots.some(
                      (s) => s.ammoniaPpm !== null || s.co2MaxPpm !== null || s.litterScore !== null
                    ) && (
                      <div style={{ marginTop: 12, overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9" }}>
                              <th style={{ padding: "5px 6px", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Day</th>
                              {house.weeklySnapshots.map((s) => (
                                <th key={s.day} style={{ padding: "5px 6px", textAlign: "center", color: "#1e293b", fontWeight: 700 }}>{s.day}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "4px 6px", color: "#64748b" }}>NH₃ ppm</td>
                              {house.weeklySnapshots.map((s) => (
                                <td key={s.day} style={{ padding: "4px 6px", textAlign: "center", color: "#1e293b" }}>
                                  {s.ammoniaPpm !== null ? s.ammoniaPpm : "—"}
                                </td>
                              ))}
                            </tr>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "4px 6px", color: "#64748b" }}>CO₂ ppm</td>
                              {house.weeklySnapshots.map((s) => (
                                <td key={s.day} style={{ padding: "4px 6px", textAlign: "center", color: "#1e293b" }}>
                                  {s.co2MaxPpm !== null ? s.co2MaxPpm : "—"}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <td style={{ padding: "4px 6px", color: "#64748b" }}>Litter</td>
                              {house.weeklySnapshots.map((s) => (
                                <td key={s.day} style={{ padding: "4px 6px", textAlign: "center", color: "#1e293b" }}>
                                  {s.litterScore !== null ? s.litterScore : "—"}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mobile-actions" style={{ marginTop: 12 }}>
                      <Link
                        href={`/houses/${house.houseId}/charts`}
                        className="mobile-button mobile-button--secondary"
                      >
                        Charts
                      </Link>

                      <Link
                        href={`/houses/${house.houseId}/table`}
                        className="mobile-button mobile-button--secondary"
                      >
                        Table
                      </Link>
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