"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=1920&q=80";

export default function RegisterPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg]           = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();
    setLoading(false);

    if (!r.ok) {
      setMsg(data.error || "Registration error.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Left ad column ── */}
      <aside style={adColumnStyle}>
        <AdSlot label="Ad 1" width={160} height={600} />
        <AdSlot label="Ad 2" width={160} height={300} />
      </aside>

      {/* ── Hero panel ── */}
      <div style={{
        flex: 1,
        background: `linear-gradient(rgba(10,30,10,0.55), rgba(10,30,10,0.7)), url(${HERO_IMAGE_URL}) center/cover no-repeat`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 48px",
        color: "#fff",
        minWidth: 0,
      }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a3e6a3", marginBottom: 16 }}>
            Poultry Management Platform
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 20px" }}>
            Join thousands<br />of poultry farmers.
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "#d4efd4", marginBottom: 32 }}>
            Get full access to real-time flock tracking, automatic alerts, performance benchmarking and document management.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ["🐔", "Track every house & batch in real-time"],
              ["📊", "Feed, water & mortality analytics"],
              ["📋", "Compliance & document management"],
              ["🔔", "Expiry and review alerts"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.9rem", color: "#d4efd4" }}>
                <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div style={{
        width: "clamp(340px, 38%, 480px)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "48px 40px",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a7a5a", marginBottom: 8 }}>
            Get started — it&apos;s free
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#1a2e1a" }}>Create account</h2>
        </div>

        {success ? (
          <div style={{ background: "#f0fff0", border: "1px solid #90e090", borderRadius: 8, padding: "16px 18px", textAlign: "center", color: "#1f5c1f" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✓</div>
            <strong>Account created!</strong>
            <p style={{ margin: "6px 0 0", fontSize: "0.875rem" }}>Redirecting to login…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={labelStyle}>Email address</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password <span style={{ color: "#888", fontWeight: 400 }}>(min 6 characters)</span></label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            {msg && (
              <div style={{ background: "#fff0f0", border: "1px solid #f5b8b8", borderRadius: 8, padding: "10px 14px", fontSize: "0.875rem", color: "#b00020" }}>
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={submitButtonStyle}
            >
              {loading ? "Creating account…" : "Create free account"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 28, textAlign: "center", fontSize: "0.875rem", color: "#555" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#2d6e2d", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>

        {/* Ad slot inside form panel */}
        <div style={{ marginTop: 40 }}>
          <AdSlot label="Sponsor" width="100%" height={90} />
        </div>
      </div>

      {/* ── Right ad column ── */}
      <aside style={adColumnStyle}>
        <AdSlot label="Ad 3" width={160} height={600} />
        <AdSlot label="Ad 4" width={160} height={300} />
      </aside>

    </div>
  );
}

function AdSlot({ label, width, height }: { label: string; width: number | string; height: number }) {
  return (
    <div style={{
      width,
      height,
      background: "#f0f4f0",
      border: "1px dashed #b0c8b0",
      borderRadius: 6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#7a9a7a",
      fontSize: "0.7rem",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      gap: 4,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18 }}>📢</span>
      <span>Advertisement</span>
      <span style={{ color: "#aac2aa" }}>{label}</span>
    </div>
  );
}

const adColumnStyle: React.CSSProperties = {
  width: 180,
  background: "#f8fbf8",
  borderRight: "1px solid #e8f0e8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
  padding: "20px 10px",
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#3a5a3a",
  marginBottom: 6,
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid #d0ddd0",
  borderRadius: 8,
  fontSize: "0.95rem",
  outline: "none",
  boxSizing: "border-box",
  color: "#1a2e1a",
  background: "#fafdfa",
};

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px",
  background: "#2d6e2d",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.02em",
};
