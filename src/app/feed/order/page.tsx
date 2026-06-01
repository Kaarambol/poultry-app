"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, canOperateUi } from "@/lib/ui-permissions";

type FeedBin = {
  id: string;
  name: string;
  capacityTonnes: number;
  isClosingStock: boolean;
};

type House = {
  id: string;
  name: string;
  code: string | null;
};

type TrailerLoad = {
  feeds: { feedProduct: string; tonnes: number }[];
  totalTonnes: number;
};

type StockDay = {
  date: string;
  dayOfWeek: string;
  ageMin: number;
  ageMax: number;
  birds: number;
  consumptionKg: number;
  stockStartKg: number;
  stockEndKg: number;
};

type DeliveryDay = {
  date: string;
  dayOfWeek: string;
  ageMin: number;
  ageMax: number;
  birds: number;
  consumptionKg: number;
  stockBeforeKg: number;
  trailers: TrailerLoad[];
  deliveryKg: number;
  stockAfterDeliveryKg: number;
  stockEndKg: number;
  feedProducts: { product: string; ownWheat: boolean; wheatPct: number }[];
};

type OrderWeek = {
  orderDate: string;
  stockOnOrderDayKg: number;
  totalOrderKg: number;
  totalTrailers: number;
  preDelivery: StockDay[];
  deliveryWindow: DeliveryDay[];
  coverage: StockDay[];
  stockOnFinalTuesdayKg: number;
  notes: string[];
};

type ScheduleMeta = {
  totalBinCapacityTonnes: number;
  maxOrderTonnes: number;
  cycleEnd: string;
  closingBins: string[];
  activeStockTonnes: number;
  trailerTonnes: number;
};

