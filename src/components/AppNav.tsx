"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearCurrentCropId,
  clearHistoryCropId,
  getCurrentFarmId,
  getHistoryCropId,
  isViewingHistory,
  setCurrentCropId,
  setCurrentFarmId,
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

type AlertItem = {
  severity: "SOON" | "OVERDUE";
};

// Main navigation links
const mainLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily", label: "Daily Entry" },
  { href: "/feed", label: "Feed" },
  { href: "/night-check", label: "Night Check" },
  { href: "/total", label: "Total" },
];

const setupLinks = [
  { href: "/farms", label: "Create Farm" },
  { href: "/farms/setup", label: "Farm Setup" },
  { href: "/crops", label: "Create Crop" },
  { href: "/crops/targets", label: "Crop Targets" },
  { href: "/access", label: "Access" },
  { href: "/log", label: "Log" },
  { href: "/admin", label: "Admin" },
];

const recordsLinks = [
  { href: "/check-flock", label: "Check Flock" },
  { href: "/audit-farm-documents", label: "Farm Documents" },
  { href: "/medication", label: "Medication" },
  { href: "/history", label: "History" },
  { href: "/avara", label: "Week Report" },
  { href: "/forum", label: "Forum" },
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [currentCrop, setCurrentCrop] = useState<Crop | null>(null);
  const [menuOpen, setMenuOpen] = useState(true);
  const isFirstMount = useRef(true);

  const [docAlerts, setDocAlerts] = useState<AlertItem[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyCropLabel, setHistoryCropLabel] = useState("");

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

  useEffect(() => {
    async function loadDocAlerts() {
      if (!currentFarmId) {
        setDocAlerts([]);
        return;
      }
      const r = await fetch(`/api/farm-documents/alerts?farmId=${currentFarmId}`);
      const data = await r.json();
      if (!r.ok) {
        setDocAlerts([]);
        return;
      }
      setDocAlerts(Array.isArray(data.alerts) ? data.alerts : []);
    }
    loadDocAlerts();
  }, [currentFarmId, pathname]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function checkHistoryMode() {
      const viewing = isViewingHistory();
      setHistoryMode(viewing);
      if (viewing) {
        const histCropId = getHistoryCropId();
        try {
          const r = await fetch(`/api/crops/${histCropId}`);
          if (r.ok) {
            const data = await r.json();
            setHistoryCropLabel(`Crop ${data.cropNumber}`);
          }
        } catch {
          setHistoryCropLabel("History Crop");
        }
      } else {
        setHistoryCropLabel("");
      }
    }
    checkHistoryMode();
  }, [pathname]);

  async function handleExitHistory() {
    clearHistoryCropId();
    setHistoryMode(false);
    setHistoryCropLabel("");
    // Reload active crop for current farm
    if (currentFarmId) {
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
    router.push("/dashboard");
  }

  function handleFarmChange(farmId: string) {
    setCurrentFarmId(farmId);
    setCurrentFarmIdState(farmId);
    setCurrentCrop(null);
    clearCurrentCropId();
  }

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("currentFarmId");
      localStorage.removeItem("currentCropId");
      clearCurrentCropId();
      setCurrentFarmId("");
      setCurrentFarmIdState("");
      setCurrentCrop(null);
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    } finally {
      setLoggingOut(false);
      setMenuOpen(false);
    }
  }

  const currentFarmLabel = useMemo(() => {
    const farm = farms.find((item) => item.id === currentFarmId);
    return farm ? `${farm.name} (${farm.code})` : "No farm selected";
  }, [farms, currentFarmId]);

  const currentCropLabel = currentCrop ? `Crop ${currentCrop.cropNumber}` : "No active crop";
  const overdueCount = docAlerts.filter((a) => a.severity === "OVERDUE").length;
  const soonCount = docAlerts.filter((a) => a.severity === "SOON").length;

  function auditLinkClass(base: string) {
    if (overdueCount > 0) return `${base} app-nav__link--alert-red`;
    if (soonCount > 0) return `${base} app-nav__link--alert-orange`;
    return base;
  }

  function renderSection(title: string, links: Array<{ href: string; label: string }>) {
    return (
      <div className="app-nav__panel">
        <div className="app-nav__field-label">{title}</div>
        <div className="app-nav__links">
          {links.map((link) => {
            const active = pathname === link.href;
            const baseClass = `app-nav__link${active ? " app-nav__link--active" : ""}`;
            const className = link.href === "/audit-farm-documents" ? auditLinkClass(baseClass) : baseClass;
            return (
              <Link key={link.href} href={link.href} className={className}>
                {link.label}
                {link.href === "/audit-farm-documents" && docAlerts.length > 0 && (
                  <span className="app-nav__badge">{docAlerts.length}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <nav className="app-nav">
      <div className="app-nav__inner">
        <div className="app-nav__bar">
          <div className="app-brand">
            <div className="app-brand__badge" style={historyMode ? { background: "#f59e0b" } : undefined}>PA</div>
            <div className="app-brand__text">
              <div className="app-brand__title">
                Poultry Manage
                {historyMode && (
                  <span style={{ marginLeft: 8, background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: "0.65rem", fontWeight: 700, verticalAlign: "middle" }}>
                    HISTORY MODE
                  </span>
                )}
              </div>
              <div className="app-brand__sub">
                {currentFarmLabel} · {historyMode ? `${historyCropLabel} · HISTORY` : currentCropLabel}
              </div>
            </div>
          </div>
          <button type="button" className="app-nav__toggle" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
        {menuOpen && (
          <div className="app-nav__meta">
            <div className="app-nav__panel">
              <div className="app-nav__field">
                <div className="app-nav__field-label">Current farm</div>
                <select className="app-nav__select" value={currentFarmId} onChange={(e) => handleFarmChange(e.target.value)}>
                  <option value="">-- choose farm --</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>{farm.name} ({farm.code})</option>
                  ))}
                </select>
              </div>
            </div>
            {renderSection("Main Menu", mainLinks)}
            {renderSection("Setup", setupLinks)}
            {renderSection("Records", recordsLinks)}
            <div className="app-nav__panel">
              <div className="app-nav__field-label">Session</div>
              <div className="app-nav__links">
                {historyMode && (
                  <button
                    type="button"
                    className="app-nav__link"
                    style={{ background: "#f59e0b", color: "#fff", fontWeight: 700 }}
                    onClick={handleExitHistory}
                  >
                    Exit History Mode
                  </button>
                )}
                <button type="button" className="app-nav__link" onClick={handleLogout} disabled={loggingOut}>
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}