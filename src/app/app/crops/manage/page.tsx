"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

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
      setMsgType("error");
      setMsg(data.error || "Error loading crops.");
      setCrops([]);
      return;
    }

    if (Array.isArray(data)) {
      setCrops(data);
      setMsgType("info");
      setMsg(data.length === 0 ? "No crops for this farm yet." : "");
    } else {
      setCrops([]);
      setMsg("No crops for this farm yet.");
    }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
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
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Crop finished.");
    loadCrops(currentFarmId);
  }

  const activeCrops = useMemo(
    () => crops.filter((crop) => crop.status === "ACTIVE"),
    [crops]
  );

  const finishedCrops = useMemo(
    () => crops.filter((crop) => crop.status === "FINISHED"),
    [crops]
  );

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
      ? "mobile-alert mobile-alert--success"
      : "mobile-alert";

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Lifecycle control</div>
            <h1 className="page-intro__title">Manage Crops</h1>
            <p className="page-intro__subtitle">
              Review active and finished production cycles for the selected farm.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Overview</div>
              <div>Active: {activeCrops.length}</div>
              <div style={{ marginTop: 6 }}>Finished: {finishedCrops.length}</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <h2 className="mobile-section-title">Active Crops</h2>

        {activeCrops.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No active crops.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {activeCrops.map((crop) => (
              <div key={crop.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">
                  Crop {crop.cropNumber}
                </h3>

                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Placement</strong>
                    <span>
                      {new Date(crop.placementDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Breed</strong>
                    <span>{crop.breed || "-"}</span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Hatchery</strong>
                    <span>{crop.hatchery || "-"}</span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Status</strong>
                    <span>{crop.status}</span>
                  </div>
                </div>

                <div className="mobile-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="mobile-button mobile-button--danger"
                    onClick={() => finishCrop(crop.id)}
                  >
                    Finish Crop
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mobile-section-title">Finished Crops</h2>

        {finishedCrops.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No finished crops yet.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {finishedCrops.map((crop) => (
              <div key={crop.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">
                  Crop {crop.cropNumber}
                </h3>

                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Placement</strong>
                    <span>
                      {new Date(crop.placementDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Finish date</strong>
                    <span>
                      {crop.finishDate
                        ? new Date(crop.finishDate).toLocaleDateString()
                        : "-"}
                    </span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Breed</strong>
                    <span>{crop.breed || "-"}</span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Hatchery</strong>
                    <span>{crop.hatchery || "-"}</span>
                  </div>

                  <div className="mobile-record-row">
                    <strong>Status</strong>
                    <span>{crop.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}