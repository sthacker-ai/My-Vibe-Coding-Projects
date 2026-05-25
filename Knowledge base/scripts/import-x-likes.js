#!/usr/bin/env node

require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = process.cwd();
const DEFAULT_LIMIT = 10;
const SEEN_INDEX_PATH = path.join(ROOT, "data", "indexes", "seen-tweets.json");
const RAW_TWEETS_DIR = path.join(ROOT, "data", "raw", "tweets");
const X_SOURCE_DIR = path.join(ROOT, "content", "sources", "x");
const RUNS_DIR = path.join(ROOT, "data", "runs");

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function asNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (Number.isNaN(number)) {
    throw new Error(`Expected number, received: ${value}`);
  }
  return number;
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

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function yamlString(value) {
  return JSON.stringify(String(value || ""));
}

function yamlArray(values) {
  if (!values || !values.length) return "[]";
  return `\n${values.map((value) => `  - ${yamlString(value)}`).join("\n")}`;
}

function markdownList(values) {
  if (!values || !values.length) return "- None captured";
  return values.map((value) => `- ${value}`).join("\n");
}

function sourceMarkdown(tweet) {
  const titleHandle = tweet.author_handle ? `@${tweet.author_handle}` : "unknown author";
  const imageMarkdown = tweet.image_urls && tweet.image_urls.length
    ? tweet.image_urls.map((url) => `![Tweet image](${url})`).join("\n\n")
    : "No images captured.";

  return `---\nsource_type: "x_tweet"\ntweet_id: ${yamlString(tweet.tweet_id)}\ntweet_url: ${yamlString(tweet.tweet_url)}\nauthor_handle: ${yamlString(tweet.author_handle)}\nauthor_name: ${yamlString(tweet.author_name)}\ntweet_published_at: ${yamlString(tweet.tweet_published_at)}\nscraped_at: ${yamlString(tweet.scraped_at)}\nliked_by: ${yamlString(tweet.liked_by)}\nprocessing_status: "imported"\ntopic_slug: "uncategorized"\ntopic_label: "Uncategorized"\nimage_urls:${yamlArray(tweet.image_urls)}\nvideo_urls:${yamlArray(tweet.video_urls)}\noutbound_urls:${yamlArray(tweet.outbound_urls)}\ntags:\n  - x-like\n  - source\n  - uncategorized\n---\n\n# X Source ${tweet.tweet_id}\n\nOriginal post by ${titleHandle}: ${tweet.tweet_url}\n\n## Tweet Text\n\n${tweet.tweet_text ? `> ${tweet.tweet_text.replace(/\n/g, "\n> ")}` : "No tweet text captured."}\n\n## Author\n\n- Handle: ${tweet.author_handle ? `@${tweet.author_handle}` : "Unknown"}\n- Name: ${tweet.author_name || "Unknown"}\n- Published: ${tweet.tweet_published_at || "Unknown"}\n\n## Links\n\n${markdownList(tweet.outbound_urls)}\n\n## Images\n\n${imageMarkdown}\n\n## Video\n\n${markdownList(tweet.video_urls)}\n\n## Processing\n\n- Status: imported\n- Topic: Uncategorized\n- Next step: extract source material, classify topic, and generate courseware.\n`;
}

function normalizeHandle(value) {
  return String(value || "").trim().replace(/^@/, "");
}

function buildConfig() {
  if (hasArg("--help") || hasArg("-h")) {
    printHelp();
    process.exit(0);
  }

  const limit = asNumber(argValue("--limit", process.env.SCRAPE_DAILY_LIMIT), DEFAULT_LIMIT);
  return {
    login: hasArg("--login"),
    mode: argValue("--mode", "latest"),
    targetHandle: normalizeHandle(argValue("--handle", process.env.SCRAPE_TARGET_HANDLE || "Pond_er_er")),
    limit,
    minDelay: asNumber(process.env.SCRAPE_REQUEST_DELAY_MIN_MS, 1400),
    maxDelay: asNumber(process.env.SCRAPE_REQUEST_DELAY_MAX_MS, 3200),
    maxScrolls: asNumber(process.env.SCRAPE_MAX_SCROLLS, 40),
    idleLimit: asNumber(process.env.SCRAPE_IDLE_SCROLL_LIMIT, 6),
    storagePath: path.resolve(ROOT, process.env.X_STORAGE_STATE_PATH || "./data/private/x-storage-state.json"),
  };
}

function printHelp() {
  console.log(`KnowledgeBase X likes importer

Usage:
  npm run import:x-login
  npm run import:x-likes
  node scripts/import-x-likes.js --limit 10 --mode latest

Options:
  --login          Open a headed browser and save X login state
  --handle HANDLE  X handle to import likes from, default from SCRAPE_TARGET_HANDLE
  --limit N        Maximum new liked tweets to import
  --mode MODE      latest or backfill
  --help           Show this help
`);
}

