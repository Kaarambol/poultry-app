"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COLORS, PAGE_LABELS, PageColors, isDark, mergeWithDefaults } from "@/lib/color-defaults";

type AllColors = Record<string, PageColors>;

export default function ColorSettingsPage() {
  const [colors, setColors] = useState<AllColors>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/colors")
      .then(r => r.json())
      .then(data => { setColors(data); setLoading(false); })
      .catch(() => { setColors(mergeWithDefaults({})); setLoading(false); });
  }, []);

  function setPageColor(key: string, field: "bg" | "nav", value: string) {
    setColors(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  function resetPage(key: string) {
    setColors(prev => ({
      ...prev,
      [key]: { ...DEFAULT_COLORS[key] },
    }));
  }

  function resetAll() {
    setColors(mergeWithDefaults({}));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/settings/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors }),
      });
      if (r.ok) {
        setMsg({ text: "Colors saved! Reload the page to see changes.", ok: true });
        // Update CSS vars immediately
        for (const [key, val] of Object.entries(colors)) {
          document.documentElement.style.setProperty(`--color-bg-${key}`, val.bg);
          document.documentElement.style.setProperty(`--color-nav-${key}`, val.nav);
        }
        localStorage.setItem("userColors", JSON.stringify(colors));
      } else {
        setMsg({ text: "Error saving colors.", ok: false });
      }
    } catch {
      setMsg({ text: "Network error.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mobile-page"><div className="page-shell"><div className="mobile-card">Loading...</div></div></div>;

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Personalisation</div>
            <h1 className="page-intro__title">Color Settings</h1>
            <p className="page-intro__subtitle">Choose background and button colours for each section of the app.</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="mobile-card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="mobile-full-button"
            style={{ flex: 1, minWidth: 140 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save All Colors"}
          </button>
          <button
            type="button"
            onClick={resetAll}
            style={{ flex: 1, minWidth: 140, padding: "13px", background: "#f1f5f9", border: "1px solid #dbe3ee", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            Reset All to Default
          </button>
        </div>

        {msg && (
          <div className={`mobile-alert mobile-alert--${msg.ok ? "success" : "error"}`} style={{ marginBottom: 16 }}>
            {msg.text}
          </div>
        )}

        {/* Color cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {Object.entries(PAGE_LABELS).map(([key, label]) => {
            const c = colors[key] ?? DEFAULT_COLORS[key] ?? { bg: "#f6f8fb", nav: "#f1f5f9" };
            const bgDark = isDark(c.bg);
            const navDark = isDark(c.nav);
            return (
              <div key={key} className="mobile-card" style={{ marginBottom: 0 }}>
                {/* Preview header */}
                <div style={{
                  background: c.bg,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: bgDark ? "#fff" : "#122033" }}>{label}</span>
                  <span style={{
                    background: c.nav,
                    color: navDark ? "#fff" : "#122033",
                    padding: "4px 12px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}>Button</span>
                </div>

                {/* BG color */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", display: "block", marginBottom: 4 }}>
                    Page Background
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={c.bg}
                      onChange={e => setPageColor(key, "bg", e.target.value)}
                      style={{ width: 44, height: 36, border: "1px solid #dbe3ee", borderRadius: 6, cursor: "pointer", padding: 2 }}
                    />
                    <input
                      type="text"
                      value={c.bg}
                      onChange={e => setPageColor(key, "bg", e.target.value)}
                      style={{ flex: 1, padding: "6px 10px", border: "1px solid #dbe3ee", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace" }}
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Nav button color */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5d6b82", display: "block", marginBottom: 4 }}>
                    Nav Button Color
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={c.nav}
                      onChange={e => setPageColor(key, "nav", e.target.value)}
                      style={{ width: 44, height: 36, border: "1px solid #dbe3ee", borderRadius: 6, cursor: "pointer", padding: 2 }}
                    />
                    <input
                      type="text"
                      value={c.nav}
                      onChange={e => setPageColor(key, "nav", e.target.value)}
                      style={{ flex: 1, padding: "6px 10px", border: "1px solid #dbe3ee", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace" }}
                      maxLength={7}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => resetPage(key)}
                  style={{ width: "100%", padding: "6px", background: "transparent", border: "1px solid #dbe3ee", borderRadius: 6, fontSize: "0.75rem", color: "#5d6b82", cursor: "pointer" }}
                >
                  Reset to default
                </button>
              </div>
            );
          })}
        </div>

        {/* Save again at bottom */}
        <div style={{ marginTop: 20 }}>
          {msg && (
            <div className={`mobile-alert mobile-alert--${msg.ok ? "success" : "error"}`} style={{ marginBottom: 12 }}>
              {msg.text}
            </div>
          )}
          <button
            className="mobile-full-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save All Colors"}
          </button>
        </div>
      </div>
    </div>
  );
}
