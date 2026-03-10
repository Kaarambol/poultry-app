"use client";

import { useState } from "react";

export default function FarmsPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function createFarm(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setMsgType("info");

    const r = await fetch("/api/farms/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, code }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Farm created successfully!");
    setName("");
    setCode("");
  }

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
      ? "mobile-alert mobile-alert--success"
      : "mobile-alert";

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Farm configuration</div>
            <h1 className="page-intro__title">Create Farm</h1>
            <p className="page-intro__subtitle">
              Add a new farm entity to manage crops, houses and daily records.
            </p>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>New Farm Details</h2>

          <form onSubmit={createFarm}>
            <label>Farm Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Green Valley Farm"
              required
            />

            <label>Farm Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. GVF01"
              required
            />

            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button className="mobile-full-button" type="submit">
                  Create Farm
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mobile-card">
          <h2>What happens next?</h2>
          <div className="mobile-record-card__grid">
            <div className="mobile-record-row">
              <strong>Step 1</strong>
              <span>Go to Farm Setup to add houses</span>
            </div>
            <div className="mobile-record-row">
              <strong>Step 2</strong>
              <span>Create a new crop</span>
            </div>
            <div className="mobile-record-row">
              <strong>Step 3</strong>
              <span>Start daily data entry</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}