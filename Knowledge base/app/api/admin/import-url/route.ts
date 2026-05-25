import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const ROOT      = process.cwd();
const TASKS_DIR = path.join(ROOT, "data", "tasks");

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate URL structure
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 });
  }

  fs.mkdirSync(TASKS_DIR, { recursive: true });

  const taskId  = `${Date.now()}-import-url`;
  const logPath = path.join(TASKS_DIR, `${taskId}.log`);

  const isYouTube  = /youtube\.com|youtu\.be/.test(rawUrl);
  const isXTwitter = /(?:x|twitter)\.com/.test(rawUrl);

  fs.writeFileSync(
    logPath,
    `[task] Importing URL: ${rawUrl}\n[task] started=${new Date().toISOString()}\n\n`,
    "utf8"
  );

  let cmd: string[];

  if (isYouTube || isXTwitter) {
    cmd = ["node", "scripts/import-youtube.js", "--url", rawUrl];
  } else {
    // Generic article URL — Phase 13 feature
    fs.appendFileSync(
      logPath,
      "[task] Generic article URL import is coming in Phase 13.\n" +
      "[task] For now, please use YouTube or X/Twitter video URLs.\n" +
      "[task] DONE — exit code: 0\n",
      "utf8"
    );
    return NextResponse.json({ taskId, step: "import-url", note: "generic-pending" });
  }

  const child = spawn(cmd[0], cmd.slice(1), {
    cwd:  ROOT,
    env:  { ...process.env, FORCE_COLOR: "0" },
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

  return NextResponse.json({ taskId, step: "import-url" });
}
