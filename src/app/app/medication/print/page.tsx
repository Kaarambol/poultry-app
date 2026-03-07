"use client";

import { useEffect, useState } from "react";

type MedicationDetails = {
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
  crop: {
    cropNumber: string;
    farm: {
      name: string;
      code: string;
    };
  };
};

export default function MedicationPrintPage() {
  const [record, setRecord] = useState<MedicationDetails | null>(null);
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      setMsg("Missing medication record id.");
      return;
    }

    fetch(`/api/medications/details?id=${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setMsg(data.error || "Error");
          return;
        }
        setRecord(data);
        setMsg("");
      })
      .catch(() => {
        setMsg("Failed to load medication record.");
      });
  }, []);

  function formatDate(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-GB");
  }

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "20px auto",
        fontFamily: "Arial, sans-serif",
        color: "#000",
      }}
    >
      <style>{`
        @media print {
          button {
            display: none !important;
          }
          body {
            margin: 0;
          }
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td, th {
          border: 1px solid #000;
          padding: 8px;
          vertical-align: top;
          font-size: 14px;
        }
        .label {
          font-weight: 700;
          width: 32%;
          background: #f5f5f5;
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          margin: 24px 0 8px;
        }
      `}</style>

      <button
        type="button"
        onClick={() => window.print()}
        style={{ marginBottom: 20, padding: "10px 16px" }}
      >
        Print
      </button>

      <div className="title">Medication Record</div>

      {msg && <p>{msg}</p>}

      {record && (
        <>
          <table>
            <tbody>
              <tr>
                <td className="label">Farm Name</td>
                <td>{record.crop.farm.name}</td>
                <td className="label">Farm Code</td>
                <td>{record.crop.farm.code}</td>
              </tr>
              <tr>
                <td className="label">Crop No</td>
                <td>{record.crop.cropNumber}</td>
                <td className="label">Identity of Animal Treated</td>
                <td>{record.animalIdentity || ""}</td>
              </tr>
              <tr>
                <td className="label">Date of Start Treatment</td>
                <td>{formatDate(record.startDate)}</td>
                <td className="label">Date Treatment Finished</td>
                <td>{formatDate(record.finishDate)}</td>
              </tr>
              <tr>
                <td className="label">Name of Medicine</td>
                <td>{record.medicineName}</td>
                <td className="label">Supplier of Medicine</td>
                <td>{record.supplier || ""}</td>
              </tr>
              <tr>
                <td className="label">Batch No</td>
                <td>{record.batchNo || ""}</td>
                <td className="label">Expire Date</td>
                <td>{formatDate(record.expireDate)}</td>
              </tr>
              <tr>
                <td className="label">Quantity Purchased</td>
                <td>{record.quantityPurchased || ""}</td>
                <td className="label">Quantity Used</td>
                <td>{record.quantityUsed || ""}</td>
              </tr>
              <tr>
                <td className="label">Houses Treated</td>
                <td>{record.housesTreated || ""}</td>
                <td className="label">Number of Birds Treated</td>
                <td>{record.birdsTreated ?? ""}</td>
              </tr>
              <tr>
                <td className="label">Withdrawal Period</td>
                <td>{record.withdrawalPeriod || ""}</td>
                <td className="label">Safe Date of Slaughter</td>
                <td>{formatDate(record.safeSlaughterDate)}</td>
              </tr>
              <tr>
                <td className="label">Name of Administrator</td>
                <td>{record.administratorName || ""}</td>
                <td className="label">Method of Treatment</td>
                <td>{record.methodOfTreatment || ""}</td>
              </tr>
              <tr>
                <td className="label">Dose mg/g</td>
                <td>{record.dose || ""}</td>
                <td className="label">Total mg/PCU</td>
                <td>{record.totalMgPcu || ""}</td>
              </tr>
              <tr>
                <td className="label">Reason for Treatment</td>
                <td colSpan={3}>{record.reasonForTreatment || ""}</td>
              </tr>
              <tr>
                <td className="label">Report</td>
                <td colSpan={3}>{record.report || ""}</td>
              </tr>
              <tr>
                <td className="label">Prescription</td>
                <td colSpan={3}>{record.prescription || ""}</td>
              </tr>
            </tbody>
          </table>

          <div className="section-title">Signature / Notes</div>
          <table>
            <tbody>
              <tr>
                <td style={{ height: 100 }}></td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}