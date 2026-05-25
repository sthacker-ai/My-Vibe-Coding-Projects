/**
 * app/lib/db.ts
 *
 * PostgreSQL connection pool for the KnowledgeBase app.
 * Used for: learning_progress, reading_sessions, daily_streaks.
 * Content data (courses, wiki, sources) remains file-based.
 *
 * Requires: DATABASE_URL in .env
 *   e.g. postgresql://postgres:PASSWORD@localhost:5432/KnowledgeBase
 */

import { Pool, type PoolClient } from "pg";

// Singleton pool — reused across requests in the Next.js process
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set in .env");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err.message);
    });
  }
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function query<T extends object = object>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client: PoolClient = await getPool().connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends object = object>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await query(sql, params);
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

export async function dbHealthCheck(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Like query(), but returns null instead of throwing on any error (DB down,
 * DATABASE_URL not set, table doesn't exist yet, etc.).
 * Use this for progressive-enhancement: try DB → fall back to files.
 */
export async function tryQuery<T extends object = object>(
  sql: string,
  params: unknown[] = []
): Promise<T[] | null> {
  try {
    return await query<T>(sql, params);
  } catch {
    return null;
  }
}
