import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/courses/[id]/documents — Link a document to a course
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  const body = await req.json();
  const documentId = body.documentId;

  if (!documentId) {
    return NextResponse.json({ error: "documentId richiesto" }, { status: 400 });
  }

  // Check course exists
  const course = db.prepare("SELECT id FROM courses WHERE id = ?").get(courseId);
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM course_documents WHERE course_id = ? AND document_id = ?"
  ).get(courseId, documentId);

  if (!existing) {
    const maxOrder = db.prepare(
      "SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM course_documents WHERE course_id = ?"
    ).get(courseId) as any;

    db.prepare(
      "INSERT INTO course_documents (course_id, document_id, order_index) VALUES (?, ?, ?)"
    ).run(courseId, documentId, maxOrder.next_order);
  }

  return NextResponse.json({ success: true });
}
