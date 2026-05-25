import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT      = process.cwd();
const TASKS_DIR = path.join(ROOT, "data", "tasks");

export async function GET() {
  if (!fs.existsSync(TASKS_DIR)) {
    return NextResponse.json({ tasks: [] });
  }

  const files = fs
    .readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith(".log"))
    .sort()
    .reverse()
    .slice(0, 30); // last 30 tasks

  const tasks = files.map((f) => {
    const taskId  = f.replace(".log", "");
    const logPath = path.join(TASKS_DIR, f);
    let output = "";
    try { output = fs.readFileSync(logPath, "utf8"); } catch { /* ignore */ }

    const done    = output.includes("[task] DONE");
    const failed  = done && output.includes("exit code: 1");
    const stepMatch = taskId.match(/^\d+-(.+)$/);
    const step    = stepMatch ? stepMatch[1] : taskId;
    const tsMatch = taskId.match(/^(\d+)/);
    const ts      = tsMatch ? new Date(parseInt(tsMatch[1])).toISOString() : "";

    // Extract last non-empty line as summary
    const lines   = output.split("\n").filter((l) => l.trim());
    const summary = lines[lines.length - 1] || "";

    return { taskId, step, ts, done, failed, summary };
  });

  return NextResponse.json({ tasks });
}
