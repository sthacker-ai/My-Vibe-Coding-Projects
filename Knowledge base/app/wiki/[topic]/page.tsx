import fs from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";
import { markdownToHtml } from "../../lib/markdown";

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");
const RAW_DIR     = path.join(ROOT, "data", "raw", "tweets");

interface Props {
  params: Promise<{ topic: string }>;
}

export async function generateStaticParams() {
  if (!fs.existsSync(COURSES_DIR)) return [];
  return fs
    .readdirSync(COURSES_DIR)
    .filter((name) => {
      const dir = path.join(COURSES_DIR, name);
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "summary.md"));
    })
    .map((topic) => ({ topic }));
}

export default async function WikiTopicPage({ params }: Props) {
  const { topic } = await params;
  const summaryPath = path.join(COURSES_DIR, topic, "summary.md");
  if (!fs.existsSync(summaryPath)) {
    // Graceful fallback — don't 404, show a helpful stub
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
        <p style={{ color: "var(--muted, #888)", marginBottom: "0.5rem" }}>
          <a href="/wiki" style={{ color: "inherit" }}>&larr; Wiki</a>
        </p>
        <h1 style={{ textTransform: "capitalize" }}>{topic.replace(/-/g, " ")}</h1>
        <p style={{ color: "var(--muted, #888)" }}>
          No wiki summary exists yet for this topic. Run <code>npm run summarize:topics</code> to generate one.
        </p>
      </main>
    );
  }

  const raw = fs.readFileSync(summaryPath, "utf8");
  let frontmatter: Record<string, unknown> = {};
  let content = raw;
  try {
    const parsed = matter(raw);
    frontmatter = parsed.data;
    content = parsed.content;
  } catch {
    // use raw
  }

  const html = markdownToHtml(content);

  const topicLabel = (frontmatter.title as string) || topic.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // List all courses for this topic
  const topicDir = path.join(COURSES_DIR, topic);
  const courseFiles = fs
    .readdirSync(topicDir)
    .filter((f) => /^course-\d{3}\.md$/.test(f))
    .sort();

  const courses = courseFiles.map((f, i) => {
    const courseRaw = fs.readFileSync(path.join(topicDir, f), "utf8");
    let title = `Course ${i + 1}`;
    let tweetUrl = "";
    let sourceHandle = "";
    let tweetId = "";
    let extractionType = "plain_tweet";
    try {
      const parsed = matter(courseRaw);
      if (parsed.data.title)          title         = parsed.data.title as string;
      if (parsed.data.tweet_url)      tweetUrl      = parsed.data.tweet_url as string;
      if (parsed.data.source_handle)  sourceHandle  = parsed.data.source_handle as string;
      if (parsed.data.tweet_id || parsed.data.source_id)
        tweetId = (parsed.data.source_id || parsed.data.tweet_id) as string;
    } catch { /* ignore */ }
    // Read extraction type from raw extracted JSON
    if (tweetId) {
      try {
        const extPath = path.join(RAW_DIR, `${tweetId}-extracted.json`);
        if (fs.existsSync(extPath)) {
          const ext = JSON.parse(fs.readFileSync(extPath, "utf8"));
          extractionType = ext.extraction_type || "plain_tweet";
        }
      } catch { /* ignore */ }
    }
    return { slug: f.replace(".md", ""), title, tweetUrl, sourceHandle, extractionType };
  });

  // Neighbouring topics
  const allTopics = fs.readdirSync(COURSES_DIR).filter((name) => {
    const dir = path.join(COURSES_DIR, name);
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "summary.md"));
  });

  return (
    <main className="kb-shell">
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Local-first learning system</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Wiki Notes</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      <section className="kb-workspace">
        {/* Breadcrumb */}
        <div style={{ padding: "14px 0 8px", fontSize: "0.8rem", color: "var(--muted)" }}>
          <Link href="/wiki" style={{ color: "var(--brand)", textDecoration: "none" }}>Wiki Notes</Link>
          {" / "}
          <span>{topicLabel}</span>
        </div>

        {/* Wiki content */}
        <article className="kb-source-panel kb-article">
          <div
            className="md-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        {/* Courses under this topic */}
        <section className="kb-source-panel" style={{ marginTop: "16px" }}>
          <div className="section-header">
            <h2 className="section-title">Courses in {topicLabel}</h2>
            <span className="see-all">{courses.length} total</span>
          </div>
          {courses.map((c) => (
            <div key={c.slug} className="kb-source-row" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" as const }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/courseware/${topic}/${c.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="kb-source-title">{c.title}</div>
                </Link>
                <div className="kb-source-author" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                  {c.sourceHandle && <span>{c.sourceHandle}</span>}
                  {c.sourceHandle && c.tweetUrl && <span style={{ color: "var(--muted)" }}>·</span>}
                  {c.tweetUrl && (
                    <a
                      href={c.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--brand)", fontSize: "0.75rem", textDecoration: "none" }}
                    >
                      {c.extractionType === "x_video" ? "Watch on X" : "View on X"} &rarr;
                    </a>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "99px",
                background: c.extractionType === "x_video" ? "#f59e0b" : c.extractionType === "x_article" ? "#3b82f6" : "#22c55e",
                color: "#fff",
                textTransform: "uppercase" as const,
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {c.extractionType === "x_video" ? "Video" : c.extractionType === "x_article" ? "Article" : "Tweet"}
              </span>
            </div>
          ))}
        </section>
      </section>

      <aside className="kb-right" aria-label="Wiki sidebar">
        <div>
          <h2 className="kb-right-title">{topicLabel}</h2>
          <p className="kb-right-sub">{courses.length} course{courses.length !== 1 ? "s" : ""} · wiki summary</p>
          {frontmatter.generated_at ? (
            <div className="kb-widget" style={{ marginTop: "10px" }}>
              <div className="vault-row">
                <span>Generated</span>
                <strong>{new Date(frontmatter.generated_at as string).toLocaleDateString("en-IN")}</strong>
              </div>
            </div>
          ) : null}
        </div>
        <div>
          <p className="kb-widget-title">Other Topics</p>
          <div className="topic-chips" style={{ marginTop: "8px" }}>
            {allTopics.filter((t) => t !== topic).map((t) => (
              <Link key={t} href={`/wiki/${t}`} style={{ textDecoration: "none" }}>
                <span className="topic-chip" style={{ cursor: "pointer" }}>{t.replace(/-/g, " ")}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <Link href="/courseware" className="btn-outline" style={{ textDecoration: "none", display: "block", textAlign: "center" }}>
            All Courses
          </Link>
        </div>
      </aside>
    </main>
  );
}
