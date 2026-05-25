#!/usr/bin/env node
"use strict";

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { aiGenerate } = require("./lib/ai-client");
const { getPrompt } = require("./lib/prompt-loader");

const ROOT = process.cwd();
const RAW_TWEETS_DIR = path.join(ROOT, "data", "raw", "tweets");
const X_SOURCE_DIR = path.join(ROOT, "content", "sources", "x");
const RUNS_DIR = path.join(ROOT, "data", "runs");
const TOPICS_FILE = path.join(ROOT, "data", "indexes", "topics.json");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const CLI_TWEET_ID = argValue("--tweet-id");
const CLI_LIMIT = argValue("--limit") ? parseInt(argValue("--limit"), 10) : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonFromResponse(text) {
  // Extract the first {...} block from the model's response
  const match = text.match(/\{[^{}]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildPrompt(rawJson, extractedJson, strict = false) {
  const tweetText = rawJson.tweet_text || "";
  const textContent = (extractedJson.text_content || "").slice(0, 1500);
  const strictNote = strict
    ? "\nIMPORTANT: Return ONLY the raw JSON object. No explanation, no markdown, no extra text."
    : "";
  const system = getPrompt("classify_source_system");
  const instructions = getPrompt("classify_source_instructions");
  return `${system}

Tweet URL: ${rawJson.tweet_url}
Author: @${rawJson.author_handle}
Tweet text: ${tweetText}
Extracted content: ${textContent}

${instructions}${strictNote}`;
}

async function classify(rawJson, extractedJson) {
  // First attempt
  const prompt1 = buildPrompt(rawJson, extractedJson, false);
  let response1;
  try {
    response1 = await aiGenerate([{ role: "user", content: prompt1 }], { maxTokens: 200, label: `classify-${rawJson.tweet_id}` });
  } catch (err) {
    console.warn(`[classify] tweet_id=${rawJson.tweet_id} AI error on attempt 1: ${err.message}`);
    return { topic_slug: "uncategorized", topic_label: "Uncategorized", fallback: true };
  }
  const parsed1 = extractJsonFromResponse(response1);
  if (parsed1 && parsed1.topic_slug && parsed1.topic_label) {
    return { topic_slug: parsed1.topic_slug, topic_label: parsed1.topic_label, fallback: false };
  }

  // Retry with stricter prompt
  console.warn(`[classify] tweet_id=${rawJson.tweet_id} JSON parse failed on attempt 1, retrying...`);
  await sleep(500);
  const prompt2 = buildPrompt(rawJson, extractedJson, true);
  let response2;
  try {
    response2 = await aiGenerate([{ role: "user", content: prompt2 }], { maxTokens: 200, label: `classify-retry-${rawJson.tweet_id}` });
  } catch (err) {
    console.warn(`[classify] tweet_id=${rawJson.tweet_id} AI error on attempt 2: ${err.message}`);
    return { topic_slug: "uncategorized", topic_label: "Uncategorized", fallback: true };
  }
  const parsed2 = extractJsonFromResponse(response2);
  if (parsed2 && parsed2.topic_slug && parsed2.topic_label) {
    return { topic_slug: parsed2.topic_slug, topic_label: parsed2.topic_label, fallback: false };
  }

  console.warn(`[classify] tweet_id=${rawJson.tweet_id} WARNING: Both attempts failed, using "uncategorized"`);
  return { topic_slug: "uncategorized", topic_label: "Uncategorized", fallback: true };
}

function loadTopicsIndex() {
  if (fs.existsSync(TOPICS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"));
    } catch {
      // fall through to default
    }
  }
  return {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    topics: {},
  };
}

function saveTopicsIndex(index) {
  index.updated_at = new Date().toISOString();
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(index, null, 2), "utf8");
}

function updateTopicsIndex(index, tweetId, topicSlug, topicLabel) {
  if (!index.topics[topicSlug]) {
    index.topics[topicSlug] = {
      slug: topicSlug,
      label: topicLabel,
      source_count: 0,
      tweet_ids: [],
    };
  }
  const entry = index.topics[topicSlug];
  if (!entry.tweet_ids.includes(tweetId)) {
    entry.tweet_ids.push(tweetId);
    entry.source_count = entry.tweet_ids.length;
  }
}

function updateRawJson(rawPath, topicSlug, topicLabel) {
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

  // Remove from old topic in index if we're reclassifying — handled at call site
  raw.topic_slug = topicSlug;
  raw.topic_label = topicLabel;
  raw.processing_status = "classified";
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2), "utf8");
  return raw;
}

function sanitizeFrontmatter(content) {
  // Fix common invalid YAML patterns written by import script:
  // "image_urls:[]" → "image_urls: []"
  // "key:value" → "key: value" (only inside frontmatter block)
  const parts = content.split(/^---$/m);
  if (parts.length < 3) return content;
  // parts[0] = "" (before first ---), parts[1] = frontmatter, parts[2]+ = body
  const fm = parts[1].replace(/^(\w[^:]*):(\S)/gm, "$1: $2");
  return ["", fm, ...parts.slice(2)].join("---");
}

