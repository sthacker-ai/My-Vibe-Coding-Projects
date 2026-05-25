import fs from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";
import { notFound } from "next/navigation";
import CourseList, { CourseEntry } from "./CourseList";

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");

interface Props {
  params: Promise<{ topic: string }>;
}

export async function generateStaticParams() {
  if (!fs.existsSync(COURSES_DIR)) return [];
  return fs
    .readdirSync(COURSES_DIR)
    .filter((name) => fs.statSync(path.join(COURSES_DIR, name)).isDirectory())
    .map((topic) => ({ topic }));
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const dir = path.join(COURSES_DIR, topic);

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) notFound();

  const courseFiles = fs.readdirSync(dir).filter((f) => /^course-\d{3}\.md$/.test(f)).sort();
  if (courseFiles.length === 0) notFound();

  const courses: CourseEntry[] = courseFiles.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    let title = f;
    let readingTimeMin = 5;
    try {
      const parsed = matter(raw);
      title = (parsed.data.title as string) || title;
      const words = parsed.content.trim().split(/\s+/).length;
      readingTimeMin = Math.max(1, Math.round(words / 200));
    } catch { /* ignore */ }
    return {
      slug: f.replace(".md", ""),
      title,
      num: f.replace("course-", "").replace(".md", ""),
      readingTimeMin,
    };
  });

  // Derive topic label from first course frontmatter
  let topicLabel = topic.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    const firstRaw = fs.readFileSync(path.join(dir, courseFiles[0]), "utf8");
    const fm = matter(firstRaw);
    if (fm.data.topic_label) topicLabel = fm.data.topic_label as string;
  } catch { /* ignore */ }

  // Read summary first paragraph for hero excerpt
  let summaryExcerpt = "";
  const summaryPath = path.join(dir, "summary.md");
  const hasSummary  = fs.existsSync(summaryPath);
  if (hasSummary) {
    try {
      const sumRaw    = fs.readFileSync(summaryPath, "utf8");
      const sumParsed = matter(sumRaw);
      const paras     = sumParsed.content.trim().split(/\n\n+/);
      const first     = paras.find((p) => p.trim().length > 20 && !p.startsWith("#")) ?? "";
      summaryExcerpt  = first
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // strip markdown links
        .replace(/[*_`#]/g, "")                    // strip inline formatting
        .slice(0, 280);
    } catch { /* ignore */ }
  }

  const totalReadMin = courses.reduce((n, c) => n + c.readingTimeMin, 0);

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
        <Link href="/"            className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"     className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware"  className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"        className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"       className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"        className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"      className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      <section className="kb-workspace">
        {/* Breadcrumb */}
        <div style={{ padding: "14px 0 8px", fontSize: "0.8rem", color: "var(--muted)" }}>
          <Link href="/courseware" style={{ color: "var(--brand)", textDecoration: "none" }}>Courseware</Link>
          {" / "}
          <span style={{ color: "var(--fg)" }}>{topicLabel}</span>
        </div>

        <div className="kb-hero" style={{ paddingBottom: "20px" }}>
          <p className="kb-hero-label">Topic</p>
          <h1 style={{ fontSize: "1.6rem" }}>{topicLabel}</h1>
          {summaryExcerpt && (
            <p className="kb-hero-sub">
              {summaryExcerpt}{summaryExcerpt.length >= 280 ? "\u2026" : ""}
            </p>
          )}
        </div>

        <section className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Courses</h2>
            <span className="see-all">{courses.length} course{courses.length !== 1 ? "s" : ""}</span>
          </div>

          {hasSummary && (
            <Link
              href={`/wiki/${topic}`}
              className="kb-source-row"
              style={{ background: "var(--purple-dim)", marginBottom: "4px", textDecoration: "none" }}
            >
              <div>
                <div className="kb-source-title" style={{ color: "var(--brand)" }}>Topic Summary (Wiki Page)</div>
                <div className="kb-source-author">Synthesized overview of all {topicLabel} courses</div>
              </div>
              <div className="kb-source-type">Summary</div>
              <div><span className="kb-badge classified">wiki</span></div>
              <div></div>
            </Link>
          )}

          <CourseList courses={courses} topic={topic} topicLabel={topicLabel} />
        </section>
      </section>

      <aside className="kb-right" aria-label="Topic info">
        <div>
          <h2 className="kb-right-title">{topicLabel}</h2>
          <p className="kb-right-sub">{courses.length} courses</p>
          <div className="kb-widget" style={{ marginTop: "12px" }}>
            <div className="vault-row"><span>Courses</span><strong>{courses.length}</strong></div>
            <div className="vault-row"><span>Total reading</span><strong>~{totalReadMin} min</strong></div>
            <div className="vault-row"><span>Wiki page</span><strong>{hasSummary ? "Yes" : "Not yet"}</strong></div>
          </div>
        </div>

        {hasSummary && (
          <div>
            <Link
              href={`/wiki/${topic}`}
              className="btn-outline"
              style={{ textDecoration: "none", display: "block", textAlign: "center", marginTop: "8px" }}
            >
              Read Wiki Summary
            </Link>
          </div>
        )}

        <div>
          <p className="kb-widget-title">Navigation</p>
          <Link href="/courseware" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.85rem" }}>
            &larr; All Topics
          </Link>
        </div>
      </aside>
    </main>
  );
}
