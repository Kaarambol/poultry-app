"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";

type ActiveCrop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  breed: string | null;
  hatchery: string | null;
  status: string;
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

type Farm = {
  id: string;
  name: string;
  code: string;
};

export default function DashboardPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [activeCrop, setActiveCrop] = useState<ActiveCrop | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [msg, setMsg] = useState("Loading...");

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

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error loading active crop.");
      setActiveCrop(null);
      setDashboard(null);
      return;
    }

    if (!data) {
      setMsg("No active crop for the current farm.");
      setActiveCrop(null);
      setDashboard(null);
      return;
    }

    setActiveCrop(data);
    setCurrentCropId(data.id);
    setMsg("");
    await loadDashboard(data.id);
  }

  async function loadDashboard(cropId: string) {
    const r = await fetch(`/api/dashboard/summary?cropId=${cropId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error loading dashboard.");
      setDashboard(null);
      return;
    }

    setDashboard(data);
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadActiveCrop(farmId);
  }, []);

  const ageDays = useMemo(() => {
    if (!activeCrop?.placementDate) return null;

    const placementDate = new Date(activeCrop.placementDate);
    const today = new Date();

    return Math.floor(
      (today.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }, [activeCrop]);

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
                    <div className="mobile-kpi__value">{dashboard.totals.birdsPlaced}</div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Mort</div>
                    <div className="mobile-kpi__value">{dashboard.totals.mort}</div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Culls</div>
                    <div className="mobile-kpi__value">{dashboard.totals.culls}</div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Total losses</div>
                    <div className="mobile-kpi__value">{dashboard.totals.totalLosses}</div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Birds alive</div>
                    <div className="mobile-kpi__value">{dashboard.totals.birdsAlive}</div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Mortality %</div>
                    <div className="mobile-kpi__value">
                      {dashboard.totals.mortalityPct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Feed kg</div>
                    <div className="mobile-kpi__value">
                      {dashboard.totals.feedKg.toFixed(2)}
                    </div>
                  </div>
                  <div className="mobile-kpi">
                    <div className="mobile-kpi__label">Water L</div>
                    <div className="mobile-kpi__value">
                      {dashboard.totals.waterL.toFixed(2)}
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
              <>
                <div className="mobile-record-list" style={{ marginBottom: 16 }}>
                  {dashboard.houses.map((house) => (
                    <div key={house.houseId} className="mobile-record-card">
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
                        <div className="mobile-record-row">
                          <strong>Feed kg</strong>
                          <span>{house.feedKg.toFixed(2)}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Water L</strong>
                          <span>{house.waterL.toFixed(2)}</span>
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
                        <th>Feed kg</th>
                        <th>Water L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.houses.map((house) => (
                        <tr key={house.houseId}>
                          <td>{house.houseName}</td>
                          <td>{house.birdsPlaced}</td>
                          <td>{house.mort}</td>
                          <td>{house.culls}</td>
                          <td>{house.totalLosses}</td>
                          <td>{house.birdsAlive}</td>
                          <td>{house.mortalityPct.toFixed(2)}%</td>
                          <td>{house.feedKg.toFixed(2)}</td>
                          <td>{house.waterL.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}