import Link from "next/link";
import { getKbSources, getKbStats } from "../lib/kb-data";

export default function SourcesPage() {
  const { sources, total } = getKbSources(100);
  const stats = getKbStats();
  const statusOrder = ["course_generated", "classified", "extracted", "imported"];

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
        <Link href="/sources"    className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>
      <section className="kb-workspace">
        <div className="kb-hero">
          <p className="kb-hero-label">Source Inbox</p>
          <h1>All Imported Sources</h1>
          <p className="kb-hero-sub">
            {total} sources from your liked posts &mdash; classified, extracted, and turned into courseware.
          </p>
        </div>
        <section className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Sources</h2>
            <span className="see-all">{total} total</span>
          </div>
          <div className="kb-table-header" aria-hidden="true">
            <span>Source</span><span>Type</span><span>Status</span><span>Topic</span>
          </div>
          {[...sources]
            .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
            .map((s) => (
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
                <div><span className={`kb-badge ${s.status}`}>{s.status.replace("_", " ")}</span></div>
                <div className="kb-source-author" style={{ fontSize: "0.78rem" }}>
                  {s.topic || "-"}
                </div>
              </a>
            ))}
        </section>
      </section>
      <aside className="kb-right" aria-label="Inbox sidebar">
        <div>
          <h2 className="kb-right-title">Processing</h2>
          <p className="kb-right-sub">Status breakdown</p>
          <div className="kb-widget" style={{ marginTop: "10px" }}>
            {Object.entries(stats.statusBreakdown).map(([status, count]) => (
              <div key={status} className="vault-row">
                <span className={`kb-badge ${status}`} style={{ fontSize: "0.68rem" }}>{status.replace("_", " ")}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="kb-widget-title">Navigate</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <Link href="/courseware" className="btn-primary" style={{ textDecoration: "none", textAlign: "center" }}>View Courses</Link>
            <Link href="/wiki" className="btn-outline" style={{ textDecoration: "none", textAlign: "center" }}>View Wiki</Link>
          </div>
        </div>
      </aside>
    </main>
  );
}
