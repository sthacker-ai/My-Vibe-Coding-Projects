#!/usr/bin/env node
/**
 * scripts/db-sync.js — One-time migration: sync file-based data into PostgreSQL.
 *
 * Syncs:
 *   1. data/token-usage.json        → token_usage table
 *   2. data/runs/*-manifest.json    → pipeline_runs table
 *   3. content/courses/**\/course-*.md → course_index table
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING / DO UPDATE.
 *
 * Usage:
 *   npm run db:sync
 *   npm run db:sync -- --only tokens   (sync only token usage)
 *   npm run db:sync -- --only runs     (sync only pipeline runs)
 *   npm run db:sync -- --only courses  (sync only course index)
 */
"use strict";

require("dotenv").config({ quiet: true });

const fs   = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes("YOUR_PASSWORD")) {
  console.error("[db-sync] ERROR: Set DATABASE_URL in .env with your actual PostgreSQL password.");
  process.exit(1);
}

const ROOT     = process.cwd();
const pool     = new Pool({ connectionString: DATABASE_URL });

// ── CLI flags ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const shouldSync = (key) => !ONLY || ONLY === key;

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const out = {};
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") break;
    const m = lines[i].match(/^([\w_-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function wordCount(raw) {
  return raw.replace(/^---[\s\S]*?---\n?/, "").split(/\s+/).filter(Boolean).length;
}

// ── 1. Sync token_usage ───────────────────────────────────────────────────────
async function syncTokenUsage(client) {
  const tokenFile = path.join(ROOT, "data", "token-usage.json");
  if (!fs.existsSync(tokenFile)) {
    console.log("[db-sync] token-usage.json not found, skipping.");
    return;
  }

  let entries;
  try { entries = JSON.parse(fs.readFileSync(tokenFile, "utf8")); }
  catch (e) { console.error("[db-sync] Cannot parse token-usage.json:", e.message); return; }

  if (!Array.isArray(entries) || !entries.length) {
    console.log("[db-sync] token-usage.json is empty.");
    return;
  }

  console.log(`[db-sync] Syncing ${entries.length} token usage records…`);
  let inserted = 0, skipped = 0;

  for (const e of entries) {
    try {
      const res = await client.query(
        `INSERT INTO token_usage (ts, label, model, provider, prompt_tokens, completion_tokens, total_tokens)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (ts, label) DO NOTHING`,
        [
          e.ts, e.label, e.model, e.provider || "OpenRouter",
          e.prompt_tokens || 0, e.completion_tokens || 0, e.total_tokens || 0,
        ]
      );
      if (res.rowCount > 0) inserted++; else skipped++;
    } catch (err) {
      console.warn(`[db-sync]   Skipping entry ${e.label}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`[db-sync] token_usage: ${inserted} inserted, ${skipped} already existed.`);
}

// ── 2. Sync pipeline_runs ─────────────────────────────────────────────────────
async function syncPipelineRuns(client) {
  const runsDir = path.join(ROOT, "data", "runs");
  if (!fs.existsSync(runsDir)) {
    console.log("[db-sync] data/runs/ not found, skipping pipeline_runs.");
    return;
  }

  const manifestFiles = fs.readdirSync(runsDir)
    .filter((f) => /^scheduled-\d{4}-\d{2}-\d{2}-manifest\.json$/.test(f))
    .sort();

  if (!manifestFiles.length) {
    console.log("[db-sync] No manifest files found.");
    return;
  }

  console.log(`[db-sync] Syncing ${manifestFiles.length} pipeline run manifests…`);
  let inserted = 0, updated = 0, skipped = 0;

  for (const file of manifestFiles) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(runsDir, file), "utf8"));
      const runId = file.replace("-manifest.json", "");

      // Convert IST string timestamps to ISO if possible
      const runDate = m.date || runId.replace("scheduled-", "").slice(0, 10);

      const res = await client.query(
        `INSERT INTO pipeline_runs (run_id, trigger, run_date, duration_secs, status, steps)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (run_id) DO UPDATE SET
           status        = EXCLUDED.status,
           duration_secs = EXCLUDED.duration_secs,
           steps         = EXCLUDED.steps`,
        [
          runId,
          m.trigger || "scheduled",
          runDate,
          m.duration_secs ?? null,
          m.status || "ok",
          JSON.stringify(m.steps || []),
        ]
      );
      if (res.rowCount > 0) {
        const wasUpdate = res.command === "UPDATE";
        if (wasUpdate) updated++; else inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`[db-sync]   Skipping ${file}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`[db-sync] pipeline_runs: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
}

// ── 3. Sync course_index ──────────────────────────────────────────────────────
async function syncCourseIndex(client) {
  const coursesDir = path.join(ROOT, "content", "courses");
  const assetsDir  = path.join(ROOT, "public", "course-assets");
  const audioDir   = path.join(ROOT, "public", "course-audio");

  if (!fs.existsSync(coursesDir)) {
    console.log("[db-sync] content/courses/ not found, skipping course_index.");
    return;
  }

  const topicDirs = fs.readdirSync(coursesDir)
    .filter((n) => fs.statSync(path.join(coursesDir, n)).isDirectory());

  let totalCourses = 0;
  for (const t of topicDirs) {
    totalCourses += fs.readdirSync(path.join(coursesDir, t))
      .filter((f) => /^course-\d{3}\.md$/.test(f)).length;
  }

  console.log(`[db-sync] Syncing ${totalCourses} courses across ${topicDirs.length} topics…`);
  let inserted = 0, updated = 0, skipped = 0;

  for (const topicSlug of topicDirs) {
    const topicDir = path.join(coursesDir, topicSlug);
    const courseFiles = fs.readdirSync(topicDir)
      .filter((f) => /^course-\d{3}\.md$/.test(f))
      .sort();

    for (const cf of courseFiles) {
      const courseSlug = cf.replace(".md", "");
      const courseId   = `${topicSlug}/${courseSlug}`;
      const mdPath     = path.join(topicDir, cf);

      try {
        const raw   = fs.readFileSync(mdPath, "utf8");
        const fm    = parseFrontmatter(raw);
        const words = wordCount(raw);

        const heroPath    = path.join(assetsDir, topicSlug, `${courseSlug}-hero.jpg`);
        const podcastPath = path.join(audioDir, topicSlug, `${courseSlug}-podcast.mp3`);
        const hasHero     = fs.existsSync(heroPath);
        const hasPodcast  = fs.existsSync(podcastPath);

        const genAt = fm.generated_at
          ? new Date(fm.generated_at).toISOString()
          : null;

        const res = await client.query(
          `INSERT INTO course_index
             (course_id, topic_slug, course_slug, title, source_id, word_count, has_hero, has_podcast, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (course_id) DO UPDATE SET
             title        = EXCLUDED.title,
             source_id    = EXCLUDED.source_id,
             word_count   = EXCLUDED.word_count,
             has_hero     = EXCLUDED.has_hero,
             has_podcast  = EXCLUDED.has_podcast,
             generated_at = EXCLUDED.generated_at,
             updated_at   = NOW()`,
          [
            courseId, topicSlug, courseSlug,
            fm.title || null,
            fm.source_id || fm.tweet_id || null,
            words, hasHero, hasPodcast, genAt,
          ]
        );

        if (res.command === "UPDATE") updated++; else inserted++;
      } catch (err) {
        console.warn(`[db-sync]   Skipping ${courseId}: ${err.message}`);
        skipped++;
      }
    }
  }

  console.log(`[db-sync] course_index: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    console.log("[db-sync] Connected to:", DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));
    console.log("[db-sync] Starting sync…\n");

    if (shouldSync("tokens"))  await syncTokenUsage(client);
    if (shouldSync("runs"))    await syncPipelineRuns(client);
    if (shouldSync("courses")) await syncCourseIndex(client);

    console.log("\n[db-sync] All done.");
  } catch (err) {
    console.error("[db-sync] Fatal:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
