"use client";

import { useEffect, useState } from "react";

interface LearnStats {
  dbConnected: boolean;
  totalCoursesStarted: number;
  totalCoursesCompleted: number;
  totalMinutesLearned: number;
  currentStreakDays: number;
  longestStreakDays: number;
  todayMinutes: number;
  recentDays: { date: string; minutes: number }[];
}

export default function LearningPanel() {
  const [stats, setStats] = useState<LearnStats | null>(null);

  useEffect(() => {
    fetch("/api/learn/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div>
        <p className="kb-widget-title">Learning Tracker</p>
        <div className="kb-widget">
          <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!stats.dbConnected) {
    return (
      <div>
        <p className="kb-widget-title">Learning Tracker</p>
        <div className="kb-widget">
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: "1.4" }}>
            PostgreSQL not connected.<br />
            Set <code style={{ fontSize: "0.7rem" }}>DATABASE_URL</code> in .env and run <code style={{ fontSize: "0.7rem" }}>npm run db:setup</code>.
          </p>
        </div>
      </div>
    );
  }

  const streakDisplay = stats.currentStreakDays > 0
    ? `${stats.currentStreakDays} day streak`
    : "Start today";

  return (
    <div>
      <p className="kb-widget-title">Learning Tracker</p>

      {/* Streak + today */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "10px 12px",
        marginBottom: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "2px" }}>
          <span style={{ fontSize: "1.3rem" }}>🔥</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{streakDisplay}</span>
        </div>
        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
          Best: {stats.longestStreakDays}d &middot; Today: {stats.todayMinutes} min
        </p>
      </div>

      <div className="kb-widget">
        <div className="vault-row">
          <span>Completed</span>
          <strong>{stats.totalCoursesCompleted} courses</strong>
        </div>
        <div className="vault-row">
          <span>In Progress</span>
          <strong>{stats.totalCoursesStarted} courses</strong>
        </div>
        <div className="vault-row">
          <span>Total Time</span>
          <strong>
            {stats.totalMinutesLearned >= 60
              ? `${Math.floor(stats.totalMinutesLearned / 60)}h ${stats.totalMinutesLearned % 60}m`
              : `${stats.totalMinutesLearned} min`}
          </strong>
        </div>
      </div>

      {/* Mini activity bar chart (last 7 days) */}
      {stats.recentDays.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--muted)", margin: "0 0 4px" }}>Last 7 days</p>
          <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: "32px" }}>
            {[...stats.recentDays].reverse().slice(0, 7).map((d) => {
              const maxMin = Math.max(...stats.recentDays.map((x) => x.minutes), 1);
              const heightPct = Math.max(((d.minutes / maxMin) * 100), d.minutes > 0 ? 15 : 5);
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.minutes} min`}
                  style={{
                    flex: 1,
                    height: `${heightPct}%`,
                    background: d.minutes > 0 ? "var(--brand)" : "var(--border)",
                    borderRadius: "2px",
                    transition: "height 0.3s",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
