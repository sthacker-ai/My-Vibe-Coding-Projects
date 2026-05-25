import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const ROOT      = process.cwd();
const TASKS_DIR = path.join(ROOT, "data", "tasks");

// Allowlist — ONLY these steps can be triggered via the API
const STEPS: Record<string, string[]> = {
  "import-likes":  ["node", "scripts/import-x-likes.js", "--limit", "25"],
  "set-cookies":   ["node", "scripts/import-x-likes.js", "--set-cookies"],
  "extract":       ["node", "scripts/import-x-source.js"],
  "classify":      ["node", "scripts/classify-source.js"],
  "courses":       ["node", "scripts/compile-course.js"],
  "summarize":     ["node", "scripts/update-topic-summary.js"],
  "graph":         ["node", "scripts/build-graph.js"],
  "pipeline":           ["node", "scripts/run-pipeline.js"],
  "transcripts":        ["node", "scripts/extract-transcripts.js"],
  "generate-assets":    ["node", "scripts/generate-course-assets.js"],
  "generate-podcasts":  ["node", "scripts/generate-podcast.js"],
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const step = typeof body.step === "string" ? body.step.trim() : "";
  if (!STEPS[step]) {
    return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
  }

  const extraArgs: string[] = Array.isArray(body.extraArgs)
    ? (body.extraArgs as unknown[]).filter((a) => typeof a === "string").map(String)
    : [];

  fs.mkdirSync(TASKS_DIR, { recursive: true });

  const taskId  = `${Date.now()}-${step}`;
  const logPath = path.join(TASKS_DIR, `${taskId}.log`);

  fs.writeFileSync(
    logPath,
    `[task] step=${step}\n[task] started=${new Date().toISOString()}\n\n`,
    "utf8"
  );

  const [cmd, ...baseArgs] = STEPS[step];
  const child = spawn(cmd, [...baseArgs, ...extraArgs], {
    cwd:  ROOT,
    env:  { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TERM: "dumb" },
    shell: false,
  });

  const appendLog = (data: Buffer | string) => {
    try { fs.appendFileSync(logPath, data.toString(), "utf8"); } catch { /* ignore */ }
  };

  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  child.on("close", (code) => {
    fs.appendFileSync(logPath, `\n[task] DONE — exit code: ${code ?? 0}\n`, "utf8");
  });
  child.on("error", (err: Error) => {
    fs.appendFileSync(logPath, `\n[task] SPAWN ERROR: ${err.message}\n[task] DONE — exit code: 1\n`, "utf8");
  });

  return NextResponse.json({ taskId, step });
}
