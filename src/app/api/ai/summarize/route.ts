import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { summarizeDocumentAI } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const { document_id } = await req.json();
    const doc: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
    if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });

    const summary = await summarizeDocumentAI(doc.content);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore AI' }, { status: 500 });
  }
}
