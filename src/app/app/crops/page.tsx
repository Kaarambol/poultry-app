"use client";

import { useEffect, useMemo, useState } from "react";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type House = {
  id: string;
  name: string;
  code: string | null;
  floorAreaM2: number;
  usableAreaM2: number | null;
  defaultCapacityBirds: number;
  defaultDrinkerLineCount: number;
  defaultNippleCount: number;
  defaultFeederPanCount: number;
  defaultFanCount: number;
  defaultHeaterCount: number;
};

type PlacementBatch = {
  placementDate: string;
  hatchery: string;
  flockNumber: string;
  birdsPlaced: string;
  parentAgeWeeks: string;
  notes: string;
};

const EMPTY_BATCH = (): PlacementBatch => ({
  placementDate: "",
  hatchery: "",
  flockNumber: "",
  birdsPlaced: "",
  parentAgeWeeks: "",
  notes: "",
});

export default function CropsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [cropNumber, setCropNumber] = useState("");
  const [placementDate, setPlacementDate] = useState("");
  const [breed, setBreed] = useState("");
  const [hatchery, setHatchery] = useState("");

  const [chickenPricePerKg, setChickenPricePerKg] = useState("");
  const [salePricePerKgAllIn, setSalePricePerKgAllIn] = useState("");
  const [currency, setCurrency] = useState("GBP");

  const [cropNotes, setCropNotes] = useState("");

  const [placements, setPlacements] = useState<Record<string, PlacementBatch[]>>(
    {}
  );

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function loadFarms() {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (Array.isArray(data)) setFarms(data);
  }

  async function loadHouses(selectedFarmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${selectedFarmId}`);
    const data = await r.json();

    if (Array.isArray(data)) {
      setHouses(data);

      const initialPlacements: Record<string, PlacementBatch[]> = {};
      data.forEach((house: House) => {
        initialPlacements[house.id] = [
          EMPTY_BATCH(),
          EMPTY_BATCH(),
          EMPTY_BATCH(),
        ];
      });

      setPlacements(initialPlacements);
    } else {
      setHouses([]);
      setPlacements({});
    }
  }

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    if (farmId) loadHouses(farmId);
    else {
      setHouses([]);
      setPlacements({});
    }
  }, [farmId]);

  function updateBatch(
    houseId: string,
    index: number,
    field: keyof PlacementBatch,
    value: string
  ) {
    setPlacements((prev) => {
      const houseBatches = [...(prev[houseId] || [])];
      houseBatches[index] = { ...houseBatches[index], [field]: value };
      return { ...prev, [houseId]: houseBatches };
    });
  }

  const birdsPlacedTotal = useMemo(() => {
    return houses.reduce((sum, house) => {
      const totalForHouse = (placements[house.id] || []).reduce((acc, batch) => {
        const birds = Number(batch.birdsPlaced || 0);
        return acc + (Number.isFinite(birds) ? birds : 0);
      }, 0);
      return sum + totalForHouse;
    }, 0);
  }, [houses, placements]);

  async function createCrop(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setMsgType("info");

    const payloadPlacements = houses.flatMap((house) =>
      (placements[house.id] || [])
        .filter(
          (batch) =>
            batch.placementDate &&
            batch.flockNumber &&
            Number(batch.birdsPlaced) > 0
        )
        .map((batch) => ({
          houseId: house.id,
          placementDate: batch.placementDate,
          hatchery: batch.hatchery,
          flockNumber: batch.flockNumber,
          birdsPlaced: Number(batch.birdsPlaced),
          parentAgeWeeks:
            batch.parentAgeWeeks === ""
              ? null
              : Number(batch.parentAgeWeeks),
          notes: batch.notes,
        }))
    );

    const r = await fetch("/api/crops/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId,
        cropNumber,
        placementDate,
        breed,
        hatchery,
        chickenPricePerKg,
        salePricePerKgAllIn,
        currency,
        notes: cropNotes,
        placements: payloadPlacements,
        houseConfigs: [],
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("Crop created successfully!");
  }

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
            <div className="page-intro__eyebrow">Production</div>
            <h1 className="page-intro__title">Create Crop</h1>
            <p className="page-intro__subtitle">
              Create crop and define sale economics (GBP).
            </p>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <form onSubmit={createCrop}>
            <label>Select Farm</label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              required
            >
              <option value="">-- choose farm --</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} ({farm.code})
                </option>
              ))}
            </select>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Crop Number</label>
                <input
                  value={cropNumber}
                  onChange={(e) => setCropNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Main Placement Date</label>
                <input
                  type="date"
                  value={placementDate}
                  onChange={(e) => setPlacementDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Breed</label>
                <input
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                />
              </div>

              <div>
                <label>Hatchery</label>
                <input
                  value={hatchery}
                  onChange={(e) => setHatchery(e.target.value)}
                />
              </div>
            </div>

            <h3 style={{ marginTop: 18 }}>Sale Economics</h3>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Chicken Price per kg (GBP)</label>
                <input
                  type="number"
                  step="0.01"
                  value={chickenPricePerKg}
                  onChange={(e) => setChickenPricePerKg(e.target.value)}
                />
              </div>

              <div>
                <label>Sale Price per kg All In (GBP)</label>
                <input
                  type="number"
                  step="0.01"
                  value={salePricePerKgAllIn}
                  onChange={(e) => setSalePricePerKgAllIn(e.target.value)}
                />
              </div>
            </div>

            <label>Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />

            <label>Crop Notes</label>
            <textarea
              value={cropNotes}
              onChange={(e) => setCropNotes(e.target.value)}
            />

            <h3 style={{ marginTop: 24 }}>Placement Batches</h3>

            {houses.map((house) => (
              <div key={house.id} className="mobile-card">
                <h3>
                  {house.name}
                  {house.code ? ` (${house.code})` : ""}
                </h3>

                {(placements[house.id] || []).map((batch, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <div className="mobile-grid mobile-grid--2">
                      <input
                        type="date"
                        value={batch.placementDate}
                        onChange={(e) =>
                          updateBatch(
                            house.id,
                            index,
                            "placementDate",
                            e.target.value
                          )
                        }
                      />
                      <input
                        placeholder="Flock number"
                        value={batch.flockNumber}
                        onChange={(e) =>
                          updateBatch(
                            house.id,
                            index,
                            "flockNumber",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="mobile-grid mobile-grid--2">
                      <input
                        type="number"
                        placeholder="Birds placed"
                        value={batch.birdsPlaced}
                        onChange={(e) =>
                          updateBatch(
                            house.id,
                            index,
                            "birdsPlaced",
                            e.target.value
                          )
                        }
                      />
                      <input
                        type="number"
                        placeholder="Parent age weeks"
                        value={batch.parentAgeWeeks}
                        onChange={(e) =>
                          updateBatch(
                            house.id,
                            index,
                            "parentAgeWeeks",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button className="mobile-full-button" type="submit">
                  Create Crop
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              Total Birds Placed: <strong>{birdsPlacedTotal}</strong>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}