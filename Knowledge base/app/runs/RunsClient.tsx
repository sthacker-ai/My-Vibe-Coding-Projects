"use client";

import { useState } from "react";

interface RunStep {
  name:          string;
  status:        string;
  duration_secs: number | null;
  error?:        string;
}

interface Run {
  id:           string;
  trigger:      string;
  date:         string;
  startedAt:    string;
  finishedAt:   string | null;
  durationSecs: number | null;
  status:       string;
  steps:        RunStep[];
}

const STEP_ORDER = ["Import X Likes", "Extract Sources", "Classify Topics", "Compile Courses", "Summarize Topics", "Build Graph"];

function fmtDuration(secs: number | null) {
  if (!secs) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    ok:      { bg: "#dcfce7", color: "#15803d", label: "OK" },
    failed:  { bg: "#fee2e2", color: "#dc2626", label: "Failed" },
    aborted: { bg: "#fef3c7", color: "#b45309", label: "Aborted" },
    running: { bg: "#dbeafe", color: "#1d4ed8", label: "Running" },
    unknown: { bg: "#f3f4f6", color: "#6b7280", label: "?" },
  };
  const c = cfg[status] || cfg.unknown;
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: "4px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

function StepChip({ step }: { step: RunStep }) {
  const ok      = step.status === "ok";
  const failed  = step.status === "failed";
  const bg      = ok ? "#dcfce7" : failed ? "#fee2e2" : "#f3f4f6";
  const color   = ok ? "#15803d" : failed ? "#dc2626" : "#6b7280";
  const prefix  = ok ? "✓" : failed ? "✗" : "—";
  const short   = step.name.split(" ")[0]; // "Import", "Extract", etc.
  return (
    <span
      title={step.error ? `${step.name}: ${step.error}` : step.name}
      style={{ background: bg, color, borderRadius: "4px", padding: "2px 6px", fontSize: "0.72rem", fontWeight: 600, marginRight: "3px", whiteSpace: "nowrap" }}
    >
      {prefix} {short}
    </span>
  );
}

export default function RunsClient({ initialRuns }: { initialRuns: Run[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (initialRuns.length === 0) {
    return (
      <p style={{ color: "var(--muted)", padding: "16px 0", fontSize: "0.88rem" }}>
        No run history yet. Runs will appear here after the scheduled pipeline or admin-triggered runs execute.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--muted)", textAlign: "left" }}>
            <th style={{ padding: "8px 12px", fontWeight: 600 }}>Date / Time</th>
            <th style={{ padding: "8px 12px", fontWeight: 600 }}>Trigger</th>
            <th style={{ padding: "8px 12px", fontWeight: 600 }}>Status</th>
            <th style={{ padding: "8px 12px", fontWeight: 600 }}>Duration</th>
            <th style={{ padding: "8px 12px", fontWeight: 600 }}>Steps</th>
            <th style={{ padding: "8px 12px" }}></th>
          </tr>
        </thead>
        <tbody>
          {initialRuns.map((run) => (
            <>
              <tr
                key={run.id}
                style={{ borderBottom: "1px solid var(--border, #f3f4f6)", cursor: "pointer" }}
                onClick={() => toggle(run.id)}
              >
                <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>
                  {run.startedAt || run.date}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {run.trigger === "scheduled" ? "🕐 Scheduled" : "⚡ Ad-hoc"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}><StatusBadge status={run.status} /></td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>
                  {fmtDuration(run.durationSecs)}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {run.steps.map((s) => <StepChip key={s.name} step={s} />)}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted)", fontSize: "0.75rem" }}>
                  {expanded.has(run.id) ? "▲" : "▼"}
                </td>
              </tr>
              {expanded.has(run.id) && (
                <tr key={`${run.id}-detail`} style={{ background: "var(--surface2, #f9fafb)" }}>
                  <td colSpan={6} style={{ padding: "12px 16px" }}>
                    <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                          <th style={{ padding: "4px 10px", fontWeight: 600 }}>Step</th>
                          <th style={{ padding: "4px 10px", fontWeight: 600 }}>Status</th>
                          <th style={{ padding: "4px 10px", fontWeight: 600 }}>Duration</th>
                          <th style={{ padding: "4px 10px", fontWeight: 600 }}>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STEP_ORDER.map((name) => {
                          const step = run.steps.find((s) => s.name === name);
                          if (!step) {
                            return (
                              <tr key={name}>
                                <td style={{ padding: "4px 10px", color: "var(--muted)" }}>{name}</td>
                                <td style={{ padding: "4px 10px" }}><StatusBadge status="unknown" /></td>
                                <td style={{ padding: "4px 10px", color: "var(--muted)" }}>—</td>
                                <td style={{ padding: "4px 10px" }}></td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={name} style={{ borderTop: "1px solid var(--border, #f3f4f6)" }}>
                              <td style={{ padding: "4px 10px" }}>{name}</td>
                              <td style={{ padding: "4px 10px" }}><StatusBadge status={step.status} /></td>
                              <td style={{ padding: "4px 10px", fontFamily: "ui-monospace, monospace", color: "var(--muted)" }}>
                                {fmtDuration(step.duration_secs)}
                              </td>
                              <td style={{ padding: "4px 10px", color: "#dc2626", fontSize: "0.75rem" }}>
                                {step.error || ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
