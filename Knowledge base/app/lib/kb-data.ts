import fs from "fs";
import path from "path";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KbStats {
  totalSources: number;
  coursesGenerated: number;
  wikiPages: number;
  topicsCount: number;
  statusBreakdown: Record<string, number>;
  contentTypeBreakdown: Record<string, number>; // x_video, plain_tweet, x_article, youtube
  wordsProcessed: number;
}

export interface KbSource {
  id: string;
  title: string;
  author: string;
  type: string;
  status: string;
  topic?: string;
  url?: string;
}

export interface KbTopic {
  slug: string;
  label: string;
  source_count: number;
}

export interface KbRunEntry {
  label: string;
  ts: string;
}

export interface KbPipelineStep {
  step: string;
  meta: string;
  status: "done" | "next" | "queued";
  n: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function countCourses(): number {
  const coursesDir = path.join(ROOT, "content", "courses");
  if (!fs.existsSync(coursesDir)) return 0;
  let count = 0;
  try {
    const topicFolders = fs.readdirSync(coursesDir);
    for (const folder of topicFolders) {
      const topicDir = path.join(coursesDir, folder);
      if (!fs.statSync(topicDir).isDirectory()) continue;
      const courses = fs.readdirSync(topicDir).filter((f) =>
        /^course-\d{3}\.md$/.test(f)
      );
      count += courses.length;
    }
  } catch {
    // ignore
  }
  return count;
}

function countWikiPages(): number {
  // Summaries + any content/wiki/ pages
  let count = 0;
  const coursesDir = path.join(ROOT, "content", "courses");
  if (fs.existsSync(coursesDir)) {
    try {
      const topicFolders = fs.readdirSync(coursesDir);
      for (const folder of topicFolders) {
        const summaryPath = path.join(coursesDir, folder, "summary.md");
        if (fs.existsSync(summaryPath)) count++;
      }
    } catch {
      // ignore
    }
  }
  const wikiDir = path.join(ROOT, "content", "wiki");
  if (fs.existsSync(wikiDir)) {
    try {
      count += fs.readdirSync(wikiDir).filter((f) => f.endsWith(".md")).length;
    } catch {
      // ignore
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getKbStats(): KbStats {
  const rawDir = path.join(ROOT, "data", "raw", "tweets");
  const statusBreakdown: Record<string, number> = {};
  const contentTypeBreakdown: Record<string, number> = {};
  let totalSources = 0;

  if (fs.existsSync(rawDir)) {
    const files = fs.readdirSync(rawDir).filter(
      (f) => f.endsWith(".json") && !f.includes("-extracted") && f !== ".gitkeep"
    );
    for (const f of files) {
      totalSources++;
      try {
        const json = safeReadJson<{ processing_status?: string; extraction_type?: string }>(
          path.join(rawDir, f),
          {}
        );
        const status = json.processing_status || "imported";
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        const ctype = json.extraction_type || "plain_tweet";
        contentTypeBreakdown[ctype] = (contentTypeBreakdown[ctype] || 0) + 1;
      } catch {
        // ignore
      }
    }
  }

  const topicsIndex = safeReadJson<{ topics?: Record<string, unknown> }>(
    path.join(ROOT, "data", "indexes", "topics.json"),
    { topics: {} }
  );

  // Count total words across all course files
  let wordsProcessed = 0;
  const coursesDir = path.join(ROOT, "content", "courses");
  if (fs.existsSync(coursesDir)) {
    const topicDirs = fs.readdirSync(coursesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const topic of topicDirs) {
      const topicDir = path.join(coursesDir, topic);
      const mdFiles = fs.readdirSync(topicDir).filter((f) => f.endsWith(".md") && f !== "summary.md");
      for (const mf of mdFiles) {
        try {
          const text = fs.readFileSync(path.join(topicDir, mf), "utf8");
          wordsProcessed += text.split(/\s+/).filter(Boolean).length;
        } catch { /* ignore */ }
      }
    }
  }

  return {
    totalSources,
    coursesGenerated: countCourses(),
    wikiPages: countWikiPages(),
    topicsCount: Object.keys(topicsIndex.topics || {}).length,
    statusBreakdown,
    contentTypeBreakdown,
    wordsProcessed,
  };
}

// ---------------------------------------------------------------------------
// Sources table — read from content/sources/x/ with simple frontmatter parse
// ---------------------------------------------------------------------------

function simpleParseFrontmatter(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return result;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") break;
    const m = lines[i].match(/^(\w[\w_-]*):\s*(.+)$/);
    if (m) {
      result[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  return result;
}

function extractionTypeToLabel(t: string): string {
  if (t === "x_article")  return "Article";
  if (t === "x_video")    return "Video";
  if (t === "plain_tweet") return "Tweet";
  if (t === "link")       return "Link";
  return t || "Tweet";
}

export function getKbSources(limit = 10): { sources: KbSource[]; total: number } {
  const sourceDir = path.join(ROOT, "content", "sources", "x");
  const rawDir    = path.join(ROOT, "data", "raw", "tweets");

  if (!fs.existsSync(sourceDir)) return { sources: [], total: 0 };

  const mdFiles = fs.readdirSync(sourceDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // most recent first (numeric IDs are time-ordered)

  const total = mdFiles.length;
  const sliced = mdFiles.slice(0, limit);

  const sources: KbSource[] = sliced.map((f) => {
    const rawMd = fs.readFileSync(path.join(sourceDir, f), "utf8");
    const fm = simpleParseFrontmatter(rawMd);
    const tweetId = path.basename(f, ".md");

    // Also read extracted JSON for type info, and raw JSON for tweet_text
    const extractedPath = path.join(rawDir, `${tweetId}-extracted.json`);
    const rawJsonPath   = path.join(rawDir, `${tweetId}.json`);
    let extractionType = "";
    if (fs.existsSync(extractedPath)) {
      const ext = safeReadJson<{ extraction_type?: string }>(extractedPath, {});
      extractionType = ext.extraction_type || "";
    }
    let tweetText = "";
    if (fs.existsSync(rawJsonPath)) {
      const raw = safeReadJson<{ tweet_text?: string }>(rawJsonPath, {});
      tweetText = raw.tweet_text || "";
    }

    const title = tweetText || fm.title || `Tweet ${tweetId.slice(-6)}`;
    const author = fm.author_handle ? `@${fm.author_handle}` : "@unknown";
    const status = fm.processing_status || "imported";
    const topic = fm.topic_label || fm.topic_slug || "";
    const url = fm.tweet_url || "";

    return {
      id: tweetId,
      title: title.slice(0, 80),
      author,
      type: extractionTypeToLabel(extractionType),
      status,
      topic,
      url,
    };
  });

  return { sources, total };
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export function getKbTopics(): KbTopic[] {
  const topicsIndex = safeReadJson<{
    topics?: Record<string, { label?: string; source_count?: number; slug?: string }>;
  }>(path.join(ROOT, "data", "indexes", "topics.json"), { topics: {} });

  return Object.entries(topicsIndex.topics || {}).map(([slug, info]) => ({
    slug,
    label: info.label || slug,
    source_count: info.source_count || 0,
  }));
}

// ---------------------------------------------------------------------------
// Recent runs — read from data/runs/
// ---------------------------------------------------------------------------

export function getRecentRuns(limit = 5): KbRunEntry[] {
  const runsDir = path.join(ROOT, "data", "runs");
  if (!fs.existsSync(runsDir)) return [];

  const files = fs.readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map((f) => {
    const json = safeReadJson<{
      started_at?: string;
      total?: number;
      results?: unknown[];
    }>(path.join(runsDir, f), {});

    const name = f
      .replace(/^[\d-T]+Z?-/, "")       // strip timestamp prefix
      .replace(/\.json$/, "")
      .replace(/-/g, " ");

    const ts = json.started_at
      ? new Date(json.started_at).toLocaleString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : f.slice(0, 16).replace("T", " ").replace(/[-:]/g, (c, i) => (i === 7 ? " " : c));

    const count = json.total ?? (Array.isArray(json.results) ? json.results.length : "");
    const label = `${name}${count ? ` (${count})` : ""}`;

    return { label, ts };
  });
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

export function getKbPipeline(stats: KbStats): KbPipelineStep[] {
  const bd = stats.statusBreakdown;
  const imported         = bd["imported"]         || 0;
  const extracted        = bd["extracted"]         || 0;
  const classified       = bd["classified"]        || 0;
  const course_generated = bd["course_generated"]  || 0;

  const total = stats.totalSources;
  const extractedTotal = extracted + classified + course_generated;
  const classifiedTotal = classified + course_generated;

  return [
    {
      step:   "Import X likes",
      meta:   `${total} sources saved locally`,
      status: total > 0 ? "done" : "next",
      n:      "1",
    },
    {
      step:   "Extract source content",
      meta:   `${extractedTotal} / ${total} extracted`,
      status: extractedTotal >= total ? "done" : extractedTotal > 0 ? "next" : "queued",
      n:      "2",
    },
    {
      step:   "Classify topics (Ollama)",
      meta:   `${classifiedTotal} / ${total} classified`,
      status: classifiedTotal >= total ? "done" : classifiedTotal > 0 ? "next" : extractedTotal > 0 ? "next" : "queued",
      n:      "3",
    },
    {
      step:   "Generate courses",
      meta:   `${course_generated} / ${total} courses generated`,
      status: course_generated >= total ? "done" : course_generated > 0 ? "next" : classifiedTotal > 0 ? "next" : "queued",
      n:      "4",
    },
    {
      step:   "Build wiki and graph",
      meta:   `${stats.wikiPages} wiki pages, ${stats.coursesGenerated} courses`,
      status: stats.wikiPages > 0 ? "done" : stats.coursesGenerated > 0 ? "next" : "queued",
      n:      "5",
    },
  ];
}
