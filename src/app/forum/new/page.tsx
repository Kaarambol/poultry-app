"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTopicPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [myName, setMyName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        if (d.name) setMyName(d.name);
        if (d.email) setMyEmail(d.email);
        setNameInput(d.name || "");
      })
      .finally(() => setLoadingMe(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = nameInput.trim();
    if (!trimmedName) { setError("Enter your first name before posting."); return; }
    if (!title.trim() || !content.trim()) { setError("Title and content are required."); return; }

    setSaving(true);
    setError("");
    try {
      // Save name if changed
      if (trimmedName !== myName) {
        const rName = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmedName }),
        });
        if (!rName.ok) { setError("Failed to save name."); setSaving(false); return; }
        setMyName(trimmedName);
      }

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

  if (loadingMe) return <div className="mobile-page"><div className="page-shell">Loading...</div></div>;

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
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Your name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Enter your first name..."
                maxLength={60}
              />
              {myEmail && (
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2 }}>
                  Will appear as: <strong>{nameInput.trim() || "…"} ({myEmail})</strong>
                </div>
              )}
            </div>

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
              <div className="mobile-alert mobile-alert--error" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1, padding: "12px",
                  background: "var(--primary)", color: "#fff",
                  border: "none", borderRadius: 12,
                  fontSize: "1rem", fontWeight: 600,
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
                    padding: "12px 20px", background: "#f0f0f0", color: "#444",
                    border: "none", borderRadius: 12, fontSize: "1rem", cursor: "pointer",
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
