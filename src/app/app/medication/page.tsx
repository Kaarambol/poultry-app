"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type MedicationRecord = {
  id: string;
  startDate: string;
  medicineName: string;
  supplier: string | null;
  housesTreated: string | null;
  birdsTreated: number | null;
  finishDate: string | null;
  administratorName: string | null;
  reasonForTreatment: string | null;
};

export default function MedicationPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");

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
  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

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

    if (r.ok) {
      setMyRole(data.role || "");
    } else {
      setMyRole("");
    }
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading active crop.");
      setCropId("");
      setCropLabel("");
      return;
    }

    if (!data) {
      setMsgType("info");
      setMsg("No active crop for the current farm.");
      setCropId("");
      setCropLabel("");
      return;
    }

    setCropId(data.id);
    setCropLabel(data.cropNumber);
    setCurrentCropId(data.id);
    setMsg("");
    loadRecords(data.id);
  }

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/medications/list?cropId=${selectedCropId}`);
    const data = await r.json();
    if (Array.isArray(data)) setRecords(data);
    else setRecords([]);
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadActiveCrop(farmId);
  }, []);

  function validateForm() {
    if (!cropId) return "No active crop selected.";
    if (!startDate) return "Choose start treatment date.";
    if (!medicineName.trim()) return "Medicine name is required.";

    const birdsNum = birdsTreated === "" ? null : Number(birdsTreated);

    if (birdsNum !== null && Number.isNaN(birdsNum)) {
      return "Birds treated must be a valid number.";
    }

    if (birdsNum !== null && birdsNum < 0) {
      return "Birds treated cannot be negative.";
    }

    if (finishDate && startDate && new Date(finishDate) < new Date(startDate)) {
      return "Finish date cannot be earlier than start date.";
    }

    if (safeSlaughterDate && finishDate && new Date(safeSlaughterDate) < new Date(finishDate)) {
      return "Safe slaughter date cannot be earlier than finish date.";
    }

    if (expireDate && startDate && new Date(expireDate) < new Date(startDate)) {
      return "Expire date cannot be earlier than start date.";
    }

    return "";
  }

  async function saveMedication(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setMsgType("error");
      setMsg(validationError);
      return;
    }

    setMsg("");

    const r = await fetch("/api/medications/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cropId,
        startDate,
        medicineName,
        supplier,
        batchNo,
        expireDate,
        quantityPurchased,
        quantityUsed,
        animalIdentity,
        housesTreated,
        birdsTreated: birdsTreated === "" ? null : Number(birdsTreated),
        finishDate,
        withdrawalPeriod,
        safeSlaughterDate,
        administratorName,
        reasonForTreatment,
        methodOfTreatment,
        dose,
        totalMgPcu,
        report,
        prescription,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Medication record saved!");
    setStartDate("");
    setMedicineName("");
    setSupplier("");
    setBatchNo("");
    setExpireDate("");
    setQuantityPurchased("");
    setQuantityUsed("");
    setHousesTreated("");
    setBirdsTreated("");
    setFinishDate("");
    setWithdrawalPeriod("");
    setSafeSlaughterDate("");
    setAdministratorName("");
    setReasonForTreatment("");
    setMethodOfTreatment("");
    setDose("");
    setTotalMgPcu("");
    setReport("");
    setPrescription("");

    loadRecords(cropId);
  }

  const fieldStyle = (hasError: boolean): React.CSSProperties => ({
    width: "100%",
    padding: 12,
    margin: "6px 0 14px",
    border: hasError ? "1px solid #c62828" : "1px solid #ccc",
    borderRadius: 10,
    background: "#fff",
  });

  const cardStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 12,
    background: "#fff",
    padding: 14,
    marginBottom: 14,
  };

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  return (
    <div className="mobile-page">
      <h1>Medication Records</h1>

      <div className="mobile-card">
        {currentFarmId && (
          <p style={{ marginTop: 0 }}>
            <strong>Current Farm:</strong> {farmName || currentFarmId}
          </p>
        )}

        <p>
          <strong>Active Crop:</strong> {cropLabel || "-"}
        </p>

        <p style={{ marginBottom: 0 }}>
          <strong>Your role:</strong> {myRole || "-"}
        </p>
      </div>

      {readOnly && (
        <div className="mobile-card">
          <p style={{ margin: 0 }}>Read-only mode. VIEWER can only see records.</p>
        </div>
      )}

      <div className="mobile-card">
        <h2 style={{ marginTop: 0 }}>Add Medication Record</h2>

        <form onSubmit={saveMedication}>
          <label>Date of Start Treatment</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={fieldStyle(!startDate && !!msg && msgType === "error")}
            required
            disabled={!cropId || !canOperate}
          />

          <label>Name of Medicine</label>
          <input
            value={medicineName}
            onChange={(e) => setMedicineName(e.target.value)}
            style={fieldStyle(!medicineName.trim() && !!msg && msgType === "error")}
            required
            disabled={!cropId || !canOperate}
          />

          <label>Supplier of Medicine</label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Batch No</label>
          <input
            value={batchNo}
            onChange={(e) => setBatchNo(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Expire Date</label>
          <input
            type="date"
            value={expireDate}
            onChange={(e) => setExpireDate(e.target.value)}
            style={fieldStyle(
              !!expireDate && !!startDate && new Date(expireDate) < new Date(startDate)
            )}
            disabled={!cropId || !canOperate}
          />

          <label>Quantity Purchased</label>
          <input
            value={quantityPurchased}
            onChange={(e) => setQuantityPurchased(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Quantity Used</label>
          <input
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Identity of Animal Treated</label>
          <input
            value={animalIdentity}
            onChange={(e) => setAnimalIdentity(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Houses Treated</label>
          <input
            value={housesTreated}
            onChange={(e) => setHousesTreated(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Number of Birds Treated</label>
          <input
            type="number"
            min="0"
            value={birdsTreated}
            onChange={(e) => setBirdsTreated(e.target.value)}
            style={fieldStyle(birdsTreated !== "" && Number(birdsTreated) < 0)}
            disabled={!cropId || !canOperate}
          />

          <label>Date Treatment Finished</label>
          <input
            type="date"
            value={finishDate}
            onChange={(e) => setFinishDate(e.target.value)}
            style={fieldStyle(
              !!finishDate && !!startDate && new Date(finishDate) < new Date(startDate)
            )}
            disabled={!cropId || !canOperate}
          />

          <label>Withdrawal Period</label>
          <input
            value={withdrawalPeriod}
            onChange={(e) => setWithdrawalPeriod(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Safe Date of Slaughter</label>
          <input
            type="date"
            value={safeSlaughterDate}
            onChange={(e) => setSafeSlaughterDate(e.target.value)}
            style={fieldStyle(
              !!safeSlaughterDate &&
                !!finishDate &&
                new Date(safeSlaughterDate) < new Date(finishDate)
            )}
            disabled={!cropId || !canOperate}
          />

          <label>Name of Administrator</label>
          <input
            value={administratorName}
            onChange={(e) => setAdministratorName(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Reason for Treatment</label>
          <input
            value={reasonForTreatment}
            onChange={(e) => setReasonForTreatment(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Method of Treatment</label>
          <input
            value={methodOfTreatment}
            onChange={(e) => setMethodOfTreatment(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Dose mg/g</label>
          <input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Total mg/PCU</label>
          <input
            value={totalMgPcu}
            onChange={(e) => setTotalMgPcu(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Report</label>
          <input
            value={report}
            onChange={(e) => setReport(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          <label>Prescription</label>
          <input
            value={prescription}
            onChange={(e) => setPrescription(e.target.value)}
            style={fieldStyle(false)}
            disabled={!cropId || !canOperate}
          />

          {canOperate && (
            <div className="mobile-actions">
              <button
                className="mobile-full-button"
                style={{ padding: 14, borderRadius: 10 }}
                type="submit"
                disabled={!cropId}
              >
                Save Medication Record
              </button>
            </div>
          )}
        </form>
      </div>

      {msg && (
        <div
          className="mobile-card"
          style={{
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
        </div>
      )}

      {cropId && (
        <>
          <h2>Saved Medication Records</h2>
          {records.length === 0 ? (
            <p>No medication records yet.</p>
          ) : (
            records.map((record) => (
              <div key={record.id} style={cardStyle}>
                <p><strong>Start Date:</strong> {new Date(record.startDate).toLocaleDateString()}</p>
                <p><strong>Medicine:</strong> {record.medicineName}</p>
                <p><strong>Supplier:</strong> {record.supplier || "-"}</p>
                <p><strong>Houses:</strong> {record.housesTreated || "-"}</p>
                <p><strong>Birds:</strong> {record.birdsTreated ?? "-"}</p>
                <p><strong>Finish Date:</strong> {record.finishDate ? new Date(record.finishDate).toLocaleDateString() : "-"}</p>
                <p><strong>Administrator:</strong> {record.administratorName || "-"}</p>
                <p style={{ marginBottom: 8 }}><strong>Reason:</strong> {record.reasonForTreatment || "-"}</p>

                <div className="mobile-actions">
                  <a
                    href={`/app/medication/print?id=${record.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #ccc",
                      textDecoration: "none",
                      textAlign: "center",
                      background: "#fff",
                    }}
                  >
                    Print
                  </a>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}