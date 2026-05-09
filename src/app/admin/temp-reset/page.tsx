"use client";

import { useState } from "react";

export default function TempResetPage() {
  const [secret, setSecret]           = useState("");
  const [email, setEmail]             = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg]                 = useState("");
  const [ok, setOk]                   = useState(false);
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/temp-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, email, newPassword }),
      });
      const data = await r.json();
      if (r.ok) {
        setOk(true);
        setMsg(data.message || "Password reset successfully.");
      } else {
        setOk(false);
        setMsg(data.error || "Error.");
      }
    } catch {
      setOk(false);
      setMsg("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "Arial, sans-serif", padding: "0 16px" }}>
      <h1 style={{ fontSize: 20, marginBottom: 24 }}>Temporary Password Reset</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Secret</label>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>User email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>New password (min 6 chars)</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px", background: "#1B3A5C", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer" }}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
      {msg && (
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 6, background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#991b1b", fontSize: 14 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
