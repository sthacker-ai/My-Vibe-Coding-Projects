import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PROMPTS_PATH = path.join(process.cwd(), "data", "prompts.json");

const PROMPT_KEYS = [
  "compile_course_system",
  "compile_course_instructions",
  "summarize_topic_system",
  "summarize_topic_instructions",
  "classify_source_system",
  "classify_source_instructions",
];

export async function GET() {
  try {
    if (!fs.existsSync(PROMPTS_PATH)) {
      return NextResponse.json({ prompts: {} });
    }
    const raw = fs.readFileSync(PROMPTS_PATH, "utf8");
    const all = JSON.parse(raw);
    // Return only the editable prompt keys (strip _comment)
    const prompts: Record<string, string> = {};
    for (const key of PROMPT_KEYS) {
      if (typeof all[key] === "string") prompts[key] = all[key];
    }
    return NextResponse.json({ prompts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Read existing file (to preserve _comment and any extra keys)
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(PROMPTS_PATH)) {
      try {
        existing = JSON.parse(fs.readFileSync(PROMPTS_PATH, "utf8"));
      } catch {
        existing = {};
      }
    }

    // Only allow updating known prompt keys
    for (const key of PROMPT_KEYS) {
      if (typeof body[key] === "string") {
        existing[key] = body[key];
      }
    }

    fs.writeFileSync(PROMPTS_PATH, JSON.stringify(existing, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
