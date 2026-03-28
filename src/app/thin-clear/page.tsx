"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";

type PlacementRow = {
  id: string;
  houseId: string;
  houseName: string;
  birdsPlaced: number;
  thinDate: string | null;
  thinBirds: number | null;
  thin2Date: string | null;
  thin2Birds: number | null;
  clearDate: string | null;
  clearBirds: number | null;
  notes: string | null;
};

type CropResponse = {
  crop: {
    id: string;
    cropNumber: string;
    placementDate: string;
    status: string;
  };
  placements: PlacementRow[];
};

export default function ThinClearPage() {
  const [cropId, setCropIdState] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const [loading, setLoading] = useState(true);

  async function loadPage() {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    const activeCropRes = await fetch(`/api/crops/active?farmId=${farmId}`);
    const activeCropData = await activeCropRes.json();

    if (!activeCropRes.ok || !activeCropData?.id) {
      setMsgType("info");
      setMsg("No active crop for this farm.");
      return;
    }

    const resolvedCropId = String(activeCropData.id);
    setCurrentCropId(resolvedCropId);
    setCropIdState(resolvedCropId);

    const r = await fetch(`/api/crops/${resolvedCropId}/thin-clear`);
    const data: CropResponse | { error: string } = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg("error" in data ? data.error : "Error loading thin/clear setup.");
      return;
    }

    const payload = data as CropResponse;
    setCropLabel(payload.crop.cropNumber);
    setRows(Array.isArray(payload.placements) ? payload.placements : []);
    setMsg("");
  }

  useEffect(() => {
    async function init() {
      try {
        await loadPage();
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  function updateRow(
    placementId: string,
    field: keyof PlacementRow,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === placementId
          ? {
              ...row,
              [field]:
                field === "thinBirds" ||
                field === "thin2Birds" ||
                field === "clearBirds"
                  ? value === ""
                    ? null
                    : Number(value)
                  : value === ""
                  ? null
                  : value,
            }
          : row
      )
    );
  }

  async function saveRow(row: PlacementRow) {
    if (row.thinDate && !row.thinBirds) {
      setMsgType("info");
      setMsg(`${row.houseName}: Thin Date 1 is set but Thin Birds 1 count is missing — targets won't adjust until birds count is entered.`);
    }
    if (row.thin2Date && !row.thin2Birds) {
      setMsgType("info");
      setMsg(`${row.houseName}: Thin Date 2 is set but Thin Birds 2 count is missing — targets won't adjust until birds count is entered.`);
    }
    const r = await fetch(`/api/crops/${cropId}/thin-clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placementId: row.id,
        thinDate: row.thinDate,
        thinBirds: row.thinBirds,
        thin2Date: row.thin2Date,
        thin2Birds: row.thin2Birds,
        clearDate: row.clearDate,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Save error.");
      return;
    }

    setMsgType("success");
    setMsg(`Saved ${row.houseName}.`);
    await loadPage();
  }

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
      ? "mobile-alert mobile-alert--success"
      : "mobile-alert";

  if (loading) {
    return (
      <div className="mobile-page">
        <div className="page-shell">
          <div className="mobile-card">
            <p style={{ margin: 0 }}>Loading thin / clear setup...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Crop adjustments</div>
            <h1 className="page-intro__title">Thin / Clear Setup</h1>
            <p className="page-intro__subtitle">
              Set thin and clear dates and removed bird counts per house.
            </p>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <h2>Active Crop</h2>
          <p style={{ margin: 0 }}>{cropLabel || "-"}</p>
        </div>

        {rows.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No houses found.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {rows.map((row) => (
              <div key={row.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">
                  {row.houseName}
                </h3>

                <div className="mobile-record-row">
                  <strong>Total birds placed</strong>
                  <span>{row.birdsPlaced}</span>
                </div>

                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Thin Date 1</label>
                    <input
                      type="date"
                      value={row.thinDate ? row.thinDate.slice(0, 10) : ""}
                      onChange={(e) =>
                        updateRow(row.id, "thinDate", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label>Thin Birds 1</label>
                    <input
                      type="number"
                      min="0"
                      value={row.thinBirds ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, "thinBirds", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Thin Date 2</label>
                    <input
                      type="date"
                      value={row.thin2Date ? row.thin2Date.slice(0, 10) : ""}
                      onChange={(e) =>
                        updateRow(row.id, "thin2Date", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label>Thin Birds 2</label>
                    <input
                      type="number"
                      min="0"
                      value={row.thin2Birds ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, "thin2Birds", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label>Clear Date</label>
                  <input
                    type="date"
                    value={row.clearDate ? row.clearDate.slice(0, 10) : ""}
                    onChange={(e) =>
                      updateRow(row.id, "clearDate", e.target.value)
                    }
                  />
                </div>

                <div className="mobile-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="mobile-button mobile-button--secondary"
                    onClick={() => saveRow(row)}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}