#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");
const fs   = require("fs");

require("dotenv").config({ quiet: true });

const ROOT     = process.cwd();
const RUNS_DIR = path.join(ROOT, "data", "runs");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const CLI_LIMIT = argValue("--limit");
const CLI_FROM  = argValue("--from");  // start from a specific step: extract|classify|course|summary|graph

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  {
    id:     "extract",
    label:  "Source extraction",
    cmd:    CLI_LIMIT ? `node scripts/import-x-source.js --limit ${CLI_LIMIT}` : "node scripts/import-x-source.js",
  },
  {
    id:     "classify",
    label:  "AI classification",
    cmd:    CLI_LIMIT ? `node scripts/classify-source.js --limit ${CLI_LIMIT}` : "node scripts/classify-source.js",
  },
  {
    id:     "course",
    label:  "Course generation",
    cmd:    CLI_LIMIT ? `node scripts/compile-course.js --limit ${CLI_LIMIT}` : "node scripts/compile-course.js",
  },
  {
    id:     "summary",
    label:  "Topic summaries",
    cmd:    "node scripts/update-topic-summary.js",
  },
  {
    id:     "graph",
    label:  "Graph build",
    cmd:    "node scripts/build-graph.js",
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function banner(msg) {
  const line = "-".repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${msg}`);
  console.log(`${line}`);
}

function runStep(step) {
  banner(`[pipeline] Step: ${step.label}`);
  console.log(`[pipeline] cmd: ${step.cmd}\n`);

  const startedAt = Date.now();
  try {
    execSync(step.cmd, { stdio: "inherit", cwd: ROOT });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n[pipeline] Step "${step.label}" completed in ${elapsed}s`);
    return { status: "ok", elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.error(`\n[pipeline] Step "${step.label}" FAILED after ${elapsed}s`);
    return { status: "error", elapsed, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  let steps = STEPS;

  // Filter to start from a particular step
  if (CLI_FROM) {
    const fromIndex = steps.findIndex((s) => s.id === CLI_FROM);
    if (fromIndex === -1) {
      console.error(`[pipeline] Unknown step: ${CLI_FROM}. Valid: ${steps.map((s) => s.id).join(", ")}`);
      process.exit(1);
    }
    steps = steps.slice(fromIndex);
    console.log(`[pipeline] Starting from step: ${CLI_FROM}`);
  }

  console.log(`\n[pipeline] Starting pipeline: ${steps.map((s) => s.id).join(" -> ")}`);
  if (CLI_LIMIT) console.log(`[pipeline] Limit: ${CLI_LIMIT} per step`);

  const runLog = {
    started_at: new Date().toISOString(),
    limit: CLI_LIMIT || null,
    from:  CLI_FROM  || null,
    steps: [],
  };

  for (const step of steps) {
    const result = runStep(step);
    runLog.steps.push({ id: step.id, label: step.label, ...result });
    if (result.status === "error") {
      console.error(`[pipeline] Aborting pipeline at step "${step.label}" due to error.`);
      break;
    }
  }

  runLog.finished_at = new Date().toISOString();
  runLog.total  = runLog.steps.length;
  runLog.errors = runLog.steps.filter((s) => s.status === "error").length;

  const ts      = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-pipeline.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), "utf8");

  const allOk = runLog.errors === 0;
  const doneMsg = allOk
    ? `[pipeline] All ${runLog.total} steps completed successfully.`
    : `[pipeline] Pipeline finished with ${runLog.errors} error(s) in ${runLog.total} step(s).`;

  banner(doneMsg);
  console.log(`[pipeline] Run log saved to ${logPath}`);
  process.exit(allOk ? 0 : 1);
}

main();
