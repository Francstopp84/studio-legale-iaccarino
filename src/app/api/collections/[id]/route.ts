import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!collection) {
    return NextResponse.json({ error: 'Collezione non trovata' }, { status: 404 });
  }
  const documents = db.prepare(`
    SELECT d.* FROM documents d
    INNER JOIN document_collections dc ON d.id = dc.document_id
    WHERE dc.collection_id = ?
    ORDER BY d.updated_at DESC
  `).all(id);
  return NextResponse.json({ ...collection as object, documents });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description, color } = await req.json();
  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Collezione non trovata' }, { status: 404 });
  }
  const ex = existing as { name: string; description: string; color: string };
  db.prepare(
    'UPDATE collections SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name ?? ex.name, description ?? ex.description, color ?? ex.color, id);
  const updated = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'Collezione non trovata' }, { status: 404 });
  }
  db.prepare('DELETE FROM document_collections WHERE collection_id = ?').run(id);
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
