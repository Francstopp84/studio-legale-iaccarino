import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { chatWithDocumentAI } from '@/lib/ai';

const VOICE_SYSTEM_PROMPTS: Record<string, string> = {
  tutor:
    'Sei un tutor paziente e chiaro. Spiega i concetti in modo accessibile, con esempi pratici. Guida lo studente passo dopo passo.',
  socratico:
    'Usa il metodo socratico: rispondi con domande guida che portino lo studente a ragionare autonomamente. Non dare risposte dirette, ma aiutalo a trovarle.',
  esperto:
    'Rispondi come un esperto tecnico del settore. Usa terminologia precisa, riferimenti normativi e giurisprudenziali. Sii dettagliato e approfondito.',
  semplificatore:
    'Spiega come se lo studente avesse 10 anni. Usa analogie semplici della vita quotidiana. Evita gergo tecnico. Sii brevissimo e diretto.',
};

export async function POST(req: NextRequest) {
  try {
    const { document_id, message, history, selectedText, voiceStyle } = await req.json();
    let documentContent = '';

    if (document_id) {
      const doc: any = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
      if (doc) documentContent = doc.content;
    }

    // Build enhanced message with selectedText context
    let enhancedMessage = message;
    if (selectedText) {
      enhancedMessage = `[PORZIONE SELEZIONATA DAL DOCUMENTO]\n---\n${selectedText}\n---\n\nDomanda dello studente su questa porzione: ${message}`;
    }

    // Build voice style instruction
    const voiceInstruction = voiceStyle && VOICE_SYSTEM_PROMPTS[voiceStyle]
      ? `\n\nSTILE DI RISPOSTA: ${VOICE_SYSTEM_PROMPTS[voiceStyle]}`
      : '';

    if (voiceInstruction) {
      enhancedMessage = enhancedMessage + voiceInstruction;
    }

    const reply = await chatWithDocumentAI(documentContent, enhancedMessage, history || []);
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Errore AI' }, { status: 500 });
  }
}
