"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Task {
  taskId: string;
  step:   string;
  ts:     string;
  done:   boolean;
  failed: boolean;
  summary: string;
}

interface Stats {
  sources_total?: number;
  sources_classified?: number;
  courses_total?: number;
  topics_total?: number;
  sources_pending_extract?: number;
  sources_pending_classify?: number;
  sources_pending_course?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline step definitions
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { id: "import-likes",  label: "Pull X Likes",       color: "#1d9bf0", desc: "Fetch latest 50 liked tweets" },
  { id: "extract",       label: "Extract Sources",     color: "#22c55e", desc: "Scrape content from tweet URLs" },
  { id: "classify",      label: "Classify Topics",     color: "#8b5cf6", desc: "AI-classify each source" },
  { id: "courses",       label: "Compile Courses",     color: "#f59e0b", desc: "Generate courseware via AI" },
  { id: "summarize",     label: "Summarize Topics",    color: "#ec4899", desc: "Build wiki summaries" },
  { id: "graph",         label: "Build Graph",         color: "#06b6d4", desc: "Update knowledge graph" },
  { id: "transcripts",      label: "Transcribe Videos",   color: "#f97316", desc: "Download & transcribe video sources" },
  { id: "generate-assets",   label: "Generate Images",     color: "#a855f7", desc: "AI hero images + diagrams for all courses (Gemini Imagen)" },
  { id: "generate-podcasts", label: "Generate Podcasts",   color: "#ec4899", desc: "2-speaker podcast audio per course (edge-tts)" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Admin Console
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTaskId, setActiveTaskId]   = useState<string | null>(null);
  const [taskOutput, setTaskOutput]       = useState<string>("");
  const [activeStep, setActiveStep]       = useState<string>("");
  const [isRunning, setIsRunning]         = useState(false);
  const [recentTasks, setRecentTasks]     = useState<Task[]>([]);
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [importUrl, setImportUrl]         = useState("");
  const [youtubeUrl, setYoutubeUrl]       = useState("");
  const [urlError, setUrlError]           = useState("");
  const [ytError, setYtError]             = useState("");
  const [prompts, setPrompts]             = useState<Record<string, string>>({});
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsSaved, setPromptsSaved]   = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ── Load stats and recent tasks on mount ──────────────────────────────────
  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tasks");
      if (res.ok) {
        const data = await res.json();
        setRecentTasks(data.tasks || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshStats();
    refreshTasks();
    // Load prompts
    fetch("/api/admin/prompts")
      .then((r) => r.json())
      .then((d) => { if (d.prompts) setPrompts(d.prompts); })
      .catch(() => {});
  }, [refreshStats, refreshTasks]);

  const savePrompts = async () => {
    setPromptsSaving(true);
    setPromptsSaved(false);
    try {
      await fetch("/api/admin/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      });
      setPromptsSaved(true);
      setTimeout(() => setPromptsSaved(false), 3000);
    } catch { /* ignore */ }
    setPromptsSaving(false);
  };

  // ── Auto-scroll terminal ──────────────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [taskOutput]);

  // ── Poll active task ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTaskId || !isRunning) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/task/${activeTaskId}`);
        if (!res.ok) return;
        const data = await res.json();
        setTaskOutput(data.output || "");
        if (data.done) {
          setIsRunning(false);
          refreshStats();
          refreshTasks();
        }
      } catch { /* ignore */ }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [activeTaskId, isRunning, refreshStats, refreshTasks]);

  // ── Run a pipeline step ───────────────────────────────────────────────────
  const runStep = async (stepId: string) => {
    if (isRunning) return;
    setActiveStep(stepId);
    setIsRunning(true);
    setTaskOutput(`[Starting: ${stepId}]\n`);
    try {
      const res = await fetch("/api/admin/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ step: stepId }),
      });
      const data = await res.json();
      if (data.taskId) {
        setActiveTaskId(data.taskId);
      } else {
        setTaskOutput(`[Error] ${data.error || "Unknown error"}`);
        setIsRunning(false);
      }
    } catch (err) {
      setTaskOutput(`[Error] ${err instanceof Error ? err.message : String(err)}`);
      setIsRunning(false);
    }
  };

  // ── Run full pipeline ─────────────────────────────────────────────────────
  const runFullPipeline = async () => {
    if (isRunning) return;
    setActiveStep("pipeline");
    setIsRunning(true);
    setTaskOutput("[Starting full pipeline: extract → classify → courses → summarize → graph]\n");
    try {
      const res = await fetch("/api/admin/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ step: "pipeline" }),
      });
      const data = await res.json();
      if (data.taskId) setActiveTaskId(data.taskId);
      else {
        setTaskOutput(`[Error] ${data.error}`);
        setIsRunning(false);
      }
    } catch (err) {
      setTaskOutput(`[Error] ${err instanceof Error ? err.message : String(err)}`);
      setIsRunning(false);
    }
  };

  // ── Import URL ────────────────────────────────────────────────────────────
  const handleImportUrl = async (url: string, setError: (e: string) => void) => {
    if (!url.trim() || isRunning) return;
    setError("");
    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Must start with http:// or https://");
      return;
    }
    setActiveStep("import-url");
    setIsRunning(true);
    setTaskOutput(`[Importing: ${url}]\n`);
    try {
      const res = await fetch("/api/admin/import-url", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.taskId) setActiveTaskId(data.taskId);
      else {
        setTaskOutput(`[Error] ${data.error || "Unknown"}`);
        setIsRunning(false);
      }
    } catch (err) {
      setTaskOutput(`[Error] ${err instanceof Error ? err.message : String(err)}`);
      setIsRunning(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const viewTask = async (taskId: string, step: string) => {
    setActiveStep(step);
    setActiveTaskId(taskId);
    try {
      const res = await fetch(`/api/admin/task/${taskId}`);
      const data = await res.json();
      setTaskOutput(data.output || "");
    } catch { /* ignore */ }
  };

  const formatTs = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="kb-shell">
      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Admin Console</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <section className="kb-workspace" style={{ gap: "16px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 0 4px" }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Admin Console</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
            Run pipeline steps, import sources, and manage your knowledge base.
          </p>
        </div>

        {/* ── Task Terminal ─────────────────────────────────────────────────── */}
        <div className="kb-source-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
              Task Terminal
              {activeStep && <span style={{ color: "var(--brand)", marginLeft: "8px" }}>{activeStep}</span>}
            </span>
            {isRunning && (
              <span style={{
                background: "#f59e0b", color: "#fff",
                fontSize: "0.7rem", fontWeight: 700,
                padding: "2px 8px", borderRadius: "99px",
                textTransform: "uppercase", letterSpacing: "0.05em",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                Running
              </span>
            )}
            {!isRunning && taskOutput && (
              <span style={{
                background: taskOutput.includes("exit code: 1") ? "#ef4444" : "#22c55e",
                color: "#fff", fontSize: "0.7rem", fontWeight: 700,
                padding: "2px 8px", borderRadius: "99px",
                textTransform: "uppercase",
              }}>
                {taskOutput.includes("exit code: 1") ? "Failed" : "Done"}
              </span>
            )}
            <span style={{ flex: 1 }} />
            <button
              onClick={() => setTaskOutput("")}
              style={{
                background: "none", border: "1px solid var(--border)",
                borderRadius: "6px", padding: "3px 10px",
                fontSize: "0.75rem", cursor: "pointer", color: "var(--muted)",
              }}
            >
              Clear
            </button>
          </div>
          <div
            ref={terminalRef}
            style={{
              background: "#0d1117", color: "#e6edf3",
              fontFamily: "'Consolas', 'Courier New', monospace",
              fontSize: "0.78rem", lineHeight: "1.5",
              padding: "14px 16px",
              height: "240px", overflowY: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}
          >
            {taskOutput || (
              <span style={{ color: "#6e7681" }}>
                {"No task running. Click a pipeline step to start."}
              </span>
            )}
          </div>
        </div>

        {/* ── Import Sources ────────────────────────────────────────────────── */}
        <div className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Import Sources</h2>
          </div>

          {/* YouTube / X Video */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              YouTube or X/Twitter Video
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://youtu.be/... or https://x.com/user/status/..."
                value={youtubeUrl}
                onChange={(e) => { setYoutubeUrl(e.target.value); setYtError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl(youtubeUrl, setYtError)}
                style={{
                  flex: 1, padding: "8px 12px",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  fontSize: "0.85rem", background: "var(--bg)",
                  outline: "none",
                }}
              />
              <button
                onClick={() => handleImportUrl(youtubeUrl, setYtError)}
                disabled={isRunning || !youtubeUrl.trim()}
                style={{
                  background: isRunning ? "var(--border)" : "#f59e0b",
                  color: "#fff", border: "none", borderRadius: "8px",
                  padding: "8px 18px", fontWeight: 600, fontSize: "0.85rem",
                  cursor: isRunning ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {isRunning && activeStep === "import-url" ? "Importing…" : "Import"}
              </button>
            </div>
            {ytError && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px" }}>{ytError}</p>}
            <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "4px" }}>
              Downloads audio, transcribes with Whisper, then runs full pipeline automatically.
            </p>
          </div>

          {/* Any URL */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Any Article URL <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Phase 13 — coming soon)</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                placeholder="https://example.com/article..."
                value={importUrl}
                onChange={(e) => { setImportUrl(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleImportUrl(importUrl, setUrlError)}
                style={{
                  flex: 1, padding: "8px 12px",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  fontSize: "0.85rem", background: "var(--bg)", opacity: 0.6,
                }}
              />
              <button
                disabled
                style={{
                  background: "var(--border)", color: "var(--muted)",
                  border: "none", borderRadius: "8px",
                  padding: "8px 18px", fontWeight: 600, fontSize: "0.85rem",
                  cursor: "not-allowed", whiteSpace: "nowrap",
                }}
              >
                Soon
              </button>
            </div>
            {urlError && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "4px" }}>{urlError}</p>}
          </div>

          {/* PDF Upload */}
          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              PDF Upload <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Phase 13 — coming soon)</span>
            </label>
            <div style={{
              border: "2px dashed var(--border)", borderRadius: "8px",
              padding: "20px", textAlign: "center",
              background: "var(--bg)", opacity: 0.6,
            }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
                PDF ingestion will be available in Phase 13.
              </p>
            </div>
          </div>
        </div>

        {/* ── Pipeline Controls ─────────────────────────────────────────────── */}
        <div className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Pipeline Controls</h2>
            <span className="see-all" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Runs are logged in data/tasks/
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", marginBottom: "14px" }}>
            {PIPELINE_STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => runStep(s.id)}
                disabled={isRunning}
                title={s.desc}
                style={{
                  background: isRunning ? "var(--bg)" : "var(--surface)",
                  border: `2px solid ${isRunning ? "var(--border)" : s.color + "44"}`,
                  borderRadius: "10px",
                  padding: "12px 14px",
                  cursor: isRunning ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isRunning ? "var(--muted)" : s.color }}>
                  {s.label}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "2px" }}>
                  {s.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Full pipeline button */}
          <button
            onClick={runFullPipeline}
            disabled={isRunning}
            style={{
              width: "100%",
              background: isRunning ? "var(--border)" : "var(--brand)",
              color: "#fff", border: "none", borderRadius: "10px",
              padding: "13px", fontWeight: 700, fontSize: "0.9rem",
              cursor: isRunning ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {isRunning && activeStep === "pipeline" ? "Pipeline Running…" : "Run Full Pipeline (extract → classify → courses → wiki → graph)"}
          </button>

          {/* Refresh X session button */}
          <button
            onClick={() => runStep("set-cookies")}
            disabled={isRunning}
            style={{
              marginTop: "10px", width: "100%",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "8px", padding: "9px",
              fontWeight: 600, fontSize: "0.82rem",
              cursor: isRunning ? "not-allowed" : "pointer",
              color: "var(--muted)",
            }}
          >
            Refresh X Session Cookies (from .env)
          </button>
        </div>

        {/* ── AI Prompts Editor ─────────────────────────────────────────────── */}
        <div className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">AI Prompts</h2>
            <span className="see-all" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Edits take effect on the next pipeline run
            </span>
          </div>

          {([
            { key: "compile_course_system",       label: "Course Generation — System Prompt",     rows: 4 },
            { key: "compile_course_instructions", label: "Course Generation — Instructions",       rows: 8 },
            { key: "summarize_topic_system",       label: "Topic Wiki — System Prompt",            rows: 4 },
            { key: "summarize_topic_instructions", label: "Topic Wiki — Instructions",             rows: 8 },
            { key: "classify_source_system",       label: "Source Classifier — System Prompt",    rows: 3 },
            { key: "classify_source_instructions", label: "Source Classifier — Instructions",     rows: 5 },
          ] as { key: string; label: string; rows: number }[]).map(({ key, label, rows }) => (
            <div key={key} style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "5px", color: "var(--text)" }}>
                {label}
              </label>
              <textarea
                rows={rows}
                value={prompts[key] ?? ""}
                onChange={(e) => setPrompts((p) => ({ ...p, [key]: e.target.value }))}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 10px",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  fontSize: "0.78rem", fontFamily: "'Consolas', monospace",
                  background: "var(--bg)", color: "var(--text)",
                  resize: "vertical", lineHeight: "1.5",
                }}
              />
            </div>
          ))}

          <button
            onClick={savePrompts}
            disabled={promptsSaving}
            style={{
              background: promptsSaved ? "#22c55e" : "var(--brand)",
              color: "#fff", border: "none", borderRadius: "8px",
              padding: "9px 22px", fontWeight: 700, fontSize: "0.85rem",
              cursor: promptsSaving ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {promptsSaving ? "Saving…" : promptsSaved ? "Saved!" : "Save Prompts"}
          </button>
        </div>

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        <div className="kb-source-panel">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
            <button
              onClick={refreshTasks}
              style={{
                background: "none", border: "1px solid var(--border)",
                borderRadius: "6px", padding: "3px 10px",
                fontSize: "0.75rem", cursor: "pointer", color: "var(--muted)",
              }}
            >
              Refresh
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No tasks yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {recentTasks.slice(0, 15).map((t) => (
                <div
                  key={t.taskId}
                  onClick={() => viewTask(t.taskId, t.step)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", borderRadius: "8px",
                    background: "var(--bg)", cursor: "pointer",
                    border: "1px solid transparent",
                    transition: "border-color 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                  <span style={{
                    width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                    background: !t.done ? "#f59e0b" : t.failed ? "#ef4444" : "#22c55e",
                  }} />
                  <span style={{ fontWeight: 600, fontSize: "0.82rem", minWidth: "120px" }}>{t.step}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.summary.replace(/^\[task\]/, "").trim()}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {formatTs(t.ts)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="kb-right" aria-label="System status">
        <div>
          <h2 className="kb-right-title">System Status</h2>
          <p className="kb-right-sub">Knowledge base health</p>
          {stats ? (
            <div className="kb-widget" style={{ marginTop: "12px" }}>
              <div className="vault-row"><span>Sources</span><strong>{stats.sources_total ?? "—"}</strong></div>
              <div className="vault-row"><span>Courses</span><strong>{stats.courses_total ?? "—"}</strong></div>
              <div className="vault-row"><span>Topics</span><strong>{stats.topics_total ?? "—"}</strong></div>
              {(stats.sources_pending_extract ?? 0) > 0 && (
                <div className="vault-row" style={{ color: "#f59e0b" }}>
                  <span>Pending extract</span><strong>{stats.sources_pending_extract}</strong>
                </div>
              )}
              {(stats.sources_pending_classify ?? 0) > 0 && (
                <div className="vault-row" style={{ color: "#f59e0b" }}>
                  <span>Pending classify</span><strong>{stats.sources_pending_classify}</strong>
                </div>
              )}
              {(stats.sources_pending_course ?? 0) > 0 && (
                <div className="vault-row" style={{ color: "#f59e0b" }}>
                  <span>Pending courses</span><strong>{stats.sources_pending_course}</strong>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Loading…</p>
          )}
        </div>

        <div>
          <p className="kb-widget-title">Pipeline Order</p>
          <div className="kb-widget">
            {["Pull X Likes", "Extract Sources", "Classify Topics", "Compile Courses", "Summarize Topics", "Build Graph"].map((step, i) => (
              <div key={i} className="vault-row">
                <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>{i + 1}</span>
                <span style={{ fontSize: "0.78rem" }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="kb-widget-title">Schedule</p>
          <div className="kb-widget">
            <div className="vault-row"><span>Daily at</span><strong>6:00 AM</strong></div>
            <div className="vault-row"><span>Limit</span><strong>50 likes/day</strong></div>
            <div className="vault-row"><span>Mode</span><strong>Incremental</strong></div>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "6px" }}>
            Task Scheduler runs <code>start-scheduled.bat</code> daily.
          </p>
        </div>

        <div>
          <button
            onClick={refreshStats}
            style={{
              width: "100%",
              background: "none", border: "1px solid var(--border)",
              borderRadius: "8px", padding: "9px",
              fontWeight: 600, fontSize: "0.82rem",
              cursor: "pointer", color: "var(--muted)",
            }}
          >
            Refresh Stats
          </button>
        </div>
      </aside>
    </main>
  );
}
