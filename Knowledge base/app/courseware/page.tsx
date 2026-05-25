import fs from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";
import TopicGrid, { TopicCardData } from "./TopicGrid";

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");

interface CourseEntry {
  slug: string;
  title: string;
  num: string;
  readingTimeMin: number;
}

interface TopicEntry {
  slug: string;
  label: string;
  courses: CourseEntry[];
  hasSummary: boolean;
}

function getTopics(): TopicEntry[] {
  if (!fs.existsSync(COURSES_DIR)) return [];

  return fs
    .readdirSync(COURSES_DIR)
    .filter((name) => fs.statSync(path.join(COURSES_DIR, name)).isDirectory())
    .map((slug) => {
      const dir = path.join(COURSES_DIR, slug);
      const courseFiles = fs
        .readdirSync(dir)
        .filter((f) => /^course-\d{3}\.md$/.test(f))
        .sort();

      const courses: CourseEntry[] = courseFiles.map((f) => {
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        let title = f;
        let readingTimeMin = 5;
        try {
          const parsed = matter(raw);
          title = (parsed.data.title as string) || title;
          const words = parsed.content.trim().split(/\s+/).length;
          readingTimeMin = Math.max(1, Math.round(words / 200));
        } catch {
          // ignore
        }
        return { slug: f.replace(".md", ""), title, num: f.replace("course-", "").replace(".md", ""), readingTimeMin };
      });

      // derive label from first course frontmatter or slug
      let label = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (courses.length > 0) {
        const firstRaw = fs.readFileSync(path.join(dir, `${courses[0].slug}.md`), "utf8");
        try {
          const fm = matter(firstRaw);
          if (fm.data.topic_label) label = fm.data.topic_label as string;
        } catch {
          // ignore
        }
      }

      const hasSummary = fs.existsSync(path.join(dir, "summary.md"));

      return { slug, label, courses, hasSummary };
    })
    .filter((t) => t.courses.length > 0)
    .sort((a, b) => b.courses.length - a.courses.length);
}

export default function CoursewarePage() {
  const topics = getTopics();
  const totalCourses = topics.reduce((n, t) => n + t.courses.length, 0);

  // Convert to serializable shape for the client component
  const topicCards: TopicCardData[] = topics.map((t) => ({
    slug:       t.slug,
    label:      t.label,
    courseCount: t.courses.length,
    totalReadMin: t.courses.reduce((n, c) => n + c.readingTimeMin, 0),
    hasSummary: t.hasSummary,
  }));

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
        <div className="kb-hero">
          <p className="kb-hero-label">Courseware</p>
          <h1>Your Generated Courses</h1>
          <p className="kb-hero-sub">
            {totalCourses} courses across {topics.length} topics &mdash; all generated from your liked posts.
            Click a topic to browse its courses.
          </p>
        </div>

        <section className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Topics</h2>
            <span className="see-all">{topics.length} topic{topics.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            <TopicGrid topics={topicCards} />
          </div>
        </section>
      </section>

      <aside className="kb-right" aria-label="Courseware sidebar">
        <div>
          <h2 className="kb-right-title">Topics</h2>
          <p className="kb-right-sub">Click a topic to browse</p>
          <div className="topic-chips" style={{ marginTop: "10px" }}>
            {topics.map((t) => (
              <Link key={t.slug} href={`/courseware/${t.slug}`} style={{ textDecoration: "none" }}>
                <span className="topic-chip" style={{ cursor: "pointer" }}>{t.label} &times;{t.courses.length}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="kb-widget-title">Stats</p>
          <div className="kb-widget">
            <div className="vault-row"><span>Total courses</span><strong>{totalCourses}</strong></div>
            <div className="vault-row"><span>Topics</span><strong>{topics.length}</strong></div>
            <div className="vault-row"><span>Wiki pages</span><strong>{topics.filter((t) => t.hasSummary).length}</strong></div>
          </div>
        </div>
      </aside>
    </main>
  );
}
