"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, canOperateUi } from "@/lib/ui-permissions";

type FeedBin = {
  id?: string;
  name: string;
  capacityTonnes: number;
};

const PRESETS = [
  { label: "1a–8b (16 bins)", bins: ["1a","1b","2a","2b","3a","3b","4a","4b","5a","5b","6a","6b","7a","7b","8a","8b"] },
  { label: "1–16 (numbers)", bins: Array.from({ length: 16 }, (_, i) => String(i + 1)) },
  { label: "A–P (letters)",  bins: Array.from({ length: 16 }, (_, i) => String.fromCharCode(65 + i)) },
];

export default function FeedOrderPage() {
  const [farmId, setFarmId] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [bins, setBins] = useState<FeedBin[]>([{ name: "", capacityTonnes: 13.5 }]);
  const [binCount, setBinCount] = useState(16);
  const [defaultCapacity, setDefaultCapacity] = useState("13.5");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  useEffect(() => {
    const fid = getCurrentFarmId();
    if (!fid) return;
    setFarmId(fid);

    fetch(`/api/farms/access/me?farmId=${fid}`)
      .then(r => r.json())
      .then(d => setMyRole(d.role || ""))
      .catch(() => {});

    fetch(`/api/feed-bins?farmId=${fid}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBins(data.map((b: FeedBin) => ({ name: b.name, capacityTonnes: b.capacityTonnes })));
          setBinCount(data.length);
        }
      })
      .catch(() => {});
  }, []);

  const canOperate = canOperateUi(myRole);

  function applyPreset(preset: typeof PRESETS[0]) {
    const cap = parseFloat(defaultCapacity) || 13.5;
    setBins(preset.bins.map(name => ({ name, capacityTonnes: cap })));
    setBinCount(preset.bins.length);
  }

  function applyBinCount(count: number) {
    const cap = parseFloat(defaultCapacity) || 13.5;
    setBinCount(count);
    setBins(prev => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, () => ({ name: "", capacityTonnes: cap })),
        ];
      }
      return prev.slice(0, count);
    });
  }

  function applyDefaultCapacity(val: string) {
    setDefaultCapacity(val);
    const cap = parseFloat(val);
    if (!cap) return;
    setBins(prev => prev.map(b => ({ ...b, capacityTonnes: cap })));
  }

  function updateBin(i: number, field: "name" | "capacityTonnes", value: string) {
    setBins(prev => prev.map((b, j) =>
      j === i ? { ...b, [field]: field === "capacityTonnes" ? parseFloat(value) || 0 : value } : b
    ));
  }

  function addBin() {
    const cap = parseFloat(defaultCapacity) || 13.5;
    setBins(prev => [...prev, { name: "", capacityTonnes: cap }]);
    setBinCount(c => c + 1);
  }

  function removeBin(i: number) {
    setBins(prev => prev.filter((_, j) => j !== i));
    setBinCount(c => c - 1);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    const invalid = bins.some(b => !b.name.trim());
    if (invalid) {
      setMsgType("error");
      setMsg("All bins must have a name.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/feed-bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId, bins }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error saving.");
      setMsgType("success");
      setMsg(`Saved ${data.length} bins.`);
    } catch (err: any) {
      setMsgType("error");
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalCapacity = bins.reduce((s, b) => s + (b.capacityTonnes || 0), 0);

  return (
    <div className="mobile-page">
      <div className="page-shell">

        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Feed</div>
            <h1 className="page-intro__title">Feed Order</h1>
            <p className="page-intro__subtitle">
              Configure your feed bin system — names, count and capacity.
            </p>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <Link href="/feed" className="mobile-button mobile-button--secondary">
            ← Back to Feed
          </Link>
        </div>

        {msg && (
          <div className={`mobile-alert mobile-alert--${msgType === "success" ? "success" : "error"}`} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* Quick setup */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Quick Setup</h2>

          <div className="mobile-grid mobile-grid--2">
            <div>
              <label>Number of bins</label>
              <input
                type="number"
                min={1}
                max={64}
                value={binCount}
                onChange={e => applyBinCount(parseInt(e.target.value) || 1)}
                disabled={!canOperate}
              />
            </div>
            <div>
              <label>Default capacity (tonnes)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                value={defaultCapacity}
                onChange={e => applyDefaultCapacity(e.target.value)}
                disabled={!canOperate}
              />
            </div>
          </div>

          {canOperate && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 6 }}>Naming presets:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="mobile-button mobile-button--secondary"
                    style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bin list */}
        <form onSubmit={save}>
          <div className="mobile-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Bins ({bins.length})</h2>
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Total capacity: <strong>{totalCapacity.toFixed(1)} t</strong>
              </span>
            </div>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px 36px", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>#</span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Bin Name</span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Capacity (t)</span>
              <span />
            </div>

            {bins.map((bin, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 140px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center" }}>{i + 1}</span>
                <input
                  value={bin.name}
                  onChange={e => updateBin(i, "name", e.target.value)}
                  placeholder={`Bin ${i + 1}`}
                  disabled={!canOperate}
                  style={{ margin: 0 }}
                />
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={bin.capacityTonnes}
                  onChange={e => updateBin(i, "capacityTonnes", e.target.value)}
                  disabled={!canOperate}
                  style={{ margin: 0 }}
                />
                {canOperate && bins.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeBin(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: 0, lineHeight: 1 }}
                  >✕</button>
                ) : <span />}
              </div>
            ))}

            {canOperate && (
              <button
                type="button"
                onClick={addBin}
                style={{ fontSize: "0.8rem", color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "6px 16px", cursor: "pointer", marginTop: 4, width: "100%" }}
              >
                + Add bin
              </button>
            )}
          </div>

          {canOperate && (
            <button className="mobile-full-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Bin Configuration"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
