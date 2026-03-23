import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/courses/[id]/concepts — list concepts for a course
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const concepts = db.prepare(
    "SELECT * FROM concepts WHERE course_id = ? ORDER BY order_index"
  ).all(Number(id));
  return NextResponse.json(concepts);
}

// POST /api/courses/[id]/concepts — bulk create concepts
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { concepts } = await req.json();

  if (!Array.isArray(concepts) || concepts.length === 0) {
    return NextResponse.json({ error: "Array di concetti richiesto" }, { status: 400 });
  }

  const insert = db.prepare(`
    INSERT INTO concepts (course_id, document_id, title, explanation, keywords, order_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: any[]) => {
    items.forEach((c, i) => {
      insert.run(
        Number(id),
        c.document_id || null,
        c.title,
        c.explanation || null,
        c.keywords ? JSON.stringify(c.keywords) : null,
        c.order_index ?? i
      );
    });
  });

  insertMany(concepts);

  // Update course total
  const count = db.prepare("SELECT COUNT(*) as n FROM concepts WHERE course_id = ?").get(Number(id)) as any;
  db.prepare("UPDATE courses SET total_concepts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(count.n, Number(id));

  return NextResponse.json({ count: concepts.length });
}

// PATCH /api/courses/[id]/concepts — update a single concept
export async function PATCH(req: NextRequest) {
  const { concept_id, mastery_score, bloom_level, next_review, last_studied, times_studied, times_correct } = await req.json();

  if (!concept_id) {
    return NextResponse.json({ error: "concept_id richiesto" }, { status: 400 });
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (mastery_score !== undefined) { fields.push("mastery_score = ?"); values.push(mastery_score); }
  if (bloom_level !== undefined) { fields.push("bloom_level = ?"); values.push(bloom_level); }
  if (next_review !== undefined) { fields.push("next_review = ?"); values.push(next_review); }
  if (last_studied !== undefined) { fields.push("last_studied = ?"); values.push(last_studied); }
  if (times_studied !== undefined) { fields.push("times_studied = ?"); values.push(times_studied); }
  if (times_correct !== undefined) { fields.push("times_correct = ?"); values.push(times_correct); }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nessun campo" }, { status: 400 });
  }

  values.push(concept_id);
  db.prepare(`UPDATE concepts SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return NextResponse.json({ success: true });
}
