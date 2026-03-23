import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { evaluateArticulationAI } from "@/lib/ai";

// POST — submit articulation for AI evaluation
export async function POST(req: NextRequest) {
  const { concept_id, user_response } = await req.json();

  if (!concept_id || !user_response) {
    return NextResponse.json({ error: "concept_id e user_response richiesti" }, { status: 400 });
  }

  // Get concept details
  const concept = db.prepare("SELECT * FROM concepts WHERE id = ?").get(concept_id) as any;
  if (!concept) {
    return NextResponse.json({ error: "Concetto non trovato" }, { status: 404 });
  }

  // Evaluate with AI
  const evaluation = await evaluateArticulationAI(
    concept.title,
    concept.explanation || "",
    user_response
  );

  const passed = (evaluation.completeness + evaluation.accuracy + evaluation.terminology) / 3 >= 70 ? 1 : 0;

  // Save articulation
  const result = db.prepare(`
    INSERT INTO articulations (concept_id, user_response, completeness_score, accuracy_score, terminology_score, ai_feedback, passed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(concept_id, user_response, evaluation.completeness, evaluation.accuracy, evaluation.terminology, evaluation.feedback, passed);

  // Update concept mastery
  const avgScore = (evaluation.completeness + evaluation.accuracy + evaluation.terminology) / 3;
  const newMastery = Math.min(100, concept.mastery_score * 0.6 + avgScore * 0.4);
  db.prepare(`
    UPDATE concepts SET mastery_score = ?, times_studied = times_studied + 1,
    times_correct = times_correct + ?, last_studied = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newMastery, passed, concept_id);

  return NextResponse.json({
    id: result.lastInsertRowid,
    ...evaluation,
    passed: !!passed,
    mastery_score: newMastery,
  });
}
