"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
  feedPrice1?: number | null;
  feedPrice2?: number | null;
  feedPrice3?: number | null;
  feedPrice4?: number | null;
  feedPrice5?: number | null;
  wheatPrice?: number | null;
};

type House = {
  id: string;
  name: string;
  code: string | null;
};

type FeedRecord = {
  id: string;
  date: string;
  feedProduct: string;
  feedKg: number;
  wheatKg: number;
  ticketNumber: string;
  feedPricePerTonneGbp: number | null;
  wheatPricePerTonneGbp: number | null;
  supplier: string | null;
  notes: string | null;
  house: {
    id: string;
    name: string;
    code: string | null;
  } | null;
};

type FeedSummary = {
  totals: {
    totalFeedKg: number;
    totalWheatKg: number;
    totalDeliveredKg: number;
    totalCostGbp: number;
    recordsCount: number;
  };
  byProduct: Array<{
    feedProduct: string;
    feedKg: number;
    wheatKg: number;
    totalKg: number;
    totalCostGbp: number;
    recordsCount: number;
  }>;
};

const FEED_PRODUCTS = [
  { value: "STARTER_CRUMB_185", label: "Starter Crumb 185", priceKey: "feedPrice1" },
  { value: "REARER_PELLET_385", label: "Rearer Pellet 385", priceKey: "feedPrice2" },
  { value: "GROWER_PELLET_485", label: "Grower Pellet 485", priceKey: "feedPrice3" },
  { value: "FINISHER_PELLET_585", label: "Finisher Pellet 585", priceKey: "feedPrice4" },
  { value: "FINAL_WITHDRAW_PELLET", label: "Final Withdraw Pellet", priceKey: "feedPrice5" },
  { value: "WHEAT", label: "Wheat", priceKey: "wheatPrice" },
];

