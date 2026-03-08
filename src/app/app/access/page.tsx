"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, isOwner } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type AccessItem = {
  id: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

type BackupItem = {
  pathname: string;
  url: string;
  uploadedAt: string;
  size: number;
};

const roles = ["OWNER", "MANAGER", "ASSISTANT_MANAGER", "VIEWER"];

export default function AccessPage() {
  const [currentFarmId, setCurrentFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [items, setItems] = useState<AccessItem[]>([]);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ASSISTANT_MANAGER");
  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    } else {
      setFarmName("");
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading role.");
      setMyRole("");
      return;
    }

    setMyRole(data.role || "");
  }

  async function loadAccess(farmId: string) {
    const r = await fetch(`/api/farms/access/list?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading access.");
      setItems([]);
      return;
    }

    setItems(data);
    setMsg("");
  }

  async function loadBackups(farmId: string) {
    const r = await fetch(`/api/farms/backup-history?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setBackups([]);
      return;
    }

    setBackups(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmId(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadAccess(farmId);
    loadBackups(farmId);
  }, []);

  async function addAccess(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setMsgType("error");
      setMsg("Email is required.");
      return;
    }

    const r = await fetch("/api/farms/access/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmId: currentFarmId,
        email,
        role,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Access added.");
    setEmail("");
    setRole("ASSISTANT_MANAGER");
    loadAccess(currentFarmId);
  }

  async function updateRole(farmUserId: string, newRole: string) {
    const r = await fetch("/api/farms/access/update-role", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmUserId,
        role: newRole,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Role updated.");
    loadAccess(currentFarmId);
  }

  async function removeAccess(farmUserId: string) {
    const confirmed = window.confirm("Remove this user from the farm?");
    if (!confirmed) return;

    const r = await fetch("/api/farms/access/remove", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmUserId,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Access removed.");
    loadAccess(currentFarmId);
  }

  async function downloadBackup() {
    if (!currentFarmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }

    try {
      const res = await fetch("/api/farms/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: currentFarmId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsgType("error");
        setMsg(data.error || "Backup failed.");
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `farm-backup-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      setMsgType("success");
      setMsg("Backup downloaded.");
    } catch {
      setMsgType("error");
      setMsg("Backup failed.");
    }
  }

  async function runBlobBackupNow() {
    if (!currentFarmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }

    try {
      const res = await fetch("/api/farms/backup-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: currentFarmId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsgType("error");
        setMsg(data.error || "Blob backup failed.");
        return;
      }

      setMsgType("success");
      setMsg("Backup saved to weekly backup history.");
      loadBackups(currentFarmId);
    } catch {
      setMsgType("error");
      setMsg("Blob backup failed.");
    }
  }

  async function restoreBackup(file: File) {
    if (!currentFarmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const res = await fetch("/api/farms/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId: currentFarmId,
          backup,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsgType("error");
        setMsg(data.error || "Restore failed.");
        return;
      }

      setMsgType("success");
      setMsg("Restore completed. New restored farm has been created.");
    } catch {
      setMsgType("error");
      setMsg("Restore failed. Check if the backup file is valid JSON.");
    } finally {
      if (restoreInputRef.current) {
        restoreInputRef.current.value = "";
      }
    }
  }

  const ownerMode = isOwner(myRole);

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Farm Access</h1>

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
          Only OWNER can manage farm access, backup history and restore.
        </p>
      )}

      {ownerMode && (
        <>
          <form onSubmit={addAccess} style={{ marginBottom: 24 }}>
            <label>User email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
              placeholder="colleague@email.com"
            />

            <label>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button style={{ padding: 12, width: "100%" }} type="submit">
              Add user to farm
            </button>
          </form>

          <button
            type="button"
            onClick={downloadBackup}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Download Full Farm Backup
          </button>

          <button
            type="button"
            onClick={runBlobBackupNow}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 16,
              borderRadius: 8,
              border: "1px solid #111",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
            }}
          >
            Run Weekly Backup Now
          </button>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              background: "#fafafa",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Restore Backup</h3>
            <p style={{ marginTop: 0 }}>
              Restore creates a new farm copy from backup. It does not overwrite the current farm.
            </p>

            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  restoreBackup(file);
                }
              }}
            />
          </div>

          <h3>Weekly Backup History</h3>
          {backups.length === 0 ? (
            <p>No weekly backups yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    File
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Uploaded
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Size
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                    Download
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((item) => (
                  <tr key={item.pathname}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {item.pathname.split("/").pop()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {new Date(item.uploadedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {item.size}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {msg && (
        <p
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background:
              msgType === "error" ? "#ffebee" : msgType === "success" ? "#e8f5e9" : "#eef3f8",
            color:
              msgType === "error" ? "#b71c1c" : msgType === "success" ? "#1b5e20" : "#1f3b57",
            border:
              msgType === "error"
                ? "1px solid #ef9a9a"
                : msgType === "success"
                ? "1px solid #a5d6a7"
                : "1px solid #c5d7ea",
          }}
        >
          {msg}
        </p>
      )}

      <h2 style={{ marginTop: 30 }}>Users with access</h2>
      {items.length === 0 ? (
        <p>No users assigned.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Email
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Name
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Role
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Change role
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ccc" }}>
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.user.email}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {item.user.name || "-"}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{item.role}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {ownerMode ? (
                    <select
                      value={item.role}
                      onChange={(e) => updateRole(item.id, e.target.value)}
                      style={{ padding: 8 }}
                    >
                      {roles.map((roleItem) => (
                        <option key={roleItem} value={roleItem}>
                          {roleItem}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  {ownerMode ? (
                    <button type="button" onClick={() => removeAccess(item.id)}>
                      Remove
                    </button>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}