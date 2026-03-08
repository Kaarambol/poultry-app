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
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Change Log</h1>

      {currentFarmId && (
        <p>
          <strong>Current Farm:</strong> {farmName || currentFarmId}
        </p>
      )}

      <p>
        <strong>Your role:</strong> {myRole || "-"}
      </p>

      {!ownerMode && (
        <p
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fff8e1",
            border: "1px solid #ffe082",
            color: "#7a5d00",
          }}
        >
          Only OWNER can view the full change log.
        </p>
      )}

      {msg && <p>{msg}</p>}

      {ownerMode && logs.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Time
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                User
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Action
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {new Date(item.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {item.user.name || item.user.email}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {item.action}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {item.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}