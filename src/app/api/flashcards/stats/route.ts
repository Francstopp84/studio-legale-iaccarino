import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const toReview = (db.prepare(
      "SELECT COUNT(*) as count FROM flashcards WHERE next_review <= datetime('now')"
    ).get() as any)?.count ?? 0;

    const neverStudied = (db.prepare(
      "SELECT COUNT(*) as count FROM flashcards WHERE repetitions = 0"
    ).get() as any)?.count ?? 0;

    const alreadyStudied = (db.prepare(
      "SELECT COUNT(*) as count FROM flashcards WHERE repetitions > 0 AND next_review > datetime('now')"
    ).get() as any)?.count ?? 0;

    return NextResponse.json({ toReview, neverStudied, alreadyStudied });
  } catch (error) {
    console.error("Flashcard stats error:", error);
    return NextResponse.json({ toReview: 0, neverStudied: 0, alreadyStudied: 0 });
  }
}
