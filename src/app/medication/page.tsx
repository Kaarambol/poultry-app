"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type House = {
  id: string;
  name: string;
  code: string | null;
};

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

export default function MedicationPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");

  const [houses, setHouses] = useState<House[]>([]);
  const [vetModeOpen, setVetModeOpen] = useState(false);
  const [vetHouseId, setVetHouseId] = useState("");
  const [vetGenerating, setVetGenerating] = useState(false);

  // FULL STATE - NO ROWS REMOVED
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

  const [records, setRecords] = useState<MedicationRecord[]>([]);
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
      setCropId(data.id);
      setCropLabel(data.cropNumber);
      setCurrentCropId(data.id);
      loadRecords(data.id);
    } else {
      setMsg("No active crop found.");
    }
  }

  async function loadHouses(farmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${farmId}`);
    const data = await r.json();
    if (Array.isArray(data)) setHouses(data);
  }

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/medications/list?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setRecords(data);
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();
    if (!farmId) return;
    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadActiveCrop(farmId);
    loadHouses(farmId);
  }, []);

  async function generateVetPdf() {
    if (!cropId || !vetHouseId) {
      setMsgType("error");
      setMsg("Please select a house.");
      return;
    }
    try {
      setVetGenerating(true);
      const url = `/api/medications/vet-report?cropId=${encodeURIComponent(cropId)}&houseId=${encodeURIComponent(vetHouseId)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Server error");
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Vet-Report-House-${vetHouseId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMsgType("success");
      setMsg("Report downloaded.");
    } catch (error) {
      setMsgType("error");
      setMsg("Error generating report.");
    } finally {
      setVetGenerating(false);
    }
  }

  async function saveMedication(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/medications/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cropId, startDate, medicineName, supplier, batchNo, expireDate,
        quantityPurchased, quantityUsed, animalIdentity, housesTreated,
        birdsTreated: birdsTreated === "" ? null : Number(birdsTreated),
        finishDate, withdrawalPeriod, safeSlaughterDate, administratorName,
        reasonForTreatment, methodOfTreatment, dose, totalMgPcu, report, prescription,
      }),
    });
    if (r.ok) {
      setMsgType("success");
      setMsg("Saved successfully!");
      setStartDate(""); setMedicineName(""); setSupplier(""); setBatchNo("");
      setExpireDate(""); setQuantityPurchased(""); setQuantityUsed("");
      setAnimalIdentity("Broiler"); setHousesTreated(""); setBirdsTreated("");
      setFinishDate(""); setWithdrawalPeriod(""); setSafeSlaughterDate("");
      setAdministratorName(""); setReasonForTreatment(""); setWithdrawalPeriod("");
      setMethodOfTreatment(""); setDose(""); setTotalMgPcu(""); setReport(""); setPrescription("");
      loadRecords(cropId);
    }
  }

  const canOperate = canOperateUi(myRole);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <h1 className="page-intro__title">Medication Records</h1>
            <p>{farmName} | Crop: {cropLabel}</p>
          </div>
        </div>

        {msg && <div className={`mobile-alert mobile-alert--${msgType}`}>{msg}</div>}

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Vet Report</h2>
            <button className="mobile-button mobile-button--secondary" onClick={() => setVetModeOpen(!vetModeOpen)}>
              {vetModeOpen ? "Close" : "Open Vet Report"}
            </button>
          </div>
          {vetModeOpen && (
            <div style={{ marginTop: 16 }}>
              <select value={vetHouseId} onChange={(e) => setVetHouseId(e.target.value)}>
                <option value="">-- select house --</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <button className="mobile-full-button" style={{ marginTop: 10 }} onClick={generateVetPdf} disabled={vetGenerating || !vetHouseId}>
                {vetGenerating ? "Generating..." : "Download Vet Report (CSV)"}
              </button>
            </div>
          )}
        </div>

        <div className="mobile-card">
          <h2>Add Medication</h2>
          <form onSubmit={saveMedication}>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required disabled={!canOperate} /></div>
              <div><label>Medicine Name</label><input value={medicineName} onChange={e => setMedicineName(e.target.value)} required disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Supplier</label><input value={supplier} onChange={e => setSupplier(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Batch No</label><input value={batchNo} onChange={e => setBatchNo(e.target.value)} disabled={!canOperate} /></div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div><label>Expire Date</label><input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} disabled={!canOperate} /></div>
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
            <button className="mobile-full-button" type="submit" disabled={!canOperate}>Save Record</button>
          </form>
        </div>

        <div className="mobile-record-list" style={{ marginTop: 24 }}>
          {records.map((record) => (
            <div key={record.id} className="mobile-record-card">
              <h3>{record.medicineName} ({new Date(record.startDate).toLocaleDateString()})</h3>
              <div className="mobile-actions" style={{ marginTop: 12 }}>
                <a href={`/medication/print?id=${record.id}`} target="_blank" className="mobile-button mobile-button--secondary">
                  Print
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}