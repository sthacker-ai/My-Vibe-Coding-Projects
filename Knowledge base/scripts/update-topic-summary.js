#!/usr/bin/env node
"use strict";

require("dotenv").config({ quiet: true });

const fs   = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { aiGenerate, aiProviderInfo } = require("./lib/ai-client");
const { getPrompt } = require("./lib/prompt-loader");

const ROOT         = process.cwd();
const COURSES_DIR  = path.join(ROOT, "content", "courses");
const TOPICS_FILE  = path.join(ROOT, "data", "indexes", "topics.json");
const RUNS_DIR     = path.join(ROOT, "data", "runs");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const CLI_TOPIC = argValue("--topic");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Collect all courses for a topic
// ---------------------------------------------------------------------------

function readCoursesForTopic(topicSlug) {
  const topicDir = path.join(COURSES_DIR, topicSlug);
  if (!fs.existsSync(topicDir)) return [];

  return fs.readdirSync(topicDir)
    .filter((f) => f.match(/^course-\d{3}\.md$/))
    .sort()
    .map((f) => {
      const fullPath = path.join(topicDir, f);
      const raw = fs.readFileSync(fullPath, "utf8");
      let parsed;
      try {
        parsed = matter(raw);
      } catch {
        return { file: f, title: f, content: raw, tweetUrl: "", sourceHandle: "" };
      }
      return {
        file:          f,
        title:         parsed.data.title || f,
        content:       parsed.content.trim(),
        tweetUrl:      parsed.data.tweet_url || "",
        sourceHandle:  parsed.data.source_handle || "",
      };
    });
}

// ---------------------------------------------------------------------------
// Build summary prompt
// ---------------------------------------------------------------------------

function buildSummaryMessages(topicSlug, topicLabel, courses, allTopicSlugs) {
  const otherTopics = allTopicSlugs
    .filter((s) => s !== topicSlug)
    .slice(0, 10)
    .join(", ");

  // Use up to 8 courses, more content per course for quality
  const courseBlocks = courses
    .slice(0, 8)
    .map((c, i) => `### Course ${i + 1}: ${c.title}\n${c.content.slice(0, 1500)}`)
    .join("\n\n");

  const system = getPrompt("summarize_topic_system");
  const instructions = getPrompt("summarize_topic_instructions");

  const courseIndex = courses
    .slice(0, 8)
    .map((c, i) => `${i + 1}. **${c.title}**${c.sourceHandle ? " (by " + c.sourceHandle + ")" : ""} — [describe in 2-3 sentences]`)
    .join("\n");

  const user = `Write a comprehensive wiki-style Markdown reference page for the topic "${topicLabel}".

You have ${courses.length} course(s) on this topic. Other topics in the knowledge base: ${otherTopics || "none yet"}.

Course content:
${courseBlocks}

---
${instructions}

Topic: ${topicLabel}
Available cross-reference topics: ${otherTopics || "none yet"}

Course Index entries to describe:
${courseIndex}

Use plain Markdown. Add [[wikilinks]] freely wherever cross-references are useful.`;

  return [
    { role: "system", content: system },
    { role: "user",   content: user },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
  if (!fs.existsSync(COURSES_DIR)) {
    console.log("[summary] No courses directory found. Run compile:courses first.");
    process.exit(0);
  }

  // Load topics index
  let topicsIndex = { topics: {} };
  if (fs.existsSync(TOPICS_FILE)) {
    try {
      topicsIndex = JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"));
    } catch {
      console.warn("[summary] WARNING: Could not parse topics.json");
    }
  }

  const allTopicSlugs = Object.keys(topicsIndex.topics || {});

  // Discover topic folders that have at least one course
  let topicFolders = fs.readdirSync(COURSES_DIR).filter((name) => {
    const dir = path.join(COURSES_DIR, name);
    if (!fs.statSync(dir).isDirectory()) return false;
    const courses = fs.readdirSync(dir).filter((f) => f.match(/^course-\d{3}\.md$/));
    return courses.length > 0;
  });

  if (CLI_TOPIC) {
    topicFolders = topicFolders.filter((t) => t === CLI_TOPIC);
    if (topicFolders.length === 0) {
      console.log(`[summary] No topic folder found for: ${CLI_TOPIC}`);
      process.exit(0);
    }
  }

  console.log(`[summary] Found ${topicFolders.length} topic(s) with courses.`);

  const runLog = {
    started_at: new Date().toISOString(),
    ai_provider: aiProviderInfo(),
    results: [],
  };

  for (let i = 0; i < topicFolders.length; i++) {
    const topicSlug  = topicFolders[i];
    const topicLabel = (topicsIndex.topics[topicSlug] || {}).label || topicSlug;
    const courses    = readCoursesForTopic(topicSlug);

    console.log(`[summary] (${i + 1}/${topicFolders.length}) topic=${topicSlug} courses=${courses.length}`);

    const messages = buildSummaryMessages(topicSlug, topicLabel, courses, allTopicSlugs);
    let summaryMarkdown;
    try {
      summaryMarkdown = await aiGenerate(messages, { maxTokens: 5000, label: `summary-${topicSlug}` });
    } catch (err) {
      console.warn(`[summary] topic=${topicSlug} AI error: ${err.message} — skipping`);
      runLog.results.push({ topic: topicSlug, status: "error", error: err.message });
      continue;
    }

    if (!summaryMarkdown || summaryMarkdown.trim().length < 50) {
      console.warn(`[summary] topic=${topicSlug} WARNING: empty response — skipping`);
      runLog.results.push({ topic: topicSlug, status: "empty" });
      continue;
    }

    // Prepend frontmatter
    const frontmatter = [
      "---",
      `title: ${JSON.stringify(topicLabel)}`,
      `topic_slug: ${topicSlug}`,
      `course_count: ${courses.length}`,
      `generated_at: "${new Date().toISOString()}"`,
      "type: topic-summary",
      "---",
      "",
    ].join("\n");

    const topicDir    = path.join(COURSES_DIR, topicSlug);
    const summaryPath = path.join(topicDir, "summary.md");
    fs.writeFileSync(summaryPath, frontmatter + summaryMarkdown.trim() + "\n", "utf8");

    console.log(`[summary] topic=${topicSlug} saved => content/courses/${topicSlug}/summary.md`);

    // Update topics.json with summary flag
    if (topicsIndex.topics[topicSlug]) {
      topicsIndex.topics[topicSlug].has_summary   = true;
      topicsIndex.topics[topicSlug].summary_path  = `content/courses/${topicSlug}/summary.md`;
      topicsIndex.topics[topicSlug].updated_at    = new Date().toISOString();
    }

    runLog.results.push({ topic: topicSlug, status: "ok", course_count: courses.length });

    if (i < topicFolders.length - 1) await sleep(500);
  }

  // Save updated topics.json
  topicsIndex.updated_at = new Date().toISOString();
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(topicsIndex, null, 2), "utf8");

  runLog.finished_at = new Date().toISOString();
  runLog.total   = topicFolders.length;
  runLog.success = runLog.results.filter((r) => r.status === "ok").length;

  const ts      = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-topic-summary.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2), "utf8");

  console.log(`\n[summary] Done. ${runLog.success}/${runLog.total} summaries generated.`);
  console.log(`[summary] Run log saved to ${logPath}`);
}

main().catch((err) => {
  console.error("[summary] Fatal error:", err.message);
  process.exit(1);
});
