import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document_id } = await req.json();
  if (!document_id) {
    return NextResponse.json({ error: 'document_id obbligatorio' }, { status: 400 });
  }
  const collection = db.prepare('SELECT id FROM collections WHERE id = ?').get(id);
  if (!collection) {
    return NextResponse.json({ error: 'Collezione non trovata' }, { status: 404 });
  }
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(document_id);
  if (!doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  }
  try {
    db.prepare(
      'INSERT OR IGNORE INTO document_collections (document_id, collection_id) VALUES (?, ?)'
    ).run(document_id, id);
  } catch {
    // already exists, ignore
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { document_id } = await req.json();
  if (!document_id) {
    return NextResponse.json({ error: 'document_id obbligatorio' }, { status: 400 });
  }
  db.prepare(
    'DELETE FROM document_collections WHERE document_id = ? AND collection_id = ?'
  ).run(document_id, id);
  return NextResponse.json({ ok: true });
}
