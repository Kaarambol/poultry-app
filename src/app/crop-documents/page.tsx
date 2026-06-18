"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId } from "@/lib/app-context";

type Crop = {
  id: string;
  cropNumber: string;
  placementDate: string;
  status: string;
};

type CropDocument = {
  id: string;
  cropId: string;
  category: string;
  title: string;
  notes: string | null;
  fileUrl: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  createdAt: string;
};

const CATEGORIES = [
  {
    id: "complaints-log",
    label: "Complaints Log",
    template: "/crop-templates/complaints-log.docx",
  },
  {
    id: "equipment-malfunction-log",
    label: "Equipment Malfunction Log",
    template: "/crop-templates/equipment-malfunction-log.docx",
  },
  {
    id: "ppp-spray-application",
    label: "PPP Spray Application Record",
    template: "/crop-templates/ppp-spray-application.docx",
  },
  {
    id: "routine-maintenance",
    label: "Routine Maintenance Schedule",
    template: "/crop-templates/routine-maintenance.docx",
  },
  {
    id: "security-breach-log",
    label: "Security Breach Log",
    template: "/crop-templates/security-breach-log.docx",
  },
  {
    id: "terminal-hygiene",
    label: "Terminal Hygiene Check Sheet",
    template: "/crop-templates/terminal-hygiene.pdf",
  },
  {
    id: "wheat-treatment-record",
    label: "Wheat Treatment Record",
    template: "/crop-templates/wheat-treatment-record.docx",
  },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB");
}

