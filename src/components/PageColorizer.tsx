"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ROUTE_TO_KEY, DEFAULT_COLORS, mergeWithDefaults } from "@/lib/color-defaults";

function applyColors(colors: Record<string, { bg: string; nav: string }>, pathname: string) {
  const match = ROUTE_TO_KEY.find(
    ([path, _key]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  );
  const key = match?.[1] ?? "home";
  const c = colors[key] ?? DEFAULT_COLORS[key];
  if (c) {
    document.documentElement.style.setProperty("--page-bg", c.bg);
    document.documentElement.style.setProperty("--page-nav-color", c.nav);
  }
}

let cachedColors: Record<string, { bg: string; nav: string }> | null = null;

export default function PageColorizer() {
  const pathname = usePathname();

  useEffect(() => {
    // Apply cached immediately to avoid flash
    if (cachedColors) {
      applyColors(cachedColors, pathname);
      return;
    }
    // Try localStorage cache first
    try {
      const stored = localStorage.getItem("userColors");
      if (stored) {
        cachedColors = JSON.parse(stored);
        applyColors(cachedColors!, pathname);
      }
    } catch {}

    // Fetch from API and update
    fetch("/api/settings/colors")
      .then(r => r.json())
      .then(data => {
        cachedColors = data;
        localStorage.setItem("userColors", JSON.stringify(data));
        applyColors(data, pathname);
      })
      .catch(() => {
        const defaults = mergeWithDefaults({});
        applyColors(defaults, pathname);
      });
  }, []);

  useEffect(() => {
    if (cachedColors) applyColors(cachedColors, pathname);
    else {
      try {
        const stored = localStorage.getItem("userColors");
        if (stored) applyColors(JSON.parse(stored), pathname);
      } catch {}
    }
  }, [pathname]);

  return null;
}
