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
            <div className="page-intro__eyebrow">Admin and backup</div>
            <h1 className="page-intro__title">Farm Access</h1>
            <p className="page-intro__subtitle">
              Manage farm users, role permissions, backups and restore actions.
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
              <div style={{ marginTop: 6 }}>Users: {items.length}</div>
            </div>
          </div>
        </div>

        {!ownerMode && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Only OWNER can manage farm access, backup history and restore.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {ownerMode && (
          <>
            <div className="mobile-card">
              <h2>Add User to Farm</h2>

              <form onSubmit={addAccess}>
                <label>User email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@email.com"
                />

                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <div className="mobile-sticky-actions">
                  <div className="mobile-sticky-actions__inner">
                    <button className="mobile-full-button" type="submit">
                      Add user to farm
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="mobile-card">
              <h2>Backup Actions</h2>
              <div className="mobile-actions">
                <button
                  type="button"
                  onClick={downloadBackup}
                  className="mobile-button"
                >
                  Download Manual Backup
                </button>

                <button
                  type="button"
                  onClick={runBlobBackupNow}
                  className="mobile-button mobile-button--secondary"
                >
                  Run Weekly Backup Now
                </button>
              </div>
            </div>

            <div className="mobile-card">
              <h2>Restore Backup</h2>
              <label>Choose backup JSON file</label>
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
          </>
        )}

        <h2 className="mobile-section-title">Farm Users</h2>
        {items.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No users found.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {items.map((item) => (
              <div key={item.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">
                  {item.user.name || item.user.email}
                </h3>

                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Email</strong>
                    <span>{item.user.email}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Role</strong>
                    <span>{item.role}</span>
                  </div>
                </div>

                {ownerMode && (
                  <div className="mobile-actions" style={{ marginTop: 12 }}>
                    <select
                      value={item.role}
                      onChange={(e) => updateRole(item.id, e.target.value)}
                    >
                      {roles.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>
                          {roleOption}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="mobile-button mobile-button--danger"
                      onClick={() => removeAccess(item.id)}
                    >
                      Remove Access
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="mobile-section-title">Backup History</h2>
        {backups.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No backup history found.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {backups.map((backup) => (
              <div key={backup.pathname} className="mobile-record-card">
                <h3 className="mobile-record-card__title">{backup.pathname}</h3>

                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Uploaded</strong>
                    <span>{new Date(backup.uploadedAt).toLocaleString()}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Size</strong>
                    <span>{Math.round(backup.size / 1024)} KB</span>
                  </div>
                </div>

                <div className="mobile-actions" style={{ marginTop: 12 }}>
                  <a
                    href={backup.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mobile-button mobile-button--secondary"
                    style={{ textAlign: "center" }}
                  >
                    Open backup file
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}