import fs from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");

interface TopicSummary {
  slug: string;
  label: string;
  courseCount: number;
  excerpt: string;
}

function getSummaries(): TopicSummary[] {
  if (!fs.existsSync(COURSES_DIR)) return [];

  return fs
    .readdirSync(COURSES_DIR)
    .filter((name) => {
      const dir = path.join(COURSES_DIR, name);
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "summary.md"));
    })
    .map((slug) => {
      const summaryPath = path.join(COURSES_DIR, slug, "summary.md");
      const raw = fs.readFileSync(summaryPath, "utf8");
      let label = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      let courseCount = 0;
      let excerpt = "";
      try {
        const parsed = matter(raw);
        if (parsed.data.title) label = parsed.data.title as string;
        if (parsed.data.course_count) courseCount = Number(parsed.data.course_count);
        // Extract Overview section as excerpt
        const overviewMatch = parsed.content.match(/## Overview\s+([\s\S]+?)(?=\n##|$)/);
        if (overviewMatch) excerpt = overviewMatch[1].trim().slice(0, 200);
      } catch {
        // ignore
      }
      return { slug, label, courseCount, excerpt };
    })
    .sort((a, b) => b.courseCount - a.courseCount);
}

export default function WikiPage() {
  const summaries = getSummaries();

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
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      <section className="kb-workspace">
        <div className="kb-hero">
          <p className="kb-hero-label">Wiki Notes</p>
          <h1>Topic Summaries</h1>
          <p className="kb-hero-sub">
            {summaries.length} synthesized wiki pages â€” each summarising all courses under a topic.
          </p>
        </div>

        <section className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">All Topics</h2>
            <span className="see-all">{summaries.length} pages</span>
          </div>

          {summaries.map((s) => (
            <Link
              key={s.slug}
              href={`/wiki/${s.slug}`}
              className="kb-source-row"
              style={{ textDecoration: "none", alignItems: "flex-start", paddingTop: "14px", paddingBottom: "14px" }}
            >
              <div style={{ flex: 2 }}>
                <div className="kb-source-title">{s.label}</div>
                {s.excerpt && (
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "4px", lineHeight: 1.5 }}>
                    {s.excerpt}
                  </div>
                )}
              </div>
              <div className="kb-source-type">Wiki</div>
              <div><span className="kb-badge classified">summary</span></div>
              <div className="kb-source-author">{s.courseCount} course{s.courseCount !== 1 ? "s" : ""}</div>
            </Link>
          ))}
        </section>
      </section>

      <aside className="kb-right" aria-label="Wiki sidebar">
        <div>
          <h2 className="kb-right-title">Wiki Notes</h2>
          <p className="kb-right-sub">AI-generated topic summaries</p>
          <div className="kb-widget" style={{ marginTop: "12px" }}>
            <div className="vault-row"><span>Summaries</span><strong>{summaries.length}</strong></div>
            <div className="vault-row"><span>With wikilinks</span><strong>{summaries.length}</strong></div>
          </div>
        </div>
        <div>
          <p className="kb-widget-title">Quick Jump</p>
          <div className="topic-chips" style={{ marginTop: "8px" }}>
            {summaries.map((s) => (
              <Link key={s.slug} href={`/wiki/${s.slug}`} style={{ textDecoration: "none" }}>
                <span className="topic-chip" style={{ cursor: "pointer" }}>{s.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
