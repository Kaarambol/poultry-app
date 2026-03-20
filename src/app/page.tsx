"use client";

import { useEffect, useState } from "react";
import { getCurrentFarmId, setCurrentCropId } from "@/lib/app-context";
import { FarmRole } from "@/lib/ui-permissions";

export default function HomePage() {
  const [currentFarmId, setCurrentFarmIdState] = useState("");
  const [farmName, setFarmName] = useState("");
  const [myRole, setMyRole] = useState<FarmRole>("");
  const [activeCrop, setActiveCrop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadData(farmId: string) {
    try {
      const rName = await fetch("/api/farms/list");
      const dName = await rName.json();
      if (Array.isArray(dName)) {
        const farm = dName.find((f: any) => f.id === farmId);
        if (farm) setFarmName(`${farm.name} (${farm.code})`);
      }

      const rRole = await fetch(`/api/farms/access/me?farmId=${farmId}`);
      const dRole = await rRole.json();
      if (rRole.ok) setMyRole(dRole.role || "");

      const rCrop = await fetch(`/api/crops/active?farmId=${farmId}`);
      const dCrop = await rCrop.json();
      if (rCrop.ok && dCrop) {
        setActiveCrop(dCrop);
        setCurrentCropId(dCrop.id);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const farmId = getCurrentFarmId();
    if (farmId) {
      setCurrentFarmIdState(farmId);
      loadData(farmId);
    } else { setLoading(false); }
  }, []);

  if (loading) return <div className="mobile-page"><div className="page-shell">Loading Dashboard...</div></div>;

  const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

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
        <div className="mobile-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Crop: {activeCrop?.cropNumber || "-"}</h2>
            <span className="mobile-badge mobile-badge--success">{activeCrop?.status}</span>
          </div>
          <div style={{ fontSize: '0.9rem' }}>
            <strong>Breed:</strong> {activeCrop?.breed || "Ross 308"} | <strong>Planted:</strong> {formatDate(activeCrop?.placementDate)}
          </div>
        </div>

        {/* HOUSE TILES */}
        <div className="mobile-grid mobile-grid--1">
          {activeCrop?.placements?.map((batch: any) => {
            const h = batch.house || {};
            const area = Number(h.floorAreaM2 || h.usableAreaM2 || 0);
            
            // House specific records
            const houseRecords = (activeCrop.dailyRecords || [])
              .filter((r: any) => r.houseId === batch.houseId)
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const latest = houseRecords.length > 0 ? houseRecords[houseRecords.length - 1] : null;

            // Density Calculations
            const calcDensity = (rec: any) => {
              if (!rec || area === 0) return "0.00";
              const wG = Number(rec.avgWeightG || 0);
              const birds = Number(rec.birdsAlive || 0);
              return ((birds * wG) / 1000 / area).toFixed(2);
            };

            const currentDensity = calcDensity(latest);

            // Find Thinning Density (First record where birds were removed but not all)
            const thinRecord = houseRecords.find((r: any) => (Number(r.birdsThinned) > 0 || r.isThinning === true) && r.birdsAlive > 0);
            const thinningDensity = thinRecord ? calcDensity(thinRecord) : "N/A";

            // Find Clearance Density (The very last record of the house)
            const clearRecord = houseRecords.find((r: any) => r.isClearance === true || (r.birdsAlive === 0 && houseRecords.indexOf(r) > 0));
            const clearanceDensity = clearRecord ? calcDensity(houseRecords[houseRecords.indexOf(clearRecord) - 1]) : "N/A";

            const nips = Number(h.defaultNippleCount || 0);
            const pans = Number(h.defaultFeederPanCount || 0);

            return (
              <div key={batch.id} className="mobile-card" style={{ marginBottom: 16, borderLeft: '5px solid var(--primary)' }}>
                <h3 style={{ margin: "0 0 10px 0" }}>House: {h.name}</h3>

                {/* DENSITY HIGHLIGHTS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ background: '#f0f7ff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #cce5ff', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.7rem', color: '#004085', fontWeight: 'bold' }}>CURRENT DENSITY</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#004085' }}>{currentDensity} <small style={{ fontSize: '0.7rem' }}>kg/m²</small></div>
                  </div>
                  <div style={{ background: '#fcf8e3', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid #faebcc' }}>
                    <div style={{ fontSize: '0.65rem', color: '#8a6d3b', fontWeight: 'bold' }}>THINNING</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#8a6d3b' }}>{thinningDensity} <small style={{ fontSize: '0.6rem' }}>kg/m²</small></div>
                  </div>
                  <div style={{ background: '#dff0d8', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid #d6e9c6' }}>
                    <div style={{ fontSize: '0.65rem', color: '#3c763d', fontWeight: 'bold' }}>CLEARANCE</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#3c763d' }}>{clearanceDensity} <small style={{ fontSize: '0.6rem' }}>kg/m²</small></div>
                  </div>
                </div>

                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', color: '#666' }}>PTC / Flock</td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }}>{batch.ptcNumber || "-"} / {batch.flockCode || "-"}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', color: '#666' }}>Parent Age</td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }}>{batch.parentAge || "-"}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', color: '#666' }}>Hatchery</td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }}>{batch.hatchery || activeCrop?.hatchery || "-"}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', color: '#666' }}>Birds Placed</td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }}>{batch.birdsPlaced?.toLocaleString()}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', fontWeight: 'bold' }}>Birds / Nipple</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(batch.birdsPlaced / (nips || 1)).toFixed(1)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '6px 0', fontWeight: 'bold' }}>Birds / Feeder Pan</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{(batch.birdsPlaced / (pans || 1)).toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
                
                <div style={{ marginTop: 12, fontSize: '0.65rem', color: '#999', textAlign: 'center', background: '#f9f9f9', padding: '4px', borderRadius: '4px' }}>
                  Setup: {area} m² | {nips} Nipples | {pans} Pans
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}