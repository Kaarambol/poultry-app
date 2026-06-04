"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; email: string; name: string | null };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // AI Query state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ sql: string; rows: Record<string, unknown>[]; count: number } | null>(null);
  const [aiError, setAiError] = useState("");

  async function handleAiQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const r = await fetch("/api/admin/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const data = await r.json();
      if (!r.ok) {
        setAiError(data.error || "Error.");
        if (data.sql) setAiResult({ sql: data.sql, rows: [], count: 0 });
      } else {
        setAiResult(data);
      }
    } catch {
      setAiError("Connection error.");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json();
      })
      .then(data => {
        if (data) setUsers(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setSaving(true);
    setResetMsg(null);
    const r = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resetUserId, newPassword }),
    });
    const data = await r.json();
    setSaving(false);
    if (r.ok) {
      setResetMsg({ ok: true, text: "Password updated." });
      setNewPassword("");
      setResetUserId(null);
    } else {
      setResetMsg({ ok: false, text: data.error || "Error." });
    }
  }

  if (loading) return <div className="mobile-page"><div className="page-shell"><p>Loading...</p></div></div>;

  if (forbidden) return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="mobile-alert mobile-alert--error">Access denied. Admin only.</div>
        <Link href="/dashboard" className="mobile-button mobile-button--secondary" style={{ marginTop: 16 }}>Back</Link>
      </div>
    </div>
  );

  const resetTarget = users.find(u => u.id === resetUserId);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Administration</div>
            <h1 className="page-intro__title">User Management</h1>
          </div>
        </div>

        <div className="mobile-card" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="mobile-button mobile-button--secondary">Back to Dashboard</Link>
          <Link href="/admin/reports" className="mobile-button mobile-button--primary">Reports</Link>
        </div>

        {resetMsg && (
          <div className={`mobile-alert ${resetMsg.ok ? "mobile-alert--success" : "mobile-alert--error"}`} style={{ marginBottom: 12 }}>
            {resetMsg.text}
          </div>
        )}

        <div className="mobile-card">
          <h2 style={{ margin: "0 0 16px", fontSize: "1rem" }}>Users ({users.length})</h2>
          {users.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-soft)" }}>No users found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ background: "var(--bg)", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Email</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>Name</th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px" }}>{u.email}</td>
                    <td style={{ padding: "8px", color: "var(--text-soft)" }}>{u.name || "—"}</td>
                    <td style={{ padding: "8px" }}>
                      <button
                        className="mobile-button mobile-button--secondary"
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                        onClick={() => { setResetUserId(u.id); setNewPassword(""); setResetMsg(null); }}
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {resetTarget && (
          <div className="mobile-card">
            <h2 style={{ margin: "0 0 12px", fontSize: "1rem" }}>
              Reset password — <span style={{ color: "var(--primary)" }}>{resetTarget.email}</span>
            </h2>
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
                  New password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="mobile-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="mobile-button mobile-button--primary" disabled={saving}>
                  {saving ? "Saving..." : "Set new password"}
                </button>
                <button type="button" className="mobile-button mobile-button--secondary" onClick={() => setResetUserId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── AI Data Query ── */}
        <div className="mobile-card" style={{ marginTop: 8 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1rem" }}>AI Data Query</h2>
          <p style={{ margin: "0 0 14px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
            Ask a question in plain English or Polish. AI will generate and run a SQL query across all farms.
          </p>
          <form onSubmit={handleAiQuery} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              placeholder="e.g. Show 3-day mortality for all Avara farms this year&#10;e.g. Jakie farmy mają więcej niż 10000m² powierzchni?"
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.9rem", resize: "vertical", boxSizing: "border-box" }}
            />
            <button
              type="submit"
              className="mobile-button"
              disabled={aiLoading || !aiQuestion.trim()}
              style={{ background: "#1B3A5C", color: "#fff" }}
            >
              {aiLoading ? "Thinking..." : "Ask AI"}
            </button>
          </form>

          {aiError && (
            <div className="mobile-alert mobile-alert--error" style={{ marginTop: 12 }}>
              {aiError}
            </div>
          )}

          {aiResult && (
            <div style={{ marginTop: 16 }}>
              {/* Generated SQL */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Generated SQL
                </div>
                <pre style={{
                  background: "#1e293b", color: "#e2e8f0", borderRadius: 8,
                  padding: "10px 14px", fontSize: "0.75rem", overflowX: "auto",
                  margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  {aiResult.sql}
                </pre>
              </div>

              {/* Results */}
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Results ({aiResult.count} row{aiResult.count !== 1 ? "s" : ""})
              </div>
              {aiResult.rows.length === 0 ? (
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>No results.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {Object.keys(aiResult.rows[0]).map(col => (
                          <th key={col} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aiResult.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} style={{ padding: "6px 10px", color: "#1e293b" }}>
                              {val === null ? <span style={{ color: "#94a3b8" }}>—</span> : String(val)}
                            </td>
                          ))}
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
    </div>
  );
}
