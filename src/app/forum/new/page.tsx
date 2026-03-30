"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTopicPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Failed to create topic.");
      } else {
        router.push(`/forum/${data.id}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mobile-page">
      <div className="page-shell">
        <div className="page-intro">
          <div className="page-intro__meta-card">
            <h1 className="page-intro__title">New Topic</h1>
            <p className="page-intro__subtitle">Start a new discussion.</p>
          </div>
        </div>

        <div className="mobile-card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Topic title..."
                maxLength={200}
              />
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your message..."
                rows={6}
                style={{ resize: "vertical" }}
              />
            </div>

            {error && (
              <div
                style={{
                  background: "var(--error-bg)",
                  border: "1px solid var(--error-border)",
                  color: "var(--error-text)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 12,
                  fontSize: "0.9rem",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Posting..." : "Post Topic"}
              </button>
              <Link href="/forum">
                <button
                  type="button"
                  style={{
                    padding: "12px 20px",
                    background: "#f0f0f0",
                    color: "#444",
                    border: "none",
                    borderRadius: 12,
                    fontSize: "1rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
