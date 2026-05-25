"use client";
import { useState } from "react";
import Link from "next/link";

export interface TopicCardData {
  slug: string;
  label: string;
  courseCount: number;
  totalReadMin: number;
  hasSummary: boolean;
}

export default function TopicGrid({ topics }: { topics: TopicCardData[] }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? topics.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
    : topics;

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="search"
          placeholder="Filter topics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "var(--surface)",
            color: "inherit",
            fontSize: "0.9rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {filtered.length === 0 && query && (
        <p style={{ color: "var(--muted)", padding: "20px 0" }}>
          No topics match &ldquo;{query}&rdquo;
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
        {filtered.map((t) => (
          <Link key={t.slug} href={`/courseware/${t.slug}`} style={{ textDecoration: "none" }}>
            <div
              className="kb-source-panel"
              style={{ padding: "18px 20px", cursor: "pointer", height: "100%", boxSizing: "border-box" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "var(--fg)", lineHeight: 1.3 }}>{t.label}</h3>
                {t.hasSummary && (
                  <span className="kb-badge classified" style={{ flexShrink: 0, marginTop: "2px" }}>wiki</span>
                )}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 10px" }}>
                {t.courseCount} course{t.courseCount !== 1 ? "s" : ""}&ensp;&middot;&ensp;~{t.totalReadMin} min total
              </p>
              <span style={{ fontSize: "0.78rem", color: "var(--brand)", fontWeight: 600 }}>
                View Topic &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
