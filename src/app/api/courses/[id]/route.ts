import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// GET /api/courses/[id] — course detail with documents and concepts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(Number(id));
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  const documents = db.prepare(`
    SELECT d.*, cd.order_index
    FROM documents d
    JOIN course_documents cd ON cd.document_id = d.id
    WHERE cd.course_id = ?
    ORDER BY cd.order_index
  `).all(Number(id));

  const concepts = db.prepare(`
    SELECT * FROM concepts WHERE course_id = ? ORDER BY order_index
  `).all(Number(id));

  return NextResponse.json({ ...(course as any), documents, concepts });
}

// PATCH /api/courses/[id] — update course
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
  if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description); }
  if (body.current_phase !== undefined) { fields.push("current_phase = ?"); values.push(body.current_phase); }
  if (body.instructions !== undefined) { fields.push("instructions = ?"); values.push(body.instructions); }

  if (fields.length > 0) {
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(Number(id));
    db.prepare(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  // Add documents to course if provided
  if (body.add_document_ids && Array.isArray(body.add_document_ids)) {
    const existing = db.prepare(
      "SELECT MAX(order_index) as max_idx FROM course_documents WHERE course_id = ?"
    ).get(Number(id)) as any;
    let nextIdx = (existing?.max_idx ?? -1) + 1;

    const insertDoc = db.prepare(
      "INSERT OR IGNORE INTO course_documents (course_id, document_id, order_index) VALUES (?, ?, ?)"
    );
    for (const docId of body.add_document_ids) {
      insertDoc.run(Number(id), docId, nextIdx++);
    }

    // Invalidate lesson cache so it regenerates with new material
    db.prepare("UPDATE courses SET lesson_simple = NULL, lesson_tecnico = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(Number(id));
  }

  if (fields.length === 0 && !body.add_document_ids) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/courses/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM courses WHERE id = ?").run(Number(id));
  return NextResponse.json({ success: true });
}
