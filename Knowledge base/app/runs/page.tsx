import Link from "next/link";
import RunsClient from "./RunsClient";

export const dynamic = "force-dynamic";

async function getRuns() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3005";
    const res = await fetch(`${baseUrl}/api/runs`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.runs ?? [];
  } catch {
    return [];
  }
}

export default async function RunsPage() {
  const runs = await getRuns();

  return (
    <main className="kb-shell">
      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Run History</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <section className="kb-workspace" style={{ gap: "16px" }}>
        <div style={{ padding: "16px 0 4px" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Run History</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
            {runs.length} run{runs.length !== 1 ? "s" : ""} recorded &middot; Click a row to expand step details.
          </p>
        </div>

        <div className="kb-widget" style={{ padding: "0" }}>
          <RunsClient initialRuns={runs} />
        </div>
      </section>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="kb-right" aria-label="Run info">
        <div>
          <h2 className="kb-right-title">Pipeline Steps</h2>
          <p className="kb-right-sub">Execution order</p>
          <div className="kb-widget" style={{ marginTop: "12px" }}>
            {[
              { n: "1", step: "Import X Likes",   desc: "Fetch new liked tweets" },
              { n: "2", step: "Extract Sources",  desc: "Parse tweet content" },
              { n: "3", step: "Classify Topics",  desc: "AI topic assignment" },
              { n: "4", step: "Compile Courses",  desc: "Generate courseware" },
              { n: "5", step: "Summarize Topics", desc: "Build wiki summaries" },
              { n: "6", step: "Build Graph",      desc: "Update knowledge graph" },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start" }}>
                <span style={{ background: "var(--accent, #6366f1)", color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.8rem" }}>{s.step}</p>
                  <p style={{ margin: 0, fontSize: "0.73rem", color: "var(--muted)" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: "20px" }}>
          <h2 className="kb-right-title">Pipeline Behavior</h2>
          <p className="kb-right-sub" style={{ lineHeight: 1.5 }}>
            Pipeline stops at first failure. Each step is idempotent — the next scheduled run automatically retries from where it left off.
          </p>
        </div>
      </aside>
    </main>
  );
}