function updateSourceNote(tweetId, topicSlug, topicLabel) {
  const mdPath = path.join(X_SOURCE_DIR, `${tweetId}.md`);
  if (!fs.existsSync(mdPath)) {
    console.warn(`[classify] tweet_id=${tweetId} WARNING: source note not found at ${mdPath}`);
    return;
  }
  const rawContent = fs.readFileSync(mdPath, "utf8");
  const fileContent = sanitizeFrontmatter(rawContent);
  let parsed;
  try {
    parsed = matter(fileContent);
  } catch (err) {
    console.warn(`[classify] tweet_id=${tweetId} WARNING: gray-matter parse error: ${err.message} — skipping frontmatter update`);
    return;
  }

  // Update frontmatter fields
  parsed.data.topic_slug = topicSlug;
  parsed.data.topic_label = topicLabel;
  parsed.data.processing_status = "classified";

  // Update tags: replace "uncategorized" with the new topic slug; add if not present
  if (!Array.isArray(parsed.data.tags)) {
    parsed.data.tags = ["x-like", "source", topicSlug];
  } else {
    parsed.data.tags = parsed.data.tags.map((t) =>
      t === "uncategorized" ? topicSlug : t
    );
    if (!parsed.data.tags.includes(topicSlug)) {
      parsed.data.tags.push(topicSlug);
    }
  }

  const newContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(mdPath, newContent, "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  // Collect candidate raw JSON files (skip *-extracted.json)
  const allFiles = fs.readdirSync(RAW_TWEETS_DIR).filter((f) => {
    return f.endsWith(".json") && !f.includes("-extracted") && f !== ".gitkeep";
  });

  let candidates = allFiles.map((f) => {
    const rawPath = path.join(RAW_TWEETS_DIR, f);
    const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
    return { file: f, rawPath, raw };
  }).filter(({ raw }) => raw.processing_status === "extracted");

  if (CLI_TWEET_ID) {
    candidates = candidates.filter(({ raw }) => raw.tweet_id === CLI_TWEET_ID);
    if (candidates.length === 0) {
      console.log(`[classify] No tweet with id=${CLI_TWEET_ID} and status=extracted found.`);
      process.exit(0);
    }
  }

  if (CLI_LIMIT && CLI_LIMIT > 0) {
    candidates = candidates.slice(0, CLI_LIMIT);
  }

  console.log(`[classify] Found ${candidates.length} tweet(s) to classify.`);

  const topicsIndex = loadTopicsIndex();
  const runLog = {
    started_at: new Date().toISOString(),
    model: process.env.OPENROUTER_MODEL_PRIMARY || "openrouter",
    results: [],
  };

  for (let i = 0; i < candidates.length; i++) {
    const { rawPath, raw } = candidates[i];
    const tweetId = raw.tweet_id;
    const extractedPath = path.join(RAW_TWEETS_DIR, `${tweetId}-extracted.json`);

    let extracted = {};
    if (fs.existsSync(extractedPath)) {
      try {
        extracted = JSON.parse(fs.readFileSync(extractedPath, "utf8"));
      } catch {
        console.warn(`[classify] tweet_id=${tweetId} WARNING: could not parse extracted JSON`);
      }
    } else {
      console.warn(`[classify] tweet_id=${tweetId} WARNING: no extracted JSON found`);
    }

    const { topic_slug, topic_label, fallback } = await classify(raw, extracted);
    const status = fallback ? "fallback" : "ok";

    console.log(`[classify] tweet_id=${tweetId} topic=${topic_slug} status=${status}`);

    // Update raw JSON
    updateRawJson(rawPath, topic_slug, topic_label);

    // Update source note
    updateSourceNote(tweetId, topic_slug, topic_label);

    // Update topics index
    updateTopicsIndex(topicsIndex, tweetId, topic_slug, topic_label);
    saveTopicsIndex(topicsIndex);

    runLog.results.push({
      tweet_id: tweetId,
      topic_slug,
      topic_label,
      status,
      fallback,
    });

    // Delay between calls to avoid overwhelming Ollama
    if (i < candidates.length - 1) {
      await sleep(500);
    }
  }

  runLog.finished_at = new Date().toISOString();
  runLog.total = candidates.length;
  runLog.fallbacks = runLog.results.filter((r) => r.fallback).length;

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-classification.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), "utf8");

  console.log(`\n[classify] Done. ${runLog.total} classified, ${runLog.fallbacks} fallback(s).`);
  console.log(`[classify] Run log saved to ${logPath}`);
}

main().catch((err) => {
  console.error("[classify] Fatal error:", err.message);
  process.exit(1);
});
