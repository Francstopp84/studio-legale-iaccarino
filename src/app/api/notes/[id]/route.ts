import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, type } = await req.json();
  db.prepare('UPDATE notes SET content = ?, type = COALESCE(?, type), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, type || null, id);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  return NextResponse.json(note);
}
