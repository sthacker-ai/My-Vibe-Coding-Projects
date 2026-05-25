#!/usr/bin/env node
"use strict";

const fs   = require("fs");
const path = require("path");
const matter = require("gray-matter");

require("dotenv").config({ quiet: true });

const ROOT         = process.cwd();
const X_SOURCE_DIR = path.join(ROOT, "content", "sources", "x");
const COURSES_DIR  = path.join(ROOT, "content", "courses");
const TOPICS_FILE  = path.join(ROOT, "data", "indexes", "topics.json");
const GRAPH_FILE   = path.join(ROOT, "data", "indexes", "graph.json");
const RUNS_DIR     = path.join(ROOT, "data", "runs");

// ---------------------------------------------------------------------------
// Wikilink parser — matches [[Some Link]] or [[some-link|Display]]
// ---------------------------------------------------------------------------

function extractWikilinks(text) {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

function labelToSlug(label) {
  return label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ---------------------------------------------------------------------------
// Node factories
// ---------------------------------------------------------------------------

function makeTopicNode(slug, label, sourceCount) {
  return {
    id:    `topic:${slug}`,
    type:  "topic",
    slug,
    label,
    source_count: sourceCount || 0,
  };
}

function makeSourceNode(tweetId, title, authorHandle, topicSlug, processingStatus) {
  return {
    id:                `source:${tweetId}`,
    type:              "source",
    tweet_id:          tweetId,
    title,
    author_handle:     authorHandle,
    topic_slug:        topicSlug,
    processing_status: processingStatus,
  };
}

function makeCourseNode(tweetId, topicSlug, courseFile) {
  return {
    id:         `course:${tweetId}`,
    type:       "course",
    tweet_id:   tweetId,
    topic_slug: topicSlug,
    file:       courseFile,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

  const nodes = {};   // id => node
  const edges = [];   // { source, target, type }

  // ---- 1. Load topics index → create topic nodes -------------------------

  let topicsIndex = { topics: {} };
  if (fs.existsSync(TOPICS_FILE)) {
    try {
      topicsIndex = JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"));
    } catch {
      console.warn("[graph] WARNING: Could not parse topics.json");
    }
  }

  for (const [slug, info] of Object.entries(topicsIndex.topics || {})) {
    const node = makeTopicNode(slug, info.label || slug, info.source_count || 0);
    nodes[node.id] = node;
  }

  // ---- 2. Process source notes (x/) --------------------------------------

  if (fs.existsSync(X_SOURCE_DIR)) {
    const mdFiles = fs.readdirSync(X_SOURCE_DIR).filter((f) => f.endsWith(".md"));

    for (const f of mdFiles) {
      const rawContent = fs.readFileSync(path.join(X_SOURCE_DIR, f), "utf8");
      let parsed;
      try {
        parsed = matter(rawContent);
      } catch {
        console.warn(`[graph] Could not parse frontmatter: ${f}`);
        continue;
      }

      const tweetId    = parsed.data.tweet_id   || path.basename(f, ".md");
      const title      = parsed.data.title       || parsed.data.tweet_text || f;
      const authorHandle = parsed.data.author_handle || "";
      const topicSlug  = parsed.data.topic_slug  || "uncategorized";
      const status     = parsed.data.processing_status || "unknown";
      const tags       = Array.isArray(parsed.data.tags) ? parsed.data.tags : [];

      // Source node
      const sourceNode = makeSourceNode(tweetId, title, authorHandle, topicSlug, status);
      nodes[sourceNode.id] = sourceNode;

      // Skip uncategorized — no wiki page exists for it, would cause 404 on graph click
      if (topicSlug === "uncategorized") continue;

      // Edge: source -> topic
      const topicNodeId = `topic:${topicSlug}`;
      if (!nodes[topicNodeId]) {
        nodes[topicNodeId] = makeTopicNode(topicSlug, topicSlug, 0);
      }
      edges.push({ source: sourceNode.id, target: topicNodeId, type: "belongs_to" });

      // Edges from tags (excluding common noise tags)
      const noiseTags = new Set(["x-like", "source", "uncategorized", topicSlug]);
      for (const tag of tags) {
        if (noiseTags.has(tag)) continue;
        const tagNodeId = `topic:${tag}`;
        if (!nodes[tagNodeId]) {
          nodes[tagNodeId] = makeTopicNode(tag, tag, 0);
        }
        edges.push({ source: sourceNode.id, target: tagNodeId, type: "tagged" });
      }

      // Wikilinks in the source note body
      const wikilinks = extractWikilinks(parsed.content);
      for (const link of wikilinks) {
        const slug2 = labelToSlug(link);
        const linkedNodeId = `topic:${slug2}`;
        if (!nodes[linkedNodeId]) {
          nodes[linkedNodeId] = makeTopicNode(slug2, link, 0);
        }
        edges.push({ source: sourceNode.id, target: linkedNodeId, type: "wikilink" });
      }
    }
  }

  // ---- 3. Process courses -------------------------------------------------

  if (fs.existsSync(COURSES_DIR)) {
    const topicFolders = fs.readdirSync(COURSES_DIR).filter((name) => {
      return fs.statSync(path.join(COURSES_DIR, name)).isDirectory();
    });

    for (const topicSlug of topicFolders) {
      const topicDir = path.join(COURSES_DIR, topicSlug);
      const courseFiles = fs.readdirSync(topicDir).filter((f) =>
        f.match(/^course-\d{3}\.md$/)
      );

      for (const cf of courseFiles) {
        const rawContent = fs.readFileSync(path.join(topicDir, cf), "utf8");
        let parsed;
        try {
          parsed = matter(rawContent);
        } catch {
          console.warn(`[graph] Could not parse course frontmatter: ${topicSlug}/${cf}`);
          continue;
        }

        const tweetId = parsed.data.tweet_id;
        if (!tweetId) continue;

        const courseNode = makeCourseNode(tweetId, topicSlug, `content/courses/${topicSlug}/${cf}`);
        nodes[courseNode.id] = courseNode;

        // Edge: course -> topic
        const topicNodeId = `topic:${topicSlug}`;
        edges.push({ source: courseNode.id, target: topicNodeId, type: "belongs_to" });

        // Edge: source -> course
        const sourceNodeId = `source:${tweetId}`;
        edges.push({ source: sourceNodeId, target: courseNode.id, type: "has_course" });

        // Wikilinks from course body
        const wikilinks = extractWikilinks(parsed.content);
        for (const link of wikilinks) {
          const slug2 = labelToSlug(link);
          const linkedNodeId = `topic:${slug2}`;
          if (!nodes[linkedNodeId]) {
            nodes[linkedNodeId] = makeTopicNode(slug2, link, 0);
          }
          edges.push({ source: courseNode.id, target: linkedNodeId, type: "wikilink" });
        }
      }

      // Summary wikilinks
      const summaryPath = path.join(topicDir, "summary.md");
      if (fs.existsSync(summaryPath)) {
        const rawContent = fs.readFileSync(summaryPath, "utf8");
        let parsed;
        try { parsed = matter(rawContent); } catch { continue; }

        const wikilinks = extractWikilinks(parsed.content);
        for (const link of wikilinks) {
          const slug2 = labelToSlug(link);
          const linkedNodeId = `topic:${slug2}`;
          const srcId = `topic:${topicSlug}`;
          if (!nodes[linkedNodeId]) {
            nodes[linkedNodeId] = makeTopicNode(slug2, link, 0);
          }
          if (linkedNodeId !== srcId) {
            edges.push({ source: srcId, target: linkedNodeId, type: "related_topic" });
          }
        }
      }
    }
  }

  // ---- 4. De-duplicate edges ---------------------------------------------

  const edgeSet = new Set();
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.source}|${e.target}|${e.type}`;
    if (edgeSet.has(key)) return false;
    edgeSet.add(key);
    return true;
  });

  // ---- 5. Write graph.json ------------------------------------------------

  const graph = {
    schema_version: 1,
    built_at:       new Date().toISOString(),
    node_count:     Object.keys(nodes).length,
    edge_count:     dedupedEdges.length,
    nodes:          Object.values(nodes),
    edges:          dedupedEdges,
  };

  fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2), "utf8");

  console.log(`[graph] Built graph: ${graph.node_count} nodes, ${graph.edge_count} edges`);
  console.log(`[graph] Saved to ${GRAPH_FILE}`);

  // ---- 6. Run log ---------------------------------------------------------
  const ts      = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(RUNS_DIR, `${ts}-graph.json`);
  fs.writeFileSync(logPath, JSON.stringify({ built_at: graph.built_at, node_count: graph.node_count, edge_count: graph.edge_count }, null, 2), "utf8");
}

main();
