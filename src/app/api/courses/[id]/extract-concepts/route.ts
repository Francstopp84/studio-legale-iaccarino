import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { extractConceptsAI } from "@/lib/ai";

export const dynamic = "force-dynamic";

// POST /api/courses/[id]/extract-concepts — Extract concepts from linked documents using AI
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);

  // Get course
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  // Check if concepts already exist
  const existing = db.prepare("SELECT COUNT(*) as n FROM concepts WHERE course_id = ?").get(courseId) as any;
  if (existing.n > 0) {
    return NextResponse.json({ message: "Concetti già estratti", total: existing.n });
  }

  // Get linked documents
  const docs = db.prepare(`
    SELECT d.id, d.title, d.content FROM documents d
    JOIN course_documents cd ON d.id = cd.document_id
    WHERE cd.course_id = ?
    ORDER BY cd.order_index
  `).all(courseId) as any[];

  if (docs.length === 0) {
    return NextResponse.json({ error: "Nessun documento collegato al corso" }, { status: 400 });
  }

  // Combine all document content (skip empty docs)
  const validDocs = docs.filter(d => d.content && d.content.trim().length > 10);
  if (validDocs.length === 0) {
    console.error(`[extract-concepts] Corso ${courseId}: ${docs.length} documenti collegati ma TUTTI con contenuto vuoto/nullo`);
    return NextResponse.json({ error: `Nessun documento con contenuto leggibile (${docs.length} doc collegati hanno testo vuoto). Verificare che i file siano stati caricati correttamente.` }, { status: 400 });
  }

  const allContent = validDocs.map(d => d.content).join("\n\n---\n\n");
  const mainTitle = course.title || docs[0]?.title || "Documento";

  console.log(`[extract-concepts] Corso ${courseId}: ${validDocs.length}/${docs.length} doc validi, ${allContent.length} chars totali`);

  // Extract concepts using AI
  const concepts = await extractConceptsAI(mainTitle, allContent);

  if (!concepts || concepts.length === 0) {
    console.error(`[extract-concepts] Corso ${courseId}: AI ha restituito 0 concetti da ${allContent.length} chars`);
    return NextResponse.json({ error: "L'AI non ha estratto concetti. Riprovare." }, { status: 500 });
  }

  // Insert concepts into DB
  const insert = db.prepare(`
    INSERT INTO concepts (course_id, document_id, title, explanation, keywords, order_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: any[]) => {
    items.forEach((c, i) => {
      insert.run(
        courseId,
        docs[0]?.id || null,
        c.title,
        c.explanation || null,
        c.keywords ? JSON.stringify(c.keywords) : null,
        i
      );
    });
  });

  insertMany(concepts);

  // Update course total
  db.prepare("UPDATE courses SET total_concepts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(concepts.length, courseId);

  return NextResponse.json({ total: concepts.length, concepts });
}
