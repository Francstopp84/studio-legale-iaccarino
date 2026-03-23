import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { sm2, qualityFromScore } from '@/lib/sm2';

export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get('document_id');
  const due = req.nextUrl.searchParams.get('due');

  let query = 'SELECT * FROM flashcards';
  const conditions: string[] = [];
  const params: any[] = [];

  if (documentId) {
    conditions.push('document_id = ?');
    params.push(documentId);
  }
  if (due === 'true') {
    conditions.push("next_review <= datetime('now')");
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY next_review ASC';

  const cards = db.prepare(query).all(...params);
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Support bulk creation
  const cards = Array.isArray(body) ? body : [body];
  const inserted: any[] = [];

  const insert = db.prepare(
    'INSERT INTO flashcards (document_id, front, back, deck) VALUES (?, ?, ?, ?)'
  );

  const insertMany = db.transaction((cards: any[]) => {
    for (const card of cards) {
      const result = insert.run(card.document_id || null, card.front, card.back, card.deck || 'Generale');
      inserted.push({ id: result.lastInsertRowid, ...card });
    }
  });

  insertMany(cards);
  return NextResponse.json(inserted, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, correct, timeMs } = await req.json();
  const card: any = db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id);
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const quality = qualityFromScore(correct, timeMs || 5000);
  const result = sm2(
    { easiness: card.easiness, interval: card.interval, repetitions: card.repetitions },
    quality
  );

  db.prepare(`
    UPDATE flashcards SET easiness = ?, interval = ?, repetitions = ?,
    next_review = ?, last_review = datetime('now') WHERE id = ?
  `).run(result.easiness, result.interval, result.repetitions, result.nextReview.toISOString(), id);

  return NextResponse.json({ ...card, ...result });
}
