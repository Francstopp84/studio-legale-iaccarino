import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/documents/merge — Unifica più documenti in uno solo
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { documentIds } = body as { documentIds: number[] };

  if (!documentIds || documentIds.length < 2) {
    return NextResponse.json({ error: "Servono almeno 2 documenti da unire" }, { status: 400 });
  }

  // Fetch all documents in order
  const placeholders = documentIds.map(() => "?").join(",");
  const docs = db.prepare(
    `SELECT * FROM documents WHERE id IN (${placeholders}) ORDER BY created_at ASC`
  ).all(...documentIds) as any[];

  if (docs.length < 2) {
    return NextResponse.json({ error: "Documenti non trovati" }, { status: 404 });
  }

  // Build merged content with section markers
  const mergedParts: string[] = [];
  const fileNames: string[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    fileNames.push(doc.title);

    if (docs.length > 1) {
      mergedParts.push(`── Parte ${i + 1}: ${doc.title} ──\n\n${doc.content || ""}`);
    } else {
      mergedParts.push(doc.content || "");
    }
  }

  const mergedContent = mergedParts.join("\n\n\n");
  const mergedTitle = `Trascrizione unificata (${docs.length} file)`;

  // Determine file_type from first doc
  const fileType = docs[0].file_type || "audio";

  // Create merged document
  const result = db.prepare(
    "INSERT INTO documents (title, content, file_type) VALUES (?, ?, ?)"
  ).run(mergedTitle, mergedContent, fileType);

  const mergedId = Number(result.lastInsertRowid);

  // Update course_documents to point to merged doc instead of originals
  const updateLinks = db.prepare(
    "UPDATE course_documents SET document_id = ? WHERE document_id = ?"
  );
  const deleteOldLinks = db.prepare(
    "DELETE FROM course_documents WHERE document_id = ? AND course_id IN (SELECT course_id FROM course_documents WHERE document_id = ?)"
  );
  for (const doc of docs) {
    // Move any course links to the merged document
    updateLinks.run(mergedId, doc.id);
  }
  // Remove duplicate links (same course_id + merged doc)
  db.prepare(`
    DELETE FROM course_documents WHERE rowid NOT IN (
      SELECT MIN(rowid) FROM course_documents GROUP BY course_id, document_id
    )
  `).run();

  // Delete original individual documents
  const deleteStmt = db.prepare("DELETE FROM documents WHERE id = ?");
  for (const doc of docs) {
    deleteStmt.run(doc.id);
  }

  return NextResponse.json({
    id: mergedId,
    title: mergedTitle,
    words: mergedContent.trim().split(/\s+/).length,
    merged_from: fileNames,
  });
}
