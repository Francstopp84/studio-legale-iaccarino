import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateFlashcardsAI } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { document_id, count } = await req.json();
    const doc: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
    if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });

    const cards = await generateFlashcardsAI(doc.title, doc.content, count || 10);

    const insert = db.prepare(
      'INSERT INTO flashcards (document_id, front, back, deck) VALUES (?, ?, ?, ?)'
    );
    const inserted: any[] = [];
    const insertMany = db.transaction((items: typeof cards) => {
      for (const card of items) {
        const result = insert.run(document_id, card.front, card.back, doc.title);
        inserted.push({ id: result.lastInsertRowid, ...card, deck: doc.title });
      }
    });
    insertMany(cards);

    return NextResponse.json({ cards: inserted, count: inserted.length }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore generazione AI' }, { status: 500 });
  }
}
