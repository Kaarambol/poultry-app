"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type FarmDocument = {
  id: string;
  farmId: string;
  title: string;
  documentType: string;
  status: string;
  documentFormat: string;
  electronicCopy: boolean;
  officeCopy: boolean;
  gateHouseCopy: boolean;
  issueDate: string | null;
  expiryDate: string | null;
  nextReviewDate: string | null;
  fileUrl: string | null;
  originalFileName: string | null;
  storedFileName: string | null;
  mimeType: string | null;
  referenceNo: string | null;
  issuer: string | null;
  notes: string | null;
  createdAt: string;
};

type AlertItem = {
  id: string;
  title: string;
  documentType: string;
  kind: "EXPIRY" | "REVIEW";
  severity: "SOON" | "OVERDUE";
  targetDate: string;
  days: number;
  status: string;
};

const DOCUMENT_TYPES = [
  "documents",
  "biosecurity",
  "samples",
  "audit",
  "service",
  "emergency",
  "certificate",
  "supplies",
  "output",
  "standards",
  "other",
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  documents: "Documents",
  biosecurity: "Biosecurity",
  samples: "Samples",
  audit: "Audit",
  service: "Service",
  emergency: "Emergency",
  certificate: "Certificate",
  supplies: "Supplies",
  output: "Output",
  standards: "Standards",
  other: "Other",
};

const DOCUMENT_STATUSES = [
  "ACTIVE",
  "EXPIRES_SOON",
  "EXPIRED",
  "ARCHIVED",
];

const DOCUMENT_FORMATS = [
  { value: "ELECTRONIC", label: "Electronic copy only" },
  { value: "PAPER", label: "Paper copy only" },
  { value: "BOTH", label: "Electronic + paper" },
];

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatDocumentTypeLabel(value: string | null | undefined) {
  if (!value) return "-";
  return DOCUMENT_TYPE_LABELS[value] || value;
}

function getExpiryVisual(expiryDate: string | null) {
  if (!expiryDate) return { label: "No expiry", color: "#666" };

  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return { label: "Expired", color: "#b00020" };
  if (diffDays <= 7) return { label: "Expires soon", color: "#c77700" };
  return { label: "Active", color: "#1f7a1f" };
}

function alertColor(severity: "SOON" | "OVERDUE") {
  return severity === "OVERDUE" ? "#b00020" : "#c77700";
}