function loadSeenIndex() {
  const index = readJson(SEEN_INDEX_PATH, { schema_version: 1, tweet_ids: {} });
  if (!index.tweet_ids || typeof index.tweet_ids !== "object") {
    index.tweet_ids = {};
  }
  return index;
}

function saveSeenIndex(index) {
  index.updated_at = new Date().toISOString();
  writeJson(SEEN_INDEX_PATH, index);
}

function markSeen(index, tweet) {
  index.tweet_ids[tweet.tweet_id] = {
    first_seen_at: index.tweet_ids[tweet.tweet_id]?.first_seen_at || tweet.scraped_at,
    tweet_url: tweet.tweet_url,
    status: "imported",
    source_note: `content/sources/x/${tweet.tweet_id}.md`,
    raw_json: `data/raw/tweets/${tweet.tweet_id}.json`,
  };
}

function saveCookieSession(storagePath) {
  const authToken = process.env.X_AUTH_TOKEN;
  const ct0 = process.env.X_CT0;

  if (!authToken || !ct0) {
    throw new Error(
      "X_AUTH_TOKEN and X_CT0 must be set in .env. " +
      "Copy them from browser DevTools > Application > Cookies > https://x.com"
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const expires = now + 60 * 60 * 24 * 30; // 30 days

  const storageState = {
    cookies: [
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        expires,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "ct0",
        value: ct0,
        domain: ".x.com",
        path: "/",
        expires,
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
    ],
    origins: [],
  };

  ensureDir(path.dirname(storagePath));
  writeJson(storagePath, storageState);
  console.log(`[cookies] Saved X session to ${storagePath}`);
}

async function saveLoginSession(storagePath) {
  ensureDir(path.dirname(storagePath));
  console.log("[login] Opening Chromium. Log into X, then return here and press Enter.");

  const browser = await chromium.launch({ headless: false });
  const context = fs.existsSync(storagePath)
    ? await browser.newContext({ storageState: storagePath })
    : await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });

  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", resolve);
  });

  await context.storageState({ path: storagePath });
  await browser.close();
  console.log(`[login] Saved X session to ${storagePath}`);
}

