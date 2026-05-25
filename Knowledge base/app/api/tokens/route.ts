import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { tryQuery } from "../../lib/db";

const TOKEN_FILE = path.join(process.cwd(), "data", "token-usage.json");

export const dynamic = "force-dynamic";

interface TokenEntry {
  ts:                string;
  label:             string;
  model:             string;
  provider:          string;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
}

function buildResponse(entries: TokenEntry[]) {
  const byModel: Record<string, {
    model: string; provider: string; calls: number;
    prompt_tokens: number; completion_tokens: number; total_tokens: number;
  }> = {};

  for (const e of entries) {
    if (!byModel[e.model]) {
      byModel[e.model] = { model: e.model, provider: e.provider, calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    }
    byModel[e.model].calls++;
    byModel[e.model].prompt_tokens     += e.prompt_tokens     || 0;
    byModel[e.model].completion_tokens += e.completion_tokens || 0;
    byModel[e.model].total_tokens      += e.total_tokens      || 0;
  }

  const totals = {
    calls:             entries.length,
    prompt_tokens:     entries.reduce((s, e) => s + (e.prompt_tokens || 0), 0),
    completion_tokens: entries.reduce((s, e) => s + (e.completion_tokens || 0), 0),
    total_tokens:      entries.reduce((s, e) => s + (e.total_tokens || 0), 0),
  };

  return {
    byModel:       Object.values(byModel).sort((a, b) => b.total_tokens - a.total_tokens),
    totals,
    recentEntries: entries.slice(0, 30),
  };
}

export async function GET() {
  // ── 1. Try PostgreSQL ───────────────────────────────────────────────────────
  const rows = await tryQuery<TokenEntry>(
    `SELECT ts, label, model, provider, prompt_tokens, completion_tokens, total_tokens
     FROM token_usage
     ORDER BY ts DESC
     LIMIT 5000`
  );

  if (rows !== null) {
    return NextResponse.json({ ...buildResponse(rows), source: "db" });
  }

  // ── 2. Fall back to JSON file ───────────────────────────────────────────────
  let entries: TokenEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    entries = entries.slice().reverse(); // newest first
  } catch { /* no data yet */ }

  return NextResponse.json({ ...buildResponse(entries), source: "file" });
}
