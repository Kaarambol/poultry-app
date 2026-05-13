"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Author = { id: string; name: string | null; email: string };
type Post = { id: string; content: string; author: Author; createdAt: string };
type Topic = {
  id: string; title: string; content: string;
  author: Author; createdAt: string; lastPostAt: string;
  _count: { posts: number };
  posts: Post[];
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SuperAdminForumPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/forum/topics")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setTopics(d);
        else setError(d.error || "Błąd ładowania.");
      })
      .catch(() => setError("Błąd połączenia."))
      .finally(() => setLoading(false));
  }, []);

  async function deleteTopic(topicId: string, title: string) {
    if (!confirm(`Usunąć temat "${title}" wraz ze wszystkimi wiadomościami?`)) return;
    setDeleting(topicId);
    try {
      const r = await fetch(`/api/superadmin/forum/topics/${topicId}`, { method: "DELETE" });
      if (r.ok) setTopics(prev => prev.filter(t => t.id !== topicId));
      else { const d = await r.json(); alert(d.error || "Błąd."); }
    } catch { alert("Błąd połączenia."); }
    finally { setDeleting(null); }
  }

  async function deletePost(postId: string, topicId: string) {
    if (!confirm("Usunąć tę wiadomość?")) return;
    setDeleting(postId);
    try {
      const r = await fetch(`/api/superadmin/forum/posts/${postId}`, { method: "DELETE" });
      if (r.ok) {
        setTopics(prev => prev.map(t =>
          t.id === topicId
            ? { ...t, posts: t.posts.filter(p => p.id !== postId), _count: { posts: t._count.posts - 1 } }
            : t
        ));
      } else { const d = await r.json(); alert(d.error || "Błąd."); }
    } catch { alert("Błąd połączenia."); }
    finally { setDeleting(null); }
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <div className="page-intro__eyebrow">SuperAdmin</div>
            <h1 className="page-intro__title">Moderacja Forum</h1>
            <p className="page-intro__subtitle">
              Usuń tematy lub pojedyncze wiadomości.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Link href="/superadmin/users" className="mobile-button mobile-button--secondary" style={{ display: "inline-flex" }}>
                ← Użytkownicy
              </Link>
            </div>
          </div>
        </div>

        {loading && <div className="mobile-card" style={{ color: "#64748b" }}>Ładowanie…</div>}
        {error && <div className="mobile-alert mobile-alert--error">{error}</div>}

        {!loading && !error && topics.length === 0 && (
          <div className="mobile-card" style={{ color: "#64748b", textAlign: "center" }}>Brak tematów.</div>
        )}

        {topics.map(topic => (
          <div key={topic.id} className="mobile-card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {/* Topic header */}
            <div style={{ padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b" }}>{topic.title}</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                  {topic.author.name || topic.author.email} · {fmtDate(topic.createdAt)} · {topic._count.posts} odp.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === topic.id ? null : topic.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: "0.72rem",
                    border: "1px solid #dbe3ee", background: "#fff", color: "#475569", cursor: "pointer",
                  }}
                >
                  {expanded === topic.id ? "Zwiń" : "Rozwiń"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteTopic(topic.id, topic.title)}
                  disabled={deleting === topic.id}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: "0.72rem",
                    border: "1px solid #fca5a5", background: "#fef2f2",
                    color: "#b91c1c", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {deleting === topic.id ? "…" : "Usuń temat"}
                </button>
              </div>
            </div>

            {/* Topic content */}
            {expanded === topic.id && (
              <div>
                <div style={{ padding: "10px 14px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", fontSize: "0.82rem", color: "#78350f" }}>
                  <strong>Treść:</strong> {topic.content}
                </div>
                {topic.posts.map(post => (
                  <div key={post.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f0f4f8", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 3 }}>
                        <strong>{post.author.name || post.author.email}</strong> · {fmtDate(post.createdAt)}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#1e293b" }}>{post.content}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePost(post.id, topic.id)}
                      disabled={deleting === post.id}
                      style={{
                        padding: "3px 8px", borderRadius: 5, fontSize: "0.68rem",
                        border: "1px solid #fca5a5", background: "#fef2f2",
                        color: "#b91c1c", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      {deleting === post.id ? "…" : "Usuń"}
                    </button>
                  </div>
                ))}
                {topic.posts.length === 0 && (
                  <div style={{ padding: "10px 14px", color: "#94a3b8", fontSize: "0.78rem" }}>Brak odpowiedzi.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
