#!/usr/bin/env node
"use strict";

/**
 * scripts/scheduled-daily.js
 *
 * Run by Windows Task Scheduler daily at 6:00 AM.
 * Performs an incremental import of liked X tweets (up to 50 new ones)
 * then runs the full pipeline: extract → classify → courses → summarize → graph.
 *
 * Always starts from the most recently liked tweets (the X likes page is
 * ordered newest-first). The seen-tweets.json index ensures already-imported
 * tweets are never re-processed.
 *
 * Log output is written to: data/runs/scheduled-YYYY-MM-DD.log
 */

require("dotenv").config({ quiet: true });

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT     = process.cwd();
const RUNS_DIR = path.join(ROOT, "data", "runs");

// ── Lazy DB pool (optional — skipped if DATABASE_URL not set) ─────────────────
let _dbPool = null;
function getDbPool() {
  if (_dbPool) return _dbPool;
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  try {
    const { Pool } = require("pg");
    _dbPool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 20_000 });
    _dbPool.on("error", () => { _dbPool = null; });
    return _dbPool;
  } catch { return null; }
}

// Ensure runs dir exists
fs.mkdirSync(RUNS_DIR, { recursive: true });

// IST timestamp helper (UTC+5:30)
function istNow() {
  return new Date().toLocaleString("en-IN", {
    timeZone:  "Asia/Kolkata",
    hour12:    false,
    year:      "numeric", month:  "2-digit", day:    "2-digit",
    hour:      "2-digit", minute: "2-digit", second: "2-digit",
  }) + " IST";
}

const TODAY    = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD in IST
const LOG_PATH = path.join(RUNS_DIR, `scheduled-${TODAY}.log`);

// Append to today's log (safe for multiple runs per day)
function log(msg) {
  const line = `[${istNow()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_PATH, line + "\n", "utf8");
}

// Run manifest — written to JSON at end of run for the /runs page
const runManifest = {
  trigger:         "scheduled",
  date:            TODAY,
  started_at_ist:  null,
  finished_at_ist: null,
  duration_secs:   null,
  status:          "running",
  steps:           [],
};
let runStartMs = 0;

function saveManifest(status) {
  runManifest.status          = status;
  runManifest.finished_at_ist = istNow();
  runManifest.duration_secs   = parseFloat(((Date.now() - runStartMs) / 1000).toFixed(1));
  const manifestPath = path.join(RUNS_DIR, `scheduled-${TODAY}-manifest.json`);
  try { fs.writeFileSync(manifestPath, JSON.stringify(runManifest, null, 2), "utf8"); } catch { /* ignore */ }

  // Also persist to PostgreSQL (fire-and-forget — never blocks the run)
  const pool = getDbPool();
  if (pool) {
    pool.query(
      `INSERT INTO pipeline_runs (run_id, trigger, run_date, duration_secs, status, steps)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id) DO UPDATE SET
         finished_at   = NOW(),
         duration_secs = EXCLUDED.duration_secs,
         status        = EXCLUDED.status,
         steps         = EXCLUDED.steps`,
      [
        `scheduled-${TODAY}`,
        "scheduled",
        TODAY,
        runManifest.duration_secs,
        status,
        JSON.stringify(runManifest.steps),
      ]
    ).catch(() => {}); // fire and forget
  }
}

function run(label, cmd) {
  log(`START: ${label}`);
  log(`CMD:   ${cmd}`);
  const startMs = Date.now();
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT });
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    log(`DONE:  ${label} in ${elapsed}s`);
    runManifest.steps.push({ name: label, status: "ok", duration_secs: parseFloat(elapsed) });
    return true;
  } catch (err) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    log(`ERROR: ${label} failed after ${elapsed}s — ${err.message}`);
    runManifest.steps.push({ name: label, status: "failed", duration_secs: parseFloat(elapsed), error: err.message.slice(0, 200) });
    return false;
  }
}

async function main() {
  runStartMs              = Date.now();
  runManifest.started_at_ist = istNow();

  log("====================================================");
  log(`KnowledgeBase Daily Scheduled Import — ${TODAY}`);
  log("====================================================");

  // Each step is a hard gate — first failure stops the whole run.
  // The pipeline is idempotent: next scheduled run picks up where this left off.
  const likeLimit = process.env.SCHEDULE_LIKES_LIMIT || "25";

  if (!run("Import X Likes",  `node scripts/import-x-likes.js --limit ${likeLimit}`)) {
    log("ABORT: Import failed — check X cookies/auth. Stopping pipeline.");
    saveManifest("aborted"); return;
  }
  if (!run("Extract Sources", "node scripts/import-x-source.js")) {
    log("ABORT: Extraction failed. Stopping pipeline.");
    saveManifest("aborted"); return;
  }
  if (!run("Classify Topics", "node scripts/classify-source.js")) {
    log("ABORT: Classification failed — OpenRouter API issue? Check OPENROUTER_API_KEY.");
    log("       Next scheduled run will retry all pending tweets automatically.");
    saveManifest("aborted"); return;
  }
  if (!run("Compile Courses", "node scripts/compile-course.js")) {
    log("ABORT: Course compilation failed. Stopping pipeline.");
    saveManifest("aborted"); return;
  }
  if (!run("Summarize Topics", "node scripts/update-topic-summary.js")) {
    log("ABORT: Topic summarization failed. Stopping pipeline.");
    saveManifest("aborted"); return;
  }
  if (!run("Build Graph", "node scripts/build-graph.js")) {
    log("ABORT: Graph build failed. Stopping pipeline.");
    saveManifest("aborted"); return;
  }

  log("====================================================");
  log("Daily scheduled run complete. All steps succeeded.");
  log("====================================================");
  saveManifest("ok");
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
