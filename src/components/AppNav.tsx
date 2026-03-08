"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCurrentFarmId,
  setCurrentCropId,
  setCurrentFarmId,
  clearCurrentCropId,
} from "@/lib/app-context";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type Crop = {
  id: string;
  cropNumber: string;
};

const links = [
  { href: "/app", label: "Home" },
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/history", label: "History" },
  { href: "/app/log", label: "Log" },
  { href: "/app/access", label: "Access" },
  { href: "/app/farms", label: "Create Farm" },
  { href: "/app/farms/setup", label: "Farm Setup" },
  { href: "/app/crops", label: "Create Crop" },
  { href: "/app/crops/manage", label: "Manage Crops" },
  { href: "/app/daily", label: "Daily Entry" },
  { href: "/app/avara", label: "Avara Export" },
  { href: "/app/medication", label: "Medication" },
];

export default function AppNav() {
  const pathname = usePathname();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [currentCrop, setCurrentCrop] = useState<Crop | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadFarms() {
      const r = await fetch("/api/farms/list");
      const data = await r.json();

      if (!Array.isArray(data)) return;

      setFarms(data);

      const savedFarmId = getCurrentFarmId();

      if (savedFarmId && data.some((f: Farm) => f.id === savedFarmId)) {
        setCurrentFarmIdState(savedFarmId);
      } else if (data.length > 0) {
        setCurrentFarmId(data[0].id);
        setCurrentFarmIdState(data[0].id);
      }
    }

    loadFarms();
  }, []);

  useEffect(() => {
    async function loadActiveCrop() {
      if (!currentFarmId) {
        setCurrentCrop(null);
        clearCurrentCropId();
        return;
      }

      const r = await fetch(`/api/crops/active?farmId=${currentFarmId}`);
      const data = await r.json();

      if (r.ok && data) {
        setCurrentCrop(data);
        setCurrentCropId(data.id);
      } else {
        setCurrentCrop(null);
        clearCurrentCropId();
      }
    }

    loadActiveCrop();
  }, [currentFarmId]);

  function handleFarmChange(farmId: string) {
    setCurrentFarmId(farmId);
    setCurrentFarmIdState(farmId);
    setCurrentCrop(null);
    clearCurrentCropId();
  }

  return (
    <nav
      style={{
        borderBottom: "1px solid #ddd",
        background: "#fafafa",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Poultry App</div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {menuOpen ? "Close Menu" : "Open Menu"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: menuOpen ? 12 : 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "1fr",
            }}
          >
            <div style={{ fontSize: 14 }}>
              <strong>Farm:</strong>
            </div>

            <select
              value={currentFarmId}
              onChange={(e) => handleFarmChange(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                width: "100%",
              }}
            >
              <option value="">-- choose farm --</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} ({farm.code})
                </option>
              ))}
            </select>

            <div style={{ fontSize: 14 }}>
              <strong>Active Crop:</strong> {currentCrop ? currentCrop.cropNumber : "-"}
            </div>

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Log out
              </button>
            </form>
          </div>

          {menuOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {links.map((link) => {
                const active = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: active ? "#fff" : "#111",
                      background: active ? "#111" : "#eaeaea",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}