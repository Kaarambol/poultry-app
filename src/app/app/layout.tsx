import type { ReactNode } from "react";
import { cookies } from "next/headers";
import AppNav from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("uid")?.value;

  if (!uid) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f6f8fb",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            border: "1px solid #dbe3ee",
            borderRadius: 18,
            padding: 24,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(18, 32, 51, 0.1)",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 12 }}>Not logged in</h1>
          <p style={{ marginTop: 0, color: "#5d6b82" }}>
            Please go to{" "}
            <a href="/login" style={{ color: "#1f6feb", fontWeight: 700 }}>
              Login
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppNav />
      <main className="app-main">{children}</main>
    </div>
  );
}