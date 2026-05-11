"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Per-page background tint — muted pastels
const PAGE_TINTS: [string, string][] = [
  ["/dashboard",            "#fefce8"], // warm yellow
  ["/daily",                "#f0f9ff"], // sky blue
  ["/feed",                 "#f0fdf4"], // soft green
  ["/night-check",          "#eef2ff"], // light indigo
  ["/total",                "#ecfeff"], // pale cyan
  ["/check-flock",          "#f7fee7"], // lime
  ["/audit-farm-documents", "#fff1f2"], // soft rose
  ["/medication",           "#f0fdfa"], // teal
  ["/history",              "#f5f3ff"], // lavender
  ["/avara",                "#fff7ed"], // warm orange
  ["/forum",                "#eff6ff"], // periwinkle
  ["/crops",                "#faf5ff"], // violet
  ["/farms",                "#f0fdf4"], // green
  ["/thin-clear",           "#fdf4ff"], // pink
  ["/houses",               "#fffbeb"], // amber
  ["/manage",               "#f8fafc"], // neutral
  ["/",                     "#fffef5"], // cream (home)
];

export default function PageColorizer() {
  const pathname = usePathname();

  useEffect(() => {
    const match = PAGE_TINTS.find(
      ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
    );
    const tint = match?.[1] ?? "#f6f8fb";
    document.documentElement.style.setProperty("--page-bg", tint);
  }, [pathname]);

  return null;
}
