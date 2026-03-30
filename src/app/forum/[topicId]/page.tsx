"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

type Author = { id: string; name: string | null; email: string };
type Post = { id: string; content: string; authorId: string; createdAt: string; author: Author };
type Topic = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  lastPostAt: string;
  author: Author;
  posts: Post[];
};

export default function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = use(params);
  const router = useRouter();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("en");

  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedContent, setTranslatedContent] = useState("");
  const [translatedPosts, setTranslatedPosts] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  const [currentUserId, setCurrentUserId] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePin, setDeletePin] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    const [rTopic, rLang] = await Promise.all([
      fetch(`/api/forum/topics/${topicId}`),
      fetch("/api/forum/language"),
    ]);

    if (rTopic.ok) {
      const data = await rTopic.json();
      setTopic(data);
    }

    const langData = await rLang.json();
    setLanguage(langData.language || "en");

    const rMe = await fetch("/api/me").catch(() => null);
    if (rMe?.ok) {
      const me = await rMe.json().catch(() => ({}));
      if (me.id) setCurrentUserId(me.id);
    }
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [topicId]);

  // Translate content when language or topic changes
  useEffect(() => {
    if (!topic || language === "en") {
      setTranslatedTitle("");
      setTranslatedContent("");
      setTranslatedPosts({});
      return;
    }
    setTranslating(true);
    const postContents = topic.posts.map((p) => p.content);
    const allTexts = [topic.title, topic.content, ...postContents];

    translateTexts(allTexts, language).then((translated) => {
      setTranslatedTitle(translated[0] || topic.title);
      setTranslatedContent(translated[1] || topic.content);
      const postMap: Record<string, string> = {};
      topic.posts.forEach((p, i) => {
        postMap[p.id] = translated[2 + i] || p.content;
      });
      setTranslatedPosts(postMap);
      setTranslating(false);
    });
  }, [language, topic]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setReplyError("");
    try {
      const r = await fetch(`/api/forum/topics/${topicId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setReplyError(data.error || "Failed to post reply.");
      } else {
        setReplyContent("");
        await loadData();
      }
    } catch {
      setReplyError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!topic) return;
    const isAuthor = topic.authorId === currentUserId;
    if (!isAuthor && !deletePin) {
      setDeleteError("PIN is required.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const r = await fetch(`/api/forum/topics/${topicId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: deletePin }),
      });
      const data = await r.json();
      if (!r.ok) {
        setDeleteError(data.error || "Failed to delete topic.");
        setDeleting(false);
      } else {
        router.push("/forum");
      }
    } catch {
      setDeleteError("Network error.");
      setDeleting(false);
    }
  }

  if (loading) return <div className="mobile-page"><div className="page-shell">Loading...</div></div>;
  if (!topic) return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="mobile-card">Topic not found. <Link href="/forum">Back to Forum</Link></div>
      </div>
    </div>
  );

  const isAuthor = topic.authorId === currentUserId;
  const displayTitle = translatedTitle || topic.title;
  const displayContent = translatedContent || topic.content;
  const authorLabel = (a: Author) => a.name || a.email;
  const fmt = (d: string) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="mobile-page">
      <div className="page-shell">
        {/* Back link */}
        <div style={{ marginBottom: 12 }}>
          <Link href="/forum" style={{ color: "var(--primary)", fontSize: "0.9rem" }}>
            ← Back to Forum
          </Link>
          {translating && (
            <span style={{ marginLeft: 12, fontSize: "0.75rem", color: "#888" }}>Translating...</span>
          )}
        </div>

        {/* Topic */}
        <div className="mobile-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "1.1rem" }}>{displayTitle}</h2>
            <button
              type="button"
              onClick={() => { setShowDeleteModal(true); setDeletePin(""); setDeleteError(""); }}
              style={{
                background: "#ffebee",
                color: "#c62828",
                border: "1px solid #ef9a9a",
                borderRadius: 8,
                padding: "4px 12px",
                fontSize: "0.8rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Delete
            </button>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 12 }}>
            by {authorLabel(topic.author)} &middot; {fmt(topic.createdAt)}
          </div>
          <div style={{ fontSize: "0.95rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {displayContent}
          </div>
        </div>

        {/* Posts / Replies */}
        {topic.posts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Replies ({topic.posts.length})
            </h3>
            {topic.posts.map((post) => (
              <div
                key={post.id}
                className="mobile-card"
                style={{ marginBottom: 10, borderLeft: "3px solid var(--border)" }}
              >
                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 8 }}>
                  {authorLabel(post.author)} &middot; {fmt(post.createdAt)}
                </div>
                <div style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {translatedPosts[post.id] || post.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        <div className="mobile-card">
          <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>Write a Reply</h3>
          <form onSubmit={handleReply}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Your reply..."
              rows={4}
              style={{ resize: "vertical" }}
            />
            {replyError && (
              <div style={{ color: "var(--error-text)", fontSize: "0.85rem", marginBottom: 10 }}>
                {replyError}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !replyContent.trim()}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: "1rem",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting || !replyContent.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? "Posting..." : "Post Reply"}
            </button>
          </form>
        </div>

        {/* Delete modal */}
        {showDeleteModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 16,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 360,
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0" }}>Delete Topic</h3>
              {isAuthor ? (
                <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: 16 }}>
                  Are you sure you want to delete this topic? All replies will be removed.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: 12 }}>
                    Enter the admin PIN to delete this topic.
                  </p>
                  <input
                    type="password"
                    value={deletePin}
                    onChange={(e) => setDeletePin(e.target.value)}
                    placeholder="PIN..."
                    style={{ marginBottom: 8 }}
                  />
                </>
              )}
              {deleteError && (
                <div style={{ color: "var(--error-text)", fontSize: "0.85rem", marginBottom: 10 }}>
                  {deleteError}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#c62828",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    cursor: deleting ? "not-allowed" : "pointer",
                    opacity: deleting ? 0.7 : 1,
                  }}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#f0f0f0",
                    color: "#444",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
