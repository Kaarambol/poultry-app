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

        <div className="mobile-card">
          <Link href="/dashboard" className="mobile-button mobile-button--secondary">Back to Dashboard</Link>
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
      </div>
    </div>
  );
}
