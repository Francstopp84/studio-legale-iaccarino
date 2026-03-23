import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const category = req.nextUrl.searchParams.get("category");
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") || "20"),
    50
  );

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query troppo corta (min 2 caratteri)" },
      { status: 400 }
    );
  }

  // Split query into words for better matching
  const words = q
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (words.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Build WHERE clause: each word must appear in content or heading
  const conditions = words.map(
    () => "(lc.content LIKE ? OR lc.heading LIKE ?)"
  );
  const params: any[] = [];
  for (const word of words) {
    const like = `%${word}%`;
    params.push(like, like);
  }

  let categoryFilter = "";
  if (category && category !== "all") {
    categoryFilter = " AND lb.category = ?";
    params.push(category);
  }

  params.push(limit);

  const results = db
    .prepare(
      `SELECT lc.id, lc.chunk_index, lc.content, lc.heading, lc.book_id,
              lb.title as book_title, lb.category
       FROM library_chunks lc
       JOIN library_books lb ON lb.id = lc.book_id
       WHERE ${conditions.join(" AND ")}${categoryFilter}
       ORDER BY lb.title, lc.chunk_index
       LIMIT ?`
    )
    .all(...params);

  return NextResponse.json({ results, query: q, count: results.length });
}
