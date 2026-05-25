#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = process.cwd();
const RAW_TWEETS_DIR = path.join(ROOT, "data", "raw", "tweets");
const X_SOURCE_DIR = path.join(ROOT, "content", "sources", "x");
const RUNS_DIR = path.join(ROOT, "data", "runs");

// ---------------------------------------------------------------------------
// Utility helpers — same pattern as import-x-likes.js
// ---------------------------------------------------------------------------

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`Expected number, received: ${value}`);
  return n;
}

function randomDelay(minMs, maxMs) {
  const min = Math.max(0, minMs);
  const max = Math.max(min, maxMs);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[warn] Failed to read JSON at ${filePath}: ${error.message}`);
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

// eslint-disable-next-line no-unused-vars
function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function buildConfig() {
  const limitRaw = argValue("--limit");
  return {
    tweetId: argValue("--tweet-id"),
    limit: limitRaw !== null ? asNumber(limitRaw, null) : null,
    minDelay: asNumber(process.env.SCRAPE_REQUEST_DELAY_MIN_MS, 1400),
    maxDelay: asNumber(process.env.SCRAPE_REQUEST_DELAY_MAX_MS, 3200),
    storagePath: path.resolve(
      ROOT,
      process.env.X_STORAGE_STATE_PATH || "./data/private/x-storage-state.json"
    ),
  };
}

// ---------------------------------------------------------------------------
// Source-type detection
// ---------------------------------------------------------------------------

function isXUrl(url) {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)/i.test(url);
}

function isYouTubeUrl(url) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i.test(url);
}

/**
 * Returns one of: plain_tweet | x_video | youtube | x_article | external_article
 */
function detectExtractionType(tweet) {
  const sourceType = tweet.source_type || "";
  const tweetText = (tweet.tweet_text || "").trim();
  const outboundUrls = tweet.outbound_urls || [];

  // x_video: check whether it's a YouTube link or X-hosted
  if (sourceType === "x_video") {
    return outboundUrls.find(isYouTubeUrl) ? "youtube" : "x_video";
  }

  // Long-form / image-only tweet with no text — needs auth to read the page
  if (!tweetText) {
    return "x_article";
  }

  // Tweet text exists but links to an external (non-X) page
  const externalUrl = outboundUrls.find((u) => !isXUrl(u));
  if (externalUrl) {
    return "external_article";
  }

  // Plain text tweet, nothing external to scrape
  return "plain_tweet";
}

// ---------------------------------------------------------------------------
// Playwright extraction: external article
// ---------------------------------------------------------------------------

async function extractExternalArticle(url, browser) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);

    const result = await page.evaluate(() => {
      const pageTitle =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.title ||
        "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.content ||
        document.querySelector('meta[property="og:description"]')?.content ||
        "";

      // Walk through common article containers, fall back to body
      const selectors = [
        "article",
        "main",
        ".post-content",
        ".article-content",
        ".entry-content",
        ".content",
        "#content",
        "#main",
      ];
      let textEl = null;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { textEl = el; break; }
      }
      if (!textEl) textEl = document.body;

      const textContent = textEl ? textEl.innerText.trim() : "";

      const codeBlocks = Array.from(
        document.querySelectorAll("pre code, pre, code")
      )
        .map((el) => el.textContent.trim())
        .filter((t) => t.length > 20)
        .slice(0, 10);

      return { pageTitle, metaDescription, textContent, codeBlocks };
    });

    return {
      page_title: result.pageTitle,
      page_url: page.url(),
      text_content: result.textContent,
      code_blocks: result.codeBlocks,
      meta_description: result.metaDescription,
      error: null,
    };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Playwright extraction: YouTube
// ---------------------------------------------------------------------------

async function extractYouTube(url, browser) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000);

    const result = await page.evaluate(() => {
      const pageTitle =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector("h1.ytd-video-primary-info-renderer")?.textContent?.trim() ||
        document.title ||
        "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.content || "";

      // Try to read expanded description
      const descEl = document.querySelector(
        "#description-text, #description .content, ytd-text-inline-expander #content"
      );
      const textContent = descEl
        ? descEl.textContent.trim()
        : metaDescription;

      return { pageTitle, metaDescription, textContent };
    });

    return {
      page_title: result.pageTitle,
      page_url: page.url(),
      text_content: result.textContent,
      code_blocks: [],
      meta_description: result.metaDescription,
      error: null,
    };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Playwright extraction: X article / tweet page (auth required)
// ---------------------------------------------------------------------------

async function extractXArticle(tweetUrl, storagePath, browser) {
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Missing X session at ${storagePath}. Run "npm run import:x-login" first.`
    );
  }

  const context = await browser.newContext({ storageState: storagePath });
  const page = await context.newPage();
  try {
    await page.goto(tweetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(3000);

    // Fail fast if X is showing a login wall
    const loginCount =
      (await page.locator('input[autocomplete="username"]').count()) +
      (await page.getByText("Log in", { exact: true }).count());
    if (loginCount > 0) {
      throw new Error(
        "X session has expired or is not authenticated. Run npm run import:x-login."
      );
    }

    // Wait for tweet content to appear
    try {
      await page.waitForSelector('[data-testid="tweetText"], article', {
        timeout: 10000,
      });
    } catch (_) {
      // Continue — page may still have usable content
    }

    const result = await page.evaluate(() => {
      const pageTitle = document.title || "";
      const metaDescription =
        document.querySelector('meta[name="description"]')?.content ||
        document.querySelector('meta[property="og:description"]')?.content ||
        "";

      const tweetTextEls = Array.from(
        document.querySelectorAll('[data-testid="tweetText"]')
      )
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      const articleEls = Array.from(document.querySelectorAll("article"))
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      const textContent = tweetTextEls.length
        ? tweetTextEls.join("\n\n")
        : articleEls.join("\n\n");

      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4")
      )
        .map((el) => el.innerText.trim())
        .filter(Boolean);

      const codeBlocks = Array.from(
        document.querySelectorAll("pre code, code")
      )
        .map((el) => el.textContent.trim())
        .filter((t) => t.length > 20)
        .slice(0, 10);

      return { pageTitle, metaDescription, textContent, headings, codeBlocks };
    });

    const fullText =
      result.headings.length && !result.textContent.includes(result.headings[0])
        ? `${result.textContent}\n\n### Headings\n${result.headings.join("\n")}`
        : result.textContent;

    return {
      page_title: result.pageTitle,
      page_url: page.url(),
      text_content: fullText,
      code_blocks: result.codeBlocks,
      meta_description: result.metaDescription,
      error: null,
    };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Markdown update helpers
// ---------------------------------------------------------------------------

function updateMarkdownStatus(mdPath, newStatus) {
  if (!fs.existsSync(mdPath)) return;
  let content = fs.readFileSync(mdPath, "utf8");
  content = content.replace(
    /^(processing_status:\s*)"[^"]*"/m,
    `$1"${newStatus}"`
  );
  fs.writeFileSync(mdPath, content, "utf8");
}

