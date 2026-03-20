import type { ReactNode } from "react";
import { cookies } from "next/headers";
import AppNav from "@/components/AppNav";
import "./globals.css"; // Upewnij się, że importujesz style!

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("uid")?.value;

  // Jeśli użytkownik NIE jest zalogowany, pokazujemy TYLKO stronę logowania/rejestracji
  // bez żadnych dodatkowych ramek i napisów "Not logged in"
  if (!uid) {
    return (
      <html lang="pl">
        <body>
          <main>{children}</main>
        </body>
      </html>
    );
  }

  // Jeśli użytkownik JEST zalogowany, pokazujemy pełny interfejs z nawigacją
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