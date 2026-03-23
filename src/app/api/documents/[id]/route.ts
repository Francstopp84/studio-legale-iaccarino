import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const fields: string[] = [];
  const values: any[] = [];

  if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
  if (body.content !== undefined) { fields.push("content = ?"); values.push(body.content); }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  db.prepare(`UPDATE documents SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  return NextResponse.json(doc);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Delete all related records first (foreign key constraints)
  const cleanup = db.transaction(() => {
    db.prepare('DELETE FROM flashcards WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM quizzes WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM study_sessions WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM notes WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM document_collections WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM course_documents WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM concepts WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  });

  try {
    cleanup();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
