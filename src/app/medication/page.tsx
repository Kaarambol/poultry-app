"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, getHistoryCropId, setCurrentCropId, isViewingHistory } from "@/lib/app-context";
import { FarmRole, canOperateUi } from "@/lib/ui-permissions";

type Farm = { id: string; name: string; code: string };
type House = { id: string; name: string; code: string | null };

type MedicationRecord = {
  id: string;
  startDate: string;
  medicineName: string;
  supplier: string | null;
  batchNo: string | null;
  expireDate: string | null;
  quantityPurchased: string | null;
  quantityUsed: string | null;
  animalIdentity: string | null;
  housesTreated: string | null;
  birdsTreated: number | null;
  finishDate: string | null;
  withdrawalPeriod: string | null;
  safeSlaughterDate: string | null;
  administratorName: string | null;
  reasonForTreatment: string | null;
  methodOfTreatment: string | null;
  dose: string | null;
  totalMgPcu: string | null;
  report: string | null;
  prescription: string | null;
};

type CropFolder = {
  cropId: string;
  cropNumber: string;
  placementDate: string;
  finishDate: string | null;
  status: string;
  records: MedicationRecord[];
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB");
}

function fmtDateInput(d: string | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default function MedicationPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [historyMode, setHistoryMode] = useState(false);

  const [houses, setHouses] = useState<House[]>([]);
  const [activeCropId, setActiveCropId] = useState("");
  const [vetModeOpen, setVetModeOpen] = useState(false);
  const [vetHouseId, setVetHouseId] = useState("");
  const [vetGenerating, setVetGenerating] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [batches, setBatches] = useState([{ batchNo: "", expireDate: "", quantityPurchased: "", quantityUsed: "" }]);
  const [animalIdentity, setAnimalIdentity] = useState("Broiler");
  const [housesTreated, setHousesTreated] = useState("");
  const [birdsTreated, setBirdsTreated] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [withdrawalPeriod, setWithdrawalPeriod] = useState("");
  const [safeSlaughterDate, setSafeSlaughterDate] = useState("");
  const [administratorName, setAdministratorName] = useState("");
  const [reasonForTreatment, setReasonForTreatment] = useState("");
  const [methodOfTreatment, setMethodOfTreatment] = useState("");
  const [dose, setDose] = useState("");
  const [totalMgPcu, setTotalMgPcu] = useState("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [overrideCropId, setOverrideCropId] = useState("");

  const [folders, setFolders] = useState<CropFolder[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [viewingRecord, setViewingRecord] = useState<MedicationRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<MedicationRecord | null>(null);
  const [editBatches, setEditBatches] = useState([{ batchNo: "", expireDate: "", quantityPurchased: "", quantityUsed: "" }]);
  const [editFormKey, setEditFormKey] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editReportFile, setEditReportFile] = useState<File | null>(null);
  const [editPrescriptionFile, setEditPrescriptionFile] = useState<File | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (Array.isArray(data)) {
      const farm = data.find((f: Farm) => f.id === farmId);
      if (farm) setFarmName(`${farm.name} (${farm.code})`);
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();
    if (r.ok) setMyRole(data.role || "");
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();
    if (r.ok && data) {
      setCurrentCropId(data.id);
      setActiveCropId(data.id);
    }
  }

  async function loadHouses(farmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${farmId}`);
    const data = await r.json();
    if (Array.isArray(data)) setHouses(data);
  }

  async function loadAllRecords(farmId: string) {
    const r = await fetch(`/api/medications/list-all?farmId=${farmId}`);
    const data = await r.json();
    if (Array.isArray(data)) {
      setFolders(data);
      // Auto-open the most recent crop folder
      if (data.length > 0) {
        setOpenFolders(new Set([data[0].cropId]));
      }
    }
  }

  useEffect(() => {
    const viewing = isViewingHistory();
    setHistoryMode(viewing);
    const farmId = getCurrentFarmId();
    if (!farmId) return;
    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadHouses(farmId);
    loadAllRecords(farmId);

    if (viewing) {
      const histCropId = getHistoryCropId();
      if (histCropId) setCurrentCropId(histCropId);
    } else {
      loadActiveCrop(farmId);
    }
  }, []);

  function toggleFolder(cropId: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(cropId)) next.delete(cropId);
      else next.add(cropId);
      return next;
    });
  }

  async function generateVetPdf() {
    if (!activeCropId || !vetHouseId) {
      setMsgType("error");
      setMsg("Please select a house. No active crop found.");
      return;
    }
    try {
      setVetGenerating(true);
      const url = `/api/medications/vet-report?cropId=${encodeURIComponent(activeCropId)}&houseId=${encodeURIComponent(vetHouseId)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Server error");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Vet-Report-Crop-${activeCropId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMsgType("success");
      setMsg("Report downloaded.");
    } catch {
      setMsgType("error");
      setMsg("Error generating report.");
    } finally {
      setVetGenerating(false);
    }
  }

  function clearForm() {
    setStartDate(""); setMedicineName(""); setSupplier("");
    setBatches([{ batchNo: "", expireDate: "", quantityPurchased: "", quantityUsed: "" }]);
    setAnimalIdentity("Broiler"); setHousesTreated(""); setBirdsTreated("");
    setFinishDate(""); setWithdrawalPeriod(""); setSafeSlaughterDate("");
    setAdministratorName(""); setReasonForTreatment(""); setMethodOfTreatment("");
    setDose(""); setTotalMgPcu("");
    setReportFile(null); setPrescriptionFile(null);
    setOverrideCropId("");
    setFormKey(k => k + 1);
  }

  async function saveMedication(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFarmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }
    const fd = new FormData();
    const join = (key: "batchNo" | "expireDate" | "quantityPurchased" | "quantityUsed") =>
      batches.map(b => b[key]).filter(Boolean).join(" / ");
    fd.append("farmId",             currentFarmId);
    fd.append("startDate",          startDate);
    if (overrideCropId) fd.append("cropId", overrideCropId);
    fd.append("medicineName",       medicineName);
    fd.append("supplier",           supplier);
    fd.append("batchNo",            join("batchNo"));
    fd.append("expireDate",         batches[0]?.expireDate ?? "");
    fd.append("quantityPurchased",  join("quantityPurchased"));
    fd.append("quantityUsed",       join("quantityUsed"));
    fd.append("animalIdentity",     animalIdentity);
    fd.append("housesTreated",      housesTreated);
    fd.append("birdsTreated",       birdsTreated);
    fd.append("finishDate",         finishDate);
    fd.append("withdrawalPeriod",   withdrawalPeriod);
    fd.append("safeSlaughterDate",  safeSlaughterDate);
    fd.append("administratorName",  administratorName);
    fd.append("reasonForTreatment", reasonForTreatment);
    fd.append("methodOfTreatment",  methodOfTreatment);
    fd.append("dose",               dose);
    fd.append("totalMgPcu",         totalMgPcu);
    if (reportFile)       fd.append("reportFile",       reportFile);
    if (prescriptionFile) fd.append("prescriptionFile", prescriptionFile);

    const r = await fetch("/api/medications/create", {
      method: "POST",
      body: fd,
    });
    const data = await r.json();
    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error saving.");
      return;
    }
    setMsgType("success");
    setMsg(`Saved — assigned to Crop ${data.cropId ? "" : ""}${folders.find(f => f.cropId === data.cropId)?.cropNumber ?? ""}`);
    clearForm();
    loadAllRecords(currentFarmId);
  }

  function startEdit(record: MedicationRecord) {
    // Parse stored " / " separated values back into rows
    const splitField = (v: string | null) => (v ?? "").split(" / ").map(s => s.trim());
    const batchNos   = splitField(record.batchNo);
    const expDates   = splitField(record.expireDate ? fmtDateInput(record.expireDate) : null);
    const qtPurch    = splitField(record.quantityPurchased);
    const qtUsed     = splitField(record.quantityUsed);
    const count = Math.max(1, batchNos.length, expDates.length, qtPurch.length, qtUsed.length);
    const editBatches = Array.from({ length: count }, (_, i) => ({
      batchNo:           batchNos[i]  ?? "",
      expireDate:        expDates[i]  ?? "",
      quantityPurchased: qtPurch[i]   ?? "",
      quantityUsed:      qtUsed[i]    ?? "",
    }));
    setEditingRecord({ ...record, batchNo: record.batchNo, expireDate: record.expireDate });
    setEditBatches(editBatches);
    setEditReportFile(null);
    setEditPrescriptionFile(null);
    setEditFormKey(k => k + 1);
  }

  function updateEditField(field: keyof MedicationRecord, value: string | number | null) {
    setEditingRecord(prev => prev ? { ...prev, [field]: value } : prev);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecord) return;
    setEditSaving(true);
    const fd = new FormData();
    fd.append("id",                  editingRecord.id);
    fd.append("startDate",           editingRecord.startDate?.slice(0, 10) ?? "");
    fd.append("medicineName",        editingRecord.medicineName);
    fd.append("supplier",            editingRecord.supplier ?? "");
    const ejoin = (key: "batchNo" | "expireDate" | "quantityPurchased" | "quantityUsed") =>
      editBatches.map(b => b[key]).filter(Boolean).join(" / ");
    fd.append("batchNo",             ejoin("batchNo"));
    fd.append("expireDate",          editBatches[0]?.expireDate ?? "");
    fd.append("quantityPurchased",   ejoin("quantityPurchased"));
    fd.append("quantityUsed",        ejoin("quantityUsed"));
    fd.append("animalIdentity",      editingRecord.animalIdentity ?? "");
    fd.append("housesTreated",       editingRecord.housesTreated ?? "");
    fd.append("birdsTreated",        editingRecord.birdsTreated != null ? String(editingRecord.birdsTreated) : "");
    fd.append("finishDate",          editingRecord.finishDate?.slice(0, 10) ?? "");
    fd.append("withdrawalPeriod",    editingRecord.withdrawalPeriod ?? "");
    fd.append("safeSlaughterDate",   editingRecord.safeSlaughterDate?.slice(0, 10) ?? "");
    fd.append("administratorName",   editingRecord.administratorName ?? "");
    fd.append("reasonForTreatment",  editingRecord.reasonForTreatment ?? "");
    fd.append("methodOfTreatment",   editingRecord.methodOfTreatment ?? "");
    fd.append("dose",                editingRecord.dose ?? "");
    fd.append("totalMgPcu",          editingRecord.totalMgPcu ?? "");
    if (editReportFile)       fd.append("reportFile",       editReportFile);
    if (editPrescriptionFile) fd.append("prescriptionFile", editPrescriptionFile);

    const r = await fetch("/api/medications/update", { method: "PATCH", body: fd });
    const data = await r.json();
    setEditSaving(false);
    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error saving.");
      return;
    }
    setMsgType("success");
    setMsg("Record updated.");
    setEditingRecord(null);
    setViewingRecord(null);
    loadAllRecords(currentFarmId);
  }

  async function deleteRecord(id: string) {
    const r = await fetch(`/api/medications/delete?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      setMsgType("success");
      setMsg("Record deleted.");
      setDeleteConfirmId(null);
      setViewingRecord(null);
      loadAllRecords(currentFarmId);
    } else {
      const data = await r.json();
      setMsgType("error");
      setMsg(data.error || "Error deleting.");
    }
  }

  const canOperate = canOperateUi(myRole) && !historyMode;

  return (
    <div className="mobile-page">

      {/* VIEW / EDIT MODAL */}
      {viewingRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 12px", overflowY: "auto" }}
          onClick={() => { setViewingRecord(null); setEditingRecord(null); setDeleteConfirmId(null); }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
                {editingRecord ? "Edit Record" : viewingRecord.medicineName}
              </h2>
              <button onClick={() => { setViewingRecord(null); setEditingRecord(null); setDeleteConfirmId(null); }}
                style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>

            {/* DELETE CONFIRM */}
            {deleteConfirmId && !editingRecord && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <p style={{ margin: "0 0 12px", fontWeight: 600, color: "#b91c1c" }}>Delete this record?</p>
                <p style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>This action cannot be undone.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="mobile-button" style={{ background: "#dc2626", color: "#fff" }}
                    onClick={() => deleteRecord(deleteConfirmId)}>
                    Yes, Delete
                  </button>
                  <button className="mobile-button mobile-button--secondary" onClick={() => setDeleteConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* EDIT FORM */}
            {editingRecord ? (
              <form onSubmit={saveEdit} key={editFormKey}>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Start Date *</label><input type="date" value={editingRecord.startDate?.slice(0,10) ?? ""} onChange={e => updateEditField("startDate", e.target.value)} required /></div>
                  <div><label>Medicine Name *</label><input value={editingRecord.medicineName} onChange={e => updateEditField("medicineName", e.target.value)} required /></div>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Supplier</label><input value={editingRecord.supplier ?? ""} onChange={e => updateEditField("supplier", e.target.value)} /></div>
                  <div><label>Finish Date</label><input type="date" value={editingRecord.finishDate?.slice(0,10) ?? ""} onChange={e => updateEditField("finishDate", e.target.value)} /></div>
                </div>

                {/* Batch rows */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 4, alignItems: "center" }}>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Batch No</span>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Expiry Date</span>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Qty Purchased</span>
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Qty Used</span>
                    <span />
                  </div>
                  {editBatches.map((b, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                      <input value={b.batchNo} onChange={e => setEditBatches(prev => prev.map((r, j) => j === i ? { ...r, batchNo: e.target.value } : r))} style={{ margin: 0 }} />
                      <input type="date" value={b.expireDate} onChange={e => setEditBatches(prev => prev.map((r, j) => j === i ? { ...r, expireDate: e.target.value } : r))} style={{ margin: 0 }} />
                      <input value={b.quantityPurchased} onChange={e => setEditBatches(prev => prev.map((r, j) => j === i ? { ...r, quantityPurchased: e.target.value } : r))} style={{ margin: 0 }} />
                      <input value={b.quantityUsed} onChange={e => setEditBatches(prev => prev.map((r, j) => j === i ? { ...r, quantityUsed: e.target.value } : r))} style={{ margin: 0 }} />
                      {editBatches.length > 1 ? (
                        <button type="button" onClick={() => setEditBatches(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: "0 4px", lineHeight: 1 }}>✕</button>
                      ) : <span />}
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditBatches(prev => [...prev, { batchNo: "", expireDate: "", quantityPurchased: "", quantityUsed: "" }])}
                    style={{ fontSize: "0.8rem", color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "4px 12px", cursor: "pointer", marginTop: 2 }}>
                    + Add row
                  </button>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Animal Identity</label><input value={editingRecord.animalIdentity ?? ""} onChange={e => updateEditField("animalIdentity", e.target.value)} /></div>
                  <div><label>Houses Treated</label><input value={editingRecord.housesTreated ?? ""} onChange={e => updateEditField("housesTreated", e.target.value)} /></div>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Birds Treated</label><input type="number" value={editingRecord.birdsTreated ?? ""} onChange={e => updateEditField("birdsTreated", e.target.value === "" ? null : Number(e.target.value))} /></div>
                  <div><label>Withdrawal Period</label><input value={editingRecord.withdrawalPeriod ?? ""} onChange={e => updateEditField("withdrawalPeriod", e.target.value)} /></div>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Safe Slaughter Date</label><input type="date" value={editingRecord.safeSlaughterDate?.slice(0,10) ?? ""} onChange={e => updateEditField("safeSlaughterDate", e.target.value)} /></div>
                  <div><label>Administrator Name</label><input value={editingRecord.administratorName ?? ""} onChange={e => updateEditField("administratorName", e.target.value)} /></div>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Reason for Treatment</label><input value={editingRecord.reasonForTreatment ?? ""} onChange={e => updateEditField("reasonForTreatment", e.target.value)} /></div>
                  <div><label>Method of Treatment</label><input value={editingRecord.methodOfTreatment ?? ""} onChange={e => updateEditField("methodOfTreatment", e.target.value)} /></div>
                </div>
                <div className="mobile-grid mobile-grid--2">
                  <div><label>Dose mg/g</label><input value={editingRecord.dose ?? ""} onChange={e => updateEditField("dose", e.target.value)} /></div>
                  <div><label>Total mg/PCU</label><input value={editingRecord.totalMgPcu ?? ""} onChange={e => updateEditField("totalMgPcu", e.target.value)} /></div>
                </div>
                <div className="mobile-grid mobile-grid--2" key={editFormKey}>
                  <div>
                    <label>Report (replace file)</label>
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setEditReportFile(e.target.files?.[0] ?? null)} />
                    {editReportFile && <div style={{ fontSize: "0.8rem", color: "#16a34a", marginTop: 4 }}>✓ {editReportFile.name}</div>}
                    {!editReportFile && editingRecord.report && <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>Current file kept</div>}
                  </div>
                  <div>
                    <label>Prescription (replace file)</label>
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => setEditPrescriptionFile(e.target.files?.[0] ?? null)} />
                    {editPrescriptionFile && <div style={{ fontSize: "0.8rem", color: "#16a34a", marginTop: 4 }}>✓ {editPrescriptionFile.name}</div>}
                    {!editPrescriptionFile && editingRecord.prescription && <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>Current file kept</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button className="mobile-button" type="submit" disabled={editSaving}
                    style={{ background: "#1B3A5C", color: "#fff", flex: 1 }}>
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="mobile-button mobile-button--secondary" type="button"
                    onClick={() => setEditingRecord(null)} style={{ flex: 1 }}>
                    Cancel Edit
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* VIEW MODE */}
                {[
                  ["Start Date", fmtDate(viewingRecord.startDate)],
                  ["Finish Date", fmtDate(viewingRecord.finishDate)],
                  ["Supplier", viewingRecord.supplier],
                  ["Batch No", viewingRecord.batchNo],
                  ["Expiry Date", fmtDate(viewingRecord.expireDate)],
                  ["Quantity Purchased", viewingRecord.quantityPurchased],
                  ["Quantity Used", viewingRecord.quantityUsed],
                  ["Animal Identity", viewingRecord.animalIdentity],
                  ["Houses Treated", viewingRecord.housesTreated],
                  ["Birds Treated", viewingRecord.birdsTreated != null ? String(viewingRecord.birdsTreated) : null],
                  ["Withdrawal Period", viewingRecord.withdrawalPeriod],
                  ["Safe Slaughter Date", fmtDate(viewingRecord.safeSlaughterDate)],
                  ["Administrator Name", viewingRecord.administratorName],
                  ["Reason for Treatment", viewingRecord.reasonForTreatment],
                  ["Method of Treatment", viewingRecord.methodOfTreatment],
                  ["Dose mg/g", viewingRecord.dose],
                  ["Total mg/PCU", viewingRecord.totalMgPcu],
                ].map(([label, value]) => value ? (
                  <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", gap: 8 }}>
                    <span style={{ fontSize: "0.82rem", color: "#64748b", flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, textAlign: "right" }}>{value}</span>
                  </div>
                ) : null)}
                {(viewingRecord.report || viewingRecord.prescription) && (
                  <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {viewingRecord.report && (
                      <a href={`/api/farm-documents/file?url=${encodeURIComponent(viewingRecord.report)}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-block", padding: "8px 16px", background: "#1B3A5C", color: "#fff", borderRadius: 8, fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
                        View Report
                      </a>
                    )}
                    {viewingRecord.prescription && (
                      <a href={`/api/farm-documents/file?url=${encodeURIComponent(viewingRecord.prescription)}`} target="_blank" rel="noreferrer"
                        style={{ display: "inline-block", padding: "8px 16px", background: "#1B3A5C", color: "#fff", borderRadius: 8, fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
                        View Prescription
                      </a>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href={`/medication/print?id=${viewingRecord.id}`} target="_blank"
                    style={{ display: "inline-block", padding: "8px 16px", background: "#f1f5f9", color: "#1e293b", borderRadius: 8, fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
                    Print
                  </a>
                  {canOperate && (
                    <>
                      <button className="mobile-button" style={{ background: "#1B3A5C", color: "#fff" }}
                        onClick={() => startEdit(viewingRecord)}>
                        Edit
                      </button>
                      <button className="mobile-button" style={{ background: "#dc2626", color: "#fff" }}
                        onClick={() => setDeleteConfirmId(viewingRecord.id)}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <h1 className="page-intro__title">Medication Records</h1>
            <p className="page-intro__subtitle">
              {farmName} — records are auto-assigned to the crop matching the start date.
            </p>
          </div>
        </div>

        {msg && <div className={`mobile-alert mobile-alert--${msgType}`} style={{ marginBottom: 12 }}>{msg}</div>}

        {/* VET REPORT */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Vet Report</h2>
            <button className="mobile-button mobile-button--secondary" onClick={() => setVetModeOpen(!vetModeOpen)}>
              {vetModeOpen ? "Close" : "Open Vet Report"}
            </button>
          </div>
          {vetModeOpen && (
            <div style={{ marginTop: 16 }}>
              {!activeCropId && (
                <p style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: 8 }}>
                  No active crop found. Vet report is available for the active crop only.
                </p>
              )}
              <label>House</label>
              <select value={vetHouseId} onChange={(e) => setVetHouseId(e.target.value)}>
                <option value="">-- select house --</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <button
                className="mobile-full-button"
                style={{ marginTop: 10 }}
                onClick={generateVetPdf}
                disabled={vetGenerating || !activeCropId || !vetHouseId}
              >
                {vetGenerating ? "Generating..." : "Download Vet Report (CSV)"}
              </button>
            </div>
          )}
        </div>

        {/* ADD FORM */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <h2>Add Medication</h2>
          <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#64748b" }}>
            The crop is determined automatically from the start date.
          </p>
          {folders.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Assign to previous crop (optional)
              </label>
              <select
                value={overrideCropId}
                onChange={e => setOverrideCropId(e.target.value)}
                disabled={!canOperate}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: "0.9rem" }}
              >
                <option value="">— auto (from start date) —</option>
                {folders.map(f => (
                  <option key={f.cropId} value={f.cropId}>
                    Crop {f.cropNumber} — {new Date(f.placementDate).toLocaleDateString("en-GB")}{f.finishDate ? ` → ${new Date(f.finishDate).toLocaleDateString("en-GB")}` : " (active)"}
                  </option>
                ))}
              </select>
            </div>
          )}
          <form onSubmit={saveMedication}>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Start Date *</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required disabled={!canOperate} /></div>
              <div><label>Medicine Name *</label><input value={medicineName} onChange={e => setMedicineName(e.target.value)} required disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Finish Date</label><input type="date" value={finishDate} onChange={e => setFinishDate(e.target.value)} disabled={!canOperate} /></div>
            </div>

            {/* Batch rows */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 4, alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Batch No</span>
                <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Expiry Date</span>
                <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Qty Purchased</span>
                <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Qty Used</span>
                <span />
              </div>
              {batches.map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input value={b.batchNo} onChange={e => setBatches(prev => prev.map((r, j) => j === i ? { ...r, batchNo: e.target.value } : r))} disabled={!canOperate} style={{ margin: 0 }} />
                  <input type="date" value={b.expireDate} onChange={e => setBatches(prev => prev.map((r, j) => j === i ? { ...r, expireDate: e.target.value } : r))} disabled={!canOperate} style={{ margin: 0 }} />
                  <input value={b.quantityPurchased} onChange={e => setBatches(prev => prev.map((r, j) => j === i ? { ...r, quantityPurchased: e.target.value } : r))} disabled={!canOperate} style={{ margin: 0 }} />
                  <input value={b.quantityUsed} onChange={e => setBatches(prev => prev.map((r, j) => j === i ? { ...r, quantityUsed: e.target.value } : r))} disabled={!canOperate} style={{ margin: 0 }} />
                  {batches.length > 1 && canOperate ? (
                    <button type="button" onClick={() => setBatches(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1.1rem", padding: "0 4px", lineHeight: 1 }}>✕</button>
                  ) : <span />}
                </div>
              ))}
              {canOperate && (
                <button type="button" onClick={() => setBatches(prev => [...prev, { batchNo: "", expireDate: "", quantityPurchased: "", quantityUsed: "" }])}
                  style={{ fontSize: "0.8rem", color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 6, padding: "4px 12px", cursor: "pointer", marginTop: 2 }}>
                  + Add row
                </button>
              )}
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Animal Identity</label><input value={animalIdentity} onChange={e => setAnimalIdentity(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Houses Treated</label><input value={housesTreated} onChange={e => setHousesTreated(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Birds Treated</label><input type="number" value={birdsTreated} onChange={e => setBirdsTreated(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Withdrawal Period</label><input value={withdrawalPeriod} onChange={e => setWithdrawalPeriod(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Safe Slaughter Date</label><input type="date" value={safeSlaughterDate} onChange={e => setSafeSlaughterDate(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Administrator Name</label><input value={administratorName} onChange={e => setAdministratorName(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Reason for Treatment</label><input value={reasonForTreatment} onChange={e => setReasonForTreatment(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Method of Treatment</label><input value={methodOfTreatment} onChange={e => setMethodOfTreatment(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Dose mg/g</label><input value={dose} onChange={e => setDose(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Total mg/PCU</label><input value={totalMgPcu} onChange={e => setTotalMgPcu(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2" key={formKey}>
              <div>
                <label>Report (file)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setReportFile(e.target.files?.[0] ?? null)}
                  disabled={!canOperate}
                />
                {reportFile && (
                  <div style={{ fontSize: "0.8rem", color: "#16a34a", marginTop: 4 }}>
                    ✓ {reportFile.name}
                  </div>
                )}
              </div>
              <div>
                <label>Prescription (file)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setPrescriptionFile(e.target.files?.[0] ?? null)}
                  disabled={!canOperate}
                />
                {prescriptionFile && (
                  <div style={{ fontSize: "0.8rem", color: "#16a34a", marginTop: 4 }}>
                    ✓ {prescriptionFile.name}
                  </div>
                )}
              </div>
            </div>
            <button className="mobile-full-button" type="submit" disabled={!canOperate}>
              Save Record
            </button>
          </form>
        </div>

        {/* CROP FOLDERS */}
        {folders.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0, color: "#64748b" }}>No medication records yet.</p>
          </div>
        ) : (
          folders.map((folder) => {
            const isOpen = openFolders.has(folder.cropId);
            return (
              <div key={folder.cropId} className="mobile-card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
                {/* Folder header */}
                <button
                  type="button"
                  onClick={() => toggleFolder(folder.cropId)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    background: isOpen ? "#f0f7ff" : "#f8fafc",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: isOpen ? "1px solid #dbeafe" : "none",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e40af" }}>
                      📁 Crop {folder.cropNumber}
                    </span>
                    <span style={{ marginLeft: 10, fontSize: "0.8rem", color: "#64748b" }}>
                      {fmtDate(folder.placementDate)} – {fmtDate(folder.finishDate)}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#64748b", flexShrink: 0, marginLeft: 8 }}>
                    {folder.records.length} record{folder.records.length !== 1 ? "s" : ""} {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {/* Records inside folder */}
                {isOpen && (
                  <div style={{ padding: "8px 12px 12px" }}>
                    {folder.records.map((record) => (
                      <div
                        key={record.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 8px",
                          borderBottom: "1px solid #f1f5f9",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{record.medicineName}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                            {fmtDate(record.startDate)}
                            {record.finishDate ? ` – ${fmtDate(record.finishDate)}` : ""}
                            {record.housesTreated ? ` · ${record.housesTreated}` : ""}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="mobile-button mobile-button--secondary"
                            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                            onClick={() => setViewingRecord(record)}
                          >
                            View
                          </button>
                          <a
                            href={`/medication/print?id=${record.id}`}
                            target="_blank"
                            className="mobile-button mobile-button--secondary"
                            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                          >
                            Print
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
