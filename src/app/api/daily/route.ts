import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET — what to do today
export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Due flashcards
  const dueCards = db.prepare(
    "SELECT COUNT(*) as count FROM flashcards WHERE next_review <= datetime('now')"
  ).get() as any;

  // Weak concepts (mastery < 60)
  const weakConcepts = db.prepare(`
    SELECT c.id, c.title, c.mastery_score, c.course_id, co.title as course_title
    FROM concepts c
    JOIN courses co ON co.id = c.course_id
    WHERE c.mastery_score < 60
    ORDER BY c.mastery_score ASC
    LIMIT 5
  `).all();

  // Concepts due for review
  const dueReview = db.prepare(
    "SELECT COUNT(*) as count FROM concepts WHERE next_review <= datetime('now')"
  ).get() as any;

  // Today's progress
  let progress = db.prepare("SELECT * FROM daily_progress WHERE date = ?").get(today) as any;
  if (!progress) {
    db.prepare("INSERT OR IGNORE INTO daily_progress (date) VALUES (?)").run(today);
    progress = db.prepare("SELECT * FROM daily_progress WHERE date = ?").get(today);
  }

  // Streak
  const streak = calculateStreak();

  return NextResponse.json({
    due_flashcards: dueCards.count,
    due_review: dueReview.count,
    weak_concepts: weakConcepts,
    progress,
    streak,
    estimated_minutes: Math.max(5, dueCards.count * 0.5 + (weakConcepts as any[]).length * 3),
  });
}

// POST — log daily progress
export async function POST(req: NextRequest) {
  const { concepts_studied, flashcards_reviewed, articulations_done, simulations_done, minutes } = await req.json();
  const today = new Date().toISOString().split("T")[0];

  db.prepare(`
    INSERT INTO daily_progress (date, concepts_studied, flashcards_reviewed, articulations_done, simulations_done, total_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      concepts_studied = concepts_studied + excluded.concepts_studied,
      flashcards_reviewed = flashcards_reviewed + excluded.flashcards_reviewed,
      articulations_done = articulations_done + excluded.articulations_done,
      simulations_done = simulations_done + excluded.simulations_done,
      total_minutes = total_minutes + excluded.total_minutes
  `).run(today, concepts_studied || 0, flashcards_reviewed || 0, articulations_done || 0, simulations_done || 0, minutes || 0);

  return NextResponse.json({ success: true });
}

function calculateStreak(): number {
  const rows = db.prepare(
    "SELECT date FROM daily_progress WHERE total_minutes > 0 ORDER BY date DESC LIMIT 60"
  ).all() as any[];

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (rows.some((r: any) => r.date === dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}
