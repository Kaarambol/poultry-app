export default function AppHome() {
  return (
    <div style={{ maxWidth: 900, margin: "20px auto", fontFamily: "sans-serif" }}>
      <h1>Poultry Crop Manager</h1>
      <p>Welcome. Use the menu above to manage farms, crops, daily records, exports and medication.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        <a href="/app/dashboard" style={cardStyle}>
          <h3>Dashboard</h3>
          <p>View active crop totals and house performance.</p>
        </a>

        <a href="/app/daily" style={cardStyle}>
          <h3>Daily Entry</h3>
          <p>Save mort, culls, feed, water and weights.</p>
        </a>

        <a href="/app/avara" style={cardStyle}>
          <h3>Avara Export</h3>
          <p>Preview and export stage-based Avara reports.</p>
        </a>

        <a href="/app/medication" style={cardStyle}>
          <h3>Medication</h3>
          <p>Save treatment records and print medication forms.</p>
        </a>

        <a href="/app/crops/manage" style={cardStyle}>
          <h3>Manage Crops</h3>
          <p>Finish crops and review active/finished history.</p>
        </a>

        <a href="/app/farms/setup" style={cardStyle}>
          <h3>Farm Setup</h3>
          <p>Manage houses and floor areas.</p>
        </a>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#111",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 16,
  background: "#fafafa",
};