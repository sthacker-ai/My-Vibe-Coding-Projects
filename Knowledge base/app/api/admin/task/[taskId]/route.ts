import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT      = process.cwd();
const TASKS_DIR = path.join(ROOT, "data", "tasks");

interface Params { taskId: string }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { taskId } = await params;

  // Prevent path traversal — only allow safe chars
  if (!/^[\w-]+$/.test(taskId)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const logPath = path.join(TASKS_DIR, `${taskId}.log`);
  if (!fs.existsSync(logPath)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const output = fs.readFileSync(logPath, "utf8");
  const done   = output.includes("[task] DONE");

  return NextResponse.json({ taskId, output, done });
}
