export default function AppHomePage() {
  return (
    <div className="mobile-page">
      <h1>Farm Work Home</h1>

      <div className="mobile-card">
        <p style={{ marginTop: 0 }}>
          Use the menu to open the current farm workflow.
        </p>
        <p style={{ marginBottom: 0 }}>
          Best daily path:
          <br />
          Dashboard → Daily Entry → Medication → Avara Export
        </p>
      </div>

      <div className="mobile-card">
        <p style={{ marginTop: 0 }}>
          For finished crops use:
          <br />
          History
        </p>
        <p style={{ marginBottom: 0 }}>
          For permissions, backup and restore use:
          <br />
          Access
        </p>
      </div>
    </div>
  );
}