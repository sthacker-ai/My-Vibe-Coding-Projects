#!/usr/bin/env node
"use strict";

/**
 * scripts/import-youtube.js
 *
 * Phase 10: YouTube (or any URL) video intake
 *
 * Given a YouTube (or any yt-dlp-supported) URL, this script:
 *   1. Downloads and transcribes the video (via yt-dlp + faster-whisper)
 *   2. Creates a source note in content/sources/youtube/<video_id>.md
 *   3. Creates a raw JSON in data/raw/videos/<video_id>.json
 *   4. Runs classify, compile-course, and summarize automatically
 *
 * Usage:
 *   node scripts/import-youtube.js --url <youtube_url>
 *   node scripts/import-youtube.js --url <youtube_url> --model medium
 *
 * The --url can be any yt-dlp-supported URL:
 *   https://www.youtube.com/watch?v=...
 *   https://youtu.be/...
 *   https://twitter.com/user/status/...  (X/Twitter videos)
 *   https://x.com/user/status/...
 */

require("dotenv").config({ quiet: true });

const fs    = require("fs");
const path  = require("path");
const { execFileSync, spawnSync } = require("child_process");
const { aiGenerate } = require("./lib/ai-client");

const ROOT              = process.cwd();
const SOURCES_DIR       = path.join(ROOT, "content", "sources", "youtube");
const RAW_VIDEOS_DIR    = path.join(ROOT, "data", "raw", "videos");
const TRANSCRIPTS_DIR   = path.join(ROOT, "data", "transcripts");
const TMP_DIR           = path.join(TRANSCRIPTS_DIR, "tmp");
const RUNS_DIR          = path.join(ROOT, "data", "runs");

const DOWNLOAD_SCRIPT   = path.join(ROOT, "scripts", "transcribe", "download_video.py");
const TRANSCRIBE_SCRIPT = path.join(ROOT, "scripts", "transcribe", "transcribe_audio.py");

const PYTHON = (() => {
  for (const cmd of ["python", "python3"]) {
    try { execFileSync(cmd, ["--version"], { stdio: "ignore" }); return cmd; } catch { /* try next */ }
  }
  return "python";
})();

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const CLI_URL   = argValue("--url");
const CLI_MODEL = argValue("--model") || process.env.WHISPER_MODEL || "small";

