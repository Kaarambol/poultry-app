export type PageColors = { bg: string; nav: string };

export const DEFAULT_COLORS: Record<string, PageColors> = {
  "home":                 { bg: "#dbeafe", nav: "#3b82f6" },
  "dashboard":            { bg: "#dbeafe", nav: "#3b82f6" },
  "daily":                { bg: "#fef9c3", nav: "#eab308" },
  "feed":                 { bg: "#fef9c3", nav: "#eab308" },
  "night-check":          { bg: "#0f172a", nav: "#1e293b" },
  "total":                { bg: "#dcfce7", nav: "#16a34a" },
  "check-flock":          { bg: "#f7fee7", nav: "#ecfccb" },
  "audit-farm-documents": { bg: "#fee2e2", nav: "#ef4444" },
  "medication":           { bg: "#f0fdfa", nav: "#ccfbf1" },
  "history":              { bg: "#f5f3ff", nav: "#ede9fe" },
  "avara":                { bg: "#fff7ed", nav: "#ffedd5" },
  "forum":                { bg: "#eff6ff", nav: "#dbeafe" },
  "crops":                { bg: "#faf5ff", nav: "#f3e8ff" },
  "farms":                { bg: "#f0fdf4", nav: "#dcfce7" },
  "thin-check":           { bg: "#fdf4ff", nav: "#fae8ff" },
  "houses":               { bg: "#fffbeb", nav: "#fef3c7" },
};

// Route path → page key
export const ROUTE_TO_KEY: [string, string][] = [
  ["/dashboard",            "dashboard"],
  ["/daily",                "daily"],
  ["/feed",                 "feed"],
  ["/night-check",          "night-check"],
  ["/total",                "total"],
  ["/check-flock",          "check-flock"],
  ["/audit-farm-documents", "audit-farm-documents"],
  ["/medication",           "medication"],
  ["/history",              "history"],
  ["/avara",                "avara"],
  ["/forum",                "forum"],
  ["/crops",                "crops"],
  ["/farms",                "farms"],
  ["/thin-clear",           "thin-check"],
  ["/houses",               "houses"],
  ["/",                     "home"],
];

export function isDark(hex: string): boolean {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  } catch {
    return false;
  }
}
