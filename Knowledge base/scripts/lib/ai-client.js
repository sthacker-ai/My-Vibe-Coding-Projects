#!/usr/bin/env node
"use strict";

/**
 * Unified AI client for KnowledgeBase pipeline scripts.
 *
 * Priority:
 *   1. OpenRouter (model 1 = OPENROUTER_MODEL_PRIMARY)
 *   2. OpenRouter (model 2 = OPENROUTER_MODEL_FALLBACK)
 *   3. Local Ollama (always available as last resort)
 *
 * Usage:
 *   const { aiGenerate } = require("./lib/ai-client");
 *   const text = await aiGenerate(messages, { maxTokens: 4000 });
 *
 * `messages` is an array of OpenAI-style chat messages:
 *   [{ role: "system", content: "..." }, { role: "user", content: "..." }]
 *
 * For legacy Ollama-style single-prompt usage, wrap in:
 *   [{ role: "user", content: prompt }]
 */

require("dotenv").config({ quiet: true });

const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY       = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL      = "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL_PRIMARY  = process.env.OPENROUTER_MODEL_PRIMARY  || "meta-llama/llama-3.3-70b-instruct:free";
const OPENROUTER_MODEL_FALLBACK = process.env.OPENROUTER_MODEL_FALLBACK || "qwen/qwen3-235b-a22b:free";

const NVIDIA_API_KEY   = process.env.NVIDIA_API_KEY   || "";
const NVIDIA_BASE_URL  = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL     = process.env.NVIDIA_MODEL || "mistralai/mistral-large-3-675b-instruct-2512";

const OLLAMA_HOST  = process.env.OLLAMA_HOST  || "localhost";
const OLLAMA_PORT  = parseInt(process.env.OLLAMA_PORT || "11434", 10);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";

// Token usage tracking — appends to data/token-usage.json AND PostgreSQL
const TOKEN_USAGE_FILE = path.join(__dirname, "..", "..", "data", "token-usage.json");

// ── Lazy DB pool (optional — skipped if DATABASE_URL not set) ────────────────
let _dbPool = null;
function getDbPool() {
  if (_dbPool) return _dbPool;
  const url = (process.env.DATABASE_URL || "").trim();
  if (!url) return null;
  try {
    const { Pool } = require("pg");
    _dbPool = new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 20_000 });
    _dbPool.on("error", () => { _dbPool = null; }); // reset on fatal error
    return _dbPool;
  } catch { return null; }
}

