#!/usr/bin/env node
"use strict";

/**
 * scripts/extract-transcripts.js
 *
 * Phase 9: Video Transcript Pipeline
 *
 * For every source with extraction_type = "x_video" (or "youtube_video"):
 *   1. Download the video/audio via yt-dlp (using the tweet_url or youtube_url)
 *   2. Transcribe with faster-whisper
 *   3. Save transcript to data/transcripts/<tweet_id>.txt
 *   4. Update the -extracted.json with { has_transcript: true, transcript_path }
 *   5. Reset processing_status to "classified" so compile:courses will re-run
 *
 * Usage:
 *   node scripts/extract-transcripts.js               # process all pending video sources
 *   node scripts/extract-transcripts.js --tweet-id <id>   # specific tweet
 *   node scripts/extract-transcripts.js --limit 3    # max 3 at a time
 *   node scripts/extract-transcripts.js --model medium   # whisper model size
 *   node scripts/extract-transcripts.js --reprocess   # reprocess already-transcribed sources
 *
 * Prerequisites (run once):
 *   pip install yt-dlp faster-whisper
 */

require("dotenv").config({ quiet: true });

const fs      = require("fs");
const path    = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT             = process.cwd();
const RAW_TWEETS_DIR   = path.join(ROOT, "data", "raw", "tweets");
const TRANSCRIPTS_DIR  = path.join(ROOT, "data", "transcripts");
const TMP_DIR          = path.join(TRANSCRIPTS_DIR, "tmp");
const RUNS_DIR         = path.join(ROOT, "data", "runs");

const DOWNLOAD_SCRIPT   = path.join(ROOT, "scripts", "transcribe", "download_video.py");
const TRANSCRIBE_SCRIPT = path.join(ROOT, "scripts", "transcribe", "transcribe_audio.py");

