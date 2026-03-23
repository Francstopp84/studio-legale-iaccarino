import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { generateExamQuestionsAI } from "@/lib/ai";

// GET — list simulations
export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("course_id");
  const type = req.nextUrl.searchParams.get("type");

  let query = "SELECT * FROM simulations WHERE 1=1";
  const params: any[] = [];

  if (courseId) { query += " AND course_id = ?"; params.push(Number(courseId)); }
  if (type) { query += " AND type = ?"; params.push(type); }

  query += " ORDER BY created_at DESC LIMIT 50";

  return NextResponse.json(db.prepare(query).all(...params));
}

// POST — create simulation
export async function POST(req: NextRequest) {
  const { course_id, type } = await req.json();

  if (!course_id || !type) {
    return NextResponse.json({ error: "course_id e type richiesti" }, { status: 400 });
  }

  // Get course concepts for generating questions
  const concepts = db.prepare(
    "SELECT title, explanation FROM concepts WHERE course_id = ? ORDER BY order_index"
  ).all(Number(course_id)) as any[];

  if (concepts.length === 0) {
    return NextResponse.json({ error: "Il corso non ha concetti" }, { status: 400 });
  }

  let structure;
  if (type === "exam") {
    const conceptTitles = concepts.map((c: any) => c.title);
    const questions = await generateExamQuestionsAI(conceptTitles, Math.min(10, concepts.length));
    structure = JSON.stringify(questions);
  } else {
    // arringa — structure is created by the user later
    structure = JSON.stringify({ pillars: [], thesis: "" });
  }

  const result = db.prepare(`
    INSERT INTO simulations (course_id, type, structure) VALUES (?, ?, ?)
  `).run(Number(course_id), type, structure);

  return NextResponse.json({
    id: result.lastInsertRowid,
    type,
    structure: JSON.parse(structure),
  });
}

// PATCH — save simulation result
export async function PATCH(req: NextRequest) {
  const { simulation_id, user_transcript, coverage_map, ai_feedback, score, duration_seconds } = await req.json();

  if (!simulation_id) {
    return NextResponse.json({ error: "simulation_id richiesto" }, { status: 400 });
  }

  db.prepare(`
    UPDATE simulations SET user_transcript = ?, coverage_map = ?, ai_feedback = ?, score = ?, duration_seconds = ?
    WHERE id = ?
  `).run(
    user_transcript || null,
    coverage_map ? JSON.stringify(coverage_map) : null,
    ai_feedback || null,
    score || 0,
    duration_seconds || 0,
    simulation_id
  );

  return NextResponse.json({ success: true });
}
