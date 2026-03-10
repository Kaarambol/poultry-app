"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole, canOperateUi, isReadOnlyUi } from "@/lib/ui-permissions";

type Farm = {
  id: string;
  name: string;
  code: string;
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
  { value: "STARTER_CRUMB_185", label: "Starter Crumb 185" },
  { value: "REARER_PELLET_385", label: "Rearer Pellet 385" },
  { value: "GROWER_PELLET_485", label: "Grower Pellet 485" },
  { value: "FINISHER_PELLET_585", label: "Finisher Pellet 585" },
  { value: "WHEAT", label: "Wheat" },
];

export default function FeedPage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
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

  async function loadFarmName(farmId: string) {
    const r = await fetch("/api/farms/list");
    const data = await r.json();

    if (!Array.isArray(data)) return;

    const farm = (data as Farm[]).find((f) => f.id === farmId);
    if (farm) {
      setFarmName(`${farm.name} (${farm.code})`);
    } else {
      setFarmName("");
    }
  }

  async function loadMyRole(farmId: string) {
    const r = await fetch(`/api/farms/access/me?farmId=${farmId}`);
    const data = await r.json();

    if (r.ok) {
      setMyRole(data.role || "");
    } else {
      setMyRole("");
    }
  }

  async function loadHouses(farmId: string) {
    const r = await fetch(`/api/houses/list?farmId=${farmId}`);
    const data = await r.json();

    if (Array.isArray(data)) setHouses(data);
    else setHouses([]);
  }

  async function loadActiveCrop(farmId: string) {
    const r = await fetch(`/api/crops/active?farmId=${farmId}`);
    const data = await r.json();

    if (!r.ok) {
      setMsgType("error");
      setMsg(data.error || "Error loading active crop.");
      setCropId("");
      setCropLabel("");
      return;
    }

    if (!data) {
      setMsgType("info");
      setMsg("No active crop for the current farm.");
      setCropId("");
      setCropLabel("");
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

    if (Array.isArray(data)) setRecords(data);
    else setRecords([]);
  }

  async function loadSummary(selectedCropId: string) {
    const r = await fetch(`/api/feed/summary?cropId=${selectedCropId}`);
    const data = await r.json();

    if (r.ok) setSummary(data);
    else setSummary(null);
  }

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));

    const farmId = getCurrentFarmId();

    if (!farmId) {
      setMsgType("info");
      setMsg("Choose a farm in the top menu first.");
      return;
    }

    setCurrentFarmIdState(farmId);
    loadFarmName(farmId);
    loadMyRole(farmId);
    loadHouses(farmId);
    loadActiveCrop(farmId);
  }, []);

  function validateForm() {
    if (!cropId) return "No active crop selected.";
    if (!date) return "Choose delivery date.";
    if (!feedProduct) return "Choose feed product.";
    if (!ticketNumber.trim()) return "Ticket number is required.";

    const feedNum = Number(feedKg || 0);
    const wheatNum = Number(wheatKg || 0);
    const feedPriceNum =
      feedPricePerTonneGbp === "" ? null : Number(feedPricePerTonneGbp);
    const wheatPriceNum =
      wheatPricePerTonneGbp === "" ? null : Number(wheatPricePerTonneGbp);

    if (Number.isNaN(feedNum) || feedNum < 0) {
      return "Feed kg must be a valid non-negative number.";
    }

    if (Number.isNaN(wheatNum) || wheatNum < 0) {
      return "Wheat kg must be a valid non-negative number.";
    }

    if (feedNum === 0 && wheatNum === 0) {
      return "At least one of feed kg or wheat kg must be greater than zero.";
    }

    if (feedPriceNum !== null && (Number.isNaN(feedPriceNum) || feedPriceNum < 0)) {
      return "Feed price per tonne must be a valid non-negative number.";
    }

    if (wheatPriceNum !== null && (Number.isNaN(wheatPriceNum) || wheatPriceNum < 0)) {
      return "Wheat price per tonne must be a valid non-negative number.";
    }

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        farmId: currentFarmId,
        cropId,
        houseId,
        date,
        feedProduct,
        feedKg: feedKg === "" ? 0 : Number(feedKg),
        wheatKg: wheatKg === "" ? 0 : Number(wheatKg),
        ticketNumber,
        feedPricePerTonneGbp,
        wheatPricePerTonneGbp,
        supplier,
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
    setMsg("Feed delivery saved!");
    setFeedKg("");
    setWheatKg("");
    setTicketNumber("");
    setFeedPricePerTonneGbp("");
    setWheatPricePerTonneGbp("");
    setSupplier("");
    setHouseId("");
    setNotes("");

    await loadRecords(cropId);
    await loadSummary(cropId);
  }

  const canOperate = canOperateUi(myRole);
  const readOnly = isReadOnlyUi(myRole);

  const totalKgPreview = (Number(feedKg || 0) || 0) + (Number(wheatKg || 0) || 0);

  const totalCostPreview = useMemo(() => {
    const feedNum = Number(feedKg || 0) || 0;
    const wheatNum = Number(wheatKg || 0) || 0;
    const feedPriceNum = Number(feedPricePerTonneGbp || 0) || 0;
    const wheatPriceNum = Number(wheatPricePerTonneGbp || 0) || 0;

    return (feedNum / 1000) * feedPriceNum + (wheatNum / 1000) * wheatPriceNum;
  }, [feedKg, wheatKg, feedPricePerTonneGbp, wheatPricePerTonneGbp]);

  const alertClass =
    msgType === "error"
      ? "mobile-alert mobile-alert--error"
      : msgType === "success"
      ? "mobile-alert mobile-alert--success"
      : "mobile-alert";

  function getFeedLabel(value: string) {
    return FEED_PRODUCTS.find((item) => item.value === value)?.label || value;
  }

  function getRecordTotalCost(record: FeedRecord) {
    const feedCost = record.feedPricePerTonneGbp
      ? (record.feedKg / 1000) * record.feedPricePerTonneGbp
      : 0;
    const wheatCost = record.wheatPricePerTonneGbp
      ? (record.wheatKg / 1000) * record.wheatPricePerTonneGbp
      : 0;

    return feedCost + wheatCost;
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">Feed deliveries</div>
            <h1 className="page-intro__title">Feed</h1>
            <p className="page-intro__subtitle">
              Register each delivery by date, product, kilograms and ticket number.
            </p>
          </div>

          <div className="page-intro__meta">
            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Current farm</div>
              <div>{currentFarmId ? farmName || currentFarmId : "-"}</div>
            </div>

            <div className="page-intro__meta-card">
              <div className="page-intro__eyebrow">Context</div>
              <div>Active crop: {cropLabel || "-"}</div>
              <div style={{ marginTop: 6 }}>Your role: {myRole || "-"}</div>
            </div>
          </div>
        </div>

        {readOnly && (
          <div className="mobile-alert mobile-alert--warning" style={{ marginBottom: 16 }}>
            Read-only mode. VIEWER can only see feed records.
          </div>
        )}

        <div className="mobile-card">
          <h2>Add Feed Delivery</h2>

          <form onSubmit={saveRecord}>
            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Feed Product</label>
                <select
                  value={feedProduct}
                  onChange={(e) => setFeedProduct(e.target.value)}
                  disabled={!cropId || !canOperate}
                >
                  {FEED_PRODUCTS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Feed kg</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feedKg}
                  onChange={(e) => setFeedKg(e.target.value)}
                  disabled={!cropId || !canOperate}
                  placeholder="e.g. 26790"
                />
              </div>

              <div>
                <label>Wheat kg</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wheatKg}
                  onChange={(e) => setWheatKg(e.target.value)}
                  disabled={!cropId || !canOperate}
                  placeholder="e.g. 0"
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Ticket Number</label>
                <input
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  disabled={!cropId || !canOperate}
                  placeholder="e.g. 685669"
                />
              </div>

              <div>
                <label>House (optional)</label>
                <select
                  value={houseId}
                  onChange={(e) => setHouseId(e.target.value)}
                  disabled={!cropId || !canOperate}
                >
                  <option value="">-- crop level / all houses --</option>
                  {houses.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.name}
                      {house.code ? ` (${house.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Feed Price / tonne GBP (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={feedPricePerTonneGbp}
                  onChange={(e) => setFeedPricePerTonneGbp(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Wheat Price / tonne GBP (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wheatPricePerTonneGbp}
                  onChange={(e) => setWheatPricePerTonneGbp(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-grid mobile-grid--2">
              <div>
                <label>Supplier (optional)</label>
                <input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>

              <div>
                <label>Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!cropId || !canOperate}
                />
              </div>
            </div>

            <div className="mobile-card mobile-card--soft" style={{ marginTop: 8 }}>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row">
                  <strong>Total kg</strong>
                  <span>{totalKgPreview.toFixed(2)}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Estimated total cost GBP</strong>
                  <span>{totalCostPreview.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {canOperate && (
              <div className="mobile-sticky-actions">
                <div className="mobile-sticky-actions__inner">
                  <button className="mobile-full-button" type="submit" disabled={!cropId}>
                    Save Feed Delivery
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {summary && (
          <>
            <div className="mobile-card">
              <h2>Feed Summary</h2>
              <div className="mobile-kpi-grid">
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Feed kg</div>
                  <div className="mobile-kpi__value">
                    {summary.totals.totalFeedKg.toFixed(0)}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Wheat kg</div>
                  <div className="mobile-kpi__value">
                    {summary.totals.totalWheatKg.toFixed(0)}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Delivered kg</div>
                  <div className="mobile-kpi__value">
                    {summary.totals.totalDeliveredKg.toFixed(0)}
                  </div>
                </div>
                <div className="mobile-kpi">
                  <div className="mobile-kpi__label">Cost GBP</div>
                  <div className="mobile-kpi__value">
                    {summary.totals.totalCostGbp.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <h2 className="mobile-section-title">By Product</h2>
            <div className="mobile-record-list">
              {summary.byProduct.map((item) => (
                <div key={item.feedProduct} className="mobile-record-card">
                  <h3 className="mobile-record-card__title">
                    {getFeedLabel(item.feedProduct)}
                  </h3>
                  <div className="mobile-record-card__grid">
                    <div className="mobile-record-row">
                      <strong>Feed kg</strong>
                      <span>{item.feedKg.toFixed(0)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Wheat kg</strong>
                      <span>{item.wheatKg.toFixed(0)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Total kg</strong>
                      <span>{item.totalKg.toFixed(0)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Cost GBP</strong>
                      <span>{item.totalCostGbp.toFixed(2)}</span>
                    </div>
                    <div className="mobile-record-row">
                      <strong>Records</strong>
                      <span>{item.recordsCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mobile-section-title">Feed Deliveries</h2>
        {records.length === 0 ? (
          <div className="mobile-card">
            <p style={{ margin: 0 }}>No feed deliveries yet.</p>
          </div>
        ) : (
          <div className="mobile-record-list">
            {records.map((record) => (
              <div key={record.id} className="mobile-record-card">
                <h3 className="mobile-record-card__title">
                  {getFeedLabel(record.feedProduct)} · {new Date(record.date).toLocaleDateString()}
                </h3>

                <div className="mobile-record-card__grid">
                  <div className="mobile-record-row">
                    <strong>Feed kg</strong>
                    <span>{record.feedKg.toFixed(2)}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Wheat kg</strong>
                    <span>{record.wheatKg.toFixed(2)}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Total kg</strong>
                    <span>{(record.feedKg + record.wheatKg).toFixed(2)}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Ticket</strong>
                    <span>{record.ticketNumber}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>House</strong>
                    <span>
                      {record.house
                        ? `${record.house.name}${record.house.code ? ` (${record.house.code})` : ""}`
                        : "Crop level"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Supplier</strong>
                    <span>{record.supplier || "-"}</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Feed price / tonne</strong>
                    <span>
                      {record.feedPricePerTonneGbp !== null
                        ? `${record.feedPricePerTonneGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Wheat price / tonne</strong>
                    <span>
                      {record.wheatPricePerTonneGbp !== null
                        ? `${record.wheatPricePerTonneGbp.toFixed(2)} GBP`
                        : "-"}
                    </span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Estimated cost</strong>
                    <span>{getRecordTotalCost(record).toFixed(2)} GBP</span>
                  </div>
                  <div className="mobile-record-row">
                    <strong>Notes</strong>
                    <span>{record.notes || "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}