import Link from "next/link";

export const dynamic = "force-dynamic";

interface TokenRow {
  model:             string;
  provider:          string;
  calls:             number;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
}

interface RecentEntry {
  ts:                string;
  label:             string;
  model:             string;
  provider:          string;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
}

interface TokenData {
  byModel:       TokenRow[];
  totals:        { calls: number; prompt_tokens: number; completion_tokens: number; total_tokens: number };
  recentEntries: RecentEntry[];
}

async function getTokenData(): Promise<TokenData> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3005";
    const res = await fetch(`${baseUrl}/api/tokens`, { cache: "no-store" });
    if (!res.ok) return { byModel: [], totals: { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, recentEntries: [] };
    return res.json();
  } catch {
    return { byModel: [], totals: { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, recentEntries: [] };
  }
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function TokensPage() {
  const { byModel, totals, recentEntries } = await getTokenData();

  return (
    <main className="kb-shell">
      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Token Usage</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <section className="kb-workspace" style={{ gap: "16px" }}>
        <div style={{ padding: "16px 0 4px" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Token Usage</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
            All OpenRouter API calls tracked since token logging was enabled.
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
          {[
            { label: "Total Calls",   value: String(totals.calls) },
            { label: "Input Tokens",  value: fmtNum(totals.prompt_tokens) },
            { label: "Output Tokens", value: fmtNum(totals.completion_tokens) },
            { label: "Total Tokens",  value: fmtNum(totals.total_tokens) },
          ].map((s) => (
            <div key={s.label} className="kb-stat-card blue" style={{ padding: "14px 16px" }}>
              <div className="kb-stat-value" style={{ fontSize: "1.4rem" }}>{s.value}</div>
              <div className="kb-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* By model table */}
        <div className="kb-widget" style={{ padding: "0" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>By Model</p>
          </div>
          {byModel.length === 0 ? (
            <p style={{ padding: "16px", color: "var(--muted)", fontSize: "0.85rem" }}>
              No token data yet. Token tracking starts from the next pipeline run.
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "8px 16px", fontWeight: 600 }}>Model</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Calls</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Input</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Output</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={row.model} style={{ borderBottom: "1px solid var(--border, #f3f4f6)" }}>
                    <td style={{ padding: "10px 16px", fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>{row.model}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{row.provider}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.calls}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--muted)" }}>{fmtNum(row.prompt_tokens)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--muted)" }}>{fmtNum(row.completion_tokens)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmtNum(row.total_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent calls */}
        {recentEntries.length > 0 && (
          <div className="kb-widget" style={{ padding: "0" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.88rem" }}>Recent API Calls</p>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "6px 16px", fontWeight: 600 }}>Label</th>
                  <th style={{ padding: "6px 12px", fontWeight: 600 }}>Model</th>
                  <th style={{ padding: "6px 12px", fontWeight: 600, textAlign: "right" }}>In</th>
                  <th style={{ padding: "6px 12px", fontWeight: 600, textAlign: "right" }}>Out</th>
                  <th style={{ padding: "6px 12px", fontWeight: 600, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border, #f9fafb)" }}>
                    <td style={{ padding: "5px 16px", fontFamily: "ui-monospace, monospace", color: "var(--muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</td>
                    <td style={{ padding: "5px 12px", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }}>{e.model.split("/").pop()}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: "var(--muted)" }}>{fmtNum(e.prompt_tokens)}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: "var(--muted)" }}>{fmtNum(e.completion_tokens)}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right" }}>{fmtNum(e.total_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="kb-right" aria-label="Token info">
        <div>
          <h2 className="kb-right-title">About Token Tracking</h2>
          <p className="kb-right-sub" style={{ lineHeight: 1.5 }}>
            Token counts are captured from OpenRouter API responses. Ollama (local) usage shows 0 tokens — Ollama does not report token counts.
          </p>
        </div>
        <div style={{ marginTop: "20px" }}>
          <h2 className="kb-right-title">Free Tier Note</h2>
          <p className="kb-right-sub" style={{ lineHeight: 1.5 }}>
            All models used are on the OpenRouter free tier ($0 cost). Token counts are tracked for rate limit awareness and future planning.
          </p>
        </div>
      </aside>
    </main>
  );
}
