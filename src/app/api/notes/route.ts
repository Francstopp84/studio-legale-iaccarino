import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get('document_id');
  let query = 'SELECT * FROM notes';
  const params: any[] = [];
  if (documentId) {
    query += ' WHERE document_id = ?';
    params.push(documentId);
  }
  query += ' ORDER BY updated_at DESC';
  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const { document_id, content, type } = await req.json();
  const result = db.prepare(
    'INSERT INTO notes (document_id, content, type) VALUES (?, ?, ?)'
  ).run(document_id || null, content, type || 'note');
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
