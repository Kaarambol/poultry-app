"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type Crop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  status: string;
  finishDate: string | null;
  breed: string | null;
  hatchery: string | null;
};

export default function ManageCropsPage() {
  const [currentFarmId, setCurrentFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [crops, setCrops] = useState<Crop[]>([]);
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

  async function loadCrops(farmId: string) {
    const r = await fetch(`/api/crops/list?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error loading crops.");
      setCrops([]);
      return;
    }

    if (Array.isArray(data)) {
      setCrops(data);
      setMsg(data.length === 0 ? "No crops for this farm yet." : "");
    } else {
      setCrops([]);
      setMsg("No crops for this farm yet.");
    }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmId(farmId);
    loadFarmName(farmId);
    loadCrops(farmId);
  }, []);

  async function finishCrop(cropId: string) {
    const confirmed = window.confirm("Are you sure you want to finish this crop?");
    if (!confirmed) return;

    const r = await fetch("/api/crops/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cropId }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      return;
    }

    setMsg("Crop finished.");
    loadCrops(currentFarmId);
  }

  const activeCrops = crops.filter((crop) => crop.status === "ACTIVE");
  const finishedCrops = crops.filter((crop) => crop.status === "FINISHED");

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Manage Crops</h1>

      {currentFarmId && (
        <p>
          <strong>Current Farm:</strong> {farmName || currentFarmId}
        </p>
      )}

      {msg && <p>{msg}</p>}

      {currentFarmId && (
        <>
          <h2>Active Crops</h2>
          {activeCrops.length === 0 ? (
            <p>No active crops.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Crop
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Placement Date
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Breed
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Hatchery
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Status
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeCrops.map((crop) => (
                  <tr key={crop.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.cropNumber}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(crop.placementDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.breed || "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.hatchery || "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.status}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      <button type="button" onClick={() => finishCrop(crop.id)}>
                        Finish Crop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2>Finished Crops</h2>
          {finishedCrops.length === 0 ? (
            <p>No finished crops yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Crop
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Placement Date
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Finish Date
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Breed
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Hatchery
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {finishedCrops.map((crop) => (
                  <tr key={crop.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.cropNumber}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(crop.placementDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.finishDate ? new Date(crop.finishDate).toLocaleDateString() : "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.breed || "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.hatchery || "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {crop.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}