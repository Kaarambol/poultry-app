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

export default function FarmSetupPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [houses, setHouses] = useState<House[]>([]);
  const [msg, setMsg] = useState("");

  async function loadFarms() {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (Array.isArray(data)) {
      setFarms(data);
    }
  }

  async function loadHouses(selectedFarmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${selectedFarmId}`);
    const data = await r.json();
    if (Array.isArray(data)) {
      setHouses(data);
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
    }
  }, [farmId]);

  async function addHouse(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const r = await fetch("/api/houses/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmId,
        name: houseName,
        floorAreaM2: Number(floorArea),
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsg(data.error || "Error");
      return;
    }

    setMsg("House added!");
    setHouseName("");
    setFloorArea("");
    loadHouses(farmId);
  }

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Farm Setup</h1>

      <label>Select farm</label>
      <select
        value={farmId}
        onChange={(e) => setFarmId(e.target.value)}
        style={{ width: "100%", padding: 10, margin: "6px 0 20px" }}
      >
        <option value="">-- choose farm --</option>
        {farms.map((farm) => (
          <option key={farm.id} value={farm.id}>
            {farm.name} ({farm.code})
          </option>
        ))}
      </select>

      {farmId && (
        <>
          <h2>Add House</h2>

          <form onSubmit={addHouse}>
            <label>House name</label>
            <input
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
              style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
              placeholder="e.g. House 1"
              required
            />

            <label>Floor area (m²)</label>
            <input
              value={floorArea}
              onChange={(e) => setFloorArea(e.target.value)}
              style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
              placeholder="e.g. 1500"
              required
            />

            <button style={{ padding: 10, width: "100%" }} type="submit">
              Add House
            </button>
          </form>

          {msg && <p style={{ marginTop: 16 }}>{msg}</p>}

          <h2 style={{ marginTop: 30 }}>Existing Houses</h2>

          {houses.length === 0 ? (
            <p>No houses yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                    House
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>
                    Floor area (m²)
                  </th>
                </tr>
              </thead>
              <tbody>
                {houses.map((house) => (
                  <tr key={house.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{house.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                      {house.floorAreaM2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}