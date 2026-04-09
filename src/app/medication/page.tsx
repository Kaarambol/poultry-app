"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId, isViewingHistory } from "@/lib/app-context";
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

export default function MedicationPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [historyMode, setHistoryMode] = useState(false);

  const [houses, setHouses] = useState<House[]>([]);
  const [vetModeOpen, setVetModeOpen] = useState(false);
  const [vetCropId, setVetCropId] = useState("");
  const [vetHouseId, setVetHouseId] = useState("");
  const [vetGenerating, setVetGenerating] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [quantityPurchased, setQuantityPurchased] = useState("");
  const [quantityUsed, setQuantityUsed] = useState("");
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
  const [report, setReport] = useState("");
  const [prescription, setPrescription] = useState("");

  const [folders, setFolders] = useState<CropFolder[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
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
    if (r.ok && data) setCurrentCropId(data.id);
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
    setHistoryMode(isViewingHistory());
    const farmId = getCurrentFarmId();
    if (!farmId) return;
    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadActiveCrop(farmId);
    loadHouses(farmId);
    loadAllRecords(farmId);
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
    if (!vetCropId || !vetHouseId) {
      setMsgType("error");
      setMsg("Please select a crop and house.");
      return;
    }
    try {
      setVetGenerating(true);
      const url = `/api/medications/vet-report?cropId=${encodeURIComponent(vetCropId)}&houseId=${encodeURIComponent(vetHouseId)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Server error");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Vet-Report-Crop-${vetCropId}.csv`;
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
    setStartDate(""); setMedicineName(""); setSupplier(""); setBatchNo("");
    setExpireDate(""); setQuantityPurchased(""); setQuantityUsed("");
    setAnimalIdentity("Broiler"); setHousesTreated(""); setBirdsTreated("");
    setFinishDate(""); setWithdrawalPeriod(""); setSafeSlaughterDate("");
    setAdministratorName(""); setReasonForTreatment(""); setMethodOfTreatment("");
    setDose(""); setTotalMgPcu(""); setReport(""); setPrescription("");
  }

  async function saveMedication(e: React.FormEvent) {
    e.preventDefault();
    if (!currentFarmId) {
      setMsgType("error");
      setMsg("No farm selected.");
      return;
    }
    const r = await fetch("/api/medications/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId: currentFarmId,
        startDate, medicineName, supplier, batchNo, expireDate,
        quantityPurchased, quantityUsed, animalIdentity, housesTreated,
        birdsTreated: birdsTreated === "" ? null : Number(birdsTreated),
        finishDate, withdrawalPeriod, safeSlaughterDate, administratorName,
        reasonForTreatment, methodOfTreatment, dose, totalMgPcu, report, prescription,
      }),
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

  const canOperate = canOperateUi(myRole) && !historyMode;

  return (
    <div className="mobile-page">
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
              <label>Crop</label>
              <select value={vetCropId} onChange={(e) => setVetCropId(e.target.value)}>
                <option value="">-- select crop --</option>
                {folders.map((f) => (
                  <option key={f.cropId} value={f.cropId}>
                    Crop {f.cropNumber} ({fmtDate(f.placementDate)} – {fmtDate(f.finishDate)})
                  </option>
                ))}
              </select>
              <label style={{ marginTop: 10 }}>House</label>
              <select value={vetHouseId} onChange={(e) => setVetHouseId(e.target.value)}>
                <option value="">-- select house --</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <button
                className="mobile-full-button"
                style={{ marginTop: 10 }}
                onClick={generateVetPdf}
                disabled={vetGenerating || !vetCropId || !vetHouseId}
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
          <form onSubmit={saveMedication}>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Start Date *</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required disabled={!canOperate} /></div>
              <div><label>Medicine Name *</label><input value={medicineName} onChange={e => setMedicineName(e.target.value)} required disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Batch No</label><input value={batchNo} onChange={e => setBatchNo(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Expiry Date</label><input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Finish Date</label><input type="date" value={finishDate} onChange={e => setFinishDate(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Quantity Purchased</label><input value={quantityPurchased} onChange={e => setQuantityPurchased(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Quantity Used</label><input value={quantityUsed} onChange={e => setQuantityUsed(e.target.value)} disabled={!canOperate} /></div>
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
            <div className="mobile-grid mobile-grid--2">
              <div><label>Report</label><input value={report} onChange={e => setReport(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Prescription</label><input value={prescription} onChange={e => setPrescription(e.target.value)} disabled={!canOperate} /></div>
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
                        <a
                          href={`/medication/print?id=${record.id}`}
                          target="_blank"
                          className="mobile-button mobile-button--secondary"
                          style={{ flexShrink: 0, fontSize: "0.8rem", padding: "4px 10px" }}
                        >
                          Print
                        </a>
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
