#!/usr/bin/env node
"use strict";

require("dotenv").config({ quiet: true });

const fs   = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { aiGenerate, aiProviderInfo } = require("./lib/ai-client");
const { getPrompt } = require("./lib/prompt-loader");

const ROOT             = process.cwd();
const RAW_TWEETS_DIR   = path.join(ROOT, "data", "raw", "tweets");
const X_SOURCE_DIR     = path.join(ROOT, "content", "sources", "x");
const COURSES_DIR      = path.join(ROOT, "content", "courses");
const RUNS_DIR         = path.join(ROOT, "data", "runs");
const TRANSCRIPTS_DIR  = path.join(ROOT, "data", "transcripts");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const CLI_TWEET_ID = argValue("--tweet-id");
const CLI_LIMIT    = argValue("--limit") ? parseInt(argValue("--limit"), 10) : null;
const CLI_FORCE    = process.argv.includes("--force");  // re-generate even if already course_generated

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Course number helper — find next 3-digit index for a topic folder
// ---------------------------------------------------------------------------

function nextCourseNumber(topicDir) {
  if (!fs.existsSync(topicDir)) return "001";
  const existing = fs.readdirSync(topicDir).filter((f) =>
    f.match(/^course-\d{3}\.md$/)
  );
  if (existing.length === 0) return "001";
  const nums = existing.map((f) => parseInt(f.replace("course-", "").replace(".md", ""), 10));
  return String(Math.max(...nums) + 1).padStart(3, "0");
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildCourseMessages(rawJson, extractedJson, transcript) {
  const tweetText    = rawJson.tweet_text    || "";
  const topicLabel   = rawJson.topic_label   || rawJson.topic_slug || "General";
  const authorHandle = rawJson.author_handle || "unknown";
  const tweetUrl     = rawJson.tweet_url     || "";
  const extractType  = extractedJson.extraction_type || "plain_tweet";
  const title        = extractedJson.title   || tweetText.slice(0, 120);

  // Primary content — prefer transcript (video), then extracted text, then tweet text
  let primaryContent = "";
  let contentLabel   = "";
  if (transcript && transcript.length > 200) {
    // Use up to 12 000 chars of transcript for comprehensive coverage
    primaryContent = transcript.slice(0, 12000);
    contentLabel   = "VIDEO TRANSCRIPT (verbatim spoken content)";
  } else if (extractedJson.text_content && extractedJson.text_content.length > 100) {
    primaryContent = extractedJson.text_content.slice(0, 8000);
    contentLabel   = extractType === "x_article" ? "ARTICLE TEXT" : "EXTRACTED CONTENT";
  } else {
    primaryContent = tweetText;
    contentLabel   = "TWEET TEXT";
  }

  const hasRichContent = primaryContent.length > 400;

  const system = getPrompt("compile_course_system");
  const instructions = getPrompt("compile_course_instructions");

  const user = `Create a comprehensive Markdown course from the following source material.

---
SOURCE METADATA
URL: ${tweetUrl}
Author: @${authorHandle}
Topic: ${topicLabel}
Source type: ${extractType}
Title: ${title}

TWEET TEXT:
${tweetText}

${contentLabel}:
${primaryContent}
---

Write a structured Markdown course document with the sections below. Use the exact heading format shown.
${instructions}
${!hasRichContent ? "- The source is brief (a short tweet). Expand each concept thoroughly using your own expertise on this topic.\n" : ""}
---

# [A clear, descriptive course title]

## Overview
A 3-5 sentence explanation of what this course covers and why it matters to someone learning about ${topicLabel}.

## Background & Context
Provide context: why does this topic exist, what problem does it solve, who created or championed it, where does it fit in the broader landscape.

## Core Concepts
For each major concept or term in the source, write a heading and a thorough explanation (minimum 3 sentences each).

### [Concept 1 Name]
[Full explanation with examples]

### [Concept 2 Name]
[Full explanation with examples]

(Add as many concepts as the source covers)

## How It Works / Step-by-Step
If the source describes a process, workflow, or method: explain each step in full detail.
If it describes a tool or system: explain how to use it with examples.

## Real-World Examples & Use Cases
Provide concrete examples. If the source gives specific examples, quote and expand on them.
If the source is brief, add 2-3 realistic scenarios where this knowledge would be applied.

## Key Insights & Takeaways
- List every important insight, lesson, or actionable takeaway from the source.
- Each bullet should be a complete, actionable sentence (not just a keyword).
- Aim for 5-10 bullets.

## Common Pitfalls / What to Watch Out For
What mistakes do beginners make? What does the source warn against? What should the reader be careful about?

## Review Questions
1. [Question that tests deep understanding of the first core concept]
2. [Question that tests understanding of the process or method]
3. [Question that requires applying the knowledge to a new scenario]

## Further Learning
- What should the reader learn next to build on this?
- What related topics in ${topicLabel} does this connect to?`;

  return [
    { role: "system", content: system },
    { role: "user",   content: user },
  ];
}

// ---------------------------------------------------------------------------
// Source note frontmatter update
// ---------------------------------------------------------------------------

function sanitizeFrontmatter(content) {
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return content;
}

function updateSourceNote(tweetId, coursePath) {
  const mdPath = path.join(X_SOURCE_DIR, `${tweetId}.md`);
  if (!fs.existsSync(mdPath)) {
    console.warn(`[course] tweet_id=${tweetId} WARNING: source note not found at ${mdPath}`);
    return;
  }
  const rawContent = sanitizeFrontmatter(fs.readFileSync(mdPath, "utf8"));
  let parsed;
  try {
    parsed = matter(rawContent);
  } catch (err) {
    console.warn(`[course] tweet_id=${tweetId} WARNING: frontmatter parse error: ${err.message}`);
    return;
  }
  parsed.data.course_path      = coursePath;
  parsed.data.processing_status = "course_generated";
  fs.writeFileSync(mdPath, matter.stringify(parsed.content, parsed.data), "utf8");
}

function updateRawJson(rawPath, coursePath) {
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  raw.course_path        = coursePath;
  raw.processing_status  = "course_generated";
  raw.course_generated_at = new Date().toISOString();
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  const allFiles = fs.readdirSync(RAW_TWEETS_DIR).filter((f) =>
    f.endsWith(".json") && !f.includes("-extracted") && f !== ".gitkeep"
  );

  // Also include YouTube/video sources from data/raw/videos/
  const RAW_VIDEOS_DIR = path.join(ROOT, "data", "raw", "videos");
  const videoFiles = fs.existsSync(RAW_VIDEOS_DIR)
    ? fs.readdirSync(RAW_VIDEOS_DIR).filter((f) => f.endsWith(".json") && f !== ".gitkeep").map((f) => ({ f, dir: RAW_VIDEOS_DIR }))
    : [];

  let candidates = [
    ...allFiles.map((f) => ({ f, dir: RAW_TWEETS_DIR })),
    ...videoFiles,
  ].map(({ f, dir }) => {
    const rawPath = path.join(dir, f);
    let raw;
    try { raw = JSON.parse(fs.readFileSync(rawPath, "utf8")); } catch { return null; }
    return { file: f, rawPath, raw };
  }).filter(Boolean).filter(({ raw }) =>
    CLI_FORCE
      ? ["classified", "course_generated"].includes(raw.processing_status)
      : raw.processing_status === "classified"
  );

  if (CLI_TWEET_ID) {
    candidates = candidates.filter(({ raw }) =>
      raw.tweet_id === CLI_TWEET_ID || raw.video_id === CLI_TWEET_ID
    );
    if (candidates.length === 0) {
      console.log(`[course] No source with id=${CLI_TWEET_ID} and status=classified found.`);
      process.exit(0);
    }
  }

  if (CLI_LIMIT && CLI_LIMIT > 0) {
    candidates = candidates.slice(0, CLI_LIMIT);
  }

  console.log(`[course] Found ${candidates.length} tweet(s) to process.`);

  console.log(`[course] AI provider: ${aiProviderInfo()}`);
  const runLog = {
    started_at: new Date().toISOString(),
    ai_provider: aiProviderInfo(),
    results: [],
  };

  for (let i = 0; i < candidates.length; i++) {
    const { rawPath, raw } = candidates[i];
    // Support both tweet_id (X sources) and video_id (YouTube sources)
    const tweetId   = raw.tweet_id || raw.video_id;
    const topicSlug = raw.topic_slug || "uncategorized";

    // For X tweets: extracted JSON lives beside the raw JSON
    // For YouTube: no separate extracted JSON (transcript loaded below)
    const extractedPath = path.join(RAW_TWEETS_DIR, `${tweetId}-extracted.json`);
    let extracted = {
      extraction_type: raw.source_type || "plain_tweet",
      title:           raw.title || "",
      text_content:    raw.description || "",
    };
    if (fs.existsSync(extractedPath)) {
      try {
        extracted = JSON.parse(fs.readFileSync(extractedPath, "utf8"));
      } catch {
        console.warn(`[course] tweet_id=${tweetId} WARNING: could not parse extracted JSON`);
      }
    }

    // Load transcript if available (Phase 9 video pipeline)
    let transcript = "";
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `${tweetId}.txt`);
    if (fs.existsSync(transcriptPath)) {
      try {
        transcript = fs.readFileSync(transcriptPath, "utf8").trim();
        console.log(`[course] tweet_id=${tweetId} transcript loaded (${transcript.length} chars)`);
      } catch { /* ignore */ }
    }

    console.log(`[course] (${i + 1}/${candidates.length}) tweet_id=${tweetId} topic=${topicSlug}`);

    const messages = buildCourseMessages(raw, extracted, transcript);
    let courseMarkdown;
    try {
      courseMarkdown = await aiGenerate(messages, { maxTokens: 6000, label: `course-${tweetId}` });
    } catch (err) {
      console.warn(`[course] tweet_id=${tweetId} AI error: ${err.message} — skipping`);
      runLog.results.push({ tweet_id: tweetId, status: "error", error: err.message });
      continue;
    }

    if (!courseMarkdown || courseMarkdown.trim().length < 50) {
      console.warn(`[course] tweet_id=${tweetId} WARNING: empty/short response — skipping`);
      runLog.results.push({ tweet_id: tweetId, status: "empty" });
      continue;
    }

    // Determine output path — reuse existing file when --force, else create new
    const topicDir  = path.join(COURSES_DIR, topicSlug);
    if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });

    let courseFile, coursePath, courseFullPath;
    if (CLI_FORCE && raw.course_path) {
      // Overwrite the existing course file
      courseFile    = path.basename(raw.course_path);
      coursePath    = raw.course_path;
      courseFullPath = path.join(ROOT, raw.course_path);
    } else {
      const courseNum  = nextCourseNumber(topicDir);
      courseFile    = `course-${courseNum}.md`;
      coursePath    = `content/courses/${topicSlug}/${courseFile}`;
      courseFullPath = path.join(topicDir, courseFile);
    }

    // Prepend YAML frontmatter — works for both X tweets and YouTube videos
    const sourceUrl    = raw.tweet_url || raw.source_url || "";
    const sourceHandle = raw.author_handle ? `@${raw.author_handle}` : raw.channel_name || "unknown";
    const frontmatter = [
      "---",
      `title: ${JSON.stringify((courseMarkdown.match(/^#\s+(.+)/m) || [])[1] || raw.tweet_text || raw.title || "Untitled")}`,
      `source_id: "${tweetId}"`,
      `source_type: ${JSON.stringify(raw.source_type || "x_tweet")}`,
      `topic_slug: ${topicSlug}`,
      `topic_label: ${JSON.stringify(raw.topic_label || topicSlug)}`,
      `source_handle: ${JSON.stringify(sourceHandle)}`,
      `tweet_url: ${JSON.stringify(sourceUrl)}`,
      `has_transcript: ${fs.existsSync(path.join(TRANSCRIPTS_DIR, `${tweetId}.txt`))}`,
      `generated_at: "${new Date().toISOString()}"`,
      "---",
      "",
    ].join("\n");

    fs.writeFileSync(courseFullPath, frontmatter + courseMarkdown.trim() + "\n", "utf8");
    console.log(`[course] tweet_id=${tweetId} saved => ${coursePath}`);

    // Update raw JSON and source note
    updateRawJson(rawPath, coursePath);
    updateSourceNote(tweetId, coursePath);

    runLog.results.push({ tweet_id: tweetId, topic_slug: topicSlug, course_path: coursePath, status: "ok" });

    if (i < candidates.length - 1) await sleep(500);
  }

  runLog.finished_at = new Date().toISOString();
  runLog.total   = candidates.length;
  runLog.success = runLog.results.filter((r) => r.status === "ok").length;
  runLog.errors  = runLog.results.filter((r) => r.status !== "ok").length;

  const ts      = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-course-gen.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), "utf8");

  console.log(`\n[course] Done. ${runLog.success}/${runLog.total} courses generated, ${runLog.errors} error(s).`);
  console.log(`[course] Run log saved to ${logPath}`);
}

main().catch((err) => {
  console.error("[course] Fatal error:", err.message);
  process.exit(1);
});
