import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const sessions = db.prepare(
    'SELECT * FROM study_sessions ORDER BY created_at DESC LIMIT 100'
  ).all();
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const { type, document_id, score, cards_reviewed, duration_seconds, details } = await req.json();
  const result = db.prepare(
    'INSERT INTO study_sessions (type, document_id, score, cards_reviewed, duration_seconds, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, document_id || null, score || null, cards_reviewed || 0, duration_seconds || 0, details ? JSON.stringify(details) : null);
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
