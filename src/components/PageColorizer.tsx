"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ROUTE_TO_KEY, DEFAULT_COLORS } from "@/lib/color-defaults";

function applyColors(pathname: string) {
  const match = ROUTE_TO_KEY.find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  );
  const key = match?.[1] ?? "home";
  const c = DEFAULT_COLORS[key];
  if (c) {
    document.documentElement.style.setProperty("--page-bg", c.bg);
    document.documentElement.style.setProperty("--page-nav-color", c.nav);
  }
}

export default function PageColorizer() {
  const pathname = usePathname();

  useEffect(() => {
    applyColors(pathname);
  }, [pathname]);

  return null;
}
