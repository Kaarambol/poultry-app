"use client";

import Link from "next/link";
import { useState } from "react";

type SearchItem = {
  placementId: string;
  farmId: string;
  farmName: string;
  farmCode: string;
  cropId: string;
  cropNumber: string;
  cropStatus: string;
  houseId: string;
  houseName: string;
  houseCode: string | null;
  placementDate: string;
  hatchery: string | null;
  birdsPlaced: number;
  parentAgeWeeks: number | null;
  notes: string | null;
  currentBirdsAliveEstimate: number;
  totalFeedKg: number;
  totalWheatKg: number;
  medicationRecordsCount: number;
};

type SearchGroup = {
  flockNumber: string;
  totalBirdsPlaced: number;
  farmsCount: number;
  cropsCount: number;
  housesCount: number;
  firstPlacementDate: string | null;
  latestPlacementDate: string | null;
  items: SearchItem[];
};

type SearchResponse = {
  query: string;
  results: SearchGroup[];
  totalMatches: number;
  totalFlocks: number;
};

export default function CheckFlockPage() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"error" | "success" | "info">("info");

  async function searchFlock(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setMsgType("error");
      setMsg("Enter at least 2 characters.");
      setData(null);
      return;
    }

    setLoading(true);
    setMsg("");
    setData(null);

    try {
      const r = await fetch(
        `/api/check-flock/search?q=${encodeURIComponent(trimmed)}`
      );
      const result = await r.json();

      if (!r.ok) {
        setMsgType("error");
        setMsg(result.error || "Search error.");
        return;
      }

      setSearchedQuery(trimmed);
      setData(result);
      if (result.totalMatches === 0) {
        setMsgType("info");
        setMsg("No matching flocks found.");
      } else {
        setMsgType("success");
        setMsg(
          `Found ${result.totalMatches} matching placement record(s) across ${result.totalFlocks} flock group(s).`
        );
      }
    } catch {
      setMsgType("error");
      setMsg("Search error.");
    } finally {
      setLoading(false);
    }
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
            <div className="page-intro__eyebrow">Global traceability</div>
            <h1 className="page-intro__title">Check Flock</h1>
            <p className="page-intro__subtitle">
              Search flock numbers across the whole database and review all farms,
              crops and houses where they appear.
            </p>
          </div>
        </div>

        <div className="mobile-card">
          <h2>Search Flock Number</h2>

          <form onSubmit={searchFlock}>
            <label>Flock number</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. L0406"
            />

            <div className="mobile-sticky-actions">
              <div className="mobile-sticky-actions__inner">
                <button className="mobile-full-button" type="submit" disabled={loading}>
                  {loading ? "Searching..." : "Check Flock"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {msg && (
          <div className={alertClass} style={{ marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {data && data.totalMatches > 0 && (
          <>
            <div className="mobile-card">
              <h2>Search Summary</h2>
              <div className="mobile-record-card__grid">
                <div className="mobile-record-row">
                  <strong>Search</strong>
                  <span>{searchedQuery}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Matching placements</strong>
                  <span>{data.totalMatches}</span>
                </div>
                <div className="mobile-record-row">
                  <strong>Flock groups</strong>
                  <span>{data.totalFlocks}</span>
                </div>
              </div>
            </div>

            <h2 className="mobile-section-title">Matching Houses</h2>

            <div className="mobile-record-list">
              {data.results.flatMap((group) =>
                group.items.map((item) => (
                  <div key={item.placementId} className="mobile-record-card">
                    <h3 className="mobile-record-card__title">
                      {item.houseName}{item.houseCode ? ` (${item.houseCode})` : ""} · {item.farmName} ({item.farmCode})
                    </h3>

                    <div className="mobile-record-card__grid">
                      <div className="mobile-record-row">
                        <strong>Flock</strong>
                        <span>{group.flockNumber}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Crop</strong>
                        <span>{item.cropNumber} · {item.cropStatus}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Placement date</strong>
                        <span>{new Date(item.placementDate).toLocaleDateString()}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds placed</strong>
                        <span>{item.birdsPlaced}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Birds alive est.</strong>
                        <span>{item.currentBirdsAliveEstimate}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Hatchery</strong>
                        <span>{item.hatchery || "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Parent age weeks</strong>
                        <span>{item.parentAgeWeeks ?? "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Feed kg</strong>
                        <span>{item.totalFeedKg.toFixed(0)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Wheat kg</strong>
                        <span>{item.totalWheatKg.toFixed(0)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <strong>Medication records</strong>
                        <span>{item.medicationRecordsCount}</span>
                      </div>
                      {item.notes && (
                        <div className="mobile-record-row">
                          <strong>Notes</strong>
                          <span>{item.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="mobile-actions" style={{ marginTop: 12 }}>
                      <Link
                        href={`/houses/${item.houseId}/table?cropId=${item.cropId}`}
                        className="mobile-button mobile-button--secondary"
                      >
                        Table
                      </Link>
                      <Link
                        href={`/houses/${item.houseId}/charts?cropId=${item.cropId}`}
                        className="mobile-button mobile-button--secondary"
                      >
                        Charts
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}