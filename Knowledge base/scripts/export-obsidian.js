#!/usr/bin/env node
/**
 * scripts/export-obsidian.js
 *
 * Exports the entire knowledge base as an Obsidian-compatible Markdown vault.
 *
 * Output directory: data/obsidian-vault/  (or OBSIDIAN_VAULT_DIR in .env)
 *
 * Structure:
 *   📁 Topics/          — one .md file per wiki topic (with [[wikilinks]])
 *   📁 Sources/         — one .md file per classified source
 *   📁 Courses/[topic]/ — course .md files with frontmatter
 *   📄 Index.md         — master index with links to everything
 *
 * Usage:
 *   node scripts/export-obsidian.js
 *   npm run export:obsidian
 */
"use strict";

require("dotenv").config({ quiet: true });

const fs   = require("fs");
const path = require("path");
const matter = require("gray-matter");

const ROOT        = process.cwd();
const WIKI_DIR    = path.join(ROOT, "content", "wiki");
const COURSES_DIR = path.join(ROOT, "content", "courses");
const SOURCES_DIR = path.join(ROOT, "data", "raw");
const TOPICS_FILE = path.join(ROOT, "data", "indexes", "topics.json");
const VAULT_DIR   = process.env.OBSIDIAN_VAULT_DIR
  ? path.resolve(process.env.OBSIDIAN_VAULT_DIR)
  : path.join(ROOT, "data", "obsidian-vault");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function slugToTitle(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Export wiki topic pages
// ─────────────────────────────────────────────────────────────────────────────

function exportWikiPages(stats) {
  const topicsOutDir = path.join(VAULT_DIR, "Topics");
  ensureDir(topicsOutDir);

  if (!fs.existsSync(WIKI_DIR)) {
    console.log("[obsidian] No wiki directory found. Skipping Topics.");
    return;
  }

  const files = fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const slug = f.replace(".md", "");
    const raw  = fs.readFileSync(path.join(WIKI_DIR, f), "utf8");

    let frontmatter = {};
    let content = raw;
    try {
      const parsed = matter(raw);
      frontmatter = parsed.data;
      content = parsed.content;
    } catch { /* use raw */ }

    // Ensure tags include the topic slug for Obsidian
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    if (!tags.includes(slug)) tags.push(slug);
    if (!tags.includes("wiki")) tags.push("wiki");

    const fm = `---
title: "${frontmatter.title || slugToTitle(slug)}"
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
slug: "${slug}"
source: "knowledge-base"
---

`;

    safeWrite(path.join(topicsOutDir, `${slug}.md`), fm + content);
    stats.topics++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export course files
// ─────────────────────────────────────────────────────────────────────────────

function exportCourses(stats) {
  if (!fs.existsSync(COURSES_DIR)) {
    console.log("[obsidian] No courses directory found. Skipping Courses.");
    return;
  }

  const topicDirs = fs.readdirSync(COURSES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const topicSlug of topicDirs) {
    const topicDir    = path.join(COURSES_DIR, topicSlug);
    const outTopicDir = path.join(VAULT_DIR, "Courses", slugToTitle(topicSlug));
    ensureDir(outTopicDir);

    const courseFiles = fs.readdirSync(topicDir).filter((f) => f.endsWith(".md"));
    for (const f of courseFiles) {
      const raw = fs.readFileSync(path.join(topicDir, f), "utf8");

      let frontmatter = {};
      let content = raw;
      try {
        const parsed = matter(raw);
        frontmatter = parsed.data;
        content = parsed.content;
      } catch { /* use raw */ }

      const title = frontmatter.title || f.replace(".md", "");
      const tags  = [`"course"`, `"${topicSlug}"`];
      const tweetUrl = frontmatter.tweet_url ? `tweet_url: "${frontmatter.tweet_url}"\n` : "";

      const fm = `---
title: "${title.replace(/"/g, "'")}"
tags: [${tags.join(", ")}]
topic: "[[${slugToTitle(topicSlug)}]]"
${tweetUrl}source: "knowledge-base"
---

`;
      // Add backlink to topic wiki page
      const backlink = `\n\n---\n> [[${slugToTitle(topicSlug)}]] — return to topic overview\n`;

      safeWrite(path.join(outTopicDir, f), fm + content + backlink);
      stats.courses++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export source notes
// ─────────────────────────────────────────────────────────────────────────────

function exportSources(stats) {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.log("[obsidian] No sources directory found. Skipping Sources.");
    return;
  }

  const sourcesOutDir = path.join(VAULT_DIR, "Sources");
  ensureDir(sourcesOutDir);

  const jsonFiles = fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith(".json"));
  for (const f of jsonFiles) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(SOURCES_DIR, f), "utf8"));
    } catch { continue; }

    const status = raw.processing_status || "raw";
    // Only export classified or beyond
    if (!["classified", "course_generated", "wiki_summarized"].includes(status)) continue;

    const tweetId    = raw.tweet_id || f.replace(".json", "");
    const title      = raw.title || raw.tweet_text?.slice(0, 80) || tweetId;
    const topicSlug  = raw.topic_slug || "uncategorized";
    const topicTitle = slugToTitle(topicSlug);
    const author     = raw.author_handle || "";
    const tweetUrl   = raw.tweet_url || "";
    const tweetText  = raw.tweet_text || "";

    const content = `---
title: "${title.slice(0, 120).replace(/"/g, "'")}"
tags: ["source", "${topicSlug}"]
topic: "[[${topicTitle}]]"
author: "${author}"
tweet_url: "${tweetUrl}"
status: "${status}"
source: "knowledge-base"
---

# ${title}

**Author:** @${author}
**Topic:** [[${topicTitle}]]
**Tweet URL:** ${tweetUrl}

## Tweet Text

${tweetText}

---
> See related courses in [[Courses/${topicTitle}/]]
`;

    safeWrite(path.join(sourcesOutDir, `${tweetId}.md`), content);
    stats.sources++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Write master Index.md
// ─────────────────────────────────────────────────────────────────────────────

function writeIndex(stats) {
  let topicsIndex = { topics: {} };
  if (fs.existsSync(TOPICS_FILE)) {
    try { topicsIndex = JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8")); } catch { /* ignore */ }
  }

  const topicLines = Object.entries(topicsIndex.topics || {})
    .map(([slug, info]) => `- [[Topics/${slug}|${info.label || slug}]] — ${info.source_count || 0} sources`)
    .join("\n");

  const content = `# KnowledgeBase — Master Index

Exported: ${new Date().toISOString().slice(0, 10)}

## Stats
- Topics: ${stats.topics}
- Courses: ${stats.courses}
- Sources: ${stats.sources}

## Topics

${topicLines || "_No topics yet_"}

## Folders

- [[Topics/]] — Wiki reference pages per topic
- [[Courses/]] — AI-generated courseware organized by topic
- [[Sources/]] — Raw imported sources (tweets, articles, videos)
`;

  safeWrite(path.join(VAULT_DIR, "Index.md"), content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[obsidian] Exporting vault to: ${VAULT_DIR}`);
  ensureDir(VAULT_DIR);

  const stats = { topics: 0, courses: 0, sources: 0 };

  exportWikiPages(stats);
  exportCourses(stats);
  exportSources(stats);
  writeIndex(stats);

  console.log(`[obsidian] Done!`);
  console.log(`[obsidian]   Topics:  ${stats.topics}`);
  console.log(`[obsidian]   Courses: ${stats.courses}`);
  console.log(`[obsidian]   Sources: ${stats.sources}`);
  console.log(`[obsidian] Open ${VAULT_DIR} as a vault in Obsidian.`);
}

main();
