import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get('document_id');
  let query = 'SELECT * FROM quizzes';
  const params: any[] = [];
  if (documentId) {
    query += ' WHERE document_id = ?';
    params.push(documentId);
  }
  query += ' ORDER BY created_at DESC';
  return NextResponse.json(db.prepare(query).all(...params));
}

export async function POST(req: NextRequest) {
  const { document_id, title, questions } = await req.json();
  const questionsStr = typeof questions === 'string' ? questions : JSON.stringify(questions);
  const result = db.prepare(
    'INSERT INTO quizzes (document_id, title, questions) VALUES (?, ?, ?)'
  ).run(document_id || null, title, questionsStr);
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(quiz, { status: 201 });
}
