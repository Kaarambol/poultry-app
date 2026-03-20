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
  const [hasActiveCrop, setHasActiveCrop] = useState(false);

  // Commercial Setup State
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

  // House Technical Setup State
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
    if (Array.isArray(data)) setFarms(data);
  }

  async function loadHouses(selectedFarmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${selectedFarmId}`);
    const data = await r.json();
    if (Array.isArray(data)) setHouses(data); else setHouses([]);
  }

  async function checkActiveCrop(selectedFarmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${selectedFarmId}`);
    const data = await r.json();
    setHasActiveCrop(!!data);
  }

  useEffect(() => { loadFarms(); }, []);

  useEffect(() => {
    if (farmId) {
      loadHouses(farmId);
      checkActiveCrop(farmId);
      const f = farms.find((f) => f.id === farmId);
      if (f) {
        setFeedContractor(f.feedContractor || "");
        setChickenSupplier(f.chickenSupplier || "");
        setFeedPrice1(f.feedPrice1 != null ? String(f.feedPrice1) : "");
        setFeedPrice2(f.feedPrice2 != null ? String(f.feedPrice2) : "");
        setFeedPrice3(f.feedPrice3 != null ? String(f.feedPrice3) : "");
        setFeedPrice4(f.feedPrice4 != null ? String(f.feedPrice4) : "");
        setFeedPrice5(f.feedPrice5 != null ? String(f.feedPrice5) : "");
        setWheatPrice(f.wheatPrice != null ? String(f.wheatPrice) : "");
        setChickenPrice(f.chickenPrice != null ? String(f.chickenPrice) : "");
        setLiveWeightPricePerKg(f.liveWeightPricePerKg != null ? String(f.liveWeightPricePerKg) : "");
      }
    }
  }, [farmId, farms]);

  function resetHouseForm() {
    setHouseName(""); setHouseCode(""); setFloorArea(""); setUsableArea("");
    setDefaultCapacityBirds(""); setDefaultDrinkerLineCount(""); setDefaultNippleCount("");
    setDefaultFeederPanCount(""); setDefaultFanCount(""); setDefaultHeaterCount("");
    setDefaultMinTempC(""); setDefaultMaxTempC(""); setDefaultTargetHumidityPct("");
    setDefaultMaxCo2Ppm(""); setDefaultMaxAmmoniaPpm(""); setNotes("");
  }

  async function saveFarmCommercialSetup(e: React.FormEvent) {
    e.preventDefault();
    if (hasActiveCrop) return;
    setMsg("Saving..."); setMsgType("info");
    const r = await fetch(`/api/farms/${farmId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedContractor, chickenSupplier, feedPrice1, feedPrice2, feedPrice3,
        feedPrice4, feedPrice5, wheatPrice, chickenPrice, liveWeightPricePerKg,
      }),
    });
    if (r.ok) { setMsg("Farm commercial setup saved."); setMsgType("success"); loadFarms(); }
    else { setMsg("Failed to save farm setup."); setMsgType("error"); }
  }

  async function addHouse(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Adding house..."); setMsgType("info");
    const r = await fetch("/api/houses/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId, name: houseName, code: houseCode, floorAreaM2: floorArea,
        usableAreaM2: usableArea, defaultCapacityBirds, defaultDrinkerLineCount,
        defaultNippleCount, defaultFeederPanCount, defaultFanCount,
        defaultHeaterCount, defaultMinTempC, defaultMaxTempC,
        defaultTargetHumidityPct, defaultMaxCo2Ppm, defaultMaxAmmoniaPpm, notes,
      }),
    });
    if (r.ok) { setMsg("House added successfully."); setMsgType("success"); resetHouseForm(); loadHouses(farmId); }
    else { setMsg("Error adding house."); setMsgType("error"); }
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Infrastructure</div>
            <h1 className="page-intro__title">Farm Setup</h1>
            <p className="page-intro__subtitle">Configure commercial terms and manage technical house data.</p>
          </div>
        </div>

        {msg && <div className={`mobile-alert mobile-alert--${msgType}`} style={{ marginBottom: 16 }}>{msg}</div>}

        <div className="mobile-card">
          <h2>Select Farm</h2>
          <label>Select farm to configure</label>
          <select value={farmId} onChange={(e) => setFarmId(e.target.value)}>
            <option value="">-- choose farm --</option>
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
          </select>
        </div>

        {farmId && (
          <>
            <div className="mobile-card">
              <h2>Commercial Setup {hasActiveCrop && <span style={{color:'red', fontSize:'12px'}}>(Locked - Active Crop)</span>}</h2>
              <form onSubmit={saveFarmCommercialSetup}>
                <label>Feed Contractor</label>
                <input disabled={hasActiveCrop} value={feedContractor} onChange={(e) => setFeedContractor(e.target.value)} placeholder="Contractor name" />
                <label>Chicken Supplier</label>
                <input disabled={hasActiveCrop} value={chickenSupplier} onChange={(e) => setChickenSupplier(e.target.value)} placeholder="Supplier name" />

                <div className="mobile-grid mobile-grid--2">
                  <div><label>Starter Crumb</label><input disabled={hasActiveCrop} type="number" step="0.001" value={feedPrice1} onChange={(e) => setFeedPrice1(e.target.value)} /></div>
                  <div><label>Rearer Pellet</label><input disabled={hasActiveCrop} type="number" step="0.001" value={feedPrice2} onChange={(e) => setFeedPrice2(e.target.value)} /></div>
                  <div><label>Grower Pellet</label><input disabled={hasActiveCrop} type="number" step="0.001" value={feedPrice3} onChange={(e) => setFeedPrice3(e.target.value)} /></div>
                  <div><label>Finisher Pellet</label><input disabled={hasActiveCrop} type="number" step="0.001" value={feedPrice4} onChange={(e) => setFeedPrice4(e.target.value)} /></div>
                  <div><label>Final Withdraw Pellet</label><input disabled={hasActiveCrop} type="number" step="0.001" value={feedPrice5} onChange={(e) => setFeedPrice5(e.target.value)} /></div>
                  <div><label>Wheat Price</label><input disabled={hasActiveCrop} type="number" step="0.001" value={wheatPrice} onChange={(e) => setWheatPrice(e.target.value)} /></div>
                  <div><label>Chicken Price</label><input disabled={hasActiveCrop} type="number" step="0.001" value={chickenPrice} onChange={(e) => setChickenPrice(e.target.value)} /></div>
                  <div><label>Live Weight Price / kg</label><input disabled={hasActiveCrop} type="number" step="0.001" value={liveWeightPricePerKg} onChange={(e) => setLiveWeightPricePerKg(e.target.value)} /></div>
                </div>

                <div className="mobile-sticky-actions">
                  <div className="mobile-sticky-actions__inner">
                    <button className="mobile-full-button" type="submit" disabled={hasActiveCrop}>
                      {hasActiveCrop ? "Locked: Active Crop in Progress" : "Save Farm Setup"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="mobile-card">
              <h2>Add New House</h2>
              <form onSubmit={addHouse}>
                <label>House Name</label>
                <input value={houseName} onChange={(e) => setHouseName(e.target.value)} required placeholder="e.g. House 1" />
                <label>House Code</label>
                <input value={houseCode} onChange={(e) => setHouseCode(e.target.value)} placeholder="e.g. H1" />

                <div className="mobile-grid mobile-grid--2">
                  <div><label>Floor Area (m²)</label><input type="number" step="0.01" value={floorArea} onChange={(e) => setFloorArea(e.target.value)} required /></div>
                  <div><label>Usable Area (m²)</label><input type="number" step="0.01" value={usableArea} onChange={(e) => setUsableArea(e.target.value)} /></div>
                </div>
                <label>Default Capacity (Birds)</label>
                <input type="number" value={defaultCapacityBirds} onChange={(e) => setDefaultCapacityBirds(e.target.value)} />

                <div className="mobile-grid mobile-grid--2">
                  <div><label>Drinker Lines</label><input type="number" value={defaultDrinkerLineCount} onChange={(e) => setDefaultDrinkerLineCount(e.target.value)} /></div>
                  <div><label>Nipples</label><input type="number" value={defaultNippleCount} onChange={(e) => setDefaultNippleCount(e.target.value)} /></div>
                  <div><label>Feeder Pans</label><input type="number" value={defaultFeederPanCount} onChange={(e) => setDefaultFeederPanCount(e.target.value)} /></div>
                  <div><label>Fans</label><input type="number" value={defaultFanCount} onChange={(e) => setDefaultFanCount(e.target.value)} /></div>
                  <div><label>Heaters</label><input type="number" value={defaultHeaterCount} onChange={(e) => setDefaultHeaterCount(e.target.value)} /></div>
                </div>

                <div className="mobile-grid mobile-grid--2">
                  <div><label>Min Temp (°C)</label><input type="number" step="0.1" value={defaultMinTempC} onChange={(e) => setDefaultMinTempC(e.target.value)} /></div>
                  <div><label>Max Temp (°C)</label><input type="number" step="0.1" value={defaultMaxTempC} onChange={(e) => setDefaultMaxTempC(e.target.value)} /></div>
                  <div><label>Target Humidity (%)</label><input type="number" value={defaultTargetHumidityPct} onChange={(e) => setDefaultTargetHumidityPct(e.target.value)} /></div>
                  <div><label>Max CO2 (ppm)</label><input type="number" value={defaultMaxCo2Ppm} onChange={(e) => setDefaultMaxCo2Ppm(e.target.value)} /></div>
                  <div><label>Max Ammonia (ppm)</label><input type="number" value={defaultMaxAmmoniaPpm} onChange={(e) => setDefaultMaxAmmoniaPpm(e.target.value)} /></div>
                </div>

                <label>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional technical notes..." />

                <div className="mobile-sticky-actions">
                  <div className="mobile-sticky-actions__inner">
                    <button className="mobile-full-button" type="submit">Add House</button>
                  </div>
                </div>
              </form>
            </div>

            <h2 className="mobile-section-title">Existing Houses</h2>
            <div className="mobile-record-list">
              {houses.length === 0 ? <p style={{padding: 16}}>No houses defined yet.</p> : houses.map((h) => (
                <div key={h.id} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">{h.name} {h.code ? `(${h.code})` : ""}</h3>
                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row"><strong>Area (Total/Usable)</strong><span>{h.floorAreaM2} / {h.usableAreaM2 || "-"} m²</span></div>
                    <div className="mobile-record-row"><strong>Capacity</strong><span>{h.defaultCapacityBirds || "-"} birds</span></div>
                    <div className="mobile-record-row"><strong>Lines / Nipples</strong><span>{h.defaultDrinkerLineCount || "-"}/{h.defaultNippleCount || "-"}</span></div>
                    <div className="mobile-record-row"><strong>Pans / Fans / Heaters</strong><span>{h.defaultFeederPanCount || "-"}/{h.defaultFanCount || "-"}/{h.defaultHeaterCount || "-"}</span></div>
                    <div className="mobile-record-row"><strong>Environmental Set</strong><span>{h.defaultMinTempC || "-"} - {h.defaultMaxTempC || "-"} °C | {h.defaultTargetHumidityPct || "-"}% Hum</span></div>
                    <div className="mobile-record-row"><strong>Gas Limits</strong><span>CO2: {h.defaultMaxCo2Ppm || "-"} | NH3: {h.defaultMaxAmmoniaPpm || "-"}</span></div>
                    {h.notes && <div className="mobile-record-row"><strong>Notes</strong><span>{h.notes}</span></div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}