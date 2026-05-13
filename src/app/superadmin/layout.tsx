"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/superadmin/me")
      .then(r => r.json())
      .then(d => {
        if (!d.isSuperAdmin) router.replace("/");
        else setChecking(false);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  if (checking) return (
    <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Checking access…</div>
  );

  return <>{children}</>;
}
