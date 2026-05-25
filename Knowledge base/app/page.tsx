import Link from "next/link";
import {
  getKbStats,
  getKbSources,
  getKbTopics,
  getRecentRuns,
  getKbPipeline,
} from "./lib/kb-data";
import LearningPanel from "./components/LearningPanel";

const navItems = [
  { label: "Overview",       href: "/",       active: true  },
  { label: "Source Inbox",  href: "/sources",    active: false },
  { label: "Courseware",    href: "/courseware", active: false },
  { label: "Wiki Notes",    href: "/wiki",       active: false },
  { label: "Knowledge Graph", href: "/graph",   active: false },
  { label: "Run History",   href: "/runs",       active: false },
  { label: "Token Usage",   href: "/tokens",     active: false },
];

const bottomNavItems = [
  { label: "Admin",    href: "/admin",   active: false },
  { label: "Help",     href: "#", active: false },
];

function statusSub(breakdown: Record<string, number>): string {
  const parts: string[] = [];
  if (breakdown["course_generated"]) parts.push(`${breakdown["course_generated"]} with course`);
  else if (breakdown["classified"])  parts.push(`${breakdown["classified"]} classified`);
  else if (breakdown["extracted"])   parts.push(`${breakdown["extracted"]} extracted`);
  return parts.join(", ") || "Ready to process";
}

