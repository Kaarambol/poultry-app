"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      return;
    }

    router.push("/app");
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Log in</h1>

      <form onSubmit={onSubmit}>
        <label>Email</label>
        <input
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label>Password</label>
        <input
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        <button style={{ padding: 10, width: "100%" }} type="submit">
          Log in
        </button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 16 }}>
        No account? <a href="/register">Register</a>
      </p>
    </div>
  );
}