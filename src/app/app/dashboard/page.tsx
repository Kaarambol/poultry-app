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

    return (
      Math.floor(
        (today.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }, [activeCrop]);

  return (
    <div className="mobile-page">
      <h1>Active Crop Dashboard</h1>

      {currentFarmId && (
        <div className="mobile-card">
          <p style={{ margin: 0 }}>
            <strong>Current Farm:</strong> {farmName || currentFarmId}
          </p>
        </div>
      )}

      {msg && <p>{msg}</p>}

      {activeCrop && dashboard && (
        <>
          <div className="mobile-card">
            <h2 style={{ marginTop: 0 }}>Active Crop</h2>
            <p><strong>Crop Number:</strong> {activeCrop.cropNumber}</p>
            <p><strong>Placement Date:</strong> {new Date(activeCrop.placementDate).toLocaleDateString()}</p>
            <p><strong>Age (days):</strong> {ageDays ?? "-"}</p>
            <p><strong>Breed:</strong> {activeCrop.breed || "-"}</p>
            <p style={{ marginBottom: 0 }}><strong>Hatchery:</strong> {activeCrop.hatchery || "-"}</p>
          </div>

          <div className="mobile-card">
            <h2 style={{ marginTop: 0 }}>Crop Totals</h2>
            <p><strong>Birds placed:</strong> {dashboard.totals.birdsPlaced}</p>
            <p><strong>Mort:</strong> {dashboard.totals.mort}</p>
            <p><strong>Culls:</strong> {dashboard.totals.culls}</p>
            <p><strong>Total losses:</strong> {dashboard.totals.totalLosses}</p>
            <p><strong>Birds alive:</strong> {dashboard.totals.birdsAlive}</p>
            <p><strong>Mortality %:</strong> {dashboard.totals.mortalityPct.toFixed(2)}%</p>
            <p><strong>Feed kg:</strong> {dashboard.totals.feedKg.toFixed(2)}</p>
            <p style={{ marginBottom: 0 }}><strong>Water L:</strong> {dashboard.totals.waterL.toFixed(2)}</p>
          </div>

          <h2>Per House</h2>
          <div className="mobile-table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>House</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Birds placed</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mort</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Culls</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Losses</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Alive</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Mortality %</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Feed kg</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>Water L</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.houses.map((house) => (
                  <tr key={house.houseId}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.houseName}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.birdsPlaced}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.mort}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.culls}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.totalLosses}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.birdsAlive}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.mortalityPct.toFixed(2)}%</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.feedKg.toFixed(2)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.waterL.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}