export default function Home() {
  const kbStats  = getKbStats();
  const { sources, total: totalSources } = getKbSources(10);
  const topics   = getKbTopics();
  const runs     = getRecentRuns(5);
  const pipeline = getKbPipeline(kbStats);

  const stats = [
    {
      label: "Sources Imported",
      value: String(kbStats.totalSources),
      sub: statusSub(kbStats.statusBreakdown),
      color: "amber",
    },
    {
      label: "Courses Generated",
      value: String(kbStats.coursesGenerated),
      sub: kbStats.coursesGenerated > 0 ? `Across ${kbStats.topicsCount} topic(s)` : "Run compile:courses",
      color: "green",
    },
    {
      label: "Wiki Pages",
      value: String(kbStats.wikiPages),
      sub: kbStats.wikiPages > 0 ? "Topic summaries live" : "Run summarize:topics",
      color: "blue",
    },
    {
      label: "Topics Detected",
      value: String(kbStats.topicsCount),
      sub: kbStats.topicsCount > 0 ? "Classified by OpenRouter" : "Awaiting classification",
      color: "purple",
    },
    {
      label: "Words Processed",
      value: kbStats.wordsProcessed >= 1000
        ? `${Math.round(kbStats.wordsProcessed / 1000)}k`
        : String(kbStats.wordsProcessed),
      sub: kbStats.wordsProcessed > 0 ? "Across all courses" : "Run compile:courses",
      color: "amber",
    },
  ];
  return (
    <main className="kb-shell">
      {/* Sidebar */}
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Local-first learning system</p>
          </div>
        </div>

        <p className="nav-section-label">Menu</p>
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={item.active ? "kb-nav-link active" : "kb-nav-link"}
            aria-current={item.active ? "page" : undefined}
          >
            <span className="kb-nav-icon" aria-hidden="true" />
            {item.label}
          </Link>
        ))}

        <div className="sidebar-bottom">
          {bottomNavItems.map((item) => (
            <Link key={item.label} href={item.href} className="kb-nav-link">
              <span className="kb-nav-icon" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main workspace */}
      <section className="kb-workspace">
        {/* Hero */}
        <div className="kb-hero">
          <p className="kb-hero-label">Personal Knowledge System</p>
          <h1>Your X feed is your curriculum.</h1>
          <p className="kb-hero-sub">
            Auto-imports liked posts and videos, transcribes, classifies by topic, and generates
            AI courses, wiki notes, and a knowledge graph &mdash; daily, automatically, locally.
          </p>
          <div className="kb-hero-actions">
            <Link href="/admin" className="btn-primary" style={{ textDecoration: "none" }}>Run Pipeline</Link>
            <Link href="/admin" className="btn-outline" style={{ textDecoration: "none" }}>Import More</Link>
          </div>
        </div>

        {/* Stats */}
        <section aria-label="Knowledge base metrics">
          <div className="kb-stats">
            {stats.map((s) => (
              <div key={s.label} className={`kb-stat-card ${s.color}`}>
                <div className="kb-stat-icon" aria-hidden="true" />
                <div className="kb-stat-value">{s.value}</div>
                <div className="kb-stat-label">{s.label}</div>
                <div className="kb-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Source inbox table */}
        <section className="kb-source-panel" id="inbox" aria-label="Source inbox">
          <div className="section-header">
            <h2 className="section-title">Sources You&apos;ve Imported</h2>
            <Link href="/sources" className="see-all">See All {totalSources} &rarr;</Link>
          </div>
          <div className="kb-table-header" aria-hidden="true">
            <span>Source</span>
            <span>Type</span>
            <span>Status</span>
            <span>Author</span>
          </div>
          {sources.map((s) => (
            <a
              key={s.id}
              href={s.url || `https://x.com/i/status/${s.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="kb-source-row"
              style={{ textDecoration: "none", color: "inherit", display: "grid", cursor: "pointer" }}
            >
              <div>
                <div className="kb-source-title">{s.title}</div>
                <div className="kb-source-author">{s.author}</div>
              </div>
              <div className="kb-source-type">{s.type}</div>
              <div>
                <span className={`kb-badge ${s.status}`}>{s.status}</span>
              </div>
              <div className="kb-source-author" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }}>
                {s.id.slice(-6)}
              </div>
            </a>
          ))}
        </section>

        {/* Pipeline */}
        <section className="kb-pipeline" aria-label="Processing pipeline">
          <div className="section-header">
            <h2 className="section-title">Processing Pipeline</h2>
          </div>
          {pipeline.map((step) => (
            <div key={step.step} className={`pipeline-step ${step.status}`}>
              <div className={`pipeline-dot ${step.status}`}>{step.n}</div>
              <div className="pipeline-label">
                <span>{step.step}</span>
                <small>{step.meta}</small>
              </div>
            </div>
          ))}
        </section>
      </section>

      {/* Right panel */}
      <aside className="kb-right" aria-label="Dashboard sidebar">
        <div>
          <h2 className="kb-right-title">Vault Status</h2>
          <p className="kb-right-sub">Local-first - Git-tracked</p>
          <div className="kb-widget">
            <p className="kb-widget-title">System</p>
            <div className="vault-row">
              <span>Storage</span>
              <strong>LOCAL</strong>
            </div>
            <div className="vault-row">
              <span>AI</span>
              <strong>OpenRouter</strong>
            </div>
            <div className="vault-row">
              <span>Model</span>
              <strong>nvidia/nemotron</strong>
            </div>
            <div className="vault-row">
              <span>Sync</span>
              <strong><span className="dot-green" />GIT</strong>
            </div>
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Learning Tracker</p>
          <LearningPanel />
        </div>

        <div>
          <div className="kb-widget">
            {runs.map((r) => (
              <div key={r.label} className="run-item">
                <div className="run-dot" />
                <span>{r.label}</span>
                <strong>{r.ts}</strong>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Detected Topics</p>
          {topics.length === 0 ? (
            <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: "10px" }}>
              Topics appear after classification runs.
            </p>
          ) : null}
          <div className="topic-chips">
            {topics.length === 0 ? (
              <span className="topic-chip">Uncategorized x{kbStats.totalSources}</span>
            ) : (
              topics.map((t) => (
                <Link key={t.slug} href={`/wiki/${t.slug}`} style={{ textDecoration: "none" }}>
                  <span className="topic-chip" style={{ cursor: "pointer" }}>{t.label} x{t.source_count}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Vault Path</p>
          <div className="kb-widget">
            <div className="vault-row">
              <span>Sources</span>
              <strong>content/sources/x/</strong>
            </div>
            <div className="vault-row">
              <span>Courses</span>
              <strong>content/courses/</strong>
            </div>
            <div className="vault-row">
              <span>Wiki</span>
              <strong>content/wiki/</strong>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}


