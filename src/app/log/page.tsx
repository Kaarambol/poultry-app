"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, isOwner } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type LogItem = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
};

export default function LogPage() {
  const [currentFarmId, setCurrentFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [msg, setMsg] = useState("Loading...");

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();

    if (r.ok) {
      setMyRole(data.role || "");
    } else {
      setMyRole("");
    }
  }

  async function loadLogs(farmId: string) {
    const r = await fetch(`/api/farms/logs?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error loading log.");
      setLogs([]);
      return;
    }

    setLogs(Array.isArray(data) ? data : []);
    setMsg(Array.isArray(data) && data.length === 0 ? "No log entries yet." : "");
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmId(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadLogs(farmId);
  }, []);

  const ownerMode = isOwner(myRole);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Audit trail</div>
            <h1 className="page-intro__title">Change Log</h1>
            <p className="page-intro__subtitle">
              Review who changed what and when across the selected farm.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Access</div>
              <div>Your role: {myRole || "-"}</div>
              <div style={{ marginTop: 6 }}>Entries: {logs.length}</div>
            </div>
          </div>
        </div>

        {!ownerMode && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Only OWNER can view the full change log.
          </div>
        )}

        {msg && (
          <div className="mobile-alert" style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {ownerMode && logs.length > 0 && (
          <div className="mobile-record-list">
            {logs.map((log) => (
              <div key={log.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">{log.action}</h3>
                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Time</strong>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>User</strong>
                    <span>{log.user.name || log.user.email}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Email</strong>
                    <span>{log.user.email}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Description</strong>
                    <span>{log.description}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}