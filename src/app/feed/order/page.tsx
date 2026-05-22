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

type WeekRow = {
  wednesday: string;
  weekStart: string;
  weekEnd: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  totalBirdsAvg: number;
  weeklyConsumptionKg: number;
  stockBeforeKg: number;
  orderNeededKg: number;
  orderNeededTonnes: number;
  closingUnlockedKg: number;
  stockAfterKg: number;
  feedProducts: string[];
  notes: string[];
};

type ScheduleMeta = {
  totalBinCapacityTonnes: number;
  maxOrderTonnes: number;
  cycleEnd: string;
  closingBins: string[];
  activeStockTonnes: number;
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
};

const DEFAULT_PHASES: FeedPhase[] = [
  { feedProduct: "STARTER_CRUMB_185",  dayFrom: 0,  dayTo: 10 },
  { feedProduct: "REARER_PELLET_385",  dayFrom: 11, dayTo: 15 },
  { feedProduct: "GROWER_PELLET_485",  dayFrom: 16, dayTo: 24 },
  { feedProduct: "FINISHER_PELLET_585", dayFrom: 25, dayTo: null },
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
  const [scheduleRows, setScheduleRows]     = useState<WeekRow[]>([]);
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
    } catch (err: any) {
      setMsgType("error"); setMsg(err.message);
    } finally {
      setSavingPhases(false);
    }
  }

  function updateDraftPhase(i: number, field: keyof FeedPhase, value: string) {
    setDraftPhases(prev => prev.map((p, j) => {
      if (j !== i) return p;
      if (field === "feedProduct") return { ...p, feedProduct: value };
      if (field === "dayFrom") return { ...p, dayFrom: parseInt(value) || 0 };
      if (field === "dayTo") return { ...p, dayTo: value === "" ? null : (parseInt(value) || null) };
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
    } catch (err: any) {
      setMsgType("error"); setMsg(err.message);
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
      setScheduleRows(d.rows ?? []);
      setScheduleMeta(d.meta ?? null);
      if (d.warning) setScheduleWarning(d.warning);
    } catch (err: any) {
      setScheduleWarning(err.message);
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
    } catch (err: any) {
      setMsgType("error"); setMsg(err.message);
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
    } catch (err: any) {
      setMsgType("error"); setMsg(err.message);
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
    } catch (err: any) {
      setMsgType("error"); setMsg(err.message);
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Feed type</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>From (day)</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>To (day)</span>
              </div>
              {savedPhases.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>{getFeedLabel(p.feedProduct)}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>D{p.dayFrom}</span>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>{p.dayTo != null ? `D${p.dayTo}` : "end"}</span>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 32px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Feed type</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>From day</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>To day</span>
                <span />
              </div>
              {draftPhases.map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
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
                  {draftPhases.length > 1 ? (
                    <button type="button"
                      onClick={() => setDraftPhases(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: 0 }}>✕</button>
                  ) : <span />}
                </div>
              ))}
              <button type="button"
                onClick={() => setDraftPhases(prev => [...prev, { feedProduct: "FINISHER_PELLET_585", dayFrom: 0, dayTo: null }])}
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
                <button
                  className="mobile-button mobile-button--secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 12px" }}
                  onClick={() => loadSchedule(farmId)}
                  disabled={scheduleLoading}
                >
                  Refresh
                </button>
              )}
            </div>

            {scheduleLoading && <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Calculating...</p>}
            {scheduleWarning && (
              <div className="mobile-alert mobile-alert--error" style={{ marginBottom: 12 }}>{scheduleWarning}</div>
            )}

            {scheduleMeta && (
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14, fontSize: "0.8rem", color: "#64748b" }}>
                <span>Bin capacity: <strong>{fmt(scheduleMeta.totalBinCapacityTonnes)}t</strong></span>
                <span>Max order: <strong>{fmt(scheduleMeta.maxOrderTonnes)}t</strong> (80%)</span>
                <span>Cycle end: <strong>{fmtDate(scheduleMeta.cycleEnd)}</strong></span>
                {scheduleMeta.closingBins.length > 0 && (
                  <span style={{ color: "#dc2626" }}>Closing bins: <strong>{scheduleMeta.closingBins.join(", ")}</strong></span>
                )}
              </div>
            )}

            {scheduleRows.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Order Wed</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Covers</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Age</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Feed type</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Birds</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Weekly (t)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Stock before (t)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", color: "#1d4ed8", fontWeight: 700 }}>Order (t)</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>Stock after (t)</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, i) => {
                      const stockLow = row.stockBeforeKg < row.weeklyConsumptionKg * 0.5;
                      const needsOrder = row.orderNeededKg > 0;
                      return (
                        <tr key={row.wednesday} style={{
                          background: needsOrder ? "#eff6ff" : (i % 2 === 0 ? "#fff" : "#fafafa"),
                          borderBottom: "1px solid #f1f5f9",
                        }}>
                          <td style={{ padding: "7px 10px", fontWeight: 700, color: needsOrder ? "#1d4ed8" : "#374151", whiteSpace: "nowrap" }}>
                            {fmtDate(row.wednesday)}
                          </td>
                          <td style={{ padding: "7px 10px", color: "#64748b", whiteSpace: "nowrap", fontSize: "0.77rem" }}>
                            {fmtDate(row.weekStart)}–{fmtDate(row.weekEnd)}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#475569", whiteSpace: "nowrap" }}>
                            D{row.ageRangeStart}–D{row.ageRangeEnd}
                          </td>
                          <td style={{ padding: "7px 10px", fontSize: "0.75rem", color: "#475569" }}>
                            {row.feedProducts.map(fp => getFeedLabel(fp)).join(", ") || "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#475569" }}>
                            {row.totalBirdsAvg > 0 ? fmt(row.totalBirdsAvg) : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right" }}>
                            {fmt(row.weeklyConsumptionKg / 1000)}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: stockLow ? "#dc2626" : "#374151", fontWeight: stockLow ? 700 : 400 }}>
                            {fmt(row.stockBeforeKg / 1000)}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: needsOrder ? "#1d4ed8" : "#94a3b8" }}>
                            {needsOrder ? fmt(row.orderNeededTonnes) : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", color: "#475569" }}>
                            {fmt(row.stockAfterKg / 1000)}
                          </td>
                          <td style={{ padding: "7px 10px", color: "#64748b", fontSize: "0.75rem" }}>
                            {row.notes.join(" · ") || ""}
                          </td>
                        </tr>
                      );
                    })}
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
