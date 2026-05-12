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

type House = { id: string; name: string };

export default function ThinClearPage() {
  const [cropId, setCropIdState] = useState("");
  const [cropLabel, setCropLabel] = useState("");
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [allHouses, setAllHouses] = useState<House[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");
  const [loading, setLoading] = useState(true);

  // Add placement form
  const [addHouseId, setAddHouseId] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().slice(0, 10));
  const [addBirds, setAddBirds] = useState("");
  const [addFlock, setAddFlock] = useState("");
  const [addHatchery, setAddHatchery] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [addMsgType, setAddMsgType] = useState<"error" | "success">("error");

  async function loadPage() {
    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    // Load all farm houses for the add-placement dropdown
    fetch(`/api/houses/list?farmId=${farmId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAllHouses(d); })
      .catch(() => {});

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

  async function saveAll() {
    const warnings: string[] = [];

    for (const row of rows) {
      if (row.thinDate && !row.thinBirds) {
        warnings.push(`${row.houseName}: Thin Date 1 set but Thin Birds 1 missing.`);
      }
      if (row.thin2Date && !row.thin2Birds) {
        warnings.push(`${row.houseName}: Thin Date 2 set but Thin Birds 2 missing.`);
      }
    }

    for (const row of rows) {
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
        setMsg(data.error || `Save error for ${row.houseName}.`);
        return;
      }
    }

    if (warnings.length > 0) {
      setMsgType("info");
      setMsg(warnings.join(" "));
    } else {
      setMsgType("success");
      setMsg("All houses saved.");
    }
    await loadPage();
  }

  async function addPlacement(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");
    if (!cropId) { setAddMsgType("error"); setAddMsg("No active crop."); return; }
    if (!addHouseId) { setAddMsgType("error"); setAddMsg("Choose a house."); return; }
    if (!addDate) { setAddMsgType("error"); setAddMsg("Choose a date."); return; }
    if (!addBirds || Number(addBirds) <= 0) { setAddMsgType("error"); setAddMsg("Enter birds placed."); return; }

    const r = await fetch("/api/crops/add-placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cropId,
        houseId: addHouseId,
        placementDate: addDate,
        birdsPlaced: Number(addBirds),
        flockNumber: addFlock || null,
        hatchery: addHatchery || null,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setAddMsgType("error");
      setAddMsg(data.error || "Error adding placement.");
      return;
    }
    setAddMsgType("success");
    setAddMsg("House added to crop.");
    setAddHouseId(""); setAddBirds(""); setAddFlock(""); setAddHatchery("");
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

        {/* Add house / placement to active crop */}
        <div className="mobile-card" style={{ marginBottom: 16, borderLeft: "4px solid #2563eb" }}>
          <h2 style={{ marginTop: 0 }}>Add House to Crop</h2>
          <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-soft)" }}>
            Use when a house was placed after the crop was created (e.g. delivery split over 2 days).
          </p>
          <form onSubmit={addPlacement}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>House</label>
                <select value={addHouseId} onChange={e => setAddHouseId(e.target.value)}>
                  <option value="">— choose —</option>
                  {allHouses.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Placement Date</label>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} />
              </div>
            </div>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Birds Placed</label>
                <input type="number" min="1" value={addBirds} onChange={e => setAddBirds(e.target.value)} placeholder="e.g. 40000" />
              </div>
              <div>
                <label>Flock Number</label>
                <input type="text" value={addFlock} onChange={e => setAddFlock(e.target.value)} placeholder="optional" />
              </div>
            </div>
            <div>
              <label>Hatchery</label>
              <input type="text" value={addHatchery} onChange={e => setAddHatchery(e.target.value)} placeholder="optional" />
            </div>
            {addMsg && (
              <div className={addMsgType === "error" ? "mobile-alert mobile-alert--error" : "mobile-alert mobile-alert--success"} style={{ marginTop: 8 }}>
                {addMsg}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="mobile-full-button" disabled={!cropId}>
                Add House to Crop
              </button>
            </div>
          </form>
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

              </div>
            ))}

            <div className="mobile-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="mobile-button mobile-button--secondary"
                onClick={saveAll}
                disabled={!cropId}
              >
                Save All Houses
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}