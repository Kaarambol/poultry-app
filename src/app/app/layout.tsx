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
      <div style={{ fontFamily: "sans-serif", padding: 24 }}>
        <h1>Not logged in</h1>
        <p>
          Please go to <a href="/login">Login</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", minHeight: "100vh", background: "#fff" }}>
      <AppNav />
      <main style={{ padding: "16px" }}>{children}</main>
    </div>
  );
}