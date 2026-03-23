import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { correctTranscriptionAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, text } = body;

    let rawText: string;
    let docId: number | null = null;

    if (documentId) {
      docId = Number(documentId);
      const doc = (db as any).prepare("SELECT content FROM documents WHERE id = ?").get(docId) as { content: string } | undefined;
      if (!doc) {
        return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
      }
      rawText = doc.content;
    } else if (text) {
      rawText = text;
    } else {
      return NextResponse.json({ error: "Fornire documentId o text" }, { status: 400 });
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "Nessun testo da correggere" }, { status: 400 });
    }

    const corrected = await correctTranscriptionAI(rawText);

    // If documentId provided, update the document content and store original
    if (docId) {
      (db as any).prepare(
        "UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(corrected, docId);
    }

    return NextResponse.json({
      corrected,
      original: rawText,
      documentId: docId,
    });
  } catch (err: any) {
    console.error("Transcription correction error:", err);
    return NextResponse.json({ error: err.message || "Errore durante la correzione" }, { status: 500 });
  }
}
