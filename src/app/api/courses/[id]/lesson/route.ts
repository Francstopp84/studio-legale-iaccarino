import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/courses/[id]/lesson — Get lesson (cached or built from documents)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  const mode = req.nextUrl.searchParams.get("mode") || "tecnico";
  const col = mode === "tecnico" ? "lesson_tecnico" : "lesson_simple";

  const course = db.prepare(`SELECT ${col}, title FROM courses WHERE id = ?`).get(courseId) as any;
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  // Se la lezione e gia salvata, ritornala
  const cached = course[col];
  if (cached) {
    try {
      return NextResponse.json({ lesson: JSON.parse(cached), mode, courseTitle: course.title, cached: true });
    } catch { /* rebuild below */ }
  }

  // Se non c'e, costruiscila dai documenti collegati (zero AI)
  const docs = db.prepare(`
    SELECT d.title, d.content FROM documents d
    JOIN course_documents cd ON d.id = cd.document_id
    WHERE cd.course_id = ? ORDER BY cd.order_index
  `).all(courseId) as { title: string; content: string }[];

  if (docs.length === 0) {
    return NextResponse.json({ lesson: null, mode, courseTitle: course.title, cached: false });
  }

  // Combina i documenti come sezioni della lezione
  const sections = docs.map((d, i) => ({
    title: d.title || `Parte ${i + 1}`,
    content: (d.content || "").trim(),
  })).filter(s => s.content.length > 50);

  if (sections.length === 0) {
    return NextResponse.json({ lesson: null, mode, courseTitle: course.title, cached: false });
  }

  // Salva come cache per le prossime volte
  const lesson = { sections };
  const lessonJson = JSON.stringify(lesson);
  db.prepare(`UPDATE courses SET lesson_tecnico = ?, lesson_simple = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(lessonJson, lessonJson, courseId);

  console.log(`[LESSON] Built lesson for course ${courseId} from ${sections.length} documents (no AI)`);

  return NextResponse.json({ lesson, mode, courseTitle: course.title, cached: true });
}

// POST /api/courses/[id]/lesson — Rebuild lesson from documents (zero AI)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode || "tecnico";

  const course = db.prepare(`SELECT title FROM courses WHERE id = ?`).get(courseId) as any;
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  // Combina documenti collegati
  const docs = db.prepare(`
    SELECT d.title, d.content FROM documents d
    JOIN course_documents cd ON d.id = cd.document_id
    WHERE cd.course_id = ? ORDER BY cd.order_index
  `).all(courseId) as { title: string; content: string }[];

  if (docs.length === 0) {
    return NextResponse.json({ error: "Nessun documento collegato" }, { status: 400 });
  }

  const sections = docs.map((d, i) => ({
    title: d.title || `Parte ${i + 1}`,
    content: (d.content || "").trim(),
  })).filter(s => s.content.length > 50);

  const lesson = { sections };
  const lessonJson = JSON.stringify(lesson);
  db.prepare(`UPDATE courses SET lesson_tecnico = ?, lesson_simple = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(lessonJson, lessonJson, courseId);

  console.log(`[LESSON] Rebuilt lesson for course ${courseId} from ${sections.length} documents (no AI)`);

  return NextResponse.json({ lesson, mode, courseTitle: course.title, cached: true });
}