if (!CLI_URL) {
  console.error("[youtube] ERROR: --url is required");
  console.error("  Usage: node scripts/import-youtube.js --url <youtube_url>");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runPython(scriptPath, args, label) {
  const result = spawnSync(PYTHON, [scriptPath, ...args], {
    encoding:   "utf8",
    maxBuffer:  10 * 1024 * 1024,
    timeout:    30 * 60 * 1000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`[${label}] Python script exited with code ${result.status}`);
  }
  return result.stdout ? result.stdout.trim().split("\n").pop() : "";
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// Extract a video ID from the URL (YouTube or X)
function deriveVideoId(url) {
  // YouTube: v=ID or youtu.be/ID
  const ytMatch = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return ytMatch[1];
  // X/Twitter: /status/ID
  const xMatch = url.match(/\/status\/(\d+)/);
  if (xMatch) return xMatch[1];
  // Generic: last path segment
  return url.split("/").filter(Boolean).pop().split("?")[0].slice(0, 20) || Date.now().toString();
}

function isYouTubeUrl(url) {
  return /youtube\.com|youtu\.be/.test(url);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  for (const dir of [SOURCES_DIR, RAW_VIDEOS_DIR, TRANSCRIPTS_DIR, TMP_DIR, RUNS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const videoId   = deriveVideoId(CLI_URL);
  const sourceType = isYouTubeUrl(CLI_URL) ? "youtube_video" : "x_video";

  console.log(`\n[youtube] Processing: ${CLI_URL}`);
  console.log(`[youtube] Video ID: ${videoId} | Type: ${sourceType}`);

  const tmpBase        = path.join(TMP_DIR, videoId);
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${videoId}.txt`);

  // ── Step 1: Check if already imported ────────────────────────────────────
  const rawPath = path.join(RAW_VIDEOS_DIR, `${videoId}.json`);
  const sourcePath = path.join(SOURCES_DIR, `${videoId}.md`);

  if (fs.existsSync(transcriptPath) && fs.existsSync(rawPath)) {
    console.log(`[youtube] Already imported. Transcript: ${transcriptPath}`);
    console.log(`[youtube] Run npm run compile:courses to regenerate courseware.`);
    process.exit(0);
  }

  // ── Step 2: Get video metadata via yt-dlp ────────────────────────────────
  console.log(`\n[youtube] Fetching metadata...`);
  let title = "", channelName = "", description = "", duration = 0;
  try {
    const metaResult = spawnSync("yt-dlp", [
      "--dump-json", "--no-playlist", "--quiet", CLI_URL
    ], { encoding: "utf8", timeout: 60000, maxBuffer: 5 * 1024 * 1024 });

    if (metaResult.status === 0 && metaResult.stdout) {
      const meta = JSON.parse(metaResult.stdout.trim().split("\n")[0]);
      title       = meta.title       || "";
      channelName = meta.uploader    || meta.channel || "";
      description = (meta.description || "").slice(0, 1000);
      duration    = meta.duration    || 0;
    }
  } catch {
    console.warn("[youtube] Could not fetch metadata, continuing without it");
  }

  if (!title) title = `Video ${videoId}`;
  console.log(`[youtube] Title: ${title}`);
  console.log(`[youtube] Channel: ${channelName}, Duration: ${duration}s`);

  // ── Step 3: Download ──────────────────────────────────────────────────────
  console.log(`\n[youtube] Downloading audio...`);
  let downloadedFile;
  try {
    downloadedFile = runPython(DOWNLOAD_SCRIPT, [CLI_URL, tmpBase], "download");
    if (!downloadedFile || !fs.existsSync(downloadedFile)) throw new Error("File missing after download");
    console.log(`[youtube] Downloaded: ${downloadedFile}`);
  } catch (err) {
    console.error(`[youtube] Download failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 4: Transcribe ────────────────────────────────────────────────────
  console.log(`\n[youtube] Transcribing with Whisper (${CLI_MODEL})...`);
  try {
    runPython(TRANSCRIBE_SCRIPT, [downloadedFile, transcriptPath, CLI_MODEL], "transcribe");
  } catch (err) {
    console.error(`[youtube] Transcription failed: ${err.message}`);
    try { fs.unlinkSync(downloadedFile); } catch { /* ignore */ }
    process.exit(1);
  }

  // Clean up temp file
  try { fs.unlinkSync(downloadedFile); } catch { /* ignore */ }

  const transcript      = fs.readFileSync(transcriptPath, "utf8").trim();
  const transcriptWords = transcript.split(/\s+/).length;
  console.log(`[youtube] Transcript: ${transcriptWords} words`);

  // ── Step 5: AI-generate a topic classification ────────────────────────────
  console.log(`\n[youtube] Classifying topic...`);
  const classifyPrompt = `Given this video content, identify the topic category.

Title: ${title}
Channel: ${channelName}
Description: ${description}
Transcript excerpt: ${transcript.slice(0, 1000)}

Respond with ONLY a JSON object:
{"topic_slug": "kebab-case-slug", "topic_label": "Human Readable Label"}`;

  let topicSlug = "general-ai", topicLabel = "General AI";
  try {
    const response = await aiGenerate([{ role: "user", content: classifyPrompt }], { maxTokens: 100, label: "yt-classify" });
    const match = response.match(/\{[^{}]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.topic_slug && parsed.topic_label) {
        topicSlug = parsed.topic_slug;
        topicLabel = parsed.topic_label;
      }
    }
  } catch (err) {
    console.warn(`[youtube] Classification failed: ${err.message} — using defaults`);
  }
  console.log(`[youtube] Topic: ${topicLabel} (${topicSlug})`);

  // ── Step 6: Write raw JSON ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const rawData = {
    video_id:         videoId,
    source_url:       CLI_URL,
    source_type:      sourceType,
    title,
    channel_name:     channelName,
    description,
    duration_seconds: duration,
    scraped_at:       now,
    processing_status: "classified",
    topic_slug:       topicSlug,
    topic_label:      topicLabel,
    transcript_path:  path.relative(ROOT, transcriptPath).replace(/\\/g, "/"),
    transcript_words: transcriptWords,
  };
  fs.writeFileSync(rawPath, JSON.stringify(rawData, null, 2), "utf8");

  // ── Step 7: Write source note ─────────────────────────────────────────────
  const frontmatter = [
    "---",
    `source_type: ${sourceType}`,
    `video_id: "${videoId}"`,
    `source_url: "${CLI_URL}"`,
    `title: ${JSON.stringify(title)}`,
    `channel_name: "${channelName}"`,
    `duration_seconds: ${duration}`,
    `scraped_at: "${now}"`,
    `processing_status: classified`,
    `topic_slug: ${topicSlug}`,
    `topic_label: ${JSON.stringify(topicLabel)}`,
    `transcript_path: ${path.relative(ROOT, transcriptPath).replace(/\\/g, "/")}`,
    `transcript_words: ${transcriptWords}`,
    "---",
    "",
    `# ${title}`,
    "",
    `**Source:** [${CLI_URL}](${CLI_URL})`,
    `**Channel:** ${channelName}`,
    `**Duration:** ${Math.round(duration / 60)} min`,
    "",
    "## Description",
    description || "(no description)",
    "",
    "## Transcript Preview",
    "",
    transcript.slice(0, 500) + (transcript.length > 500 ? "..." : ""),
  ].join("\n");

  fs.writeFileSync(sourcePath, frontmatter, "utf8");

  console.log(`\n[youtube] Source note saved: content/sources/youtube/${videoId}.md`);
  console.log(`[youtube] Raw data saved:    data/raw/videos/${videoId}.json`);
  console.log(`[youtube] Transcript saved:  data/transcripts/${videoId}.txt`);
  console.log(`\n[youtube] Done! Now run:`);
  console.log(`  npm run compile:courses   (generates courseware from transcript)`);
  console.log(`  npm run summarize:topics  (updates wiki pages)`);
}

main().catch((err) => {
  console.error("[youtube] Fatal:", err.message);
  process.exit(1);
});
