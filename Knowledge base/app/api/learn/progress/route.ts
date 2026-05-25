/**
 * POST /api/learn/progress
 *
 * Upserts learning progress for a course.
 * Body: { courseId: string, topicSlug: string, status: "in_progress" | "completed", durationSec?: number }
 */

import { NextResponse } from "next/server";
import { query, execute } from "../../../lib/db";

interface ProgressRow {
  id: number;
  course_id: string;
  status: string;
  time_spent_sec: number;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { courseId, topicSlug, status, durationSec = 0 } = body as {
      courseId: string;
      topicSlug: string;
      status: "in_progress" | "completed";
      durationSec?: number;
    };

    if (!courseId || !topicSlug || !status) {
      return NextResponse.json({ error: "courseId, topicSlug, and status are required" }, { status: 400 });
    }
    if (!["in_progress", "completed"].includes(status)) {
      return NextResponse.json({ error: "status must be in_progress or completed" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Check if row exists
    const existing = await query<ProgressRow>(
      "SELECT id, status, time_spent_sec FROM learning_progress WHERE course_id = $1",
      [courseId]
    );

    if (existing.length === 0) {
      // Insert new
      await execute(
        `INSERT INTO learning_progress
           (course_id, topic_slug, status, started_at, completed_at, time_spent_sec, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          courseId,
          topicSlug,
          status,
          now, // started_at
          status === "completed" ? now : null,
          durationSec,
        ]
      );
    } else {
      const row = existing[0];
      const newDuration = (row.time_spent_sec ?? 0) + durationSec;
      await execute(
        `UPDATE learning_progress
            SET status = $1,
                completed_at = $2,
                time_spent_sec = $3,
                updated_at = NOW()
          WHERE course_id = $4`,
        [
          status,
          status === "completed" ? now : null,
          newDuration,
          courseId,
        ]
      );
    }

    // Log reading session
    if (durationSec > 0) {
      await execute(
        `INSERT INTO reading_sessions (course_id, session_date, duration_sec)
         VALUES ($1, CURRENT_DATE, $2)`,
        [courseId, durationSec]
      );

      // Update daily streak
      await execute(
        `INSERT INTO daily_streaks (streak_date, minutes_spent, sessions_count)
         VALUES (CURRENT_DATE, $1, 1)
         ON CONFLICT (streak_date) DO UPDATE
           SET minutes_spent  = daily_streaks.minutes_spent  + EXCLUDED.minutes_spent,
               sessions_count = daily_streaks.sessions_count + 1,
               updated_at     = NOW()`,
        [Math.round(durationSec / 60)]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/learn/progress]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
