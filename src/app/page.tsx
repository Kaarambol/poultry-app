"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole } from "@/lib/ui-permissions";

type FarmInfo = {
  id: string;
  name: string;
  code: string;
  farmNumber?: string | null;
  chpCode?: string | null;
  rodentControl?: string | null;
  disinfectProgramme?: string | null;
  waterSanitizer?: string | null;
  footDipDisinfectant?: string | null;
  cleaningContractor?: string | null;
  vetContractor?: string | null;
  electricianContractor?: string | null;
  generatorService?: string | null;
  weedkiller?: string | null;
  security?: string | null;
};

export default function HomePage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName]   = useState("");
  const [farmInfo, setFarmInfo]   = useState<FarmInfo | null>(null);
  const [myRole, setMyRole]       = useState<FarmRole>("");
  const [activeCrop, setActiveCrop] = useState<any>(null);
  const [allHouses, setAllHouses]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  async function loadData(farmId: string) {
    try {
      const [rFarms, rRole, rCrop, rHouses] = await Promise.all([
        fetch("/api/farms/list"),
        fetch(`/api/farms/access/me?farmId=${farmId}`),
        fetch(`/api/crops/active?farmId=${farmId}`),
        fetch(`/api/houses/list?farmId=${farmId}`),
      ]);

      const dFarms = await rFarms.json();
      if (Array.isArray(dFarms)) {
        const farm = dFarms.find((f: any) => f.id === farmId);
        if (farm) {
          setFarmName(`${farm.name} (${farm.code})`);
          setFarmInfo(farm);
        }
      }

      const dRole = await rRole.json();
      if (rRole.ok) setMyRole(dRole.role || "");

      const dCrop = await rCrop.json();
      if (rCrop.ok && dCrop) {
        setActiveCrop(dCrop);
        setCurrentCropId(dCrop.id);
      }

      const dHouses = await rHouses.json();
      if (Array.isArray(dHouses)) setAllHouses(dHouses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();
    if (farmId) {
      setCurrentFarmIdState(farmId);
      loadData(farmId);
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="mobile-page"><div className="page-shell">Loading Dashboard...</div></div>;

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

  // Total farm area from all houses
  const totalFarmAreaM2 = allHouses.reduce((s, h) => s + Number(h.floorAreaM2 || 0), 0);

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <h1 className="page-intro__title">{farmName || "Farm Dashboard"}</h1>
            <p className="page-intro__subtitle">Real-time stocking density and house equipment metrics.</p>
          </div>
        </div>

        {/* CROP SUMMARY */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Crop: {activeCrop?.cropNumber || "-"}</h2>
            <span className="mobile-badge mobile-badge--success">{activeCrop?.status}</span>
          </div>
          <div style={{ fontSize: "0.9rem" }}>
            <strong>Breed:</strong> {activeCrop?.breed || "Ross 308"} | <strong>Placed:</strong> {formatDate(activeCrop?.placementDate)}
          </div>
        </div>

        {/* FARM INFORMATION TILE */}
        {farmInfo && (
          <div className="mobile-card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Farm Information</h2>
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <tbody>
                {totalFarmAreaM2 > 0 && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Total Farm Area</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{totalFarmAreaM2.toLocaleString()} m²</td>
                  </tr>
                )}
                {farmInfo.farmNumber && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Farm Number</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.farmNumber}</td>
                  </tr>
                )}
                {farmInfo.chpCode && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>CHP Code</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.chpCode}</td>
                  </tr>
                )}
                {farmInfo.rodentControl && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Rodent Control</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.rodentControl}</td>
                  </tr>
                )}
                {farmInfo.disinfectProgramme && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Disinfect Programme</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.disinfectProgramme}</td>
                  </tr>
                )}
                {farmInfo.waterSanitizer && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Water Sanitizer</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.waterSanitizer}</td>
                  </tr>
                )}
                {farmInfo.footDipDisinfectant && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Foot Dip Disinfectant</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.footDipDisinfectant}</td>
                  </tr>
                )}
                {farmInfo.cleaningContractor && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Cleaning Contractor</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.cleaningContractor}</td>
                  </tr>
                )}
                {farmInfo.vetContractor && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Vet Contractor</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.vetContractor}</td>
                  </tr>
                )}
                {farmInfo.electricianContractor && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Electrician</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.electricianContractor}</td>
                  </tr>
                )}
                {farmInfo.generatorService && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Generator Service</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.generatorService}</td>
                  </tr>
                )}
                {farmInfo.weedkiller && (
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "5px 0", color: "#666" }}>Weedkiller</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.weedkiller}</td>
                  </tr>
                )}
                {farmInfo.security && (
                  <tr>
                    <td style={{ padding: "5px 0", color: "#666" }}>Security</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{farmInfo.security}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* HOUSE TILES */}
        {(() => {
          // Group placements by house — one tile per house, sum all batches
          const houseMap: Record<string, { houseId: string; house: any; totalPlaced: number; thinDate: string | null; thin2Date: string | null; clearDate: string | null; batches: any[] }> = {};
          for (const batch of (activeCrop?.placements || [])) {
            const hid = batch.houseId;
            if (!houseMap[hid]) {
              houseMap[hid] = { houseId: hid, house: batch.house || {}, totalPlaced: 0, thinDate: null, thin2Date: null, clearDate: null, batches: [] };
            }
            houseMap[hid].totalPlaced += Number(batch.birdsPlaced || 0);
            if (batch.thinDate  && !houseMap[hid].thinDate)  houseMap[hid].thinDate  = batch.thinDate;
            if (batch.thin2Date && !houseMap[hid].thin2Date) houseMap[hid].thin2Date = batch.thin2Date;
            if (batch.clearDate && !houseMap[hid].clearDate) houseMap[hid].clearDate = batch.clearDate;
            houseMap[hid].batches.push(batch);
          }

          return Object.values(houseMap).map(({ houseId, house: h, totalPlaced, thinDate, thin2Date, clearDate, batches }) => {
            const area = Number(h.floorAreaM2 || h.usableAreaM2 || 0);
            const nips = Number(h.defaultNippleCount || 0);
            const pans = Number(h.defaultFeederPanCount || 0);

            // Calculated supply quantities (based on totalPlaced for this house)
            const balesOfShavings = totalPlaced > 0 ? Math.ceil(totalPlaced * 1.5 / 1000) : null;
            const metersOfPerch   = totalPlaced > 0 ? Math.ceil(totalPlaced * 1.5 / 1000) : null;
            const packingObjects  = totalPlaced > 0 ? Math.ceil(totalPlaced / 1000) : null;

            // Daily records for this house sorted by date ascending
            const houseRecords = (activeCrop.dailyRecords || [])
              .filter((r: any) => r.houseId === houseId)
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Helper: cumulative thinned birds up to and including a given date
            const getThinned = (dateStr: string) => {
              let total = 0;
              for (const b of batches) {
                if (b.thinBirds && b.thinDate) {
                  const d = new Date(b.thinDate).toISOString().slice(0, 10);
                  if (d <= dateStr) total += Number(b.thinBirds || 0);
                }
                if (b.thin2Birds && b.thin2Date) {
                  const d = new Date(b.thin2Date).toISOString().slice(0, 10);
                  if (d <= dateStr) total += Number(b.thin2Birds || 0);
                }
              }
              return total;
            };

            let cumLosses = 0;
            const recordsWithAlive = houseRecords.map((r: any) => {
              cumLosses += Number(r.mort || 0) + Number(r.culls || 0);
              const thinned = getThinned(new Date(r.date).toISOString().slice(0, 10));
              return { ...r, birdsAlive: totalPlaced - cumLosses - thinned };
            });

            const calcDensity = (rec: any) => {
              if (!rec || area === 0) return "0.00";
              const wG    = Number(rec.avgWeightG || 0);
              const birds = Number(rec.birdsAlive || 0);
              if (wG === 0 || birds === 0) return "0.00";
              return ((birds * wG) / 1000 / area).toFixed(2);
            };

            const latest = recordsWithAlive.length > 0 ? recordsWithAlive[recordsWithAlive.length - 1] : null;
            const currentDensity = calcDensity(latest);

            const recordOnOrBefore = (dateStr: string | null) => {
              if (!dateStr) return null;
              const ts = new Date(dateStr).setHours(23, 59, 59, 999);
              const candidates = recordsWithAlive.filter((r: any) => new Date(r.date).getTime() <= ts);
              return candidates.length > 0 ? candidates[candidates.length - 1] : null;
            };

            const calcThinDensity = (targetDate: string | null, thinBirdsForEvent: number) => {
              if (!targetDate) return "N/A";
              const rec = recordOnOrBefore(targetDate);
              if (!rec) return "N/A";
              const recDateStr    = new Date(rec.date).toISOString().slice(0, 10);
              const targetDateStr = new Date(targetDate).toISOString().slice(0, 10);
              const preThinBirds  = recDateStr === targetDateStr
                ? Number(rec.birdsAlive || 0) + thinBirdsForEvent
                : Number(rec.birdsAlive || 0);
              return calcDensity({ ...rec, birdsAlive: preThinBirds }) || "N/A";
            };

            const houseThin1Birds = batches.reduce((s: number, b: any) => s + Number(b.thinBirds || 0), 0);
            const houseThin2Birds = batches.reduce((s: number, b: any) => s + Number(b.thin2Birds || 0), 0);

            const thinningDensity  = thinDate  ? calcThinDensity(thinDate,  houseThin1Birds) : "N/A";
            const thin2Density     = thin2Date ? calcThinDensity(thin2Date, houseThin2Birds) : null;
            const clearanceDensity = clearDate ? (calcDensity(recordOnOrBefore(clearDate)) || "N/A") : "N/A";

            const flockNumbers = batches.map((b: any) => b.flockNumber).filter(Boolean).join(", ") || "-";

            return (
              <div key={houseId} className="mobile-card" style={{ marginBottom: 16, borderLeft: "5px solid var(--primary)" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>House: {h.name}</h3>

                {/* DENSITY HIGHLIGHTS */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                  <div style={{ background: "#f0f7ff", padding: "12px", borderRadius: "10px", textAlign: "center", border: "1px solid #cce5ff", gridColumn: "span 2" }}>
                    <div style={{ fontSize: "0.7rem", color: "#004085", fontWeight: "bold" }}>CURRENT DENSITY</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#004085" }}>{currentDensity} <small style={{ fontSize: "0.7rem" }}>kg/m²</small></div>
                  </div>
                  <div style={{ background: "#fcf8e3", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #faebcc" }}>
                    <div style={{ fontSize: "0.65rem", color: "#8a6d3b", fontWeight: "bold" }}>THINNING{thin2Date ? " 1" : ""}</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#8a6d3b" }}>{thinningDensity} <small style={{ fontSize: "0.6rem" }}>kg/m²</small></div>
                  </div>
                  {thin2Date && thin2Density !== null ? (
                    <div style={{ background: "#fcf8e3", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #faebcc" }}>
                      <div style={{ fontSize: "0.65rem", color: "#8a6d3b", fontWeight: "bold" }}>THINNING 2</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#8a6d3b" }}>{thin2Density} <small style={{ fontSize: "0.6rem" }}>kg/m²</small></div>
                    </div>
                  ) : (
                    <div style={{ background: "#dff0d8", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #d6e9c6" }}>
                      <div style={{ fontSize: "0.65rem", color: "#3c763d", fontWeight: "bold" }}>CLEARANCE</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#3c763d" }}>{clearanceDensity} <small style={{ fontSize: "0.6rem" }}>kg/m²</small></div>
                    </div>
                  )}
                  {thin2Date && (
                    <div style={{ background: "#dff0d8", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid #d6e9c6", gridColumn: "span 2" }}>
                      <div style={{ fontSize: "0.65rem", color: "#3c763d", fontWeight: "bold" }}>CLEARANCE</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#3c763d" }}>{clearanceDensity} <small style={{ fontSize: "0.6rem" }}>kg/m²</small></div>
                    </div>
                  )}
                </div>

                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 0", color: "#666" }}>Flock</td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>{flockNumbers}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 0", color: "#666" }}>Birds Placed</td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>{totalPlaced.toLocaleString()}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 0", fontWeight: "bold" }}>Birds / Nipple</td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{(totalPlaced / (nips || 1)).toFixed(1)}</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 0", fontWeight: "bold" }}>Birds / Feeder Pan</td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{(totalPlaced / (pans || 1)).toFixed(1)}</td>
                    </tr>
                    {balesOfShavings !== null && (
                      <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "6px 0", fontWeight: "bold" }}>Bales of Shavings</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>{balesOfShavings}</td>
                      </tr>
                    )}
                    {metersOfPerch !== null && (
                      <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "6px 0", fontWeight: "bold" }}>Meters of Perch</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>{metersOfPerch} m</td>
                      </tr>
                    )}
                    {packingObjects !== null && (
                      <tr>
                        <td style={{ padding: "6px 0", fontWeight: "bold" }}>Packing Objects</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>{packingObjects}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div style={{ marginTop: 12, fontSize: "0.65rem", color: "#999", textAlign: "center", background: "#f9f9f9", padding: "4px", borderRadius: "4px" }}>
                  Setup: {area} m² | {nips} Nipples | {pans} Pans
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
