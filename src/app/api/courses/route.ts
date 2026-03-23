import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/courses — list all courses with stats
export async function GET() {
  const courses = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM concepts WHERE course_id = c.id) as total_concepts,
      (SELECT COUNT(*) FROM concepts WHERE course_id = c.id AND mastery_score >= 80) as mastered_concepts,
      (SELECT COUNT(*) FROM course_documents WHERE course_id = c.id) as document_count
    FROM courses c
    ORDER BY c.updated_at DESC
  `).all();
  return NextResponse.json(courses);
}

// POST /api/courses — create a new course
// Il testo dei documenti diventa DIRETTAMENTE la lezione (zero AI)
export async function POST(req: NextRequest) {
  const { title, description, instructions, document_ids } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "Titolo richiesto" }, { status: 400 });
  }

  const result = db.prepare(
    "INSERT INTO courses (title, description, instructions) VALUES (?, ?, ?)"
  ).run(title, description || null, instructions || null);

  const courseId = result.lastInsertRowid;

  // Link documents if provided
  if (document_ids && Array.isArray(document_ids)) {
    const insertDoc = db.prepare(
      "INSERT OR IGNORE INTO course_documents (course_id, document_id, order_index) VALUES (?, ?, ?)"
    );
    document_ids.forEach((docId: number, index: number) => {
      insertDoc.run(courseId, docId, index);
    });

    // Salva il testo dei documenti DIRETTAMENTE come lesson_tecnico (zero AI)
    const docs = db.prepare(
      `SELECT d.title, d.content FROM documents d
       JOIN course_documents cd ON d.id = cd.document_id
       WHERE cd.course_id = ? ORDER BY cd.order_index`
    ).all(courseId) as { title: string; content: string }[];

    if (docs.length > 0) {
      const sections = docs.map((d, i) => ({
        title: d.title || `Parte ${i + 1}`,
        content: (d.content || "").trim(),
      })).filter(s => s.content.length > 50);

      // Se c'e un solo documento, prova a splittarlo in sezioni per headers
      if (sections.length === 1 && sections[0].content.length > 3000) {
        const split = splitTextIntoSections(sections[0].content, title);
        if (split.length > 1) sections.splice(0, 1, ...split);
      }

      const lesson = JSON.stringify({ sections });
      db.prepare("UPDATE courses SET lesson_tecnico = ?, lesson_simple = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(lesson, lesson, courseId);

      console.log(`[COURSE] Created course ${courseId} with ${sections.length} sections directly from documents (no AI)`);
    }
  }

  return NextResponse.json({ id: courseId, title });
}

// Split un testo lungo in sezioni basate su headers
function splitTextIntoSections(text: string, fallbackTitle: string): { title: string; content: string }[] {
  // Prova a splittare per headers markdown (## o ###)
  let parts = text.split(/\n(?=#{2,3}\s+)/).map(c => c.trim()).filter(c => c.length > 100);

  // Prova "Capitolo N"
  if (parts.length < 3) {
    parts = text.split(/\n(?=(?:\*\*)?Capitolo\s+\d)/i).map(c => c.trim()).filter(c => c.length > 100);
  }

  // Prova sezioni numerate in grassetto (**1.** o **1.1.**)
  if (parts.length < 3) {
    parts = text.split(/\n(?=\*\*\d+\.\s)/).map(c => c.trim()).filter(c => c.length > 200);
    // Raggruppa sezioni troppo piccole (~500 parole per sezione)
    if (parts.length > 12) {
      const grouped: string[] = [];
      let current = "";
      for (const chunk of parts) {
        current += (current ? "\n\n" : "") + chunk;
        if (current.split(/\s+/).length >= 400) {
          grouped.push(current);
          current = "";
        }
      }
      if (current.trim()) grouped.push(current);
      parts = grouped;
    }
  }

  if (parts.length < 2) return [{ title: fallbackTitle, content: text }];

  return parts.map((raw, i) => {
    const lines = raw.split("\n");
    let title = lines[0].replace(/^[#*\s]+/, "").replace(/\*\*/g, "").trim();
    if (title.length > 80) title = title.slice(0, 60) + "...";
    if (title.length < 5) title = `Sezione ${i + 1}`;
    const contentStart = (lines[0].length < 100 && lines.length > 1) ? 1 : 0;
    return { title, content: lines.slice(contentStart).join("\n").trim() || raw };
  });
}
