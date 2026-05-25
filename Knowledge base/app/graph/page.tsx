import fs from "fs";
import path from "path";
import Link from "next/link";
import GraphClient from "./GraphClient";
import type { GraphData } from "../components/KnowledgeGraph";

const GRAPH_FILE = path.join(process.cwd(), "data", "indexes", "graph.json");

function loadGraph(): GraphData {
  try {
    const raw = JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8"));
    return {
      nodes: raw.nodes ?? [],
      links: raw.links ?? raw.edges ?? [],   // build-graph.js writes 'edges'
    };
  } catch {
    return { nodes: [], links: [] };
  }
}

export const dynamic = "force-static";

export default function GraphPage() {
  const graph = loadGraph();
  const topicCount  = graph.nodes.filter((n) => n.type === "topic").length;
  const sourceCount = graph.nodes.filter((n) => n.type === "source").length;

  return (
    <main className="kb-shell">
      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Knowledge Graph</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <section className="kb-workspace" style={{ gap: "16px" }}>
        <div style={{ padding: "16px 0 4px" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Knowledge Graph</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
            {topicCount} topics &middot; {sourceCount} sources &middot; {graph.links.length} connections.
            Click a topic node to open its wiki page. Drag to rearrange. Scroll to zoom.
          </p>
        </div>

        <GraphClient data={graph} />
      </section>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="kb-right" aria-label="Graph legend">
        <div>
          <h2 className="kb-right-title">Legend</h2>
          <p className="kb-right-sub">Node types & connections</p>
          <div className="kb-widget" style={{ marginTop: "12px" }}>
            {[
              { color: "#8b5cf6", label: "Topic", desc: "Wiki topic — click to open" },
              { color: "#1d9bf0", label: "Source", desc: "Raw tweet / article" },
              { color: "#f59e0b", label: "Course", desc: "Generated course" },
            ].map((item) => (
              <div key={item.label} className="vault-row">
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: item.color, display: "inline-block", flexShrink: 0 }} />
                  <strong style={{ fontSize: "0.8rem" }}>{item.label}</strong>
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Edge Types</p>
          <div className="kb-widget">
            {[
              { color: "#4b5563", label: "belongs_to", desc: "Source → Topic" },
              { color: "#8b5cf6", label: "wiki_link",  desc: "Topic ↔ Topic (cross-ref)" },
              { color: "#374151", label: "tagged",     desc: "Source → Tag topic" },
            ].map((item) => (
              <div key={item.label} className="vault-row">
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "16px", height: "2px", background: item.color, display: "inline-block" }} />
                  <code style={{ fontSize: "0.7rem" }}>{item.label}</code>
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Stats</p>
          <div className="kb-widget">
            <div className="vault-row"><span>Nodes</span><strong>{graph.nodes.length}</strong></div>
            <div className="vault-row"><span>Links</span><strong>{graph.links.length}</strong></div>
            <div className="vault-row"><span>Topics</span><strong>{topicCount}</strong></div>
            <div className="vault-row"><span>Sources</span><strong>{sourceCount}</strong></div>
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Rebuild Graph</p>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "4px 0 8px" }}>
            Run from Admin Console or via:<br />
            <code style={{ fontSize: "0.7rem" }}>npm run build:graph</code>
          </p>
          <Link href="/admin" style={{
            display: "block", textAlign: "center",
            background: "none", border: "1px solid var(--border)",
            borderRadius: "8px", padding: "8px",
            fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)",
            textDecoration: "none",
          }}>
            Open Admin Console
          </Link>
        </div>
      </aside>
    </main>
  );
}
