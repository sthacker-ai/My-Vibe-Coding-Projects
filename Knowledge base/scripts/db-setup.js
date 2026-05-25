#!/usr/bin/env node
/**
 * scripts/db-setup.js
 *
 * Creates the PostgreSQL tables required for the KnowledgeBase learning tracker.
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 *
 * Usage: npm run db:setup
 *
 * Required: DATABASE_URL in .env
 *   e.g. postgresql://postgres:PASSWORD@localhost:5432/KnowledgeBase
 */
"use strict";

require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes("YOUR_PASSWORD")) {
  console.error("[db-setup] ERROR: Set DATABASE_URL in .env with your actual PostgreSQL password.");
  console.error("  Example: DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/KnowledgeBase");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const SCHEMA = `
-- Tracks whether a course has been started / completed
CREATE TABLE IF NOT EXISTS learning_progress (
  id              SERIAL PRIMARY KEY,
  course_id       TEXT NOT NULL,          -- e.g. "ai-agents/course-001"
  topic_slug      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'not_started',
                                          -- 'not_started' | 'in_progress' | 'completed'
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  time_spent_sec  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id)
);

-- Individual reading/study sessions for a course
CREATE TABLE IF NOT EXISTS reading_sessions (
  id           SERIAL PRIMARY KEY,
  course_id    TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_course    ON reading_sessions (course_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_date      ON reading_sessions (session_date);

-- Daily activity streaks
CREATE TABLE IF NOT EXISTS daily_streaks (
  streak_date    DATE PRIMARY KEY,
  minutes_spent  INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline run history (written by scheduled-daily.js and admin panel)
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            SERIAL PRIMARY KEY,
  run_id        TEXT UNIQUE NOT NULL,      -- e.g. "scheduled-2026-05-25"
  trigger       TEXT NOT NULL DEFAULT 'scheduled',
  run_date      DATE,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  duration_secs DECIMAL,
  status        TEXT NOT NULL DEFAULT 'running',
  steps         JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date   ON pipeline_runs (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs (status);

-- Token usage records (written by scripts/lib/ai-client.js)
CREATE TABLE IF NOT EXISTS token_usage (
  id                SERIAL PRIMARY KEY,
  ts                TIMESTAMPTZ NOT NULL,
  label             TEXT NOT NULL,
  model             TEXT NOT NULL,
  provider          TEXT NOT NULL DEFAULT 'OpenRouter',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_usage_ts    ON token_usage (ts DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage (model);
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_ts_label ON token_usage (ts, label);

-- Course index (metadata about generated courses, updated by pipeline)
CREATE TABLE IF NOT EXISTS course_index (
  id           SERIAL PRIMARY KEY,
  course_id    TEXT UNIQUE NOT NULL,   -- "{topic}/{slug}" e.g. "ai-agents/course-001"
  topic_slug   TEXT NOT NULL,
  course_slug  TEXT NOT NULL,
  title        TEXT,
  source_id    TEXT,
  word_count   INTEGER NOT NULL DEFAULT 0,
  has_hero     BOOLEAN NOT NULL DEFAULT FALSE,
  has_podcast  BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_index_topic ON course_index (topic_slug);
`;

async function setup() {
  const client = await pool.connect();
  try {
    console.log("[db-setup] Connecting to:", DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));
    await client.query(SCHEMA);
    console.log("[db-setup] Tables created (or already exist):");
    console.log("  - learning_progress");
    console.log("  - reading_sessions");
    console.log("  - daily_streaks");
    console.log("  - pipeline_runs");
    console.log("  - token_usage");
    console.log("  - course_index");
    console.log("[db-setup] Done.");
  } catch (err) {
    console.error("[db-setup] ERROR:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