function fmt(n: number) { return n.toLocaleString("en-GB", { maximumFractionDigits: 1 }); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const FEED_PRODUCTS = [
  { value: "STARTER_CRUMB_185",  label: "Starter Crumb 185" },
  { value: "REARER_PELLET_385",  label: "Rearer Pellet 385" },
  { value: "GROWER_PELLET_485",  label: "Grower Pellet 485" },
  { value: "FINISHER_PELLET_585", label: "Finisher Pellet 585" },
];

function getFeedLabel(v: string) {
  return FEED_PRODUCTS.find(p => p.value === v)?.label ?? v;
}

type FeedPhase = {
  id?: string;
  feedProduct: string;
  dayFrom: number;
  dayTo: number | null;
  wheatPct: number;
  ownWheat: boolean;
};

const DEFAULT_PHASES: FeedPhase[] = [
  { feedProduct: "STARTER_CRUMB_185",  dayFrom: 0,  dayTo: 10,  wheatPct: 0, ownWheat: false },
  { feedProduct: "REARER_PELLET_385",  dayFrom: 11, dayTo: 15,  wheatPct: 0, ownWheat: false },
  { feedProduct: "GROWER_PELLET_485",  dayFrom: 16, dayTo: 24,  wheatPct: 0, ownWheat: false },
  { feedProduct: "FINISHER_PELLET_585", dayFrom: 25, dayTo: null, wheatPct: 0, ownWheat: false },
];

const PRESETS = [
  { label: "1a–8b (16)", bins: ["1a","1b","2a","2b","3a","3b","4a","4b","5a","5b","6a","6b","7a","7b","8a","8b"] },
  { label: "1–16",        bins: Array.from({ length: 16 }, (_, i) => String(i + 1)) },
  { label: "A–P",         bins: Array.from({ length: 16 }, (_, i) => String.fromCharCode(65 + i)) },
];

export default function FeedOrderPage() {
  const [farmId, setFarmId]     = useState("");
  const [myRole, setMyRole]     = useState<FarmRole>("");
  const [houses, setHouses]     = useState<House[]>([]);
  const [savedBins, setSavedBins] = useState<FeedBin[]>([]);

  // Bin config edit state
  const [editingBins, setEditingBins]       = useState(false);
  const [draftBins, setDraftBins]           = useState<{ name: string; capacityTonnes: number }[]>([]);
  const [binCount, setBinCount]             = useState(16);
  const [defaultCapacity, setDefaultCapacity] = useState("13.5");
  const [savingBins, setSavingBins]         = useState(false);

  // House-bin assignment state
  // assignments[houseId] = Set of binIds
  const [assignments, setAssignments]       = useState<Record<string, Set<string>>>({});
  const [savingAssign, setSavingAssign]     = useState(false);

  // Feed phase state
  const [savedPhases, setSavedPhases]     = useState<FeedPhase[]>([]);
  const [editingPhases, setEditingPhases] = useState(false);
  const [draftPhases, setDraftPhases]     = useState<FeedPhase[]>(DEFAULT_PHASES);
  const [savingPhases, setSavingPhases]   = useState(false);

  // Current stock state
  const [activeStock, setActiveStock]       = useState("0");
  const [savingStock, setSavingStock]       = useState(false);

  // Schedule state
  const [scheduleRows, setScheduleRows]     = useState<OrderWeek[]>([]);
  const [scheduleMeta, setScheduleMeta]     = useState<ScheduleMeta | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleWarning, setScheduleWarning] = useState("");

  const [msg, setMsg]       = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const canOperate = canOperateUi(myRole);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fid = getCurrentFarmId();
    if (!fid) return;
    setFarmId(fid);
    fetch(`/api/farms/access/me?farmId=${fid}`).then(r => r.json()).then(d => setMyRole(d.role || "")).catch(() => {});
    fetch(`/api/houses/list?farmId=${fid}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setHouses(d); }).catch(() => {});
    loadBins(fid);
    loadAssignments(fid);
    loadStock(fid);
    loadPhases(fid);
  }, []);

  async function loadPhases(fid: string) {
    const r = await fetch(`/api/feed-phases?farmId=${fid}`);
    const d = await r.json();
    if (Array.isArray(d) && d.length > 0) {
      setSavedPhases(d);
      setDraftPhases(d);
    } else {
      setSavedPhases([]);
      setDraftPhases(DEFAULT_PHASES);
    }
  }

  async function savePhases(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    setSavingPhases(true);
    try {
      const r = await fetch("/api/feed-phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, phases: draftPhases }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error saving.");
      setSavedPhases(d);
      setEditingPhases(false);
      setMsgType("success"); setMsg("Feed phases saved.");
    } catch (err: unknown) {
      setMsgType("error"); setMsg((err as Error).message);
    } finally {
      setSavingPhases(false);
    }
  }

  function updateDraftPhase(i: number, field: keyof FeedPhase, value: string | boolean) {
    setDraftPhases(prev => prev.map((p, j) => {
      if (j !== i) return p;
      if (field === "feedProduct") return { ...p, feedProduct: value as string };
      if (field === "dayFrom") return { ...p, dayFrom: parseInt(value as string) || 0 };
      if (field === "dayTo") return { ...p, dayTo: (value as string) === "" ? null : (parseInt(value as string) || null) };
      if (field === "wheatPct") return { ...p, wheatPct: parseFloat(value as string) || 0 };
      if (field === "ownWheat") return { ...p, ownWheat: value as boolean };
      return p;
    }));
  }

  async function loadStock(fid: string) {
    const r = await fetch(`/api/feed-order-stock?farmId=${fid}`);
    const d = await r.json();
    if (r.ok) {
      setActiveStock(String(d.activeStockTonnes ?? 0));
      if ((d.activeStockTonnes ?? 0) > 0) {
        loadSchedule(fid);
      }
    }
  }

  async function saveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    setSavingStock(true);
    try {
      const r = await fetch("/api/feed-order-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, activeStockTonnes: parseFloat(activeStock) || 0 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error saving stock.");
      setMsgType("success");
      setMsg("Current stock saved.");
      loadSchedule(farmId);
    } catch (err: unknown) {
      setMsgType("error"); setMsg((err as Error).message);
    } finally {
      setSavingStock(false);
    }
  }

  async function loadSchedule(fid: string) {
    setScheduleLoading(true);
    setScheduleWarning("");
    try {
      const r = await fetch(`/api/feed-order/schedule?farmId=${fid}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error loading schedule.");
      setScheduleRows(d.orders ?? []);
      setScheduleMeta(d.meta ?? null);
      if (d.warning) setScheduleWarning(d.warning);
    } catch (err: unknown) {
      setScheduleWarning((err as Error).message);
    } finally {
      setScheduleLoading(false);
    }
  }

  async function loadBins(fid: string) {
    const r = await fetch(`/api/feed-bins?farmId=${fid}`);
    const data = await r.json();
    if (Array.isArray(data)) {
      setSavedBins(data);
      setDraftBins(data.map((b: FeedBin) => ({ name: b.name, capacityTonnes: b.capacityTonnes })));
      setBinCount(data.length);
    }
  }

  async function loadAssignments(fid: string) {
    const r = await fetch(`/api/feed-bin-assignments?farmId=${fid}`);
    const data = await r.json();
    if (data && typeof data === "object") {
      const parsed: Record<string, Set<string>> = {};
      for (const [houseId, binIds] of Object.entries(data)) {
        parsed[houseId] = new Set(binIds as string[]);
      }
      setAssignments(parsed);
    }
  }

  // --- Bin config helpers ---
  function startEdit() {
    setDraftBins(savedBins.map(b => ({ name: b.name, capacityTonnes: b.capacityTonnes })));
    setBinCount(savedBins.length);
    setEditingBins(true);
    setMsg("");
  }

  function cancelEdit() {
    setDraftBins(savedBins.map(b => ({ name: b.name, capacityTonnes: b.capacityTonnes })));
    setBinCount(savedBins.length);
    setEditingBins(false);
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    const cap = parseFloat(defaultCapacity) || 13.5;
    setDraftBins(preset.bins.map(name => ({ name, capacityTonnes: cap })));
    setBinCount(preset.bins.length);
  }

  function applyBinCount(count: number) {
    const cap = parseFloat(defaultCapacity) || 13.5;
    setBinCount(count);
    setDraftBins(prev =>
      count > prev.length
        ? [...prev, ...Array.from({ length: count - prev.length }, () => ({ name: "", capacityTonnes: cap }))]
        : prev.slice(0, count)
    );
  }

  function applyDefaultCapacity(val: string) {
    setDefaultCapacity(val);
    const cap = parseFloat(val);
    if (!cap) return;
    setDraftBins(prev => prev.map(b => ({ ...b, capacityTonnes: cap })));
  }

  function updateDraftBin(i: number, field: "name" | "capacityTonnes", value: string) {
    setDraftBins(prev => prev.map((b, j) =>
      j === i ? { ...b, [field]: field === "capacityTonnes" ? parseFloat(value) || 0 : value } : b
    ));
  }

  async function saveBins(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    if (draftBins.some(b => !b.name.trim())) {
      setMsgType("error"); setMsg("All bins must have a name."); return;
    }
    setSavingBins(true);
    try {
      const r = await fetch("/api/feed-bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, bins: draftBins }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error saving.");
      setSavedBins(data);
      setEditingBins(false);
      setMsgType("success");
      setMsg(`Saved ${data.length} bins.`);
      // Reload assignments in case bin IDs changed
      loadAssignments(farmId);
    } catch (err: unknown) {
      setMsgType("error"); setMsg((err as Error).message);
    } finally {
      setSavingBins(false);
    }
  }

  // --- Assignment helpers ---
  function toggleBinForHouse(houseId: string, binId: string) {
    setAssignments(prev => {
      const next = { ...prev };
      const set = new Set(next[houseId] ?? []);
      if (set.has(binId)) set.delete(binId);
      else set.add(binId);
      next[houseId] = set;
      return next;
    });
  }

  async function toggleClosingStock(binId: string, current: boolean) {
    if (!farmId) return;
    try {
      const r = await fetch("/api/feed-bins/toggle-closing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, binId, isClosingStock: !current }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSavedBins(prev => prev.map(b => b.id === binId ? { ...b, isClosingStock: !current } : b));
    } catch (err: unknown) {
      setMsgType("error"); setMsg((err as Error).message);
    }
  }

  function handleBinTileClick(houseId: string, binId: string, isAssigned: boolean, isClosing: boolean) {
    if (!canOperate) return;
    if (clickTimerRef.current) {
      // Second click within 300ms = double click
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      if (isAssigned) {
        // Toggle closing stock flag (blue → red or red → blue)
        toggleClosingStock(binId, isClosing);
      }
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (isClosing) {
          // Single click on red: remove closing stock flag, keep assigned
          toggleClosingStock(binId, true);
        } else {
          // Single click on gray/blue: toggle assign
          toggleBinForHouse(houseId, binId);
        }
      }, 280);
    }
  }

  async function saveAssignments() {
    if (!farmId) return;
    setSavingAssign(true);
    try {
      const payload = houses.map(h => ({
        houseId: h.id,
        binIds: Array.from(assignments[h.id] ?? []),
      }));
      const r = await fetch("/api/feed-bin-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, assignments: payload }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error saving.");
      setMsgType("success");
      setMsg("House assignments saved.");
    } catch (err: unknown) {
      setMsgType("error"); setMsg((err as Error).message);
    } finally {
      setSavingAssign(false);
    }
  }

  const totalCapacity = (editingBins ? draftBins : savedBins).reduce((s, b) => s + (b.capacityTonnes || 0), 0);

  return (
    <div className="mobile-page">
      <div className="page-shell">

        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Feed</div>
            <h1 className="page-intro__title">Feed Order</h1>
            <p className="page-intro__subtitle">Configure bins and assign them to houses.</p>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <Link href="/feed" className="mobile-button mobile-button--secondary">← Back to Feed</Link>
        </div>

        {msg && (
          <div className={`mobile-alert mobile-alert--${msgType === "success" ? "success" : "error"}`} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* ── SECTION 0: FEED PHASES ── */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Feed Phases</h2>
            {!editingPhases && canOperate && (
              <button className="mobile-button mobile-button--secondary"
                style={{ padding: "4px 14px", fontSize: "0.85rem" }}
                onClick={() => { setDraftPhases(savedPhases.length ? savedPhases : DEFAULT_PHASES); setEditingPhases(true); setMsg(""); }}>
                {savedPhases.length ? "Edit" : "Set up"}
              </button>
            )}
          </div>

          {/* VIEW mode */}
          {!editingPhases && savedPhases.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Feed type</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>From</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>To</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Wheat %</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Own wheat</span>
              </div>
              {savedPhases.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 80px", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{getFeedLabel(p.feedProduct)}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>D{p.dayFrom}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>{p.dayTo != null ? `D${p.dayTo}` : "end"}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>{p.wheatPct > 0 ? `${p.wheatPct}%` : "—"}</span>
                  <span style={{ fontSize: "0.85rem", color: p.ownWheat ? "#1d4ed8" : "#94a3b8", fontWeight: p.ownWheat ? 600 : 400 }}>
                    {p.ownWheat ? "Own" : "Mixed"}
                  </span>
                </div>
              ))}
            </>
          )}

          {!editingPhases && savedPhases.length === 0 && (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
              No feed phases configured yet. {canOperate ? "Click \"Set up\" to define your feed schedule." : ""}
            </p>
          )}

          {/* EDIT mode */}
          {editingPhases && canOperate && (
            <form onSubmit={savePhases}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px 80px 32px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Feed type</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>From</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>To</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Wheat %</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Own wheat</span>
                <span />
              </div>
              {draftPhases.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select value={p.feedProduct} onChange={e => updateDraftPhase(i, "feedProduct", e.target.value)} style={{ margin: 0 }}>
                    {FEED_PRODUCTS.map(fp => (
                      <option key={fp.value} value={fp.value}>{fp.label}</option>
                    ))}
                  </select>
                  <input type="number" min="0" max="60" value={p.dayFrom}
                    onChange={e => updateDraftPhase(i, "dayFrom", e.target.value)}
                    style={{ margin: 0 }} />
                  <input type="number" min="0" max="60" value={p.dayTo ?? ""}
                    placeholder="end"
                    onChange={e => updateDraftPhase(i, "dayTo", e.target.value)}
                    style={{ margin: 0 }} />
                  <input type="number" min="0" max="100" step="1" value={p.wheatPct}
                    onChange={e => updateDraftPhase(i, "wheatPct", e.target.value)}
                    placeholder="0"
                    style={{ margin: 0 }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", cursor: "pointer", margin: 0 }}>
                    <input type="checkbox" checked={p.ownWheat}
                      onChange={e => updateDraftPhase(i, "ownWheat", e.target.checked)} />
                    Own
                  </label>
                  {draftPhases.length > 1 ? (
                    <button type="button"
                      onClick={() => setDraftPhases(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: 0 }}>✕</button>
                  ) : <span />}
                </div>
              ))}
              <button type="button"
                onClick={() => setDraftPhases(prev => [...prev, { feedProduct: "FINISHER_PELLET_585", dayFrom: 0, dayTo: null, wheatPct: 0, ownWheat: false }])}
                style={{ fontSize: "0.8rem", color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "5px 16px", cursor: "pointer", margin: "4px 0 14px", width: "100%" }}>
                + Add phase
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="mobile-button" type="submit" disabled={savingPhases}
                  style={{ background: "#1B3A5C", color: "#fff", flex: 1 }}>
                  {savingPhases ? "Saving..." : "Save Phases"}
                </button>
                <button className="mobile-button mobile-button--secondary" type="button"
                  onClick={() => setEditingPhases(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── SECTION 1: BIN CONFIGURATION ── */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Bin Configuration</h2>
            {!editingBins && canOperate && savedBins.length > 0 && (
              <button className="mobile-button mobile-button--secondary" style={{ padding: "4px 14px", fontSize: "0.85rem" }} onClick={startEdit}>
                Edit
              </button>
            )}
          </div>

          {!editingBins && savedBins.length === 0 && (
            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "0.85rem" }}>
              No bins configured yet. {canOperate ? "Use the form below to set up your bins." : ""}
            </p>
          )}

          {/* VIEW mode */}
          {!editingBins && savedBins.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>#</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Name</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Capacity</span>
              </div>
              {savedBins.map((bin, i) => (
                <div key={bin.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{bin.name}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>{bin.capacityTonnes} t</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: "0.82rem", color: "#64748b" }}>
                {savedBins.length} bins · Total capacity: <strong>{totalCapacity.toFixed(1)} t</strong>
              </div>
            </>
          )}

          {/* EDIT mode */}
          {(editingBins || savedBins.length === 0) && canOperate && (
            <form onSubmit={saveBins}>
              {/* Quick setup tools */}
              <div className="mobile-grid mobile-grid--2" style={{ marginBottom: 12 }}>
                <div>
                  <label>Number of bins</label>
                  <input type="number" min={1} max={64} value={binCount}
                    onChange={e => applyBinCount(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label>Default capacity (t)</label>
                  <input type="number" step="0.5" min={0} value={defaultCapacity}
                    onChange={e => applyDefaultCapacity(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 6 }}>Naming presets:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PRESETS.map(p => (
                    <button key={p.label} type="button"
                      className="mobile-button mobile-button--secondary"
                      style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                      onClick={() => applyPreset(p)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bin rows */}
              <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 120px 32px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>#</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Bin Name</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Capacity (t)</span>
                <span />
              </div>
              {draftBins.map((bin, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr 120px 32px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>{i + 1}</span>
                  <input value={bin.name} onChange={e => updateDraftBin(i, "name", e.target.value)}
                    placeholder={`Bin ${i + 1}`} style={{ margin: 0 }} />
                  <input type="number" step="0.5" min={0} value={bin.capacityTonnes}
                    onChange={e => updateDraftBin(i, "capacityTonnes", e.target.value)} style={{ margin: 0 }} />
                  {draftBins.length > 1 ? (
                    <button type="button"
                      onClick={() => { setDraftBins(prev => prev.filter((_, j) => j !== i)); setBinCount(c => c - 1); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: 0 }}>✕</button>
                  ) : <span />}
                </div>
              ))}
              <button type="button"
                onClick={() => { setDraftBins(prev => [...prev, { name: "", capacityTonnes: parseFloat(defaultCapacity) || 13.5 }]); setBinCount(c => c + 1); }}
                style={{ fontSize: "0.8rem", color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "5px 16px", cursor: "pointer", margin: "4px 0 12px", width: "100%" }}>
                + Add bin
              </button>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 12 }}>
                {draftBins.length} bins · Total capacity: <strong>{totalCapacity.toFixed(1)} t</strong>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="mobile-button" type="submit" disabled={savingBins}
                  style={{ background: "#1B3A5C", color: "#fff", flex: 1 }}>
                  {savingBins ? "Saving..." : "Save Bins"}
                </button>
                {editingBins && (
                  <button className="mobile-button mobile-button--secondary" type="button" onClick={cancelEdit} style={{ flex: 1 }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        {/* ── SECTION 2: HOUSE ASSIGNMENTS ── */}
        {savedBins.length > 0 && houses.length > 0 && (
          <div className="mobile-card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>House → Bin Assignment</h2>
            <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "#64748b" }}>
              Select which bins are connected to each house. A bin can serve multiple houses.
            </p>

            {houses.map(house => (
              <div key={house.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 8, color: "#1e293b" }}>
                  {house.name}{house.code ? ` (${house.code})` : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {savedBins.map(bin => {
                    const isAssigned = assignments[house.id]?.has(bin.id) ?? false;
                    const isClosing = bin.isClosingStock;
                    // Color: red=closing, blue=assigned, gray=not assigned
                    const bg = isClosing ? "#fee2e2" : isAssigned ? "#dbeafe" : "#f8fafc";
                    const border = isClosing ? "#fca5a5" : isAssigned ? "#93c5fd" : "#e2e8f0";
                    const color = isClosing ? "#dc2626" : isAssigned ? "#1d4ed8" : "#475569";
                    return (
                      <div key={bin.id}
                        onClick={() => handleBinTileClick(house.id, bin.id, isAssigned, isClosing)}
                        title={isClosing ? "Closing stock bin — double-click to remove flag" : isAssigned ? "Double-click to mark as closing stock" : "Click to assign"}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          cursor: canOperate ? "pointer" : "default",
                          background: bg, border: `1px solid ${border}`,
                          borderRadius: 8, padding: "6px 12px", fontSize: "0.85rem",
                          fontWeight: (isAssigned || isClosing) ? 600 : 400,
                          color, userSelect: "none", transition: "all 0.15s",
                        }}>
                        {bin.name}
                        <span style={{ fontSize: "0.72rem", color: isClosing ? "#ef4444" : isAssigned ? "#3b82f6" : "#94a3b8" }}>
                          {bin.capacityTonnes}t
                        </span>
                      </div>
                    );
                  })}
                </div>
                {(assignments[house.id]?.size ?? 0) > 0 && (
                  <div style={{ marginTop: 6, fontSize: "0.78rem", color: "#64748b" }}>
                    Total: <strong>
                      {[...assignments[house.id]].reduce((s, bid) => {
                        const b = savedBins.find(x => x.id === bid);
                        return s + (b?.capacityTonnes ?? 0);
                      }, 0).toFixed(1)} t
                    </strong> across {assignments[house.id].size} bin{assignments[house.id].size !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ))}

            {canOperate && (
              <button className="mobile-full-button" onClick={saveAssignments} disabled={savingAssign}>
                {savingAssign ? "Saving..." : "Save House Assignments"}
              </button>
            )}
          </div>
        )}

        {/* ── SECTION 3: CURRENT STOCK ── */}
        {savedBins.length > 0 && (
          <div className="mobile-card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Current Stock</h2>
            <p style={{ margin: "0 0 14px", fontSize: "0.82rem", color: "#64748b" }}>
              Enter current stock levels to generate the delivery schedule.
            </p>
            <form onSubmit={saveStock}>
              <div style={{ marginBottom: 14 }}>
                <label>Active stock (tonnes)</label>
                <input
                  type="number" step="0.1" min="0"
                  value={activeStock}
                  onChange={e => setActiveStock(e.target.value)}
                  placeholder="e.g. 45.5"
                  style={{ maxWidth: 200 }}
                />
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>
                  Total usable feed in active bins right now.
                  Mark closing stock bins in red using the house assignment section above.
                </div>
              </div>
              {savedBins.some(b => b.isClosingStock) && (
                <div style={{ marginBottom: 14, fontSize: "0.82rem", color: "#dc2626" }}>
                  Closing stock bins: <strong>{savedBins.filter(b => b.isClosingStock).map(b => b.name).join(", ")}</strong>
                  {" "}— excluded from order capacity
                </div>
              )}
              {canOperate && (
                <button className="mobile-button" type="submit" disabled={savingStock}
                  style={{ background: "#1B3A5C", color: "#fff" }}>
                  {savingStock ? "Saving..." : "Save & Generate Schedule"}
                </button>
              )}
            </form>
          </div>
        )}

        {/* ── SECTION 4: DELIVERY SCHEDULE ── */}
        {(scheduleRows.length > 0 || scheduleLoading || scheduleWarning) && (
          <div className="mobile-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Delivery Schedule</h2>
              {scheduleMeta && (
                <button className="mobile-button mobile-button--secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 12px" }}
                  onClick={() => loadSchedule(farmId)} disabled={scheduleLoading}>
                  Refresh
                </button>
              )}
            </div>

            {scheduleLoading && <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Calculating...</p>}
            {scheduleWarning && <div className="mobile-alert mobile-alert--error" style={{ marginBottom: 12 }}>{scheduleWarning}</div>}

            {scheduleMeta && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: "0.8rem", color: "#64748b" }}>
                <span>Bin capacity: <strong>{fmt(scheduleMeta.totalBinCapacityTonnes)}t</strong></span>
                <span>Max order: <strong>{fmt(scheduleMeta.maxOrderTonnes)}t</strong></span>
                <span>Trailer: <strong>{scheduleMeta.trailerTonnes}t</strong></span>
                <span>Cycle end: <strong>{fmtDate(scheduleMeta.cycleEnd)}</strong></span>
                {scheduleMeta.closingBins.length > 0 && (
                  <span style={{ color: "#dc2626" }}>Closing bins: <strong>{scheduleMeta.closingBins.join(", ")}</strong></span>
                )}
              </div>
            )}

            {scheduleRows.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {scheduleRows.map((order) => {
                  const finalTuesday = order.coverage[order.coverage.length - 1];
                  const finalOk = order.stockOnFinalTuesdayKg >= 0;
                  return (
                    <div key={order.orderDate}>

                      {/* ── Order header ── */}
                      <div style={{
                        background: "#1B3A5C", color: "#fff",
                        borderRadius: "10px 10px 0 0", padding: "12px 16px",
                        marginBottom: 0,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
                          ORDER: Wednesday {fmtDate(order.orderDate)}
                        </div>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: "0.85rem", opacity: 0.9 }}>
                          <span>Stock now: <strong>{fmt(order.stockOnOrderDayKg / 1000)}t</strong></span>
                          <span>Order total: <strong>{fmt(order.totalOrderKg / 1000)}t</strong>
                            {order.totalTrailers > 0 && ` (${order.totalTrailers} trailer${order.totalTrailers !== 1 ? "s" : ""})`}
                          </span>
                          {order.notes.length > 0 && (
                            <span style={{ color: "#fbbf24" }}>{order.notes.join(" · ")}</span>
                          )}
                        </div>
                      </div>

                      {/* ── Pre-delivery buffer ── */}
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "10px 16px 6px" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Pre-delivery (existing stock)
                        </div>
                        {order.preDelivery.map((day) => (
                          <div key={day.date} style={{
                            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                            padding: "4px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.82rem",
                          }}>
                            <span style={{ fontWeight: 600, color: "#374151", minWidth: 36 }}>{day.dayOfWeek}</span>
                            <span style={{ color: "#64748b", minWidth: 44 }}>{fmtDate(day.date)}</span>
                            <span style={{ color: "#94a3b8", minWidth: 36 }}>D{day.ageMin}</span>
                            <span style={{ color: "#475569", minWidth: 60 }}>{day.birds > 0 ? fmt(day.birds) : "—"}</span>
                            <span style={{ fontWeight: 600, color: "#1e293b", minWidth: 50 }}>{fmt(day.consumptionKg / 1000)}t</span>
                            <span style={{ color: "#64748b" }}>
                              stock: {fmt(day.stockStartKg / 1000)}t
                              <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                              <span style={{ color: day.stockEndKg < 0 ? "#dc2626" : "#374151", fontWeight: day.stockEndKg < 0 ? 700 : 400 }}>
                                {fmt(day.stockEndKg / 1000)}t
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* ── Delivery window ── */}
                      <div style={{ border: "1px solid #e2e8f0", borderTop: "none" }}>
                        <div style={{ background: "#eff6ff", padding: "8px 16px 4px", borderBottom: "1px solid #dbeafe" }}>
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Delivery window (Mon–Fri)
                          </div>
                        </div>
                        {order.deliveryWindow.map((day) => {
                          const hasDelivery = day.deliveryKg > 0;
                          const dow = day.dayOfWeek;
                          // Mon/Tue/Wed = blue, Thu/Fri = amber
                          const isEarlyWeek = dow === "Mon" || dow === "Tue" || dow === "Wed";
                          const delivColor = isEarlyWeek ? "#1d4ed8" : "#b45309";
                          const delivBg = isEarlyWeek ? "#dbeafe" : "#fef3c7";
                          const delivBorder = isEarlyWeek ? "#93c5fd" : "#fcd34d";

                          return (
                            <div key={day.date} style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: hasDelivery ? (isEarlyWeek ? "#eff6ff" : "#fffbeb") : "#fff",
                            }}>
                              {/* Day summary row */}
                              <div style={{
                                display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                                padding: "6px 16px", fontSize: "0.82rem",
                              }}>
                                <span style={{ fontWeight: 700, color: hasDelivery ? delivColor : "#374151", minWidth: 36 }}>{day.dayOfWeek}</span>
                                <span style={{ color: "#64748b", minWidth: 44 }}>{fmtDate(day.date)}</span>
                                <span style={{ color: "#94a3b8", minWidth: 36 }}>D{day.ageMin}</span>
                                <span style={{ color: "#475569", minWidth: 60 }}>{day.birds > 0 ? fmt(day.birds) : "—"}</span>
                                {hasDelivery ? (
                                  <span style={{
                                    background: delivBg, border: `1px solid ${delivBorder}`,
                                    color: delivColor, borderRadius: 6, padding: "2px 10px",
                                    fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap",
                                  }}>
                                    DELIVERY +{fmt(day.deliveryKg / 1000)}t
                                  </span>
                                ) : (
                                  <span style={{ color: "#cbd5e1", fontSize: "0.78rem", fontStyle: "italic" }}>no delivery</span>
                                )}
                                <span style={{ color: "#475569", marginLeft: "auto" }}>
                                  use: <strong>{fmt(day.consumptionKg / 1000)}t</strong>
                                </span>
                                <span style={{ color: "#64748b" }}>
                                  {hasDelivery
                                    ? `${fmt(day.stockBeforeKg / 1000)}t + ${fmt(day.deliveryKg / 1000)}t = ${fmt(day.stockAfterDeliveryKg / 1000)}t`
                                    : `${fmt(day.stockBeforeKg / 1000)}t`
                                  }
                                  <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                                  <span style={{ color: day.stockEndKg < 0 ? "#dc2626" : "#374151", fontWeight: day.stockEndKg < 0 ? 700 : 400 }}>
                                    {fmt(day.stockEndKg / 1000)}t
                                  </span>
                                </span>
                              </div>

                              {/* Trailer breakdown */}
                              {hasDelivery && day.trailers.length > 0 && (
                                <div style={{ padding: "4px 16px 10px 52px", display: "flex", flexDirection: "column", gap: 6 }}>
                                  {day.trailers.map((trailer, ti) => (
                                    <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <span style={{
                                        background: delivColor, color: "#fff",
                                        borderRadius: 5, padding: "2px 9px",
                                        fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap",
                                      }}>
                                        Trailer {ti + 1}
                                      </span>
                                      {trailer.feeds.map((f, fi) => (
                                        <span key={fi} style={{
                                          background: "#fff",
                                          border: `1px solid ${delivBorder}`,
                                          borderRadius: 5, padding: "2px 10px",
                                          fontSize: "0.82rem", fontWeight: 600, color: "#1e293b",
                                        }}>
                                          {getFeedLabel(f.feedProduct)} — {f.tonnes}t
                                        </span>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Coverage through Tuesday ── */}
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "10px 16px 6px", borderRadius: "0 0 10px 10px" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Coverage through Tuesday
                        </div>
                        {order.coverage.map((day, ci) => {
                          const isFinalTuesday = ci === order.coverage.length - 1;
                          return (
                            <div key={day.date} style={{
                              display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                              padding: "4px 0", borderBottom: isFinalTuesday ? "none" : "1px solid #f1f5f9", fontSize: "0.82rem",
                            }}>
                              <span style={{ fontWeight: 600, color: "#374151", minWidth: 36 }}>{day.dayOfWeek}</span>
                              <span style={{ color: "#64748b", minWidth: 44 }}>{fmtDate(day.date)}</span>
                              <span style={{ color: "#94a3b8", minWidth: 36 }}>D{day.ageMin}</span>
                              <span style={{ color: "#475569", minWidth: 60 }}>{day.birds > 0 ? fmt(day.birds) : "—"}</span>
                              <span style={{ fontWeight: 600, color: "#1e293b", minWidth: 50 }}>{fmt(day.consumptionKg / 1000)}t</span>
                              <span style={{ color: "#64748b" }}>
                                {fmt(day.stockStartKg / 1000)}t
                                <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                                <span style={{ color: day.stockEndKg < 0 ? "#dc2626" : "#374151", fontWeight: (isFinalTuesday || day.stockEndKg < 0) ? 700 : 400 }}>
                                  {fmt(day.stockEndKg / 1000)}t
                                </span>
                              </span>
                              {isFinalTuesday && (
                                <span style={{
                                  marginLeft: 4, fontWeight: 700,
                                  color: finalOk ? "#16a34a" : "#dc2626",
                                  fontSize: "1rem",
                                }}>
                                  {finalOk ? "✓" : "⚠"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {finalTuesday && (
                          <div style={{ marginTop: 8, fontSize: "0.78rem", color: finalOk ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                            {finalOk
                              ? `Stock at Tuesday end: ${fmt(order.stockOnFinalTuesdayKg / 1000)}t — sufficient`
                              : `Stock deficit at Tuesday end: ${fmt(order.stockOnFinalTuesdayKg / 1000)}t — order more`
                            }
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
