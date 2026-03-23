import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { expandChapterAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

// POST /api/courses/[id]/lesson/expand — Expand a single chapter
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  const body = await req.json().catch(() => ({}));
  const { chapterIndex } = body;
  const mode = body.mode || "tecnico";
  const col = mode === "tecnico" ? "lesson_tecnico" : "lesson_simple";

  if (typeof chapterIndex !== "number") {
    return NextResponse.json({ error: "chapterIndex richiesto" }, { status: 400 });
  }

  const course = db.prepare(`SELECT title, ${col} as lesson_json FROM courses WHERE id = ?`).get(courseId) as any;
  if (!course || !course.lesson_json) {
    return NextResponse.json({ error: "Lezione non trovata" }, { status: 404 });
  }

  let lesson: { sections: { title: string; content: string }[] };
  try {
    lesson = JSON.parse(course.lesson_json);
  } catch {
    return NextResponse.json({ error: "Lezione corrotta" }, { status: 500 });
  }

  if (chapterIndex < 0 || chapterIndex >= lesson.sections.length) {
    return NextResponse.json({ error: "Indice capitolo non valido" }, { status: 400 });
  }

  const chapter = lesson.sections[chapterIndex];

  // Get all document content for reference
  const docs = db.prepare(`
    SELECT d.content FROM documents d
    JOIN course_documents cd ON d.id = cd.document_id
    WHERE cd.course_id = ? ORDER BY cd.order_index
  `).all(courseId) as any[];
  const fullMaterial = docs.map(d => d.content || "").join("\n\n---\n\n");

  try {
    const expanded = await expandChapterAI(
      course.title, chapter.title, chapter.content, fullMaterial
    );

    // Update the chapter in the lesson
    lesson.sections[chapterIndex].content = expanded;

    // Save back to DB
    db.prepare(`UPDATE courses SET ${col} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(JSON.stringify(lesson), courseId);

    return NextResponse.json({
      section: lesson.sections[chapterIndex],
      chapterIndex,
      wordCount: expanded.split(/\s+/).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Espansione fallita: ${err.message}` }, { status: 500 });
  }
}
