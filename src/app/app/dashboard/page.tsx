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
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Active Crop Dashboard</h1>

      {currentFarmId && (
        <p>
          <strong>Current Farm:</strong> {farmName || currentFarmId}
        </p>
      )}

      {msg && <p>{msg}</p>}

      {activeCrop && dashboard && (
        <>
          <h2>Active Crop</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Crop Number
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {activeCrop.cropNumber}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Placement Date
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {new Date(activeCrop.placementDate).toLocaleDateString()}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Age (days)
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{ageDays ?? "-"}</td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Breed
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {activeCrop.breed || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  Hatchery
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {activeCrop.hatchery || "-"}
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Crop Totals</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds placed
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mort
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Culls
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Total losses
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds alive
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mortality %
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Feed kg
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Water L
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.birdsPlaced}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.mort}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.culls}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.totalLosses}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.birdsAlive}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.mortalityPct.toFixed(2)}%
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.feedKg.toFixed(2)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {dashboard.totals.waterL.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <h2>Per House</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  House
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds placed
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mort
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Culls
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Total losses
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Birds alive
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Mortality %
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Feed kg
                </th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                  Water L
                </th>
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
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                    {house.mortalityPct.toFixed(2)}%
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.feedKg.toFixed(2)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.waterL.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}