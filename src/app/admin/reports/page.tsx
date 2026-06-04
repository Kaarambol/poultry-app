"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Farm = { id: string; name: string; code: string };

type FlockRow = {
  cropId: string; farmName: string; cropNumber: string; breed: string | null; hatchery: string | null;
  status: string; birdsPlaced: number; placementDate: string;
  thinDate: string | null; thinAge: number | null; thinBirds: number | null; thinWeightG: number | null; thinPct: number | null;
  thin2Date: string | null; thin2Age: number | null; thin2Birds: number | null; thin2Pct: number | null;
  clearDate: string | null; clearAge: number | null; clearBirds: number | null; clearWeightG: number | null; clearPct: number | null;
  totalMort: number; totalCulls: number; mortPct: number | null;
  totalFeedT: number; fcr: number | null; epef: number | null; adg: number | null;
};

type WeekRow = {
  week: number; dayFrom: number; dayTo: number; dateFrom: string; dateTo: string;
  mort: number; culls: number; birdsEnd: number; avgWeightG: number | null; targetWeightG: number | null;
  densityKgM2: number | null; cumulativeMortPct: number | null;
};

type WeeklyData = {
  cropId: string; cropNumber: string; farmName: string; birdsPlaced: number; totalFloorAreaM2: number;
  weeks: WeekRow[]; thinDensityKgM2: number | null; clearDensityKgM2: number | null;
};

type MortRow = {
  cropId: string; farmName: string; cropNumber: string; breed: string | null; birdsPlaced: number;
  placementDate: string; status: string;
  mort3day: number; mortPct3day: number | null;
  mort7day: number; mortPct7day: number | null;
  mort14day: number; mortPct14day: number | null;
  mortFinal: number; mortPctFinal: number | null;
  deadTotal: number; cullsTotal: number; cullsSmall: number; cullsLeg: number;
};

type FeedRow = {
  cropId: string; farmName: string; cropNumber: string; birdsPlaced: number; placementDate: string;
  feedProduct: string; totalFeedKg: number; totalWheatKg: number; totalKg: number;
  totalTonnes: number; tonnesPer1000Birds: number | null; avgPricePerTonne: number | null; totalCostGbp: number | null;
};

type FinancialRow = {
  cropId: string; farmName: string; cropNumber: string; breed: string | null; birdsPlaced: number;
  placementDate: string; clearDate: string | null; clearBirds: number | null; clearWeightG: number | null;
  totalLiveWeightKg: number | null; revenueGbp: number | null; pricePerKg: number | null;
  feedCostGbp: number | null; marginGbp: number | null; marginPct: number | null;
  gbpPerBird: number | null; gbpPerKg: number | null;
};

type Filters = {
  farmIds: string[];
  dateFrom: string;
  dateTo: string;
  status: "ALL" | "ACTIVE" | "FINISHED";
  breed: string;
  hatchery: string;
};

type Tab = "flock" | "weekly" | "mortality" | "feed" | "financial";

const n = (v: number | null | undefined, dp = 2) =>
  v == null ? "—" : v.toFixed(dp);
const fmtDate = (iso: string | null) =>
  iso ? iso.slice(0, 10) : "—";
const fmtNum = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString();