async function insertTokenUsageDB(entry) {
  const pool = getDbPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO token_usage (ts, label, model, provider, prompt_tokens, completion_tokens, total_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ts, label) DO NOTHING`,
      [entry.ts, entry.label, entry.model, entry.provider,
       entry.prompt_tokens, entry.completion_tokens, entry.total_tokens]
    );
  } catch { /* never crash — DB is best-effort */ }
}

function recordTokenUsage(label, model, provider, usage) {
  if (!usage) return;
  try {
    const entry = {
      ts:                new Date().toISOString(),
      label,
      model,
      provider,
      prompt_tokens:     usage.prompt_tokens     || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens:      usage.total_tokens      || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
    };
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(TOKEN_USAGE_FILE, "utf8")); } catch { /* new file */ }
    existing.push(entry);
    fs.mkdirSync(path.dirname(TOKEN_USAGE_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_USAGE_FILE, JSON.stringify(existing, null, 2), "utf8");
    // Also write to PostgreSQL (fire-and-forget — never blocks the pipeline)
    insertTokenUsageDB(entry).catch(() => {});
  } catch { /* never crash on usage tracking */ }
}

// ---------------------------------------------------------------------------
// Internal: OpenRouter chat completions
// ---------------------------------------------------------------------------

function openRouterChat(model, messages, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens || 4096,
      temperature: 0.4,
    });

    const options = {
      hostname: "openrouter.ai",
      path:     "/api/v1/chat/completions",
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization":  `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer":   "https://github.com/sthacker-ai",
        "X-Title":        "KnowledgeBase Pipeline",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`OpenRouter error [${model}]: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            return;
          }
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error(`OpenRouter returned no content [${model}]. Response: ${data.slice(0, 300)}`));
            return;
          }
          resolve({ content: content.trim(), usage: parsed.usage || null });
        } catch (e) {
          reject(new Error(`OpenRouter parse error [${model}]: ${e.message}. Raw: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`OpenRouter network error [${model}]: ${e.message}`)));
    req.setTimeout(180000, () => {
      req.destroy();
      reject(new Error(`OpenRouter timeout [${model}] after 3 min`));
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Internal: NVIDIA NIM chat completions (OpenAI-compatible)
// ---------------------------------------------------------------------------

function nvidiaChat(model, messages, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens || 4096,
      temperature: 0.4,
    });

    const url = new URL(`${NVIDIA_BASE_URL}/chat/completions`);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Authorization":  `Bearer ${NVIDIA_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`NVIDIA NIM error [${model}]: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            return;
          }
          const content = parsed.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error(`NVIDIA NIM returned no content [${model}]. Response: ${data.slice(0, 300)}`));
            return;
          }
          resolve({ content: content.trim(), usage: parsed.usage || null });
        } catch (e) {
          reject(new Error(`NVIDIA NIM parse error [${model}]: ${e.message}. Raw: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`NVIDIA NIM network error [${model}]: ${e.message}`)));
    req.setTimeout(180000, () => {
      req.destroy();
      reject(new Error(`NVIDIA NIM timeout [${model}] after 3 min`));
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Internal: Ollama generate (legacy /api/generate endpoint)
// ---------------------------------------------------------------------------

function ollamaGenerate(messages) {
  // Convert messages array to a single prompt string for Ollama
  const prompt = messages
    .map((m) => {
      if (m.role === "system") return `[System]\n${m.content}`;
      if (m.role === "user")   return `[User]\n${m.content}`;
      return m.content;
    })
    .join("\n\n");

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false });
    const options = {
      hostname: OLLAMA_HOST,
      port:     OLLAMA_PORT,
      path:     "/api/generate",
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || "");
        } catch (e) {
          reject(new Error(`Ollama parse error: ${e.message}`));
        }
      });
    });
    req.on("error", (e) => reject(new Error(`Ollama network error: ${e.message}`)));
    req.setTimeout(600000, () => {
      req.destroy();
      reject(new Error("Ollama timeout after 10 min"));
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Circuit breakers — once a provider rate-limits, skip it for the whole run
// ---------------------------------------------------------------------------

let _openRouterDead = false; // set true after first 429 / rate-limit from OpenRouter
let _nvidiaDead     = false; // set true after first 429 / rate-limit from NVIDIA NIM

function isRateLimitError(err) {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("429") ||
         msg.includes("free-models-per-day") || msg.includes("quota");
}

// ---------------------------------------------------------------------------
// Public: aiGenerate — tries OpenRouter (2 models) then NVIDIA NIM then Ollama

/**
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ maxTokens?: number, label?: string }} [opts]
 * @returns {Promise<string>}
 */
async function aiGenerate(messages, opts = {}) {
  const maxTokens = opts.maxTokens || 4096;
  const label     = opts.label || "ai";

  // ── OpenRouter (skipped if dead for this run) ─────────────────────────────
  if (OPENROUTER_API_KEY && !_openRouterDead) {
    // Try primary
    try {
      console.log(`  [${label}] Trying OpenRouter primary: ${OPENROUTER_MODEL_PRIMARY}`);
      const { content: result, usage } = await openRouterChat(OPENROUTER_MODEL_PRIMARY, messages, maxTokens);
      if (result && result.length > 50) {
        console.log(`  [${label}] OpenRouter primary OK (${result.length} chars)`);
        recordTokenUsage(label, OPENROUTER_MODEL_PRIMARY, "OpenRouter", usage);
        return result;
      }
      throw new Error("Response too short");
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`  [${label}] OpenRouter rate-limited — skipping for rest of this run`);
        _openRouterDead = true;
      } else {
        console.warn(`  [${label}] Primary failed: ${err.message}`);
        // Try fallback only if primary failed for a non-rate-limit reason
        try {
          console.log(`  [${label}] Trying OpenRouter fallback: ${OPENROUTER_MODEL_FALLBACK}`);
          const { content: result, usage } = await openRouterChat(OPENROUTER_MODEL_FALLBACK, messages, maxTokens);
          if (result && result.length > 50) {
            console.log(`  [${label}] OpenRouter fallback OK (${result.length} chars)`);
            recordTokenUsage(label, OPENROUTER_MODEL_FALLBACK, "OpenRouter", usage);
            return result;
          }
          throw new Error("Response too short");
        } catch (fallbackErr) {
          if (isRateLimitError(fallbackErr)) {
            console.warn(`  [${label}] OpenRouter fallback rate-limited — skipping for rest of this run`);
            _openRouterDead = true;
          } else {
            console.warn(`  [${label}] Fallback failed: ${fallbackErr.message}`);
          }
        }
      }
    }
  } else if (_openRouterDead) {
    console.log(`  [${label}] OpenRouter dead (rate-limited) — skipping directly to NVIDIA NIM`);
  }

  // ── NVIDIA NIM (skipped if dead for this run) ─────────────────────────────
  if (NVIDIA_API_KEY && !_nvidiaDead) {
    try {
      console.log(`  [${label}] Trying NVIDIA NIM: ${NVIDIA_MODEL}`);
      const { content: result, usage } = await nvidiaChat(NVIDIA_MODEL, messages, maxTokens);
      if (result && result.length > 50) {
        console.log(`  [${label}] NVIDIA NIM OK (${result.length} chars)`);
        recordTokenUsage(label, NVIDIA_MODEL, "NVIDIA-NIM", usage);
        return result;
      }
      throw new Error("Response too short");
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn(`  [${label}] NVIDIA NIM rate-limited — skipping for rest of this run`);
        _nvidiaDead = true;
      } else {
        console.warn(`  [${label}] NVIDIA NIM failed: ${err.message}`);
      }
    }
  } else if (_nvidiaDead) {
    console.log(`  [${label}] NVIDIA NIM dead (rate-limited) — going to Ollama`);
  }

  // ── Ollama (last resort, always available) ────────────────────────────────
  console.log(`  [${label}] Using Ollama (${OLLAMA_MODEL})`);
  return ollamaGenerate(messages);
}

/**
 * Returns a string describing the currently configured AI provider chain.
 */
function aiProviderInfo() {
  const orChain = OPENROUTER_API_KEY ? `OpenRouter (${OPENROUTER_MODEL_PRIMARY} → ${OPENROUTER_MODEL_FALLBACK})` : null;
  const nvidia  = NVIDIA_API_KEY     ? `NVIDIA NIM (${NVIDIA_MODEL})` : null;
  const parts   = [orChain, nvidia, `Ollama (${OLLAMA_MODEL})`].filter(Boolean);
  return parts.join(" → ");
}

module.exports = { aiGenerate, aiProviderInfo };
