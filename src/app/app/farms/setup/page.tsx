"use client";

import { useEffect, useState } from "react";

type Farm = {
  id: string;
  name: string;
  code: string;
  feedContractor?: string | null;
  chickenSupplier?: string | null;
  feedPrice1?: number | null;
  feedPrice2?: number | null;
  feedPrice3?: number | null;
  feedPrice4?: number | null;
  feedPrice5?: number | null;
  wheatPrice?: number | null;
  chickenPrice?: number | null;
  liveWeightPricePerKg?: number | null;
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
  defaultMinTempC: number | null;
  defaultMaxTempC: number | null;
  defaultTargetHumidityPct: number | null;
  defaultMaxCo2Ppm: number | null;
  defaultMaxAmmoniaPpm: number | null;
  notes: string | null;
};

export default function FarmSetupPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState("");

  const [feedContractor, setFeedContractor] = useState("");
  const [chickenSupplier, setChickenSupplier] = useState("");
  const [feedPrice1, setFeedPrice1] = useState("");
  const [feedPrice2, setFeedPrice2] = useState("");
  const [feedPrice3, setFeedPrice3] = useState("");
  const [feedPrice4, setFeedPrice4] = useState("");
  const [feedPrice5, setFeedPrice5] = useState("");
  const [wheatPrice, setWheatPrice] = useState("");
  const [chickenPrice, setChickenPrice] = useState("");
  const [liveWeightPricePerKg, setLiveWeightPricePerKg] = useState("");

  const [houseName, setHouseName] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [usableArea, setUsableArea] = useState("");
  const [defaultCapacityBirds, setDefaultCapacityBirds] = useState("");
  const [defaultDrinkerLineCount, setDefaultDrinkerLineCount] = useState("");
  const [defaultNippleCount, setDefaultNippleCount] = useState("");
  const [defaultFeederPanCount, setDefaultFeederPanCount] = useState("");
  const [defaultFanCount, setDefaultFanCount] = useState("");
  const [defaultHeaterCount, setDefaultHeaterCount] = useState("");
  const [defaultMinTempC, setDefaultMinTempC] = useState("");
  const [defaultMaxTempC, setDefaultMaxTempC] = useState("");
  const [defaultTargetHumidityPct, setDefaultTargetHumidityPct] = useState("");
  const [defaultMaxCo2Ppm, setDefaultMaxCo2Ppm] = useState("");
  const [defaultMaxAmmoniaPpm, setDefaultMaxAmmoniaPpm] = useState("");
  const [notes, setNotes] = useState("");

  const [houses, setHouses] = useState<House[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

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
    } else {
      setHouses([]);
    }
  }

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    if (farmId) {
      loadHouses(farmId);

      const selectedFarm = farms.find((farm) => farm.id === farmId);
      if (selectedFarm) {
        setFeedContractor(selectedFarm.feedContractor || "");
        setChickenSupplier(selectedFarm.chickenSupplier || "");
        setFeedPrice1(
          selectedFarm.feedPrice1 !== null && selectedFarm.feedPrice1 !== undefined
            ? String(selectedFarm.feedPrice1)
            : ""
        );
        setFeedPrice2(
          selectedFarm.feedPrice2 !== null && selectedFarm.feedPrice2 !== undefined
            ? String(selectedFarm.feedPrice2)
            : ""
        );
        setFeedPrice3(
          selectedFarm.feedPrice3 !== null && selectedFarm.feedPrice3 !== undefined
            ? String(selectedFarm.feedPrice3)
            : ""
        );
        setFeedPrice4(
          selectedFarm.feedPrice4 !== null && selectedFarm.feedPrice4 !== undefined
            ? String(selectedFarm.feedPrice4)
            : ""
        );
        setFeedPrice5(
          selectedFarm.feedPrice5 !== null && selectedFarm.feedPrice5 !== undefined
            ? String(selectedFarm.feedPrice5)
            : ""
        );
        setWheatPrice(
          selectedFarm.wheatPrice !== null && selectedFarm.wheatPrice !== undefined
            ? String(selectedFarm.wheatPrice)
            : ""
        );
        setChickenPrice(
          selectedFarm.chickenPrice !== null && selectedFarm.chickenPrice !== undefined
            ? String(selectedFarm.chickenPrice)
            : ""
        );
        setLiveWeightPricePerKg(
          selectedFarm.liveWeightPricePerKg !== null &&
            selectedFarm.liveWeightPricePerKg !== undefined
            ? String(selectedFarm.liveWeightPricePerKg)
            : ""
        );
      }
    } else {
      setHouses([]);
    }
  }, [farmId, farms]);

  function resetForm() {
    setHouseName("");
    setHouseCode("");
    setFloorArea("");
    setUsableArea("");
    setDefaultCapacityBirds("");
    setDefaultDrinkerLineCount("");
    setDefaultNippleCount("");
    setDefaultFeederPanCount("");
    setDefaultFanCount("");
    setDefaultHeaterCount("");
    setDefaultMinTempC("");
    setDefaultMaxTempC("");
    setDefaultTargetHumidityPct("");
    setDefaultMaxCo2Ppm("");
    setDefaultMaxAmmoniaPpm("");
    setNotes("");
  }

  async function saveFarmCommercialSetup(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setMsgType("info");

    if (!farmId) {
      setMsgType("error");
      setMsg("Please choose a farm first.");
      return;
    }

    const selectedFarm = farms.find((farm) => farm.id === farmId);

    const r = await fetch(`/api/farms/${farmId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: selectedFarm?.name || "",
        code: selectedFarm?.code || "",
        feedContractor,
        chickenSupplier,
        feedPrice1,
        feedPrice2,
        feedPrice3,
        feedPrice4,
        feedPrice5,
        wheatPrice,
        chickenPrice,
        liveWeightPricePerKg,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Could not save farm setup.");
      return;
    }

    setMsgType("success");
    setMsg("Farm commercial setup saved.");
    await loadFarms();
  }

  async function addHouse(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setMsgType("info");

    const r = await fetch("/api/houses/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmId,
        name: houseName,
        code: houseCode,
        floorAreaM2: floorArea,
        usableAreaM2: usableArea,
        defaultCapacityBirds,
        defaultDrinkerLineCount,
        defaultNippleCount,
        defaultFeederPanCount,
        defaultFanCount,
        defaultHeaterCount,
        defaultMinTempC,
        defaultMaxTempC,
        defaultTargetHumidityPct,
        defaultMaxCo2Ppm,
        defaultMaxAmmoniaPpm,
        notes,
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error");
      return;
    }

    setMsgType("success");
    setMsg("House added successfully!");
    resetForm();
    loadHouses(farmId);
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
            <div className="page-intro__eyebrow">Infrastructure</div>
            <h1 className="page-intro__title">Farm Setup</h1>
            <p className="page-intro__subtitle">
              Configure farm commercial settings and add houses.
            </p>
          </div>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="mobile-card">
          <h2>Select Farm</h2>

          <label>Choose farm</label>
          <select value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            <option value="">-- choose farm --</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name} ({farm.code})
              </option>
            ))}
          </select>
        </div>

        {farmId && (
          <>
            <div className="mobile-card">
              <h2>Farm Commercial Setup</h2>

              <form onSubmit={saveFarmCommercialSetup}>
                <h3 style={{ marginBottom: 10 }}>Suppliers</h3>

                <label>Feed Contractor</label>
                <input
                  value={feedContractor}
                  onChange={(e) => setFeedContractor(e.target.value)}
                  placeholder="e.g. AB Agri"
                />

                <label>Chicken Supplier</label>
                <input
                  value={chickenSupplier}
                  onChange={(e) => setChickenSupplier(e.target.value)}
                  placeholder="e.g. PD Hook / supplier name"
                />

                <h3 style={{ marginTop: 18, marginBottom: 10 }}>Fixed Prices</h3>

                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Feed Price 1</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feedPrice1}
                      onChange={(e) => setFeedPrice1(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Feed Price 2</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feedPrice2}
                      onChange={(e) => setFeedPrice2(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Feed Price 3</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feedPrice3}
                      onChange={(e) => setFeedPrice3(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Feed Price 4</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feedPrice4}
                      onChange={(e) => setFeedPrice4(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Feed Price 5</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feedPrice5}
                      onChange={(e) => setFeedPrice5(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Wheat Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wheatPrice}
                      onChange={(e) => setWheatPrice(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Chicken Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={chickenPrice}
                      onChange={(e) => setChickenPrice(e.target.value)}
                      placeholder="optional"
                    />
                  </div>

                  <div>
                    <label>Live Weight Price / kg</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={liveWeightPricePerKg}
                      onChange={(e) => setLiveWeightPricePerKg(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                </div>

                <div className="mobile-sticky-actions">
                  <div className="mobile-sticky-actions__inner">
                    <button className="mobile-full-button" type="submit">
                      Save Farm Setup
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="mobile-card">
              <h2>Add New House</h2>

              <form onSubmit={addHouse}>
                <h3 style={{ marginBottom: 10 }}>Identity</h3>

                <label>House Name</label>
                <input
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="e.g. House 1"
                  required
                />

                <label>House Code</label>
                <input
                  value={houseCode}
                  onChange={(e) => setHouseCode(e.target.value)}
                  placeholder="e.g. H1"
                />

                <h3 style={{ marginTop: 18, marginBottom: 10 }}>Area and Capacity</h3>

                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Floor Area (m²)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={floorArea}
                      onChange={(e) => setFloorArea(e.target.value)}
                      placeholder="e.g. 1500"
                      required
                    />
                  </div>

                  <div>
                    <label>Usable Area (m²)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={usableArea}
                      onChange={(e) => setUsableArea(e.target.value)}
                      placeholder="optional"
                    />
                  </div>
                </div>

                <label>Default Capacity Birds</label>
                <input
                  type="number"
                  min="0"
                  value={defaultCapacityBirds}
                  onChange={(e) => setDefaultCapacityBirds(e.target.value)}
                  placeholder="e.g. 30000"
                />

                <h3 style={{ marginTop: 18, marginBottom: 10 }}>Drinking Equipment</h3>

                <div className="mobile-grid mobile-grid--2">
                  <div>
                    <label>Default Drinker Line Count</label>
                    <input
                      type="number"
                      min="0"
                      value={defaultDrinkerLineCount}
                      onChange={(e) => setDefaultDrinkerLineCount(e.target.value)}
                      placeholder="e.g. 4"
                    />
                  </div>

                  <div>
                    <label>Default Nipple Count</label>
                    <input
                      type="number"
                      min="0"
                      value={defaultNippleCount}
                      onChange={(e) => setDefaultNippleCount(e.target.value)}
                      placeholder="e.g. 1200"
                    />
                  </div>
                </div>

                <h3 style={{ marginTop: 18, marginBottom: 10 }}>Feeding Equipment</h3>

                <label>Default Feeder Pan Count</label>
                <input
                  type="number"
                  min="0"
                  value={defaultFeederPanCount}
                  onChange={(e) => setDefaultFeederPanCount(e.target.value)}
                  placeholder="e.g. 350"
                />

                <h3 style={{ marginTop: 18, marginBottom: 10 }}>Notes</h3>

                <label>House Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="optional"
                />

                <div className="mobile-sticky-actions">
                  <div className="mobile-sticky-actions__inner">
                    <button className="mobile-full-button" type="submit">
                      Add House
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <h2 className="mobile-section-title">Existing Houses</h2>

            {houses.length === 0 ? (
              <div className="mobile-card">
                <p style={{ margin: 0 }}>No houses yet.</p>
              </div>
            ) : (
              <div className="mobile-record-list">
                {houses.map((house) => (
                  <div key={house.id} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {house.name}
                      {house.code ? ` (${house.code})` : ""}
                    </h3>

                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Floor Area</strong>
                        <span>{house.floorAreaM2} m²</span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Usable Area</strong>
                        <span>
                          {house.usableAreaM2 ?? "-"}
                          {house.usableAreaM2 ? " m²" : ""}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Capacity</strong>
                        <span>{house.defaultCapacityBirds || "-"}</span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Drinker Lines</strong>
                        <span>{house.defaultDrinkerLineCount || "-"}</span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Nipples</strong>
                        <span>{house.defaultNippleCount || "-"}</span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Feeder Pans</strong>
                        <span>{house.defaultFeederPanCount || "-"}</span>
                      </div>

                      <div className="mobile-record-row">
                        <strong>Notes</strong>
                        <span>{house.notes || "-"}</span>
                      </div>
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