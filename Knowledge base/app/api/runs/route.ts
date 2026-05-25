import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { tryQuery } from "../../lib/db";

const ROOT      = process.cwd();
const RUNS_DIR  = path.join(ROOT, "data", "runs");
const TASKS_DIR = path.join(ROOT, "data", "tasks");

export const dynamic = "force-dynamic";

export async function GET() {
  const runs: RunEntry[] = [];

  // ── 1. Scheduled runs — try PostgreSQL first ──────────────────────────────
  const dbRuns = await tryQuery<{
    run_id: string; trigger: string; run_date: string;
    started_at: string | null; finished_at: string | null;
    duration_secs: string | null; status: string; steps: RunStep[];
  }>(
    `SELECT run_id, trigger, run_date::text, started_at, finished_at,
            duration_secs, status, steps
     FROM pipeline_runs
     ORDER BY run_date DESC, created_at DESC
     LIMIT 100`
  );

  if (dbRuns !== null) {
    for (const r of dbRuns) {
      runs.push({
        id:           r.run_id,
        trigger:      r.trigger as "scheduled" | "admin-adhoc",
        date:         r.run_date?.slice(0, 10) || "",
        startedAt:    r.started_at || r.run_date || "",
        finishedAt:   r.finished_at ?? null,
        durationSecs: r.duration_secs ? Number(r.duration_secs) : null,
        status:       r.status as RunEntry["status"],
        steps:        Array.isArray(r.steps) ? r.steps : [],
      });
    }
  } else {
    // ── Fall back: read manifest JSON files ────────────────────────────────
    if (fs.existsSync(RUNS_DIR)) {
      const manifests = fs.readdirSync(RUNS_DIR)
        .filter((f) => /^scheduled-\d{4}-\d{2}-\d{2}-manifest\.json$/.test(f))
        .sort().reverse().slice(0, 60);

      for (const file of manifests) {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, file), "utf8"));
          runs.push({
            id:           file.replace("-manifest.json", ""),
            trigger:      "scheduled",
            date:         m.date || "",
            startedAt:    m.started_at_ist || "",
            finishedAt:   m.finished_at_ist ?? null,
            durationSecs: m.duration_secs ?? null,
            status:       m.status || "unknown",
            steps:        m.steps || [],
          });
        } catch { /* skip malformed */ }
      }
    }
  }

  // ── 2. Admin adhoc runs — always read task log files ─────────────────────
  if (fs.existsSync(TASKS_DIR)) {
    const taskLogs = fs.readdirSync(TASKS_DIR)
      .filter((f) => f.endsWith(".log"))
      .sort().reverse().slice(0, 50);

    for (const file of taskLogs) {
      try {
        const content = fs.readFileSync(path.join(TASKS_DIR, file), "utf8");
        const stepMatch    = content.match(/step=(\S+)/);
        const startedMatch = content.match(/started=(\S+)/);
        const step      = stepMatch?.[1]    || "unknown";
        const startedAt = startedMatch?.[1] || "";
        const failed    = /exit code 1|ERROR:/.test(content);
        runs.push({
          id:           file.replace(".log", ""),
          trigger:      "admin-adhoc",
          date:         startedAt.slice(0, 10),
          startedAt,
          finishedAt:   null,
          durationSecs: null,
          status:       failed ? "failed" : "ok",
          steps:        [{ name: step, status: failed ? "failed" : "ok", duration_secs: null }],
        });
      } catch { /* skip */ }
    }
  }

  // Sort newest first
  runs.sort((a, b) => (b.startedAt || b.date || "").localeCompare(a.startedAt || a.date || ""));

  return NextResponse.json({ runs });
}

interface RunStep {
  name:          string;
  status:        "ok" | "failed" | "aborted";
  duration_secs: number | null;
  error?:        string;
}

interface RunEntry {
  id:           string;
  trigger:      "scheduled" | "admin-adhoc";
  date:         string;
  startedAt:    string;
  finishedAt:   string | null;
  durationSecs: number | null;
  status:       "ok" | "failed" | "aborted" | "running" | "unknown";
  steps:        RunStep[];
}
