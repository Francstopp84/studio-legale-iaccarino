import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const unlinked = req.nextUrl.searchParams.get('unlinked');

  if (unlinked === 'true') {
    // Solo documenti NON assegnati a nessun corso
    const docs = db.prepare(`
      SELECT d.* FROM documents d
      WHERE d.id NOT IN (SELECT document_id FROM course_documents)
      ORDER BY d.updated_at DESC
    `).all();
    return NextResponse.json(docs);
  }

  const docs = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all();
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const { title, content, file_path, file_type } = await req.json();
  const result = db.prepare(
    'INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)'
  ).run(title, content || '', file_path || null, file_type || 'text');
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(doc, { status: 201 });
}
