import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const collections = db.prepare(`
    SELECT c.*, COUNT(dc.document_id) as doc_count
    FROM collections c
    LEFT JOIN document_collections dc ON c.id = dc.collection_id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const { name, description, color, parent_id } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 });
  }
  const result = db.prepare(
    'INSERT INTO collections (name, description, color, parent_id) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), description || null, color || '#d4a853', parent_id || null);
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(collection, { status: 201 });
}
