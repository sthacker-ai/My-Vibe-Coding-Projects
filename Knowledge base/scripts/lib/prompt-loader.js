/**
 * scripts/lib/prompt-loader.js
 *
 * Loads AI prompts from data/prompts.json at runtime.
 * Falls back to the hardcoded defaults below if the file is missing or malformed.
 * Used by compile-course.js, update-topic-summary.js, classify-source.js.
 */
"use strict";

const fs   = require("fs");
const path = require("path");

const PROMPTS_PATH = path.join(process.cwd(), "data", "prompts.json");

const DEFAULTS = {
  compile_course_system: "You are a senior educator creating in-depth courseware for a personal knowledge base. Your job is to teach — not to summarize. Every important concept, example, statistic, step, argument, and insight from the source must be preserved and explained clearly. Do NOT condense. Do NOT omit details. Expand where helpful.",
  compile_course_instructions: "Write a structured Markdown course document with the sections below. Use the exact heading format shown.\nRules:\n- Teach comprehensively. Do NOT summarize or condense the source material — extract FULL value from it.\n- Each chapter must have at least 3-5 paragraphs of substantive explanation.\n- Include every example, technique, tool, statistic, quote, or case study from the source.\n- Add context and explanation so a reader who has not seen the source understands completely.\n- For code or technical content: include real code examples.\n- Do NOT add disclaimers or meta-commentary. Just write the course.",
  summarize_topic_system: "You are an expert knowledge curator writing a comprehensive wiki reference page for a personal knowledge base. Your wiki pages are the definitive reference for the topic — thorough, well-organized, and packed with insight. Do NOT produce thin or vague summaries.",
  summarize_topic_instructions: "Write a comprehensive wiki-style Markdown reference page for the given topic.\n\n# [Topic Name]\n## Overview\n## Key Concepts\n## Techniques & Methods\n## Insights & Lessons Learned\n## Cross-References\n## Course Index",
  classify_source_system: "You are a knowledge base classifier. Given content from a saved social media post, identify the most appropriate topic category.",
  classify_source_instructions: "Respond with ONLY a JSON object in this exact format, no other text:\n{\"topic_slug\": \"kebab-case-slug\", \"topic_label\": \"Human Readable Label\"}\n\nChoose specific, meaningful topics like: \"claude-ai\", \"ai-agents\", \"machine-learning\", \"software-engineering\", \"product-management\", \"data-engineering\", \"startup\", \"health-wellness\", \"finance\", \"python\", \"web-development\", etc.\nIf the content is unclear, use \"general-ai\" or \"technology\".",
};

let _cached = null;

function loadPrompts() {
  if (_cached) return _cached;
  try {
    const raw = fs.readFileSync(PROMPTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    // Merge with defaults so missing keys fall back gracefully
    _cached = { ...DEFAULTS, ...parsed };
  } catch {
    _cached = { ...DEFAULTS };
  }
  return _cached;
}

/**
 * Get a single prompt value by key, with fallback to default.
 * @param {string} key - e.g. "compile_course_system"
 * @returns {string}
 */
function getPrompt(key) {
  const prompts = loadPrompts();
  return prompts[key] || DEFAULTS[key] || "";
}

/**
 * Reload prompts from disk (useful if file was updated mid-run).
 */
function reloadPrompts() {
  _cached = null;
  return loadPrompts();
}

module.exports = { loadPrompts, getPrompt, reloadPrompts };
