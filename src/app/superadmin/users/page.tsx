"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type FarmAccess = { role: string; farm: { id: string; name: string; code: string } };
type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  farmUsers: FarmAccess[];
};

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/users")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setUsers(d);
        else setError(d.error || "Error loading users.");
      })
      .catch(() => setError("Connection error."))
      .finally(() => setLoading(false));
  }, []);

  function openReset(user: UserRow) {
    setResetUserId(user.id);
    setResetEmail(user.email);
    setNewPassword("");
    setResetMsg("");
  }

  async function handleReset() {
    if (!resetUserId) return;
    if (newPassword.length < 6) { setResetMsg("Min. 6 znaków."); return; }
    setResetLoading(true);
    setResetMsg("");
    try {
      const r = await fetch(`/api/superadmin/users/${resetUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const d = await r.json();
      if (r.ok) {
        setResetMsg("Hasło zmienione.");
        setNewPassword("");
      } else {
        setResetMsg(d.error || "Błąd.");
      }
    } catch {
      setResetMsg("Błąd połączenia.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">SuperAdmin</div>
            <h1 className="page-intro__title">Użytkownicy</h1>
            <p className="page-intro__subtitle">
              Lista wszystkich kont — reset hasła, podgląd farm.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Link href="/superadmin/forum" className="mobile-button mobile-button--secondary" style={{ display: "inline-flex" }}>
                Forum →
              </Link>
            </div>
          </div>
        </div>

        {loading && <div className="mobile-card" style={{ color: "#64748b" }}>Ładowanie…</div>}
        {error && <div className="mobile-alert mobile-alert--error">{error}</div>}

        {!loading && !error && (
          <div className="mobile-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Email / Nazwa</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Farmy</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f0f4f8" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>
                          {u.email}
                          {u.isSuperAdmin && (
                            <span style={{ marginLeft: 6, fontSize: "0.68rem", background: "#7c3aed", color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                              SUPERADMIN
                            </span>
                          )}
                        </div>
                        {u.name && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{u.name}</div>}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {u.farmUsers.length === 0
                          ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>brak</span>
                          : u.farmUsers.map(f => (
                            <div key={f.farm.id} style={{ fontSize: "0.75rem", color: "#475569" }}>
                              {f.farm.name} ({f.farm.code}) — <span style={{ color: "#2563eb" }}>{f.role}</span>
                            </div>
                          ))
                        }
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => openReset(u)}
                          style={{
                            padding: "5px 12px", borderRadius: 6, fontSize: "0.75rem",
                            border: "1px solid #dbe3ee", background: "#fff",
                            color: "#2563eb", fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          Reset hasła
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal reset hasła */}
        {resetUserId && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: "90%", maxWidth: 400 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>Reset hasła</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 16 }}>{resetEmail}</div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>Nowe hasło (min. 6 znaków)</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ width: "100%", marginTop: 6, marginBottom: 12, boxSizing: "border-box" }}
                placeholder="Nowe hasło"
              />
              {resetMsg && (
                <div style={{
                  marginBottom: 10, fontSize: "0.8rem", padding: "6px 10px", borderRadius: 6,
                  background: resetMsg === "Hasło zmienione." ? "#f0fdf4" : "#fef2f2",
                  color: resetMsg === "Hasło zmienione." ? "#16a34a" : "#b91c1c",
                }}>
                  {resetMsg}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetLoading}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                    background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
                  }}
                >
                  {resetLoading ? "Zapisywanie…" : "Zmień hasło"}
                </button>
                <button
                  type="button"
                  onClick={() => setResetUserId(null)}
                  style={{
                    padding: "10px 18px", borderRadius: 8,
                    border: "1px solid #dbe3ee", background: "#fff",
                    color: "#475569", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