export default function AdminReportsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [forbidden, setForbidden] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

  const [filters, setFilters] = useState<Filters>({
    farmIds: [],
    dateFrom: yearAgo,
    dateTo: today,
    status: "ALL",
    breed: "",
    hatchery: "",
  });

  const [activeTab, setActiveTab] = useState<Tab>("flock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [flockData, setFlockData] = useState<FlockRow[] | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [mortalityData, setMortalityData] = useState<MortRow[] | null>(null);
  const [feedData, setFeedData] = useState<FeedRow[] | null>(null);
  const [financialData, setFinancialData] = useState<FinancialRow[] | null>(null);

  const [selectedCropId, setSelectedCropId] = useState("");

  useEffect(() => {
    fetch("/api/admin/farms")
      .then(r => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json();
      })
      .then(data => { if (data) setFarms(data); });
  }, []);

  function buildParams() {
    const p = new URLSearchParams();
    filters.farmIds.forEach(id => p.append("farmId", id));
    if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) p.set("dateTo", filters.dateTo);
    p.set("status", filters.status);
    if (filters.breed) p.set("breed", filters.breed);
    if (filters.hatchery) p.set("hatchery", filters.hatchery);
    return p.toString();
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const qs = buildParams();
    try {
      if (activeTab === "flock") {
        const r = await fetch(`/api/admin/reports/flock-summary?${qs}`);
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        setFlockData(await r.json());
      } else if (activeTab === "mortality") {
        const r = await fetch(`/api/admin/reports/mortality?${qs}`);
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        setMortalityData(await r.json());
      } else if (activeTab === "feed") {
        const r = await fetch(`/api/admin/reports/feed?${qs}`);
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        setFeedData(await r.json());
      } else if (activeTab === "financial") {
        const r = await fetch(`/api/admin/reports/financial?${qs}`);
        if (!r.ok) throw new Error((await r.json()).error || "Error");
        setFinancialData(await r.json());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadWeekly() {
    if (!selectedCropId) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/reports/weekly?cropId=${selectedCropId}`);
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      setWeeklyData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function toggleFarm(id: string) {
    setFilters(f => ({
      ...f,
      farmIds: f.farmIds.includes(id) ? f.farmIds.filter(x => x !== id) : [...f.farmIds, id],
    }));
  }

  if (forbidden) return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="mobile-alert mobile-alert--error">Access denied. Admin only.</div>
        <Link href="/admin" className="mobile-button mobile-button--secondary" style={{ marginTop: 16 }}>Back to Admin</Link>
      </div>
    </div>
  );

  const thStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: "2px solid var(--border)",
    textAlign: "left",
    fontWeight: 600,
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    background: "var(--bg)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 8px",
    borderBottom: "1px solid var(--border)",
    fontSize: "0.78rem",
    whiteSpace: "nowrap",
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "flock", label: "Flock Summary" },
    { key: "weekly", label: "Weekly" },
    { key: "mortality", label: "Mortality" },
    { key: "feed", label: "Feed" },
    { key: "financial", label: "Financial" },
  ];

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Administration</div>
            <h1 className="page-intro__title">Reports</h1>
          </div>
        </div>

        <div className="mobile-card">
          <Link href="/admin" className="mobile-button mobile-button--secondary">Back to Admin</Link>
        </div>

        {/* Filters */}
        <div className="mobile-card">
          <h2 style={{ margin: "0 0 14px", fontSize: "1rem" }}>Filters</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Farm multi-select */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6 }}>
                Farms ({filters.farmIds.length === 0 ? "all" : `${filters.farmIds.length} selected`})
              </label>
              <div style={{
                maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 10px",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                {farms.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>Loading farms...</span>}
                {farms.map(farm => (
                  <label key={farm.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={filters.farmIds.includes(farm.id)}
                      onChange={() => toggleFarm(farm.id)}
                    />
                    {farm.name} <span style={{ color: "var(--text-soft)", fontSize: "0.75rem" }}>({farm.code})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="mobile-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="mobile-input"
                />
              </div>
            </div>

            {/* Status + Breed + Hatchery */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Status</label>
                <select
                  value={filters.status}
                  onChange={e => setFilters(f => ({ ...f, status: e.target.value as "ALL" | "ACTIVE" | "FINISHED" }))}
                  className="mobile-input"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="FINISHED">Finished</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Breed</label>
                <input
                  type="text"
                  value={filters.breed}
                  onChange={e => setFilters(f => ({ ...f, breed: e.target.value }))}
                  placeholder="e.g. Ross 308"
                  className="mobile-input"
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Hatchery</label>
                <input
                  type="text"
                  value={filters.hatchery}
                  onChange={e => setFilters(f => ({ ...f, hatchery: e.target.value }))}
                  placeholder="e.g. Avara"
                  className="mobile-input"
                />
              </div>
            </div>

            <button
              className="mobile-button mobile-button--primary"
              onClick={handleGenerate}
              disabled={loading || activeTab === "weekly"}
            >
              {loading ? "Loading..." : "Generate"}
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="mobile-card" style={{ padding: "8px 12px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  fontSize: "0.82rem",
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  background: activeTab === tab.key ? "var(--primary, #1B3A5C)" : "transparent",
                  color: activeTab === tab.key ? "#fff" : "var(--text)",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mobile-alert mobile-alert--error">{error}</div>
        )}

        {/* Flock Summary */}
        {activeTab === "flock" && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Flock Summary {flockData ? `(${flockData.length} crops)` : ""}</h2>
            {!flockData ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>Set filters and click Generate.</p>
            ) : flockData.length === 0 ? (
              <p style={{ color: "var(--text-soft)" }}>No crops found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 1400 }}>
                  <thead>
                    <tr>
                      {["Farm","Crop#","Status","Breed","Hatchery","Birds","Placed",
                        "T1 Date","T1 Age","T1 Birds","T1 Wt(g)","T1%",
                        "T2 Date","T2 Age","T2 Birds","T2%",
                        "Clear Date","Clear Age","Clear Birds","Clear Wt(g)","Clear%",
                        "Dead","Culls","Mort%","Feed(t)","FCR","EPEF","ADG"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flockData.map((row, i) => (
                      <tr key={row.cropId} style={{ background: i % 2 === 0 ? "var(--card-bg, #fff)" : "var(--bg, #fafafa)" }}>
                        <td style={tdStyle}>{row.farmName}</td>
                        <td style={tdStyle}>{row.cropNumber}</td>
                        <td style={tdStyle}>{row.status}</td>
                        <td style={tdStyle}>{row.breed || "—"}</td>
                        <td style={tdStyle}>{row.hatchery || "—"}</td>
                        <td style={tdStyle}>{fmtNum(row.birdsPlaced)}</td>
                        <td style={tdStyle}>{fmtDate(row.placementDate)}</td>
                        <td style={tdStyle}>{fmtDate(row.thinDate)}</td>
                        <td style={tdStyle}>{row.thinAge ?? "—"}</td>
                        <td style={tdStyle}>{fmtNum(row.thinBirds)}</td>
                        <td style={tdStyle}>{fmtNum(row.thinWeightG)}</td>
                        <td style={tdStyle}>{n(row.thinPct)}</td>
                        <td style={tdStyle}>{fmtDate(row.thin2Date)}</td>
                        <td style={tdStyle}>{row.thin2Age ?? "—"}</td>
                        <td style={tdStyle}>{fmtNum(row.thin2Birds)}</td>
                        <td style={tdStyle}>{n(row.thin2Pct)}</td>
                        <td style={tdStyle}>{fmtDate(row.clearDate)}</td>
                        <td style={tdStyle}>{row.clearAge ?? "—"}</td>
                        <td style={tdStyle}>{fmtNum(row.clearBirds)}</td>
                        <td style={tdStyle}>{fmtNum(row.clearWeightG)}</td>
                        <td style={tdStyle}>{n(row.clearPct)}</td>
                        <td style={tdStyle}>{fmtNum(row.totalMort)}</td>
                        <td style={tdStyle}>{fmtNum(row.totalCulls)}</td>
                        <td style={tdStyle}>{n(row.mortPct)}</td>
                        <td style={tdStyle}>{n(row.totalFeedT, 2)}</td>
                        <td style={tdStyle}>{n(row.fcr, 3)}</td>
                        <td style={tdStyle}>{n(row.epef, 1)}</td>
                        <td style={tdStyle}>{n(row.adg, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Weekly */}
        {activeTab === "weekly" && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Weekly Report</h2>
            {!flockData ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
                Generate <strong>Flock Summary</strong> first to select a crop, then switch back here.
              </p>
            ) : (
              <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>Select Crop</label>
                  <select
                    value={selectedCropId}
                    onChange={e => setSelectedCropId(e.target.value)}
                    className="mobile-input"
                  >
                    <option value="">— select a crop —</option>
                    {flockData.map(row => (
                      <option key={row.cropId} value={row.cropId}>
                        {row.farmName} — Crop #{row.cropNumber} ({fmtDate(row.placementDate)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="mobile-button mobile-button--primary"
                  onClick={handleLoadWeekly}
                  disabled={!selectedCropId || loading}
                >
                  {loading ? "Loading..." : "Load Weekly"}
                </button>
              </div>
            )}

            {weeklyData && (
              <>
                <div style={{ marginBottom: 12, fontSize: "0.85rem", color: "var(--text-soft)" }}>
                  <strong>{weeklyData.farmName}</strong> — Crop #{weeklyData.cropNumber} &nbsp;|&nbsp;
                  Birds: {fmtNum(weeklyData.birdsPlaced)} &nbsp;|&nbsp;
                  Floor area: {n(weeklyData.totalFloorAreaM2, 1)} m²
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr>
                        {["Week","Days","Dead","Culls","Birds End","Avg Wt(g)","Target Wt(g)","vs Target","Cum Mort%","Density(kg/m²)"].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.weeks.map((w, i) => {
                        const vsTarget = w.avgWeightG != null && w.targetWeightG != null
                          ? w.avgWeightG - w.targetWeightG : null;
                        return (
                          <tr key={w.week} style={{ background: i % 2 === 0 ? "var(--card-bg, #fff)" : "var(--bg, #fafafa)" }}>
                            <td style={tdStyle}>{w.week}</td>
                            <td style={tdStyle}>{w.dayFrom}–{w.dayTo}</td>
                            <td style={tdStyle}>{fmtNum(w.mort)}</td>
                            <td style={tdStyle}>{fmtNum(w.culls)}</td>
                            <td style={tdStyle}>{fmtNum(w.birdsEnd)}</td>
                            <td style={tdStyle}>{w.avgWeightG != null ? fmtNum(Math.round(w.avgWeightG)) : "—"}</td>
                            <td style={tdStyle}>{w.targetWeightG != null ? fmtNum(Math.round(w.targetWeightG)) : "—"}</td>
                            <td style={{
                              ...tdStyle,
                              color: vsTarget == null ? undefined : vsTarget >= 0 ? "green" : "red",
                              fontWeight: vsTarget != null ? 600 : undefined,
                            }}>
                              {vsTarget != null ? `${vsTarget >= 0 ? "+" : ""}${Math.round(vsTarget)}` : "—"}
                            </td>
                            <td style={tdStyle}>{n(w.cumulativeMortPct)}</td>
                            <td style={tdStyle}>{n(w.densityKgM2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 24, flexWrap: "wrap", fontSize: "0.85rem" }}>
                  <div><strong>Thin density (after thin):</strong> {n(weeklyData.thinDensityKgM2)} kg/m²</div>
                  <div><strong>Clear density:</strong> {n(weeklyData.clearDensityKgM2)} kg/m²</div>
                  <div><strong>Total floor area:</strong> {n(weeklyData.totalFloorAreaM2, 1)} m²</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mortality */}
        {activeTab === "mortality" && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Mortality Report {mortalityData ? `(${mortalityData.length} crops)` : ""}</h2>
            {!mortalityData ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>Set filters and click Generate.</p>
            ) : mortalityData.length === 0 ? (
              <p style={{ color: "var(--text-soft)" }}>No crops found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr>
                      {["Farm","Crop#","Breed","Birds","Placed","3-day%","7-day%","14-day%","Final%","Dead","Culls","Small Culls","Leg Culls"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mortalityData.map((row, i) => (
                      <tr key={row.cropId} style={{ background: i % 2 === 0 ? "var(--card-bg, #fff)" : "var(--bg, #fafafa)" }}>
                        <td style={tdStyle}>{row.farmName}</td>
                        <td style={tdStyle}>{row.cropNumber}</td>
                        <td style={tdStyle}>{row.breed || "—"}</td>
                        <td style={tdStyle}>{fmtNum(row.birdsPlaced)}</td>
                        <td style={tdStyle}>{fmtDate(row.placementDate)}</td>
                        <td style={tdStyle}>{n(row.mortPct3day)}</td>
                        <td style={tdStyle}>{n(row.mortPct7day)}</td>
                        <td style={tdStyle}>{n(row.mortPct14day)}</td>
                        <td style={tdStyle}>{n(row.mortPctFinal)}</td>
                        <td style={tdStyle}>{fmtNum(row.deadTotal)}</td>
                        <td style={tdStyle}>{fmtNum(row.cullsTotal)}</td>
                        <td style={tdStyle}>{fmtNum(row.cullsSmall)}</td>
                        <td style={tdStyle}>{fmtNum(row.cullsLeg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Feed */}
        {activeTab === "feed" && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Feed Report {feedData ? `(${feedData.length} rows)` : ""}</h2>
            {!feedData ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>Set filters and click Generate.</p>
            ) : feedData.length === 0 ? (
              <p style={{ color: "var(--text-soft)" }}>No feed records found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 800 }}>
                  <thead>
                    <tr>
                      {["Farm","Crop#","Birds","Placed","Product","Total(t)","t/1000 birds","Avg £/t","Total Cost £"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feedData.map((row, i) => (
                      <tr key={`${row.cropId}-${row.feedProduct}`} style={{ background: i % 2 === 0 ? "var(--card-bg, #fff)" : "var(--bg, #fafafa)" }}>
                        <td style={tdStyle}>{row.farmName}</td>
                        <td style={tdStyle}>{row.cropNumber}</td>
                        <td style={tdStyle}>{fmtNum(row.birdsPlaced)}</td>
                        <td style={tdStyle}>{fmtDate(row.placementDate)}</td>
                        <td style={tdStyle}>{row.feedProduct}</td>
                        <td style={tdStyle}>{n(row.totalTonnes, 2)}</td>
                        <td style={tdStyle}>{n(row.tonnesPer1000Birds, 3)}</td>
                        <td style={tdStyle}>{row.avgPricePerTonne != null ? `£${n(row.avgPricePerTonne, 2)}` : "—"}</td>
                        <td style={tdStyle}>{row.totalCostGbp != null ? `£${n(row.totalCostGbp, 2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Financial */}
        {activeTab === "financial" && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Financial Report {financialData ? `(${financialData.length} crops)` : ""}</h2>
            {!financialData ? (
              <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>Set filters and click Generate.</p>
            ) : financialData.length === 0 ? (
              <p style={{ color: "var(--text-soft)" }}>No crops found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 1000 }}>
                  <thead>
                    <tr>
                      {["Farm","Crop#","Birds","Clear Birds","Live Wt(kg)","Revenue £","Feed Cost £","Margin £","Margin%","£/bird","£/kg"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.map((row, i) => (
                      <tr key={row.cropId} style={{ background: i % 2 === 0 ? "var(--card-bg, #fff)" : "var(--bg, #fafafa)" }}>
                        <td style={tdStyle}>{row.farmName}</td>
                        <td style={tdStyle}>{row.cropNumber}</td>
                        <td style={tdStyle}>{fmtNum(row.birdsPlaced)}</td>
                        <td style={tdStyle}>{fmtNum(row.clearBirds)}</td>
                        <td style={tdStyle}>{row.totalLiveWeightKg != null ? n(row.totalLiveWeightKg, 0) : "—"}</td>
                        <td style={tdStyle}>{row.revenueGbp != null ? `£${n(row.revenueGbp, 2)}` : "—"}</td>
                        <td style={tdStyle}>{row.feedCostGbp != null ? `£${n(row.feedCostGbp, 2)}` : "—"}</td>
                        <td style={{
                          ...tdStyle,
                          color: row.marginGbp == null ? undefined : row.marginGbp >= 0 ? "green" : "red",
                          fontWeight: row.marginGbp != null ? 600 : undefined,
                        }}>
                          {row.marginGbp != null ? `£${n(row.marginGbp, 2)}` : "—"}
                        </td>
                        <td style={tdStyle}>{n(row.marginPct)}</td>
                        <td style={tdStyle}>{row.gbpPerBird != null ? `£${n(row.gbpPerBird, 2)}` : "—"}</td>
                        <td style={tdStyle}>{row.gbpPerKg != null ? `£${n(row.gbpPerKg, 2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
