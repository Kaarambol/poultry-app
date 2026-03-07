"use client";

import { useState } from "react";

export default function FarmsPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function createFarm(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const r = await fetch("/api/farms/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, code }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      return;
    }

    setMsg("Farm created!");
    setName("");
    setCode("");
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Create Farm</h1>

      <form onSubmit={createFarm}>
        <label>Farm name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          required
        />

        <label>Farm code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          required
        />

        <button style={{ padding: 10, width: "100%" }} type="submit">
          Create Farm
        </button>
      </form>

      {msg && <p style={{ marginTop: 20 }}>{msg}</p>}
    </div>
  );
}