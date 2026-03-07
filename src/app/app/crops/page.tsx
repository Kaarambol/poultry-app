"use client";

import { useEffect, useState } from "react";

type Farm = {
  id: string;
  name: string;
  code: string;
};

type House = {
  id: string;
  name: string;
  floorAreaM2: number;
};

type PlacementBatch = {
  placementDate: string;
  hatchery: string;
  flockNumber: string;
  birdsPlaced: string;
};

const EMPTY_BATCH = (): PlacementBatch => ({
  placementDate: "",
  hatchery: "",
  flockNumber: "",
  birdsPlaced: "",
});

export default function CropsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [houses, setHouses] = useState<House[]>([]);

  const [cropNumber, setCropNumber] = useState("");
  const [placementDate, setPlacementDate] = useState("");
  const [breed, setBreed] = useState("");
  const [hatchery, setHatchery] = useState("");
  const [msg, setMsg] = useState("");

  const [placements, setPlacements] = useState<Record<string, PlacementBatch[]>>({});

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

      const initial: Record<string, PlacementBatch[]> = {};
      data.forEach((house: House) => {
        initial[house.id] = [EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH()];
      });
      setPlacements(initial);
    }
  }

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    if (farmId) {
      loadHouses(farmId);
    } else {
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
      const houseBatches = prev[houseId] ? [...prev[houseId]] : [EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH()];
      houseBatches[index] = {
        ...houseBatches[index],
        [field]: value,
      };
      return {
        ...prev,
        [houseId]: houseBatches,
      };
    });
  }

  async function createCrop(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const payloadPlacements = houses.flatMap((house) =>
      (placements[house.id] || []).map((batch) => ({
        houseId: house.id,
        placementDate: batch.placementDate,
        hatchery: batch.hatchery,
        flockNumber: batch.flockNumber,
        birdsPlaced: Number(batch.birdsPlaced || 0),
      }))
    );

    const r = await fetch("/api/crops/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmId,
        cropNumber,
        placementDate,
        breed,
        hatchery,
        placements: payloadPlacements,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      return;
    }

    setMsg("Crop created!");
    setCropNumber("");
    setPlacementDate("");
    setBreed("");
    setHatchery("");

    const initial: Record<string, PlacementBatch[]> = {};
    houses.forEach((house) => {
      initial[house.id] = [EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH(), EMPTY_BATCH()];
    });
    setPlacements(initial);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Create Crop</h1>

      <form onSubmit={createCrop}>
        <label>Select farm</label>
        <select
          value={farmId}
          onChange={(e) => setFarmId(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          required
        >
          <option value="">-- choose farm --</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name} ({farm.code})
            </option>
          ))}
        </select>

        <label>Crop number</label>
        <input
          value={cropNumber}
          onChange={(e) => setCropNumber(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="e.g. 3008"
          required
        />

        <label>Main placement date</label>
        <input
          type="date"
          value={placementDate}
          onChange={(e) => setPlacementDate(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          required
        />

        <label>Breed</label>
        <input
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
          placeholder="e.g. Ross 308"
        />

        <label>Default hatchery (optional)</label>
        <input
          value={hatchery}
          onChange={(e) => setHatchery(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 20px" }}
          placeholder="e.g. Avara"
        />

        {houses.length > 0 && (
          <>
            <h2>Placement batches per house</h2>
            {houses.map((house) => (
              <div
                key={house.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 20,
                  background: "#fafafa",
                }}
              >
                <h3>{house.name}</h3>

                {(placements[house.id] || []).map((batch, index) => (
                  <div
                    key={index}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <input
                      type="date"
                      value={batch.placementDate}
                      onChange={(e) =>
                        updateBatch(house.id, index, "placementDate", e.target.value)
                      }
                      placeholder="Date"
                      style={{ padding: 8 }}
                    />
                    <input
                      value={batch.hatchery}
                      onChange={(e) =>
                        updateBatch(house.id, index, "hatchery", e.target.value)
                      }
                      placeholder={`Hatchery ${index + 1}`}
                      style={{ padding: 8 }}
                    />
                    <input
                      value={batch.flockNumber}
                      onChange={(e) =>
                        updateBatch(house.id, index, "flockNumber", e.target.value)
                      }
                      placeholder={`Flock No ${index + 1}`}
                      style={{ padding: 8 }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={batch.birdsPlaced}
                      onChange={(e) =>
                        updateBatch(house.id, index, "birdsPlaced", e.target.value)
                      }
                      placeholder={`Birds ${index + 1}`}
                      style={{ padding: 8 }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        <button style={{ padding: 12, width: "100%" }} type="submit">
          Create Crop
        </button>
      </form>

      {msg && <p style={{ marginTop: 16 }}>{msg}</p>}
    </div>
  );
}