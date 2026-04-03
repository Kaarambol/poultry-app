import type { ReactNode } from "react";
import { cookies } from "next/headers";
import AppNav from "@/components/AppNav";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("uid")?.value;

  // If not logged in, show only login/register page without the app shell
  const pwaHead = (
    <>
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#2563eb" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Poultry" />
      <link rel="apple-touch-icon" href="/icon.svg" />
    </>
  );

  if (!uid) {
    return (
      <html lang="pl">
        <head>{pwaHead}</head>
        <body>
          <PwaSetup />
          <main>{children}</main>
        </body>
      </html>
    );
  }

  // Logged in — show full app shell with navigation
  return (
    <html lang="pl">
      <head>{pwaHead}</head>
      <body>
        <PwaSetup />
        <div className="app-shell">
          <AppNav />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}