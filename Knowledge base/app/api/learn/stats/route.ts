/**
 * GET /api/learn/stats
 *
 * Returns learning statistics from PostgreSQL.
 * Falls back gracefully if DB is not configured.
 */

import { NextResponse } from "next/server";
import { query, dbHealthCheck } from "../../../lib/db";

interface StreakRow { streak_date: string; minutes_spent: number }
interface ProgressRow { status: string; count: string; total_sec: string }
interface StatsResult {
  dbConnected: boolean;
  totalCoursesStarted: number;
  totalCoursesCompleted: number;
  totalMinutesLearned: number;
  currentStreakDays: number;
  longestStreakDays: number;
  todayMinutes: number;
  recentDays: { date: string; minutes: number }[];
}

export async function GET() {
  const dbConnected = await dbHealthCheck().catch(() => false);
  if (!dbConnected) {
    return NextResponse.json({
      dbConnected: false,
      totalCoursesStarted: 0,
      totalCoursesCompleted: 0,
      totalMinutesLearned: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      todayMinutes: 0,
      recentDays: [],
    } satisfies StatsResult);
  }

  try {
    // Progress counts
    const progressRows = await query<ProgressRow>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(time_spent_sec),0)::text AS total_sec
       FROM learning_progress
       GROUP BY status`
    );

    let totalCoursesStarted = 0;
    let totalCoursesCompleted = 0;
    let totalSec = 0;
    for (const row of progressRows) {
      const c = parseInt(row.count, 10);
      totalSec += parseInt(row.total_sec, 10);
      if (row.status === "in_progress")  totalCoursesStarted   += c;
      if (row.status === "completed")    totalCoursesCompleted += c;
    }

    // Daily streak data (last 90 days)
    const streakRows = await query<StreakRow>(
      `SELECT streak_date::text, minutes_spent
       FROM daily_streaks
       WHERE streak_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY streak_date DESC`
    );

    // Compute current streak
    let currentStreakDays = 0;
    let longestStreakDays = 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateSet = new Set(streakRows.map((r) => r.streak_date));

    for (let i = 0; i <= 90; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (dateSet.has(key)) {
        streak++;
        if (i === 0 || i === 1) currentStreakDays = streak; // today or yesterday keeps it alive
        longestStreakDays = Math.max(longestStreakDays, streak);
      } else {
        if (i > 1) break; // streak is broken
      }
    }

    const todayKey = today.toISOString().slice(0, 10);
    const todayRow = streakRows.find((r) => r.streak_date === todayKey);
    const todayMinutes = todayRow?.minutes_spent ?? 0;

    const recentDays = streakRows.slice(0, 14).map((r) => ({
      date: r.streak_date,
      minutes: r.minutes_spent,
    }));

    return NextResponse.json({
      dbConnected: true,
      totalCoursesStarted,
      totalCoursesCompleted,
      totalMinutesLearned: Math.round(totalSec / 60),
      currentStreakDays,
      longestStreakDays,
      todayMinutes,
      recentDays,
    } satisfies StatsResult);
  } catch (err) {
    console.error("[GET /api/learn/stats]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
