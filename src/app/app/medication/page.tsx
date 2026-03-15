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

  const [houses, setHouses] = useState<House[]>([]);
  const [vetModeOpen, setVetModeOpen] = useState(false);
  const [vetHouseId, setVetHouseId] = useState("");
  const [vetGenerating, setVetGenerating] = useState(false);

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

  async function loadHouses(farmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${farmId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setHouses(data);
    } else {
      setHouses([]);
    }
  }

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/medications/list?cropId=${selectedCropId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setRecords(data);
    } else {
      setRecords([]);
    }
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
    loadHouses(farmId);
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

  async function generateVetPdf() {
    if (!cropId) {
      setMsgType("error");
      setMsg("No active crop selected.");
      return;
    }

    if (!vetHouseId) {
      setMsgType("error");
      setMsg("Choose a house for the vet report.");
      return;
    }

    try {
      setVetGenerating(true);

      const url = `/api/medications/vet-report?cropId=${encodeURIComponent(
        cropId
      )}&houseId=${encodeURIComponent(vetHouseId)}`;

      const response = await fetch(url);

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.error || "Error generating PDF.");
        }
        throw new Error("Error generating PDF.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "vet-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setMsgType("success");
      setMsg("Vet PDF generated.");
    } catch (error: any) {
      setMsgType("error");
      setMsg(error.message || "Error generating vet PDF.");
    } finally {
      setVetGenerating(false);
    }
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

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
            <div className="page-intro__eyebrow">Medication register</div>
            <h1 className="page-intro__title">Medication Records</h1>
            <p className="page-intro__subtitle">
              Register treatment details for the active crop and keep a clean printable list.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Context</div>
              <div>Active crop: {cropLabel || "-"}</div>
              <div style={{ marginTop: 6 }}>Your role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can only see records.
          </div>
        )}

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ marginBottom: 6 }}>Vet Report</h2>
              <p style={{ margin: 0 }}>
                Generate a 7-day PDF summary for a selected house.
              </p>
            </div>

            <button
              type="button"
              className="mobile-button mobile-button--secondary"
              onClick={() => setVetModeOpen((v) => !v)}
              disabled={!cropId}
            >
              {vetModeOpen ? "Close Vet" : "Vet"}
            </button>
          </div>

          {vetModeOpen && (
            <div style={{ marginTop: 16 }}>
              <label>Select house</label>
              <select
                value={vetHouseId}
                onChange={(e) => setVetHouseId(e.target.value)}
              >
                <option value="">-- choose house --</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                    {house.code ? ` (${house.code})` : ""}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="mobile-full-button"
                  onClick={generateVetPdf}
                  disabled={!cropId || !vetHouseId || vetGenerating}
                >
                  {vetGenerating ? "Generating..." : "Generate Vet PDF"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mobile-card">
          <h2>Add Medication Record</h2>

          <form onSubmit={saveMedication}>
            <h3 style={{ marginBottom: 10 }}>Basic treatment data</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Date of Start Treatment</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Name of Medicine</label>
                <input
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  required
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Supplier of Medicine</label>
                <input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Batch No</label>
                <input
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Expire Date</label>
                <input
                  type="date"
                  value={expireDate}
                  onChange={(e) => setExpireDate(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Finish Date</label>
                <input
                  type="date"
                  value={finishDate}
                  onChange={(e) => setFinishDate(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <h3 style={{ marginTop: 10, marginBottom: 10 }}>Quantities and flock</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Quantity Purchased</label>
                <input
                  value={quantityPurchased}
                  onChange={(e) => setQuantityPurchased(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Quantity Used</label>
                <input
                  value={quantityUsed}
                  onChange={(e) => setQuantityUsed(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Identity of Animal Treated</label>
                <input
                  value={animalIdentity}
                  onChange={(e) => setAnimalIdentity(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Houses Treated</label>
                <input
                  value={housesTreated}
                  onChange={(e) => setHousesTreated(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Birds Treated</label>
                <input
                  type="number"
                  min="0"
                  value={birdsTreated}
                  onChange={(e) => setBirdsTreated(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Withdrawal Period</label>
                <input
                  value={withdrawalPeriod}
                  onChange={(e) => setWithdrawalPeriod(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Safe Slaughter Date</label>
                <input
                  type="date"
                  value={safeSlaughterDate}
                  onChange={(e) => setSafeSlaughterDate(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Administrator Name</label>
                <input
                  value={administratorName}
                  onChange={(e) => setAdministratorName(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <h3 style={{ marginTop: 10, marginBottom: 10 }}>Clinical details</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Reason for Treatment</label>
                <input
                  value={reasonForTreatment}
                  onChange={(e) => setReasonForTreatment(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Method of Treatment</label>
                <input
                  value={methodOfTreatment}
                  onChange={(e) => setMethodOfTreatment(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Dose mg/g</label>
                <input
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Total mg/PCU</label>
                <input
                  value={totalMgPcu}
                  onChange={(e) => setTotalMgPcu(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Report</label>
                <input
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Prescription</label>
                <input
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit" disabled={!cropId}>
                    Save Medication Record
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {cropId && (
          <>
            <h2 className="mobile-section-title">Saved Medication Records</h2>

            {records.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No medication records yet.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {records.map((record) => (
                  <div key={record.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {record.medicineName} · {new Date(record.startDate).toLocaleDateString()}
                    </h3>

                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Supplier</strong>
                        <span>{record.supplier || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Houses</strong>
                        <span>{record.housesTreated || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds</strong>
                        <span>{record.birdsTreated ?? "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Finish date</strong>
                        <span>
                          {record.finishDate
                            ? new Date(record.finishDate).toLocaleDateString()
                            : "-"}
                        </span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Administrator</strong>
                        <span>{record.administratorName || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Reason</strong>
                        <span>{record.reasonForTreatment || "-"}</span>
                      </div>
                    </div>

                    <div className="mobile-actions" style={{ marginTop: 12 }}>
                      <a
                        href={`/app/medication/print?id=${record.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mobile-button mobile-button--secondary"
                        style={{ textAlign: "center" }}
                      >
                        Print
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}