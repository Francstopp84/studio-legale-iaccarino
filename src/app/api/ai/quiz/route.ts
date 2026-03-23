import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateQuizAI } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { document_id, count } = await req.json();
    const doc: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
    if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });

    const questions = await generateQuizAI(doc.title, doc.content, count || 5);

    const result = db.prepare(
      'INSERT INTO quizzes (document_id, title, questions) VALUES (?, ?, ?)'
    ).run(document_id, `Quiz AI: ${doc.title}`, JSON.stringify(questions));

    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(quiz, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore generazione AI' }, { status: 500 });
  }
}
