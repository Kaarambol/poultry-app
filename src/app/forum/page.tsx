"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pt", label: "Português" },
  { code: "ro", label: "Română" },
  { code: "cs", label: "Čeština" },
  { code: "sk", label: "Slovenčina" },
  { code: "hu", label: "Magyar" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
];

type Topic = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  lastPostAt: string;
  author: { id: string; name: string | null; email: string };
  _count: { posts: number };
};

function getExpiryInfo(lastPostAt: string) {
  const last = new Date(lastPostAt).getTime();
  const expiryTs = last + SIX_MONTHS_MS;
  const now = Date.now();
  const msLeft = expiryTs - now;
  return {
    isExpiringSoon: msLeft > 0 && msLeft <= TWO_WEEKS_MS,
    daysLeft: Math.ceil(msLeft / (24 * 60 * 60 * 1000)),
  };
}

async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === "en") return texts;
  try {
    const r = await fetch("/api/forum/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, targetLang }),
    });
    const data = await r.json();
    return Array.isArray(data.translations) ? data.translations : texts;
  } catch {
    return texts;
  }
}

export default function ForumPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("en");
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  async function loadTopics() {
    const r = await fetch("/api/forum/topics");
    const data = await r.json();
    if (Array.isArray(data)) setTopics(data);
  }

  async function loadLanguage() {
    const r = await fetch("/api/forum/language");
    const data = await r.json();
    setLanguage(data.language || "en");
  }

  useEffect(() => {
    Promise.all([loadTopics(), loadLanguage()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (language === "en" || topics.length === 0) {
      setTranslatedTitles({});
      return;
    }
    setTranslating(true);
    const titles = topics.map((t) => t.title);
    translateTexts(titles, language).then((translated) => {
      const map: Record<string, string> = {};
      topics.forEach((t, i) => {
        map[t.id] = translated[i] || t.title;
      });
      setTranslatedTitles(map);
      setTranslating(false);
    });
  }, [language, topics]);

  async function handleLanguageChange(lang: string) {
    setLanguage(lang);
    await fetch("/api/forum/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
  }

  if (loading) return <div className="mobile-page"><div className="page-shell">Loading Forum...</div></div>;

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <h1 className="page-intro__title">Forum</h1>
            <p className="page-intro__subtitle">Community discussion board.</p>
          </div>
        </div>

        {/* Language selector */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: "0.85rem", color: "#666", whiteSpace: "nowrap" }}>
              My language:
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{ margin: 0, minHeight: 36, padding: "6px 10px" }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {translating && (
              <span style={{ fontSize: "0.75rem", color: "#888" }}>Translating...</span>
            )}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#999" }}>
            Titles will be translated to your selected language. Only you see this setting.
          </p>
        </div>

        {/* New topic button */}
        <div style={{ marginBottom: 16 }}>
          <Link href="/forum/new">
            <button
              type="button"
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + New Topic
            </button>
          </Link>
        </div>

        {/* Topics list */}
        {topics.length === 0 ? (
          <div className="mobile-card" style={{ textAlign: "center", color: "#666" }}>
            No topics yet. Be the first to start a discussion!
          </div>
        ) : (
          topics.map((topic) => {
            const { isExpiringSoon, daysLeft } = getExpiryInfo(topic.lastPostAt);
            const displayTitle = translatedTitles[topic.id] || topic.title;
            return (
              <Link key={topic.id} href={`/forum/${topic.id}`} style={{ textDecoration: "none" }}>
                <div
                  className="mobile-card"
                  style={{
                    marginBottom: 12,
                    cursor: "pointer",
                    background: isExpiringSoon ? "#fffde7" : undefined,
                    border: isExpiringSoon ? "1px solid #ffe082" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text)" }}>
                      {displayTitle}
                    </h3>
                    {isExpiringSoon && (
                      <span
                        style={{
                          background: "#fff8e1",
                          border: "1px solid #ffca28",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: "0.7rem",
                          color: "#7a5d00",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        Expires in {daysLeft}d
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#888" }}>
                    by {topic.author.name || topic.author.email} &middot;{" "}
                    {new Date(topic.createdAt).toLocaleDateString("en-GB")} &middot;{" "}
                    {topic._count.posts} {topic._count.posts === 1 ? "reply" : "replies"}
                  </div>
                  {isExpiringSoon && (
                    <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#e65100" }}>
                      No activity for a long time — expires in {daysLeft} days.
                    </div>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
