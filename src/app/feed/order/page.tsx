"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, canOperateUi } from "@/lib/ui-permissions";

type FeedBin = {
  id: string;
  name: string;
  capacityTonnes: number;
};

type House = {
  id: string;
  name: string;
  code: string | null;
};

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

  const [msg, setMsg]       = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const canOperate = canOperateUi(myRole);

  useEffect(() => {
    const fid = getCurrentFarmId();
    if (!fid) return;
    setFarmId(fid);
    fetch(`/api/farms/access/me?farmId=${fid}`).then(r => r.json()).then(d => setMyRole(d.role || "")).catch(() => {});
    fetch(`/api/houses/list?farmId=${fid}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setHouses(d); }).catch(() => {});
    loadBins(fid);
    loadAssignments(fid);
  }, []);

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
                    const checked = assignments[house.id]?.has(bin.id) ?? false;
                    return (
                      <label key={bin.id} style={{
                        display: "flex", alignItems: "center", gap: 6, cursor: canOperate ? "pointer" : "default",
                        background: checked ? "#dbeafe" : "#f8fafc",
                        border: `1px solid ${checked ? "#93c5fd" : "#e2e8f0"}`,
                        borderRadius: 8, padding: "6px 12px", fontSize: "0.85rem", fontWeight: checked ? 600 : 400,
                        color: checked ? "#1d4ed8" : "#475569",
                        userSelect: "none",
                      }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => canOperate && toggleBinForHouse(house.id, bin.id)}
                          style={{ display: "none" }}
                        />
                        {bin.name}
                        <span style={{ fontSize: "0.72rem", color: checked ? "#3b82f6" : "#94a3b8" }}>
                          {bin.capacityTonnes}t
                        </span>
                      </label>
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

      </div>
    </div>
  );
}
