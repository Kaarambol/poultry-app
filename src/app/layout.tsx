import type { ReactNode } from "react";
import { cookies } from "next/headers";
import AppNav from "@/components/AppNav";
import "./globals.css";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("uid")?.value;

  // If not logged in, show only login/register page without the app shell
  if (!uid) {
    return (
      <html lang="pl">
        <body>
          <main>{children}</main>
        </body>
      </html>
    );
  }

  // Logged in — show full app shell with navigation
  return (
    <html lang="pl">
      <body>
        <div className="app-shell">
          <AppNav />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}