function getDocumentStatusBadge(doc: FarmDocument): { label: string; color: string } {
  const today = new Date();

  if (doc.status === "EXPIRED") return { label: "Expired", color: "#b00020" };
  if (doc.status === "ARCHIVED") return { label: "Archived", color: "#666" };

  if (doc.expiryDate) {
    const diffDays = Math.ceil(
      (new Date(doc.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) return { label: "Expired", color: "#b00020" };
    if (diffDays <= 30) return { label: "Expiry soon", color: "#c77700" };
  }

  if (doc.nextReviewDate) {
    const diffDays = Math.ceil(
      (new Date(doc.nextReviewDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays < 0) return { label: "Review overdue", color: "#b00020" };
    if (diffDays <= 30) return { label: "Review soon", color: "#c77700" };
  }

  return { label: "Active", color: "#1f7a1f" };
}

export default function AuditFarmDocumentsPage() {
  const [currentFarmId, setCurrentFarmId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");

  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  const [editingId, setEditingId] = useState("");

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("documents");
  const [status, setStatus] = useState("ACTIVE");
  const [documentFormat, setDocumentFormat] = useState("ELECTRONIC");

  const [electronicCopy, setElectronicCopy] = useState(true);
  const [officeCopy, setOfficeCopy] = useState(false);
  const [gateHouseCopy, setGateHouseCopy] = useState(false);

  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [issuer, setIssuer] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [existingFileName, setExistingFileName] = useState("");

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FarmDocument[]>([]);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [allDocuments, setAllDocuments] = useState<FarmDocument[]>([]);

  const alertsRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) setFarmName(`${farm.name} (${farm.code})`);
    else setFarmName("");
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();

    if (r.ok) setMyRole(data.role || "");
    else setMyRole("");
  }

  async function loadAlerts(farmId: string) {
    const r = await fetch(`/api/farm-documents/alerts?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setAlerts([]);
      return;
    }

    setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
  }

  async function loadAllDocuments(farmId: string) {
    const r = await fetch(`/api/farm-documents/list?farmId=${farmId}`);
    const data = await r.json();
    if (!r.ok || !Array.isArray(data)) {
      setAllDocuments([]);
      return;
    }
    const sorted = [...data].sort((a, b) =>
      (a.documentType || "").localeCompare(b.documentType || "")
    );
    setAllDocuments(sorted);
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
    loadAlerts(farmId);
    loadAllDocuments(farmId);
    setMsg("");
  }, []);

  function clearForm() {
    setEditingId("");
    setTitle("");
    setDocumentType("documents");
    setStatus("ACTIVE");
    setDocumentFormat("ELECTRONIC");
    setElectronicCopy(true);
    setOfficeCopy(false);
    setGateHouseCopy(false);
    setIssueDate("");
    setExpiryDate("");
    setNextReviewDate("");
    setReferenceNo("");
    setIssuer("");
    setNotes("");
    setSelectedFile(null);
    setExistingFileUrl("");
    setExistingFileName("");
  }

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();

    const url = editingId
      ? "/api/farm-documents/update"
      : "/api/farm-documents/create";

    const form = new FormData();
    form.append("id", editingId);
    form.append("farmId", currentFarmId);
    form.append("title", title);
    form.append("documentType", documentType);
    form.append("status", status);
    form.append("documentFormat", documentFormat);
    form.append("electronicCopy", String(electronicCopy));
    form.append("officeCopy", String(officeCopy));
    form.append("gateHouseCopy", String(gateHouseCopy));
    form.append("issueDate", issueDate);
    form.append("expiryDate", expiryDate);
    form.append("nextReviewDate", nextReviewDate);
    form.append("referenceNo", referenceNo);
    form.append("issuer", issuer);
    form.append("notes", notes);

    if (selectedFile) {
      form.append("file", selectedFile);
    }

    const r = await fetch(url, {
      method: "POST",
      body: form,
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error saving document.");
      return;
    }

    setMsgType("success");
    setMsg(editingId ? "Document updated." : "Document added.");
    clearForm();
    await loadAlerts(currentFarmId);
    await loadAllDocuments(currentFarmId);

    if (searchExecuted && searchQuery.trim().length >= 2) {
      await runSearch(searchQuery);
    }
  }

  async function runSearch(query: string) {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setMsgType("error");
      setMsg("Enter at least 2 characters to search.");
      setSearchResults([]);
      setSearchExecuted(false);
      return;
    }

    const r = await fetch(
      `/api/farm-documents/search?farmId=${currentFarmId}&q=${encodeURIComponent(
        trimmed
      )}`
    );
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Search error.");
      setSearchResults([]);
      setSearchExecuted(false);
      return;
    }

    setSearchResults(Array.isArray(data.documents) ? data.documents : []);
    setSearchExecuted(true);

    if ((data.count || 0) === 0) {
      setMsgType("info");
      setMsg("No matching documents found.");
    } else {
      setMsgType("success");
      setMsg(`Found ${data.count} matching document(s).`);
    }
  }

  async function deleteDocument(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );
    if (!confirmed) return;

    const r = await fetch("/api/farm-documents/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Delete error.");
      return;
    }

    setMsgType("success");
    setMsg("Document deleted.");
    await loadAlerts(currentFarmId);
    await loadAllDocuments(currentFarmId);

    if (searchExecuted && searchQuery.trim().length >= 2) {
      await runSearch(searchQuery);
    }

    if (editingId === id) {
      clearForm();
    }
  }

  async function startEditById(id: string) {
    const fromSearch = searchResults.find((item) => item.id === id);
    if (fromSearch) {
      startEdit(fromSearch);
      return;
    }

    if (searchQuery.trim().length >= 2) {
      const r = await fetch(
        `/api/farm-documents/search?farmId=${currentFarmId}&q=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      const data = await r.json();
      if (r.ok && Array.isArray(data.documents)) {
        const found = data.documents.find((item: FarmDocument) => item.id === id);
        if (found) {
          startEdit(found);
        }
      }
    }
  }

  function startEdit(doc: FarmDocument) {
    setEditingId(doc.id);
    setTitle(doc.title);
    setDocumentType(doc.documentType);
    setStatus(doc.status);
    setDocumentFormat(doc.documentFormat);
    setElectronicCopy(doc.electronicCopy);
    setOfficeCopy(doc.officeCopy);
    setGateHouseCopy(doc.gateHouseCopy);
    setIssueDate(doc.issueDate ? doc.issueDate.slice(0, 10) : "");
    setExpiryDate(doc.expiryDate ? doc.expiryDate.slice(0, 10) : "");
    setNextReviewDate(doc.nextReviewDate ? doc.nextReviewDate.slice(0, 10) : "");
    setReferenceNo(doc.referenceNo || "");
    setIssuer(doc.issuer || "");
    setNotes(doc.notes || "");
    setSelectedFile(null);
    setExistingFileUrl(doc.fileUrl || "");
    setExistingFileName(doc.originalFileName || "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  const stats = useMemo(() => {
    let expired = 0;
    let expiringSoon = 0;

    for (const alert of alerts) {
      if (alert.severity === "OVERDUE") expired += 1;
      else expiringSoon += 1;
    }

    return {
      totalAlerts: alerts.length,
      expiringSoon,
      expired,
    };
  }, [alerts]);

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
            <div className="page-intro__eyebrow">Compliance</div>
            <h1 className="page-intro__title">Audit Farm Documents</h1>
            <p className="page-intro__subtitle">
              Search documents, monitor alerts and renew or delete records when needed.
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
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can search and view documents, but cannot edit.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>Alerts</h2>

          <div className="mobile-kpi-grid">
            <button
              type="button"
              className="mobile-kpi"
              onClick={() =>
                alertsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              style={{ cursor: "pointer" }}
            >
              <div className="mobile-kpi__label">Total alerts</div>
              <div className="mobile-kpi__value">{stats.totalAlerts}</div>
            </button>

            <button
              type="button"
              className="mobile-kpi"
              onClick={() =>
                alertsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              style={{ cursor: "pointer" }}
            >
              <div className="mobile-kpi__label">Due soon</div>
              <div className="mobile-kpi__value">{stats.expiringSoon}</div>
            </button>

            <button
              type="button"
              className="mobile-kpi"
              onClick={() =>
                alertsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              style={{ cursor: "pointer" }}
            >
              <div className="mobile-kpi__label">Overdue</div>
              <div className="mobile-kpi__value">{stats.expired}</div>
            </button>
          </div>

          <p style={{ marginTop: 12, marginBottom: 0 }}>
            Tap any alert box above to jump to the documents requiring action.
          </p>
        </div>

        <div ref={alertsRef} className="mobile-card">
          <h2>Documents requiring action</h2>

          {alerts.length === 0 ? (
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              No review or expiry alerts for the next 7 days.
            </p>
          ) : (
            <div className="mobile-record-list" style={{ marginTop: 12 }}>
              {alerts.map((alert) => (
                <div
                  key={`${alert.id}-${alert.kind}`}
                  className="mobile-record-card"
                  style={{ borderLeft: `6px solid ${alertColor(alert.severity)}` }}
                >
                  <h3 className="mobile-record-card__title">{alert.title}</h3>
                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row">
                      <strong>Type</strong>
                      <span>{formatDocumentTypeLabel(alert.documentType)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Action needed</strong>
                      <span style={{ color: alertColor(alert.severity) }}>
                        {alert.kind === "EXPIRY"
                          ? alert.severity === "OVERDUE"
                            ? "Expiry overdue"
                            : "Expiry due soon"
                          : alert.severity === "OVERDUE"
                          ? "Review overdue"
                          : "Review due soon"}
                      </span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Target date</strong>
                      <span>{formatDate(alert.targetDate)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Days</strong>
                      <span>{alert.days}</span>
                    </div>
                  </div>

                  {canOperate && (
                    <div className="mobile-actions" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="mobile-button mobile-button--secondary"
                        onClick={() => startEditById(alert.id)}
                      >
                        Edit / Renew
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mobile-card">
          <h2>Search document</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(searchQuery);
            }}
          >
            <label>Search by title, type, reference, issuer or notes</label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. water, audit, policy, cert"
            />

            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button className="mobile-full-button" type="submit">
                  Search document
                </button>
              </div>
            </div>
          </form>
        </div>

        <div ref={formRef} className="mobile-card">
          <h2>{editingId ? "Edit / Renew Document" : "Add Document"}</h2>

          <form onSubmit={saveDocument}>
            <label>Document title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canOperate}
              placeholder="e.g. Water analysis certificate"
              required
            />

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Document type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  disabled={!canOperate}
                >
                  {DOCUMENT_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {formatDocumentTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={!canOperate}
                >
                  {DOCUMENT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label>Document format</label>
            <select
              value={documentFormat}
              onChange={(e) => setDocumentFormat(e.target.value)}
              disabled={!canOperate}
            >
              {DOCUMENT_FORMATS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Copy locations</h3>

            <div className="mobile-grid mobile-grid--2">
              <label className="mobile-checkbox">
                <input
                  type="checkbox"
                  checked={electronicCopy}
                  onChange={(e) => setElectronicCopy(e.target.checked)}
                  disabled={!canOperate}
                />
                <span>Electronic copy</span>
              </label>

              <label className="mobile-checkbox">
                <input
                  type="checkbox"
                  checked={officeCopy}
                  onChange={(e) => setOfficeCopy(e.target.checked)}
                  disabled={!canOperate}
                />
                <span>Copy in office</span>
              </label>

              <label className="mobile-checkbox">
                <input
                  type="checkbox"
                  checked={gateHouseCopy}
                  onChange={(e) => setGateHouseCopy(e.target.checked)}
                  disabled={!canOperate}
                />
                <span>Copy in gate house</span>
              </label>
            </div>

            <h3 style={{ marginTop: 18, marginBottom: 10 }}>Upload / scan</h3>

            <label>Attach file (camera / scan / PDF / image)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              disabled={!canOperate}
            />

            {selectedFile && (
              <div className="mobile-alert" style={{ marginTop: 8, marginBottom: 12 }}>
                Selected file: {selectedFile.name}
              </div>
            )}

            {existingFileUrl && !selectedFile && (
              <div className="mobile-alert" style={{ marginTop: 8, marginBottom: 12 }}>
                Current file: {existingFileName || existingFileUrl}
              </div>
            )}

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Issue date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={!canOperate}
                />
              </div>

              <div>
                <label>Expiry date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={!canOperate}
                />
              </div>
            </div>

            <label>Next review date</label>
            <input
              type="date"
              value={nextReviewDate}
              onChange={(e) => setNextReviewDate(e.target.value)}
              disabled={!canOperate}
            />

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Reference no</label>
                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  disabled={!canOperate}
                  placeholder="optional"
                />
              </div>

              <div>
                <label>Issuer</label>
                <input
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  disabled={!canOperate}
                  placeholder="optional"
                />
              </div>
            </div>

            <label>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canOperate}
            />

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit">
                    {editingId ? "Update Document" : "Add Document"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      className="mobile-button mobile-button--secondary"
                      onClick={clearForm}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {allDocuments.length > 0 && (
          <div className="mobile-card" style={{ overflowX: "auto" }}>
            <h2>All Documents ({allDocuments.length})</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd" }}>Title</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd" }}>Expiry date</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd" }}>Next review</th>
                  {canOperate && (
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd" }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {allDocuments.map((doc, idx) => {
                  const badge = getDocumentStatusBadge(doc);
                  return (
                    <tr
                      key={doc.id}
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #eee" }}
                    >
                      <td style={{ padding: "8px 10px", wordBreak: "break-word", maxWidth: 260 }}>
                        <span style={{ fontWeight: 500 }}>{doc.title}</span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: badge.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {formatDocumentTypeLabel(doc.documentType)}
                      </td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {formatDate(doc.expiryDate)}
                      </td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {formatDate(doc.nextReviewDate)}
                      </td>
                      {canOperate && (
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="mobile-button mobile-button--secondary"
                            style={{ marginRight: 6, padding: "4px 10px", fontSize: "0.8rem" }}
                            onClick={() => startEdit(doc)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="mobile-button mobile-button--danger"
                            style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                            onClick={() => deleteDocument(doc.id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {searchExecuted && (
          <>
            <h2 className="mobile-section-title">Search results</h2>

            {searchResults.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No matching documents found.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {searchResults.map((doc) => {
                  const visual = getExpiryVisual(doc.expiryDate);

                  return (
                    <div
                      key={doc.id}
                      className="mobile-record-card"
                      style={{ borderLeft: `6px solid ${visual.color}` }}
                    >
                      <h3 className="mobile-record-card__title">{doc.title}</h3>

                      <div className="mobile-record-card__grid">
                        <div className="mobile-record-row">
                          <strong>Type</strong>
                          <span>{formatDocumentTypeLabel(doc.documentType)}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Status</strong>
                          <span>{doc.status}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Format</strong>
                          <span>{doc.documentFormat}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Expiry state</strong>
                          <span style={{ color: visual.color }}>{visual.label}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Issue date</strong>
                          <span>{formatDate(doc.issueDate)}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Expiry date</strong>
                          <span>{formatDate(doc.expiryDate)}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Next review</strong>
                          <span>{formatDate(doc.nextReviewDate)}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Electronic copy</strong>
                          <span>{doc.electronicCopy ? "Yes" : "No"}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Copy in office</strong>
                          <span>{doc.officeCopy ? "Yes" : "No"}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Copy in gate house</strong>
                          <span>{doc.gateHouseCopy ? "Yes" : "No"}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Reference no</strong>
                          <span>{doc.referenceNo || "-"}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Issuer</strong>
                          <span>{doc.issuer || "-"}</span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>File</strong>
                          <span>
                            {doc.fileUrl ? (
                              <a
                                href={`/api/farm-documents/file?url=${encodeURIComponent(
                                  doc.fileUrl || ""
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {doc.originalFileName || "Open file"}
                              </a>
                            ) : (
                              "-"
                            )}
                          </span>
                        </div>
                        <div className="mobile-record-row">
                          <strong>Notes</strong>
                          <span>{doc.notes || "-"}</span>
                        </div>
                      </div>

                      {canOperate && (
                        <div className="mobile-actions" style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            className="mobile-button mobile-button--secondary"
                            onClick={() => startEdit(doc)}
                          >
                            Edit / Renew
                          </button>
                          <button
                            type="button"
                            className="mobile-button mobile-button--danger"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}