export default function FeedPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmData, setFarmData] = useState<Farm | null>(null);
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [cropId, setCropId] = useState("");
  const [cropLabel, setCropLabel] = useState("");

  const [houses, setHouses] = useState<House[]>([]);

  const [date, setDate] = useState("");
  const [feedProduct, setFeedProduct] = useState("STARTER_CRUMB_185");
  const [feedKg, setFeedKg] = useState("");
  const [wheatKg, setWheatKg] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [feedPricePerTonneGbp, setFeedPricePerTonneGbp] = useState("");
  const [wheatPricePerTonneGbp, setWheatPricePerTonneGbp] = useState("");
  const [supplier, setSupplier] = useState("");
  const [houseId, setHouseId] = useState("");
  const [notes, setNotes] = useState("");

  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [summary, setSummary] = useState<FeedSummary | null>(null);
  const [msg, setMsg] = useState("Loading...");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function loadFarmData(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();
    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmData(farm);
      updatePrices(feedProduct, farm);
    }
  }

  function updatePrices(productValue: string, farm: Farm | null) {
    if (!farm) return;
    const product = FEED_PRODUCTS.find(p => p.value === productValue);
    if (product && product.priceKey && product.priceKey.startsWith("feedPrice")) {
      const price = farm[product.priceKey as keyof Farm];
      setFeedPricePerTonneGbp(price ? String(price) : "");
    }
    if (farm.wheatPrice) {
      setWheatPricePerTonneGbp(String(farm.wheatPrice));
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();
    if (r.ok) setMyRole(data.role || "");
  }

  async function loadHouses(farmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${farmId}`);
    const data = await r.json();
    setHouses(Array.isArray(data) ? data : []);
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();
    if (!r.ok || !data) {
      setMsg(r.ok ? "No active crop for the current farm." : data.error || "Error.");
      setMsgType(r.ok ? "info" : "error");
      return;
    }
    setCropId(data.id);
    setCropLabel(data.cropNumber);
    setCurrentCropId(data.id);
    setMsg("");
    await loadRecords(data.id);
    await loadSummary(data.id);
  }

  async function loadRecords(selectedCropId: string) {
    const r = await fetch(`/api/feed/list?cropId=${selectedCropId}`);
    const data = await r.json();
    setRecords(Array.isArray(data) ? data : []);
  }

  async function loadSummary(selectedCropId: string) {
    const r = await fetch(`/api/feed/summary?cropId=${selectedCropId}`);
    const data = await r.json();
    if (r.ok) setSummary(data);
  }

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
    const farmId = getCurrentFarmId();
    if (!farmId) {
      setMsg("Choose a farm in the top menu first.");
      return;
    }
    setCurrentFarmIdState(farmId);
    loadFarmData(farmId);
    loadMyRole(farmId);
    loadHouses(farmId);
    loadActiveCrop(farmId);
  }, []);

  useEffect(() => {
    updatePrices(feedProduct, farmData);
  }, [feedProduct, farmData]);

  function validateForm() {
    if (!cropId) return "No active crop selected.";
    if (!date) return "Choose delivery date.";
    if (!ticketNumber.trim()) return "Ticket number is required.";
    return "";
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setMsgType("error");
      setMsg(validationError);
      return;
    }

    const r = await fetch("/api/feed/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId: currentFarmId, cropId, houseId, date, feedProduct,
        feedKg: Number(feedKg || 0), wheatKg: Number(wheatKg || 0),
        ticketNumber, feedPricePerTonneGbp, wheatPricePerTonneGbp,
        supplier, notes
      }),
    });

    if (r.ok) {
      setMsgType("success");
      setMsg("Feed delivery saved!");
      setFeedKg(""); setWheatKg(""); setTicketNumber(""); setNotes("");
      await loadRecords(cropId);
      await loadSummary(cropId);
    }
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);
  const totalKgPreview = (Number(feedKg || 0)) + (Number(wheatKg || 0));
  const totalCostPreview = useMemo(() => {
    return ((Number(feedKg || 0) / 1000) * Number(feedPricePerTonneGbp || 0)) + 
           ((Number(wheatKg || 0) / 1000) * Number(wheatPricePerTonneGbp || 0));
  }, [feedKg, wheatKg, feedPricePerTonneGbp, wheatPricePerTonneGbp]);

  function getFeedLabel(value: string) {
    return FEED_PRODUCTS.find((item) => item.value === value)?.label || value;
  }

  function getRecordTotalCost(record: FeedRecord) {
    const feedCost = record.feedPricePerTonneGbp ? (record.feedKg / 1000) * record.feedPricePerTonneGbp : 0;
    const wheatCost = record.wheatPricePerTonneGbp ? (record.wheatKg / 1000) * record.wheatPricePerTonneGbp : 0;
    return feedCost + wheatCost;
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Feed deliveries</div>
            <h1 className="page-intro__title">Feed</h1>
            <p className="page-intro__subtitle">Register delivery with automatic pricing from Farm Setup.</p>
          </div>
          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{farmData ? `${farmData.name} (${farmData.code})` : "-"}</div>
            </div>
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Context</div>
              <div>Active crop: {cropLabel || "-"}</div>
              <div style={{ marginTop: 6 }}>Your role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>Read-only mode.</div>}

        <div className="mobile-card">
          <h2>Add Feed Delivery</h2>
          <form onSubmit={saveRecord}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canOperate} />
              </div>
              <div>
                <label>Feed Product</label>
                <select value={feedProduct} onChange={(e) => setFeedProduct(e.target.value)} disabled={!canOperate}>
                  {FEED_PRODUCTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div><label>Feed kg</label><input type="number" value={feedKg} onChange={(e) => setFeedKg(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Wheat kg</label><input type="number" value={wheatKg} onChange={(e) => setWheatKg(e.target.value)} disabled={!canOperate} /></div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div><label>Feed Price / t (Auto)</label><input type="number" value={feedPricePerTonneGbp} onChange={(e) => setFeedPricePerTonneGbp(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Wheat Price / t (Auto)</label><input type="number" value={wheatPricePerTonneGbp} onChange={(e) => setWheatPricePerTonneGbp(e.target.value)} disabled={!canOperate} /></div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div><label>Ticket Number</label><input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} disabled={!canOperate} /></div>
              <div>
                <label>House (optional)</label>
                <select value={houseId} onChange={(e) => setHouseId(e.target.value)} disabled={!canOperate}>
                  <option value="">-- crop level --</option>
                  {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div><label>Supplier</label><input value={supplier} onChange={(e) => setSupplier(e.target.value)} disabled={!canOperate} /></div>
              <div><label>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canOperate} /></div>
            </div>

            <div className="mobile-card mobile-card--soft" style={{ marginTop: 8 }}>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row"><strong>Total kg</strong><span>{totalKgPreview.toFixed(2)}</span></div>
                <div className="mobile-record-row"><strong>Est. Cost GBP</strong><span>{totalCostPreview.toFixed(2)}</span></div>
              </div>
            </div>

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit" disabled={!cropId}>Save Delivery</button>
                </div>
              </div>
            )}
          </form>
        </div>

        {msg && <div className={msgType === "error" ? "mobile-alert mobile-alert--error" : "mobile-alert"} style={{ marginBottom: 16 }}>{msg}</div>}

        {summary && (
          <>
            <div className="mobile-card">
              <h2>Feed Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi"><div className="mobile-kpi__label">Feed kg</div><div className="mobile-kpi__value">{summary.totals.totalFeedKg.toFixed(0)}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Wheat kg</div><div className="mobile-kpi__value">{summary.totals.totalWheatKg.toFixed(0)}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Delivered kg</div><div className="mobile-kpi__value">{summary.totals.totalDeliveredKg.toFixed(0)}</div></div>
                <div className="mobile-kpi"><div className="mobile-kpi__label">Cost GBP</div><div className="mobile-kpi__value">{summary.totals.totalCostGbp.toFixed(2)}</div></div>
              </div>
            </div>
            <h2 className="mobile-section-title">By Product</h2>
            <div className="mobile-record-list">
              {summary.byProduct.map((item) => (
                <div key={item.feedProduct} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">{getFeedLabel(item.feedProduct)}</h3>
                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row"><strong>Feed kg</strong><span>{item.feedKg.toFixed(0)}</span></div>
                    <div className="mobile-record-row"><strong>Wheat kg</strong><span>{item.wheatKg.toFixed(0)}</span></div>
                    <div className="mobile-record-row"><strong>Total kg</strong><span>{item.totalKg.toFixed(0)}</span></div>
                    <div className="mobile-record-row"><strong>Cost GBP</strong><span>{item.totalCostGbp.toFixed(2)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mobile-section-title">Feed Deliveries</h2>
        <div className="mobile-record-list">
          {records.map((record) => (
            <div key={record.id} className="mobile-record-card">
              <h3 className="mobile-record-card__title">{getFeedLabel(record.feedProduct)} · {new Date(record.date).toLocaleDateString()}</h3>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row"><strong>Total kg</strong><span>{(record.feedKg + record.wheatKg).toFixed(2)}</span></div>
                <div className="mobile-record-row"><strong>Ticket</strong><span>{record.ticketNumber}</span></div>
                <div className="mobile-record-row"><strong>House</strong><span>{record.house?.name || "Crop level"}</span></div>
                <div className="mobile-record-row"><strong>Cost</strong><span>{getRecordTotalCost(record).toFixed(2)} GBP</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}