function appendExtractedSection(mdPath, extractedText) {
  if (!fs.existsSync(mdPath)) return;
  const text = extractedText || "";
  const snippet =
    text.length > 2000
      ? `${text.slice(0, 2000)}\n\n_(truncated — full content saved in -extracted.json)_`
      : text;
  fs.appendFileSync(mdPath, `\n\n## Extracted Content\n\n${snippet}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// Per-tweet processing
// ---------------------------------------------------------------------------

async function processTweet(tweet, config, browser) {
  const tweetId = tweet.tweet_id;
  const tweetUrl = tweet.tweet_url;
  const extractionType = detectExtractionType(tweet);
  const rawPath = path.join(RAW_TWEETS_DIR, `${tweetId}.json`);
  const extractedPath = path.join(RAW_TWEETS_DIR, `${tweetId}-extracted.json`);
  const mdPath = path.join(X_SOURCE_DIR, `${tweetId}.md`);

  const baseExtracted = {
    tweet_id: tweetId,
    extraction_type: extractionType,
    extracted_at: new Date().toISOString(),
    page_title: "",
    page_url: tweetUrl,
    text_content: "",
    code_blocks: [],
    meta_description: "",
    error: null,
  };

  try {
    let extracted = { ...baseExtracted };

    if (extractionType === "plain_tweet") {
      extracted.page_title = `Tweet by @${tweet.author_handle || "unknown"}`;
      extracted.text_content = tweet.tweet_text || "";
    } else if (extractionType === "x_video") {
      extracted.page_title = `Video tweet by @${tweet.author_handle || "unknown"}`;
      extracted.text_content = tweet.tweet_text || "";
      // Record video metadata in text
      if (tweet.video_urls && tweet.video_urls.length) {
        extracted.text_content +=
          (extracted.text_content ? "\n\n" : "") +
          `Video URLs:\n${tweet.video_urls.join("\n")}`;
      }
    } else if (extractionType === "youtube") {
      const ytUrl = (tweet.outbound_urls || []).find(isYouTubeUrl);
      console.log(`[extract] tweet_id=${tweetId} type=youtube url=${ytUrl}`);
      const result = await extractYouTube(ytUrl, browser);
      extracted = { ...extracted, ...result };
    } else if (extractionType === "external_article") {
      const extUrl = (tweet.outbound_urls || []).find((u) => !isXUrl(u));
      console.log(
        `[extract] tweet_id=${tweetId} type=external_article url=${extUrl}`
      );
      const result = await extractExternalArticle(extUrl, browser);
      extracted = { ...extracted, ...result };
    } else if (extractionType === "x_article") {
      console.log(
        `[extract] tweet_id=${tweetId} type=x_article url=${tweetUrl}`
      );
      const result = await extractXArticle(tweetUrl, config.storagePath, browser);
      extracted = { ...extracted, ...result };
    }

    // Persist extracted JSON
    writeJson(extractedPath, extracted);

    // Update raw JSON status
    tweet.processing_status = "extracted";
    writeJson(rawPath, tweet);

    // Update Markdown source note
    updateMarkdownStatus(mdPath, "extracted");
    appendExtractedSection(mdPath, extracted.text_content);

    console.log(
      `[extract] tweet_id=${tweetId} type=${extractionType} status=ok`
    );
    return { tweet_id: tweetId, extraction_type: extractionType, status: "ok" };
  } catch (error) {
    console.error(
      `[extract] tweet_id=${tweetId} type=${extractionType} status=error error=${error.message}`
    );

    const failedExtracted = {
      ...baseExtracted,
      extraction_type: extractionType,
      error: error.message,
    };
    writeJson(extractedPath, failedExtracted);

    tweet.processing_status = "extraction_failed";
    writeJson(rawPath, tweet);
    updateMarkdownStatus(mdPath, "extraction_failed");

    return {
      tweet_id: tweetId,
      extraction_type: extractionType,
      status: "error",
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = buildConfig();

  // Load all raw tweet JSONs (skip -extracted.json files)
  const rawFiles = fs
    .readdirSync(RAW_TWEETS_DIR)
    .filter(
      (f) =>
        f.endsWith(".json") &&
        !f.includes("-extracted") &&
        f !== ".gitkeep"
    );

  let pending = rawFiles
    .map((f) => readJson(path.join(RAW_TWEETS_DIR, f), null))
    .filter((t) => t && t.processing_status === "imported");

  // --tweet-id filter
  if (config.tweetId) {
    pending = pending.filter((t) => t.tweet_id === config.tweetId);
    if (pending.length === 0) {
      console.log(
        `[extract] No tweet with id=${config.tweetId} and status=imported found.`
      );
      process.exit(0);
    }
  }

  // --limit
  if (config.limit !== null) {
    pending = pending.slice(0, config.limit);
  }

  console.log(
    `[extract] pending=${pending.length} limit=${config.limit !== null ? config.limit : "all"}`
  );

  if (pending.length === 0) {
    console.log("[extract] Nothing to process.");
    process.exit(0);
  }

  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (let i = 0; i < pending.length; i++) {
      if (i > 0) {
        const delay = randomDelay(config.minDelay, config.maxDelay);
        await sleep(delay);
      }
      const result = await processTweet(pending[i], config, browser);
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  // Save run log
  ensureDir(RUNS_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runLogPath = path.join(RUNS_DIR, `${stamp}-extraction.json`);
  writeJson(runLogPath, {
    schema_version: 1,
    type: "x_source_extraction",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    processed_count: results.length,
    ok_count: results.filter((r) => r.status === "ok").length,
    error_count: results.filter((r) => r.status === "error").length,
    results,
  });

  const okCount = results.filter((r) => r.status === "ok").length;
  const errCount = results.filter((r) => r.status === "error").length;
  console.log(
    `[extract] done ok=${okCount} errors=${errCount} run_log=${runLogPath}`
  );
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exit(1);
});
