"use client";

import { useEffect, useMemo, useState, use } from "react";

type Placement = {
  id: string;
  houseId: string;
  house?: {
    id: string;
    name: string;
  };
  houseName?: string;
  batchNo: number;
  placementDate: string;
  hatchery: string | null;
  flockNumber: string | null;
  birdsPlaced: number;
  parentAgeWeeks: number | null;
  notes: string | null;
};

type CropHeader = {
  id: string;
  cropNumber: string;
  placementDate: string;
  breed: string | null;
  hatchery: string | null;
  chickenPricePerKg: number | null;
  salePricePerKgAllIn: number | null;
  currency: string | null;
  notes: string | null;
  status: string;
};

export default function EditCropPage({
  params,
}: {
  params: Promise<{ cropId: string }>;
}) {
  // Rozpakowanie params zgodnie z nowym standardem Next.js
  const resolvedParams = use(params);
  const cropId = resolvedParams.cropId;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  const [cropNumber, setCropNumber] = useState("");
  const [placementDate, setPlacementDate] = useState("");
  const [breed, setBreed] = useState("");
  const [hatchery, setHatchery] = useState("");
  const [chickenPricePerKg, setChickenPricePerKg] = useState("");
  const [salePricePerKgAllIn, setSalePricePerKgAllIn] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [notes, setNotes] = useState("");

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [dependentCounts, setDependentCounts] = useState({
    dailyRecords: 0,
    nightChecks: 0,
    medicationRecords: 0,
  });

  useEffect(() => {
    async function init() {
      const r = await fetch(`/api/crops/details?cropId=${cropId}`);
      const data = await r.json();

      if (!r.ok) {
        setMsgType("error");
        setMsg(data?.error || "Error loading crop.");
        setLoading(false);
        return;
      }

      const crop: CropHeader | null =
        data?.crop ??
        (data?.id && data?.cropNumber ? data : null);

      const placementsData: Placement[] =
        Array.isArray(data?.placements) ? data.placements : [];

      if (!crop) {
        setMsgType("error");
        setMsg("Crop details response has unexpected format.");
        setLoading(false);
        return;
      }

      setCropNumber(crop.cropNumber || "");
      setPlacementDate(crop.placementDate?.slice(0, 10) || "");
      setBreed(crop.breed || "");
      setHatchery(crop.hatchery || "");
      setChickenPricePerKg(
        crop.chickenPricePerKg !== null && crop.chickenPricePerKg !== undefined
          ? String(crop.chickenPricePerKg)
          : ""
      );
      setSalePricePerKgAllIn(
        crop.salePricePerKgAllIn !== null && crop.salePricePerKgAllIn !== undefined
          ? String(crop.salePricePerKgAllIn)
          : ""
      );
      setCurrency(crop.currency || "GBP");
      setNotes(crop.notes || "");
      setPlacements(placementsData);

      const [dailyRes, nightRes, medRes] = await Promise.all([
        fetch(`/api/daily-records/list?cropId=${cropId}`),
        fetch(`/api/night-check/list?cropId=${cropId}`),
        fetch(`/api/medications/list?cropId=${cropId}`),
      ]);

      const [dailyData, nightData, medData] = await Promise.all([
        dailyRes.json(),
        nightRes.json(),
        medRes.json(),
      ]);

      setDependentCounts({
        dailyRecords: Array.isArray(dailyData) ? dailyData.length : 0,
        nightChecks: Array.isArray(nightData) ? nightData.length : 0,
        medicationRecords: Array.isArray(medData) ? medData.length : 0,
      });

      setLoading(false);
    }

    init();
  }, [cropId]);

  function updatePlacement(
    id: string,
    field: keyof Placement,
    value: string | number | null
  ) {
    setPlacements((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  const hasDependentData = useMemo(() => {
    return (
      dependentCounts.dailyRecords > 0 ||
      dependentCounts.nightChecks > 0 ||
      dependentCounts.medicationRecords > 0
    );
  }, [dependentCounts]);

  async function saveCrop(e: React.FormEvent) {
    e.preventDefault();

    if (hasDependentData) {
      const confirmed = window.confirm(
        `Editing this crop will delete dependent crop data.\n\nDaily records: ${dependentCounts.dailyRecords}\nNight checks: ${dependentCounts.nightChecks}\nMedication records: ${dependentCounts.medicationRecords}\n\nAre you sure?`
      );
      if (!confirmed) return;
    }

    const r = await fetch("/api/crops/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cropId,
        cropNumber,
        placementDate,
        breed,
        hatchery,
        chickenPricePerKg:
          chickenPricePerKg === "" ? null : Number(chickenPricePerKg),
        salePricePerKgAllIn:
          salePricePerKgAllIn === "" ? null : Number(salePricePerKgAllIn),
        currency,
        notes,
        placements: placements.map((p) => ({
          id: p.id,
          placementDate: p.placementDate,
          hatchery: p.hatchery,
          flockNumber: p.flockNumber,
          birdsPlaced: Number(p.birdsPlaced || 0),
          // parentAgeWeeks is a number, avoid comparing with empty string
          parentAgeWeeks:
            p.parentAgeWeeks === null || p.parentAgeWeeks === undefined
              ? null
              : Number(p.parentAgeWeeks),
          notes: p.notes,
        })),
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error saving crop.");
      return;
    }

    setMsgType("success");
    setMsg("Crop updated successfully.");
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
            <p style={{ margin: 0 }}>Loading crop...</p>
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
            <div className="page-intro__eyebrow">Production</div>
            <h1 className="page-intro__title">Edit Crop</h1>
            <p className="page-intro__subtitle">
              Update crop header, economics and placement batches.
            </p>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {hasDependentData && (
          <div
            className="mobile-alert"
            style={{ marginBottom: 16, background: "#fff3cd", borderColor: "#f0cc72" }}
          >
            Saving changes will remove dependent crop data.
            <div style={{ marginTop: 8 }}>
              Daily: {dependentCounts.dailyRecords} · Night checks: {dependentCounts.nightChecks} · Medication: {dependentCounts.medicationRecords}
            </div>
          </div>
        )}

        <div className="mobile-card">
          <form onSubmit={saveCrop}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Crop Number</label>
                <input value={cropNumber} onChange={(e) => setCropNumber(e.target.value)} />
              </div>

              <div>
                <label>Main Placement Date</label>
                <input
                  type="date"
                  value={placementDate}
                  onChange={(e) => setPlacementDate(e.target.value)}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Breed</label>
                <input value={breed} onChange={(e) => setBreed(e.target.value)} />
              </div>

              <div>
                <label>Hatchery</label>
                <input value={hatchery} onChange={(e) => setHatchery(e.target.value)} />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Chicken Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={chickenPricePerKg}
                  onChange={(e) => setChickenPricePerKg(e.target.value)}
                />
              </div>

              <div>
                <label>Sale Price per kg</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePricePerKgAllIn}
                  onChange={(e) => setSalePricePerKgAllIn(e.target.value)}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>

              <div>
                <label>Notes</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <h2 style={{ marginTop: 24, marginBottom: 12 }}>Placement Batches</h2>

            {placements.length === 0 ? (
              <div className="mobile-alert" style={{ marginBottom: 16 }}>
                No placement batches returned by `/api/crops/details`.
              </div>
            ) : (
              placements.map((p) => (
                <div key={p.id} className="mobile-record-card" style={{ marginBottom: 12 }}>
                  <h3 className="mobile-record-card__title" style={{ color: "#b00020" }}>
                    {p.house?.name || p.houseName || "House"} · Batch {p.batchNo}
                  </h3>

                  <div className="mobile-grid mobile-grid--2">
                    <div>
                      <label>Placement Date</label>
                      <input
                        type="date"
                        value={p.placementDate?.slice(0, 10) || ""}
                        onChange={(e) =>
                          updatePlacement(p.id, "placementDate", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label>Flock Number</label>
                      <input
                        value={p.flockNumber || ""}
                        onChange={(e) =>
                          updatePlacement(p.id, "flockNumber", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="mobile-grid mobile-grid--2">
                    <div>
                      <label>Birds Placed</label>
                      <input
                        type="number"
                        value={p.birdsPlaced}
                        onChange={(e) =>
                          updatePlacement(p.id, "birdsPlaced", Number(e.target.value))
                        }
                      />
                    </div>

                    <div>
                      <label>Parent Age Weeks</label>
                      <input
                        type="number"
                        value={p.parentAgeWeeks ?? ""}
                        onChange={(e) =>
                          updatePlacement(
                            p.id,
                            "parentAgeWeeks",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="mobile-grid mobile-grid--2">
                    <div>
                      <label>Batch Hatchery</label>
                      <input
                        value={p.hatchery || ""}
                        onChange={(e) =>
                          updatePlacement(p.id, "hatchery", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label>Batch Notes</label>
                      <input
                        value={p.notes || ""}
                        onChange={(e) =>
                          updatePlacement(p.id, "notes", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button className="mobile-full-button" type="submit">
                  Save Crop Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}