export default function CropDocumentsPage() {
  const [farmId, setFarmId] = useState("");
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState("");
  const [documents, setDocuments] = useState<CropDocument[]>([]);
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  // Upload state per category (keyed by category id)
  const [uploadFile, setUploadFile] = useState<Record<string, File | null>>({});
  const [uploadNotes, setUploadNotes] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Other documents upload state
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [otherNotes, setOtherNotes] = useState("");
  const [otherTitle, setOtherTitle] = useState("");
  const [otherUploading, setOtherUploading] = useState(false);
  const [otherFormKey, setOtherFormKey] = useState(0);

  // Per-category form keys for resetting inputs
  const [formKeys, setFormKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    const id = getCurrentFarmId();
    setFarmId(id);
  }, []);

  useEffect(() => {
    if (!farmId) {
      setLoading(false);
      return;
    }
    loadRole();
    loadCrops();
  }, [farmId]);

  useEffect(() => {
    if (!selectedCropId) {
      setDocuments([]);
      return;
    }
    loadDocuments(selectedCropId);
  }, [selectedCropId]);

  async function loadRole() {
    if (!farmId) return;
    try {
      const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
      const d = await r.json();
      setMyRole(d.role || "");
    } catch {
      setMyRole("");
    }
  }

  async function loadCrops() {
    try {
      const r = await fetch(`/api/crops/list?farmId=${farmId}`);
      const data = await r.json();
      if (Array.isArray(data)) {
        setCrops(data);
        if (data.length > 0) {
          setSelectedCropId(data[0].id);
        }
      }
    } catch {
      showMsg("Failed to load crops.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(cropId: string) {
    try {
      const r = await fetch(`/api/crop-documents/list?cropId=${cropId}`);
      const data = await r.json();
      if (r.ok && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      } else {
        setDocuments([]);
      }
    } catch {
      showMsg("Failed to load documents.", "error");
    }
  }

  function showMsg(text: string, type: "error" | "success" | "info") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  }

  function isViewer() {
    return myRole === "VIEWER";
  }

  function docsForCategory(categoryId: string) {
    return documents.filter((d) => d.category === categoryId);
  }

  async function handleUpload(categoryId: string, categoryLabel: string) {
    const file = uploadFile[categoryId];
    if (!file) {
      showMsg("Please select a file to upload.", "error");
      return;
    }
    if (!selectedCropId) return;

    setUploading((prev) => ({ ...prev, [categoryId]: true }));
    try {
      const form = new FormData();
      form.append("cropId", selectedCropId);
      form.append("category", categoryId);
      form.append("title", file.name || categoryLabel);
      form.append("notes", uploadNotes[categoryId] || "");
      form.append("file", file);

      const r = await fetch("/api/crop-documents/upload", {
        method: "POST",
        body: form,
      });

      if (!r.ok) {
        const d = await r.json();
        showMsg(d.error || "Upload failed.", "error");
        return;
      }

      showMsg("Document uploaded successfully.", "success");
      setUploadFile((prev) => ({ ...prev, [categoryId]: null }));
      setUploadNotes((prev) => ({ ...prev, [categoryId]: "" }));
      setFormKeys((prev) => ({ ...prev, [categoryId]: (prev[categoryId] || 0) + 1 }));
      await loadDocuments(selectedCropId);
    } catch {
      showMsg("Upload failed.", "error");
    } finally {
      setUploading((prev) => ({ ...prev, [categoryId]: false }));
    }
  }

  async function handleOtherUpload() {
    if (!otherFile) {
      showMsg("Please select a file to upload.", "error");
      return;
    }
    if (!otherTitle.trim()) {
      showMsg("Please enter a title for the document.", "error");
      return;
    }
    if (!selectedCropId) return;

    setOtherUploading(true);
    try {
      const form = new FormData();
      form.append("cropId", selectedCropId);
      form.append("category", "other");
      form.append("title", otherTitle.trim());
      form.append("notes", otherNotes);
      form.append("file", otherFile);

      const r = await fetch("/api/crop-documents/upload", {
        method: "POST",
        body: form,
      });

      if (!r.ok) {
        const d = await r.json();
        showMsg(d.error || "Upload failed.", "error");
        return;
      }

      showMsg("Document uploaded successfully.", "success");
      setOtherFile(null);
      setOtherNotes("");
      setOtherTitle("");
      setOtherFormKey((k) => k + 1);
      await loadDocuments(selectedCropId);
    } catch {
      showMsg("Upload failed.", "error");
    } finally {
      setOtherUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    setDeleting(true);
    try {
      const r = await fetch(`/api/crop-documents/${docId}`, {
        method: "DELETE",
      });

      if (!r.ok) {
        const d = await r.json();
        showMsg(d.error || "Delete failed.", "error");
        return;
      }

      showMsg("Document deleted.", "success");
      setDeleteConfirmId(null);
      if (selectedCropId) await loadDocuments(selectedCropId);
    } catch {
      showMsg("Delete failed.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="mobile-page">
        <div className="page-shell">
          <h1 className="mobile-page__title">Crop Documents</h1>
          <p style={{ color: "#666" }}>Loading...</p>
        </div>
      </main>
    );
  }

  if (!farmId) {
    return (
      <main className="mobile-page">
        <div className="page-shell">
          <h1 className="mobile-page__title">Crop Documents</h1>
          <p style={{ color: "#b00020" }}>No farm selected. Please select a farm from the navigation menu.</p>
        </div>
      </main>
    );
  }

  if (crops.length === 0) {
    return (
      <main className="mobile-page">
        <div className="page-shell">
          <h1 className="mobile-page__title">Crop Documents</h1>
          <p style={{ color: "#666" }}>No crops found for this farm.</p>
        </div>
      </main>
    );
  }

  const selectedCrop = crops.find((c) => c.id === selectedCropId);

  return (
    <main className="mobile-page">
      <div className="page-shell">
        <h1 className="mobile-page__title">Crop Documents</h1>

        {msg && (
          <div
            className="mobile-card"
            style={{
              background: msgType === "error" ? "#fee2e2" : msgType === "success" ? "#dcfce7" : "#eff6ff",
              color: msgType === "error" ? "#b00020" : msgType === "success" ? "#166534" : "#1e40af",
              marginBottom: 16,
              padding: "10px 14px",
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        )}

        {/* Crop selector */}
        <div className="mobile-card" style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151", display: "block", marginBottom: 6 }}>
            Select Crop
          </label>
          <select
            className="app-nav__select"
            value={selectedCropId}
            onChange={(e) => setSelectedCropId(e.target.value)}
            style={{ width: "100%", maxWidth: 400 }}
          >
            {crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                Crop {crop.cropNumber} — {fmtDate(crop.placementDate)}
                {crop.status !== "ACTIVE" ? ` (${crop.status})` : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedCrop && (
          <p style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: 20 }}>
            Showing documents for <strong>Crop {selectedCrop.cropNumber}</strong>
            {" "}(placed {fmtDate(selectedCrop.placementDate)})
          </p>
        )}

        {/* Category cards */}
        {CATEGORIES.map((cat) => {
          const catDocs = docsForCategory(cat.id);
          const isUploading = uploading[cat.id] || false;
          const formKey = formKeys[cat.id] || 0;

          return (
            <div key={cat.id} className="mobile-card" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  {cat.label}
                </h2>
                <a
                  href={cat.template}
                  download
                  className="mobile-button"
                  style={{
                    fontSize: "0.78rem",
                    padding: "5px 12px",
                    background: "#2563eb",
                    color: "#fff",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: 600,
                    display: "inline-block",
                  }}
                >
                  Download Template
                </a>
              </div>

              {/* Uploaded documents list */}
              {catDocs.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  {catDocs.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 0",
                        borderBottom: "1px solid #e5e7eb",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.originalFileName || doc.title}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {fmtDate(doc.createdAt)}
                          {doc.notes && (
                            <span style={{ marginLeft: 8, fontStyle: "italic" }}>{doc.notes}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {doc.fileUrl && (
                          <a
                            href={`/api/farm-documents/file?url=${encodeURIComponent(doc.fileUrl)}&download=1`}
                            className="mobile-button"
                            style={{
                              fontSize: "0.75rem",
                              padding: "4px 10px",
                              background: "#16a34a",
                              color: "#fff",
                              borderRadius: 5,
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            Download
                          </a>
                        )}
                        {!isViewer() && (
                          deleteConfirmId === doc.id ? (
                            <span style={{ display: "flex", gap: 4 }}>
                              <button
                                className="mobile-button"
                                onClick={() => handleDelete(doc.id)}
                                disabled={deleting}
                                style={{ fontSize: "0.75rem", padding: "4px 8px", background: "#b00020", color: "#fff", borderRadius: 5, fontWeight: 700, border: "none", cursor: "pointer" }}
                              >
                                {deleting ? "..." : "Confirm"}
                              </button>
                              <button
                                className="mobile-button"
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ fontSize: "0.75rem", padding: "4px 8px", background: "#6b7280", color: "#fff", borderRadius: 5, border: "none", cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              className="mobile-button"
                              onClick={() => setDeleteConfirmId(doc.id)}
                              style={{ fontSize: "0.75rem", padding: "4px 10px", background: "#fee2e2", color: "#b00020", borderRadius: 5, fontWeight: 600, border: "none", cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.82rem", color: "#9ca3af", marginBottom: 10 }}>No documents uploaded yet.</p>
              )}

              {/* Upload form (hidden for VIEWER) */}
              {!isViewer() && (
                <div key={formKey} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#374151" }}>
                    Upload completed document
                  </label>
                  <input
                    type="file"
                    style={{ fontSize: "0.82rem" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setUploadFile((prev) => ({ ...prev, [cat.id]: f }));
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={uploadNotes[cat.id] || ""}
                    onChange={(e) => setUploadNotes((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    style={{ fontSize: "0.82rem", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 5 }}
                  />
                  <button
                    className="mobile-button"
                    onClick={() => handleUpload(cat.id, cat.label)}
                    disabled={isUploading || !uploadFile[cat.id]}
                    style={{
                      background: isUploading || !uploadFile[cat.id] ? "#9ca3af" : "#2563eb",
                      color: "#fff",
                      fontSize: "0.82rem",
                      padding: "7px 14px",
                      borderRadius: 6,
                      border: "none",
                      cursor: isUploading || !uploadFile[cat.id] ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      alignSelf: "flex-start",
                    }}
                  >
                    {isUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Other Documents */}
        <div className="mobile-card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginTop: 0, marginBottom: 12 }}>
            Other Documents
          </h2>

          {docsForCategory("other").length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              {docsForCategory("other").map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid #e5e7eb",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {doc.originalFileName && (
                        <span style={{ marginRight: 8 }}>{doc.originalFileName}</span>
                      )}
                      {fmtDate(doc.createdAt)}
                      {doc.notes && (
                        <span style={{ marginLeft: 8, fontStyle: "italic" }}>{doc.notes}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {doc.fileUrl && (
                      <a
                        href={`/api/farm-documents/file?url=${encodeURIComponent(doc.fileUrl)}&download=1`}
                        className="mobile-button"
                        style={{
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                          background: "#16a34a",
                          color: "#fff",
                          borderRadius: 5,
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        Download
                      </a>
                    )}
                    {!isViewer() && (
                      deleteConfirmId === doc.id ? (
                        <span style={{ display: "flex", gap: 4 }}>
                          <button
                            className="mobile-button"
                            onClick={() => handleDelete(doc.id)}
                            disabled={deleting}
                            style={{ fontSize: "0.75rem", padding: "4px 8px", background: "#b00020", color: "#fff", borderRadius: 5, fontWeight: 700, border: "none", cursor: "pointer" }}
                          >
                            {deleting ? "..." : "Confirm"}
                          </button>
                          <button
                            className="mobile-button"
                            onClick={() => setDeleteConfirmId(null)}
                            style={{ fontSize: "0.75rem", padding: "4px 8px", background: "#6b7280", color: "#fff", borderRadius: 5, border: "none", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          className="mobile-button"
                          onClick={() => setDeleteConfirmId(doc.id)}
                          style={{ fontSize: "0.75rem", padding: "4px 10px", background: "#fee2e2", color: "#b00020", borderRadius: 5, fontWeight: 600, border: "none", cursor: "pointer" }}
                        >
                          Delete
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "#9ca3af", marginBottom: 10 }}>No other documents uploaded yet.</p>
          )}

          {!isViewer() && (
            <div key={otherFormKey} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontWeight: 600, fontSize: "0.8rem", color: "#374151" }}>
                Upload other document
              </label>
              <input
                type="text"
                placeholder="Document title (required)"
                value={otherTitle}
                onChange={(e) => setOtherTitle(e.target.value)}
                style={{ fontSize: "0.82rem", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 5 }}
              />
              <input
                type="file"
                style={{ fontSize: "0.82rem" }}
                onChange={(e) => setOtherFile(e.target.files?.[0] || null)}
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={otherNotes}
                onChange={(e) => setOtherNotes(e.target.value)}
                style={{ fontSize: "0.82rem", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 5 }}
              />
              <button
                className="mobile-button"
                onClick={handleOtherUpload}
                disabled={otherUploading || !otherFile || !otherTitle.trim()}
                style={{
                  background: otherUploading || !otherFile || !otherTitle.trim() ? "#9ca3af" : "#2563eb",
                  color: "#fff",
                  fontSize: "0.82rem",
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: otherUploading || !otherFile || !otherTitle.trim() ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  alignSelf: "flex-start",
                }}
              >
                {otherUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
