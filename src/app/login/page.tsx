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
      setMsg(data.error || "Login error.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="login-container">
      <h1>Log in</h1>
      <form onSubmit={onSubmit} className="login-form">
        <div className="form-group">
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        <button type="submit" className="btn-primary">Log in</button>
      </form>
      {msg && <p className="error-msg">{msg}</p>}
      <p>Don&apos;t have an account? <a href="/register">Register</a></p>
    </div>
  );
}