// Prefer `python` or `python3` — whichever is on PATH
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
const CLI_TWEET_ID  = argValue("--tweet-id");
const CLI_LIMIT     = argValue("--limit") ? parseInt(argValue("--limit"), 10) : null;
const CLI_MODEL     = argValue("--model") || process.env.WHISPER_MODEL || "small";
const CLI_REPROCESS = process.argv.includes("--reprocess");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function runPython(scriptPath, args, label) {
  const result = spawnSync(PYTHON, [scriptPath, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout:   30 * 60 * 1000, // 30 min max per video
  });

  // Always echo stdout/stderr for visibility
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`[${label}] Python script exited with code ${result.status}`);
  }

  return result.stdout ? result.stdout.trim().split("\n").pop() : "";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  if (!fs.existsSync(TMP_DIR))          fs.mkdirSync(TMP_DIR, { recursive: true });
  if (!fs.existsSync(RUNS_DIR))         fs.mkdirSync(RUNS_DIR, { recursive: true });

  // Find all extracted JSONs that are video type
  const allExtracted = fs.readdirSync(RAW_TWEETS_DIR)
    .filter((f) => f.endsWith("-extracted.json"));

  let candidates = allExtracted.map((f) => {
    const extPath = path.join(RAW_TWEETS_DIR, f);
    let ext;
    try { ext = JSON.parse(fs.readFileSync(extPath, "utf8")); } catch { return null; }
    if (!ext) return null;

    const tweetId = f.replace("-extracted.json", "");
    const rawPath = path.join(RAW_TWEETS_DIR, `${tweetId}.json`);
    if (!fs.existsSync(rawPath)) return null;

    let raw;
    try { raw = JSON.parse(fs.readFileSync(rawPath, "utf8")); } catch { return null; }

    return { tweetId, extPath, rawPath, ext, raw };
  }).filter(Boolean);

  // Only video / youtube types
  candidates = candidates.filter(({ ext }) =>
    ["x_video", "youtube_video"].includes(ext.extraction_type)
  );

  // Skip already-transcribed unless --reprocess
  if (!CLI_REPROCESS) {
    candidates = candidates.filter(({ tweetId }) => {
      const transcriptPath = path.join(TRANSCRIPTS_DIR, `${tweetId}.txt`);
      return !fs.existsSync(transcriptPath);
    });
  }

  // CLI filters
  if (CLI_TWEET_ID) {
    candidates = candidates.filter(({ tweetId }) => tweetId === CLI_TWEET_ID);
  }
  if (CLI_LIMIT) {
    candidates = candidates.slice(0, CLI_LIMIT);
  }

  if (candidates.length === 0) {
    console.log("[transcripts] No video sources pending transcription. Use --reprocess to re-run existing.");
    process.exit(0);
  }

  console.log(`[transcripts] Found ${candidates.length} video source(s) to transcribe (whisper model: ${CLI_MODEL})`);
  console.log(`[transcripts] Python: ${PYTHON}\n`);

  const runLog = {
    started_at:   new Date().toISOString(),
    whisper_model: CLI_MODEL,
    results:      [],
  };

  for (let i = 0; i < candidates.length; i++) {
    const { tweetId, extPath, rawPath, ext, raw } = candidates[i];
    const tweetUrl = raw.tweet_url || ext.tweet_url || "";

    console.log(`\n[transcripts] (${i + 1}/${candidates.length}) tweet_id=${tweetId}`);
    console.log(`[transcripts] URL: ${tweetUrl}`);

    if (!tweetUrl) {
      console.warn(`[transcripts] tweet_id=${tweetId} — no tweet_url, skipping`);
      runLog.results.push({ tweetId, status: "skip", reason: "no_url" });
      continue;
    }

    const tmpBase        = path.join(TMP_DIR, tweetId);
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `${tweetId}.txt`);

    // Step 1: Download
    console.log(`[transcripts] Downloading video...`);
    let downloadedFile;
    try {
      downloadedFile = runPython(DOWNLOAD_SCRIPT, [tweetUrl, tmpBase], "download");
      if (!downloadedFile || !fs.existsSync(downloadedFile)) {
        throw new Error("Downloaded file path not returned or file missing");
      }
      console.log(`[transcripts] Downloaded => ${downloadedFile}`);
    } catch (err) {
      console.warn(`[transcripts] tweet_id=${tweetId} download failed: ${err.message}`);
      runLog.results.push({ tweetId, status: "error", stage: "download", error: err.message });
      continue;
    }

    // Step 2: Transcribe
    console.log(`[transcripts] Transcribing with Whisper (${CLI_MODEL})...`);
    try {
      runPython(TRANSCRIBE_SCRIPT, [downloadedFile, transcriptPath, CLI_MODEL], "transcribe");
    } catch (err) {
      console.warn(`[transcripts] tweet_id=${tweetId} transcription failed: ${err.message}`);
      // Clean up downloaded file
      try { fs.unlinkSync(downloadedFile); } catch { /* ignore */ }
      runLog.results.push({ tweetId, status: "error", stage: "transcribe", error: err.message });
      continue;
    }

    // Step 3: Clean up temp video file
    try { fs.unlinkSync(downloadedFile); } catch { /* ignore */ }

    // Step 4: Update extracted JSON
    const transcript = fs.readFileSync(transcriptPath, "utf8");
    ext.has_transcript   = true;
    ext.transcript_path  = path.relative(ROOT, transcriptPath).replace(/\\/g, "/");
    ext.transcript_words = transcript.split(/\s+/).length;
    fs.writeFileSync(extPath, JSON.stringify(ext, null, 2), "utf8");

    // Step 5: Reset raw JSON status to "classified" so compile:courses re-processes it
    if (raw.processing_status === "course_generated") {
      raw.processing_status = "classified";
      raw.transcript_added_at = new Date().toISOString();
      raw.course_path = null;
      raw.course_generated_at = null;
      fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), "utf8");
      console.log(`[transcripts] tweet_id=${tweetId} reset to "classified" for course re-generation`);
    }

    console.log(`[transcripts] tweet_id=${tweetId} transcript saved (${ext.transcript_words} words)`);
    runLog.results.push({
      tweetId,
      status:          "ok",
      transcript_words: ext.transcript_words,
      transcript_path:  ext.transcript_path,
    });

    if (i < candidates.length - 1) await sleep(1000);
  }

  runLog.finished_at = new Date().toISOString();
  runLog.total   = candidates.length;
  runLog.success = runLog.results.filter((r) => r.status === "ok").length;
  runLog.errors  = runLog.results.filter((r) => r.status === "error").length;

  const ts      = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-transcripts.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), "utf8");

  console.log(`\n[transcripts] Done. ${runLog.success}/${runLog.total} transcribed, ${runLog.errors} error(s).`);
  if (runLog.success > 0) {
    console.log(`[transcripts] Now run: npm run compile:courses  (will use transcripts automatically)`);
  }
}

main().catch((err) => {
  console.error("[transcripts] Fatal:", err.message);
  process.exit(1);
});