function parseTweetArticles(articles) {
  const unique = new Map();

  const absoluteUrl = (href) => {
    if (!href) return "";
    if (href.startsWith("http://") || href.startsWith("https://")) return href;
    if (href.startsWith("/")) return `https://x.com${href}`;
    return href;
  };

  const parseStatus = (href) => {
    const match = href.match(/\/([^/?#]+)\/status\/(\d+)/);
    if (!match) return null;
    return { handle: match[1], tweetId: match[2] };
  };

  for (const article of articles) {
    const statusAnchors = Array.from(article.querySelectorAll("a[href*='/status/']"));
    const statusAnchor = statusAnchors.find((anchor) => parseStatus(anchor.getAttribute("href") || ""));
    if (!statusAnchor) continue;

    const status = parseStatus(statusAnchor.getAttribute("href") || "");
    if (!status || unique.has(status.tweetId)) continue;

    const timeEl = article.querySelector("time");
    const textEl = article.querySelector("div[data-testid='tweetText']");
    const userBlock = article.querySelector("div[data-testid='User-Name']");
    const userLines = userBlock
      ? userBlock.innerText.split("\n").map((line) => line.trim()).filter(Boolean)
      : [];
    const handleLine = userLines.find((line) => line.startsWith("@"));
    const authorHandle = handleLine ? handleLine.replace(/^@/, "") : status.handle;
    const authorName = userLines.find((line) => !line.startsWith("@") && !line.includes("·")) || "";

    const imageUrls = Array.from(article.querySelectorAll("img"))
      .map((img) => img.getAttribute("src") || "")
      .filter((src) => src.includes("twimg.com/media/"));

    const videoUrls = Array.from(article.querySelectorAll("video"))
      .map((video) => video.currentSrc || video.getAttribute("src") || "")
      .filter(Boolean);

    const urls = Array.from(article.querySelectorAll("a[href]"))
      .map((anchor) => absoluteUrl(anchor.getAttribute("href") || ""))
      .filter(Boolean);

    const tweetUrl = `https://x.com/${status.handle}/status/${status.tweetId}`;
    const outboundUrls = Array.from(new Set(urls.filter((url) => {
      if (url === tweetUrl) return false;
      if (url.includes("/photo/")) return false;
      if (url.match(/x\.com\/[^/]+\/status\/\d+$/)) return false;
      if (url.match(/twitter\.com\/[^/]+\/status\/\d+$/)) return false;
      return true;
    })));

    unique.set(status.tweetId, {
      tweet_id: status.tweetId,
      tweet_url: tweetUrl,
      author_handle: authorHandle,
      author_name: authorName,
      tweet_text: textEl ? textEl.innerText.trim() : "",
      tweet_published_at: timeEl ? timeEl.getAttribute("datetime") || "" : "",
      image_urls: Array.from(new Set(imageUrls)),
      video_urls: Array.from(new Set(videoUrls)),
      outbound_urls: outboundUrls,
      source_type: videoUrls.length ? "x_video" : outboundUrls.length ? "x_linked_source" : "x_tweet",
    });
  }

  return Array.from(unique.values());
}

async function scrapeLikedTweets(config, seenIndex) {
  if (!fs.existsSync(config.storagePath)) {
    throw new Error(
      `Missing X session at ${config.storagePath}. Run "npm run import:x-login" first.`
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: config.storagePath });
  const page = await context.newPage();

  try {
    await page.goto(`https://x.com/${config.targetHandle}/likes`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const loginPrompt =
      (await page.locator('input[autocomplete="username"]').count()) +
      (await page.getByText("Log in", { exact: true }).count());
    if (loginPrompt) {
      throw new Error("X session is not logged in. Run npm run import:x-login again.");
    }

    const collected = [];
    const seenThisRun = new Set();
    let previousVisibleCount = 0;
    let idleScrolls = 0;

    for (let scroll = 0; scroll < config.maxScrolls; scroll += 1) {
      const visibleTweets = await page.$$eval("article[data-testid='tweet']", parseTweetArticles);

      for (const tweet of visibleTweets) {
        if (!tweet.tweet_id) continue;
        if (seenThisRun.has(tweet.tweet_id)) continue;
        seenThisRun.add(tweet.tweet_id);

        if (seenIndex.tweet_ids[tweet.tweet_id]) continue;

        collected.push({
          schema_version: 1,
          ...tweet,
          liked_by: config.targetHandle,
          imported_from: "x_likes",
          topic_slug: "uncategorized",
          topic_label: "Uncategorized",
          processing_status: "imported",
          scraped_at: new Date().toISOString(),
        });

        if (collected.length >= config.limit) break;
      }

      if (collected.length >= config.limit) break;

      if (seenThisRun.size === previousVisibleCount) {
        idleScrolls += 1;
      } else {
        previousVisibleCount = seenThisRun.size;
        idleScrolls = 0;
      }

      if (idleScrolls >= config.idleLimit) break;

      await page.mouse.wheel(0, 2200);
      await sleep(randomDelay(config.minDelay, config.maxDelay));
    }

    return collected;
  } finally {
    await context.close();
    await browser.close();
  }
}

function saveTweet(tweet, seenIndex) {
  ensureDir(RAW_TWEETS_DIR);
  ensureDir(X_SOURCE_DIR);

  const rawPath = path.join(RAW_TWEETS_DIR, `${tweet.tweet_id}.json`);
  const notePath = path.join(X_SOURCE_DIR, `${tweet.tweet_id}.md`);

  writeJson(rawPath, tweet);
  fs.writeFileSync(notePath, sourceMarkdown(tweet), "utf8");
  markSeen(seenIndex, tweet);

  return { rawPath, notePath };
}

function saveRunLog(runLog) {
  ensureDir(RUNS_DIR);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(RUNS_DIR, `${stamp}-x-likes.json`);
  writeJson(filePath, runLog);
  return filePath;
}

async function runImport(config) {
  ensureDir(path.dirname(SEEN_INDEX_PATH));
  const seenIndex = loadSeenIndex();

  console.log(`[import] handle=@${config.targetHandle} limit=${config.limit} mode=${config.mode}`);
  console.log(`[import] seen=${Object.keys(seenIndex.tweet_ids).length}`);

  const tweets = await scrapeLikedTweets(config, seenIndex);
  const saved = [];

  for (const tweet of tweets) {
    saved.push({
      tweet_id: tweet.tweet_id,
      ...saveTweet(tweet, seenIndex),
    });
  }

  saveSeenIndex(seenIndex);
  const runLogPath = saveRunLog({
    schema_version: 1,
    type: "x_likes_import",
    started_at: tweets[0]?.scraped_at || new Date().toISOString(),
    finished_at: new Date().toISOString(),
    target_handle: config.targetHandle,
    mode: config.mode,
    limit: config.limit,
    imported_count: saved.length,
    imported_tweet_ids: saved.map((item) => item.tweet_id),
  });

  console.log(`[import] imported=${saved.length}`);
  console.log(`[import] run_log=${runLogPath}`);
}

async function main() {
  const config = buildConfig();

  if (hasArg("--set-cookies")) {
    saveCookieSession(config.storagePath);
    return;
  }

  if (config.login) {
    await saveLoginSession(config.storagePath);
    return;
  }

  await runImport(config);
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`);
  process.exit(1);
});
