import { NextResponse } from "next/server";
import { getKbStats } from "../../../lib/kb-data";

export async function GET() {
  try {
    const stats = await getKbStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}
