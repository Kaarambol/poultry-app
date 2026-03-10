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

const quickLinks = [
  { href: "/app/dashboard", label: "Open Dashboard" },
  { href: "/app/daily", label: "Daily Entry" },
  { href: "/app/feed", label: "Feed" },
  { href: "/app/total", label: "Total" },
  { href: "/app/medication", label: "Medication" },
  { href: "/app/avara", label: "Avara Export" },
  { href: "/app/history", label: "History" },
  { href: "/app/access", label: "Access" },
];

export default function AppHomePage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [activeCrop, setActiveCrop] = useState<ActiveCrop | null>(null);
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
      return;
    }

    if (!data) {
      setMsg("No active crop for the current farm.");
      setActiveCrop(null);
      return;
    }

    setActiveCrop(data);
    setCurrentCropId(data.id);
    setMsg("");
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
            <div className="page-intro__eyebrow">Control center</div>
            <h1 className="page-intro__title">Poultry App Home</h1>
            <p className="page-intro__subtitle">
              Fast access to the most important daily tools for the selected farm.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Active crop</div>
              <div>{activeCrop ? `Crop ${activeCrop.cropNumber}` : "-"}</div>
              <div style={{ marginTop: 6 }}>Age: {ageDays ?? "-"} days</div>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mobile-alert" style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>Quick Actions</h2>
          <div className="mobile-actions">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="mobile-full-button">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mobile-grid mobile-grid--2">
          <div className="mobile-card">
            <h2>Current Context</h2>
            <div className="mobile-record-card__grid">
              <div className="mobile-record-row">
                <strong>Farm</strong>
                <span>{currentFarmId ? farmName || currentFarmId : "-"}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Crop</strong>
                <span>{activeCrop?.cropNumber || "-"}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Status</strong>
                <span>{activeCrop?.status || "-"}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Placement date</strong>
                <span>
                  {activeCrop?.placementDate
                    ? new Date(activeCrop.placementDate).toLocaleDateString()
                    : "-"}
                </span>
              </div>
              <div className="mobile-record-row">
                <strong>Age day</strong>
                <span>{ageDays ?? "-"}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Breed</strong>
                <span>{activeCrop?.breed || "-"}</span>
              </div>
              <div className="mobile-record-row">
                <strong>Hatchery</strong>
                <span>{activeCrop?.hatchery || "-"}</span>
              </div>
            </div>
          </div>

          <div className="mobile-card">
            <h2>Setup Shortcuts</h2>
            <div className="mobile-actions">
              <Link href="/app/farms" className="mobile-button mobile-button--secondary">
                Create Farm
              </Link>
              <Link href="/app/farms/setup" className="mobile-button mobile-button--secondary">
                Farm Setup
              </Link>
              <Link href="/app/crops" className="mobile-button mobile-button--secondary">
                Create Crop
              </Link>
              <Link href="/app/crops/manage" className="mobile-button mobile-button--secondary">
                Manage Crops
              </Link>
            </div>
          </div>
        </div>

        <div className="mobile-card">
          <h2>Recommended Flow</h2>
          <div className="mobile-record-card__grid">
            <div className="mobile-record-row">
              <strong>Morning</strong>
              <span>Dashboard → Daily Entry</span>
            </div>
            <div className="mobile-record-row">
              <strong>Feed</strong>
              <span>Feed deliveries by ticket</span>
            </div>
            <div className="mobile-record-row">
              <strong>Treatment</strong>
              <span>Medication Records</span>
            </div>
            <div className="mobile-record-row">
              <strong>Weekly</strong>
              <span>Avara Export</span>
            </div>
            <div className="mobile-record-row">
              <strong>Finance</strong>
              <span>Total &amp; Margin</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}