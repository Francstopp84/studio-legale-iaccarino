import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET() {
  const books = db
    .prepare(
      `SELECT lb.*, COUNT(lc.id) as chunk_count
       FROM library_books lb
       LEFT JOIN library_chunks lc ON lc.book_id = lb.id
       GROUP BY lb.id
       ORDER BY lb.created_at DESC`
    )
    .all();
  return NextResponse.json(books);
}

// Accept FormData (file upload) or JSON (text paste)
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  let title = "";
  let content = "";
  let fileType = "text";
  let category = "altro";

  if (contentType.includes("multipart/form-data")) {
    // File upload via FormData
    const formData = await req.formData();
    title = (formData.get("title") as string) || "";
    category = (formData.get("category") as string) || "altro";
    const file = formData.get("file") as File | null;

    if (!title || !file) {
      return NextResponse.json(
        { error: "Titolo e file obbligatori" },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".pdf")) {
      fileType = "pdf";
      content = await extractTextFromPdf(file);
    } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      fileType = "docx";
      content = await extractTextFromDocx(file);
    } else {
      fileType = "text";
      content = await file.text();
    }
  } else {
    // JSON body (text paste)
    const body = await req.json();
    title = body.title || "";
    content = body.content || "";
    fileType = body.file_type || "text";
    category = body.category || "altro";
  }

  if (!title || !content) {
    return NextResponse.json(
      { error: "Titolo e contenuto obbligatori" },
      { status: 400 }
    );
  }

  // Clean up extracted text
  content = cleanExtractedText(content);

  if (content.length < 100) {
    return NextResponse.json(
      { error: "Contenuto troppo corto dopo l'estrazione. Il file potrebbe essere un'immagine scansionata (non supportato) o vuoto." },
      { status: 400 }
    );
  }

  const validCategories = [
    "penale",
    "civile",
    "procedura_penale",
    "procedura_civile",
    "altro",
  ];
  const cat = validCategories.includes(category) ? category : "altro";

  // Chunk the content (~2000 chars each, split at paragraph/sentence boundaries)
  const chunks = chunkText(content, 2000);

  const insertBook = db.prepare(
    `INSERT INTO library_books (title, file_path, file_type, category, total_chunks)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertChunk = db.prepare(
    `INSERT INTO library_chunks (book_id, chunk_index, content, heading)
     VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    const result = insertBook.run(
      title,
      null,
      fileType,
      cat,
      chunks.length
    );
    const bookId = result.lastInsertRowid;

    for (let i = 0; i < chunks.length; i++) {
      insertChunk.run(bookId, i, chunks[i].content, chunks[i].heading || null);
    }

    return bookId;
  });

  const bookId = transaction();
  const book = db
    .prepare("SELECT * FROM library_books WHERE id = ?")
    .get(bookId);

  // Crea un corso con il testo del libro come lezione (zero AI)
  const insertDoc = db.prepare(
    "INSERT INTO documents (title, content, file_type) VALUES (?, ?, ?)"
  );
  const insertCourse = db.prepare(
    "INSERT INTO courses (title, description, lesson_tecnico, lesson_simple) VALUES (?, ?, ?, ?)"
  );
  const insertCourseDoc = db.prepare(
    "INSERT OR IGNORE INTO course_documents (course_id, document_id, order_index) VALUES (?, ?, ?)"
  );

  let courseId: number | null = null;

  const createCourse = db.transaction(() => {
    // Salva il testo come documento
    const docResult = insertDoc.run(title, content, fileType);
    const docId = Number(docResult.lastInsertRowid);

    // Crea il corso con il testo come lezione diretta
    const sections = [{ title, content }];
    const lessonJson = JSON.stringify({ sections });

    const courseResult = insertCourse.run(
      title,
      `Libro: ${title} (${cat})`,
      lessonJson,
      lessonJson
    );
    courseId = Number(courseResult.lastInsertRowid);

    // Link documento al corso
    insertCourseDoc.run(courseId, docId, 0);
  });

  createCourse();

  console.log(`[LIBRARY] Book "${title}" saved + course ${courseId} created (text = lesson, no AI)`);

  return NextResponse.json({
    ...(book as any),
    course_id: courseId,
  }, { status: 201 });
}

// ---------- PDF text extraction using pdftotext ----------
async function extractTextFromPdf(file: File): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `library-upload-${Date.now()}.pdf`);
  const tmpOut = tmpFile.replace(".pdf", ".txt");

  try {
    // Write uploaded file to temp
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpFile, buffer);

    // Extract text with pdftotext (preserves layout)
    execSync(`pdftotext -layout "${tmpFile}" "${tmpOut}"`, {
      timeout: 60000,
      stdio: "pipe",
    });

    const text = fs.readFileSync(tmpOut, "utf-8");
    return text;
  } catch (err: any) {
    console.error("[LIBRARY] pdftotext failed:", err.message);
    // Fallback: try pandoc
    try {
      const text = execSync(`pandoc "${tmpFile}" -t plain --wrap=none`, {
        timeout: 60000,
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
      });
      return text;
    } catch {
      throw new Error("Impossibile estrarre il testo dal PDF. Assicurati che il file non sia un'immagine scansionata.");
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// ---------- DOCX text extraction using pandoc ----------
async function extractTextFromDocx(file: File): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `library-upload-${Date.now()}.docx`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpFile, buffer);

    const text = execSync(`pandoc "${tmpFile}" -t plain --wrap=none`, {
      timeout: 60000,
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
    return text;
  } catch (err: any) {
    console.error("[LIBRARY] pandoc docx extraction failed:", err.message);
    throw new Error("Impossibile estrarre il testo dal DOCX.");
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ---------- Clean extracted text ----------
function cleanExtractedText(text: string): string {
  return text
    // Remove form feed characters
    .replace(/\f/g, "\n\n")
    // Collapse 3+ newlines into 2
    .replace(/\n{3,}/g, "\n\n")
    // Remove lines that are just page numbers
    .replace(/^\s*\d+\s*$/gm, "")
    // Remove excessive whitespace within lines but preserve indentation
    .replace(/[^\S\n]{3,}/g, "  ")
    .trim();
}

// ---------- Group chunks into chapters ----------
function groupChunksIntoChapters(
  chunks: { content: string; heading: string | null }[],
  bookTitle: string
): { title: string; content: string }[] {
  if (chunks.length === 0) return [];

  // Detect chapter-level headings
  const chapterPattern = /^(CAPITOLO|CAPO|TITOLO|LIBRO|PARTE|SEZIONE|CAP\.|TIT\.)\s/i;

  const chapters: { title: string; content: string }[] = [];
  let currentTitle = "";
  let currentContent = "";

  for (const chunk of chunks) {
    const heading = chunk.heading?.trim() || "";
    const isChapterHeading = heading && chapterPattern.test(heading);

    if (isChapterHeading && currentContent.length > 0) {
      chapters.push({
        title: currentTitle || `${bookTitle} — Parte ${chapters.length + 1}`,
        content: currentContent.trim(),
      });
      currentContent = "";
    }

    if (isChapterHeading) {
      currentTitle = heading;
    } else if (!currentTitle && heading) {
      currentTitle = heading;
    }

    currentContent += (currentContent ? "\n\n" : "") +
      (chunk.heading ? `## ${chunk.heading}\n\n` : "") +
      chunk.content;
  }

  // Push last chapter
  if (currentContent.trim()) {
    chapters.push({
      title: currentTitle || `${bookTitle} — Parte ${chapters.length + 1}`,
      content: currentContent.trim(),
    });
  }

  // If no chapter headings were detected, split into ~10k char chunks
  // and try to extract a meaningful title from the first line
  if (chapters.length <= 1) {
    const bigContent = chapters[0]?.content || currentContent;
    if (bigContent.length > 15000) {
      return splitBySize(bigContent, bookTitle);
    }
  }

  return chapters;
}

// Split large text by size and extract meaningful titles from content
function splitBySize(
  text: string,
  bookTitle: string
): { title: string; content: string }[] {
  const chapters: { title: string; content: string }[] = [];
  const paragraphs = text.split(/\n\n/);
  let part = "";
  let partNum = 1;

  for (const para of paragraphs) {
    if (part.length + para.length > 10000 && part.length > 2000) {
      chapters.push({
        title: extractTitle(part, bookTitle, partNum),
        content: part.trim(),
      });
      part = "";
      partNum++;
    }
    part += (part ? "\n\n" : "") + para;
  }
  if (part.trim()) {
    chapters.push({
      title: extractTitle(part, bookTitle, partNum),
      content: part.trim(),
    });
  }
  return chapters;
}

// Extract a title from the first significant line of a text chunk
function extractTitle(content: string, bookTitle: string, partNum: number): string {
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 3);

  for (const line of lines.slice(0, 5)) {
    // Look for headings: "## Something", "CAPITOLO X", "Art. X", etc.
    const cleaned = line.replace(/^#+\s*/, "").trim();
    if (
      cleaned.length > 5 &&
      cleaned.length < 120 &&
      (/^(Art\.|Capo|Titolo|Libro|Sezione|Capitolo|PARTE|CAPO|TITOLO|LIBRO|SEZIONE|CAPITOLO)/i.test(cleaned) ||
       /^[A-Z][A-Za-zÀ-ú\s,':–—-]{5,80}$/.test(cleaned) ||
       /^\d+[\.\)]\s+[A-Z]/.test(cleaned))
    ) {
      return cleaned;
    }
  }

  return `${bookTitle} — Parte ${partNum}`;
}

// ---------- Chunk text ----------
function chunkText(
  text: string,
  maxLen: number
): { content: string; heading: string | null }[] {
  const chunks: { content: string; heading: string | null }[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";
  let currentHeading: string | null = null;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect headings
    const isHeading =
      trimmed.length < 120 &&
      (/^(Art\.|Capo|Titolo|Libro|Sezione|PARTE|CAPO|TITOLO|LIBRO|SEZIONE|CAPITOLO)/i.test(trimmed) ||
        /^[A-Z][A-Z\s\d.()]{4,}$/.test(trimmed));

    if (isHeading) {
      if (current.length > 0) {
        chunks.push({ content: current.trim(), heading: currentHeading });
        current = "";
      }
      currentHeading = trimmed;
    }

    if (current.length + trimmed.length + 2 > maxLen && current.length > 0) {
      chunks.push({ content: current.trim(), heading: currentHeading });
      current = trimmed;
      if (!isHeading) currentHeading = null;
    } else {
      current += (current ? "\n\n" : "") + trimmed;
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), heading: currentHeading });
  }

  // Split oversized chunks at sentence boundaries
  const result: { content: string; heading: string | null }[] = [];
  for (const chunk of chunks) {
    if (chunk.content.length <= maxLen * 1.5) {
      result.push(chunk);
    } else {
      const sentences = chunk.content.split(/(?<=[.!?])\s+/);
      let sub = "";
      for (const sentence of sentences) {
        if (sub.length + sentence.length + 1 > maxLen && sub.length > 0) {
          result.push({ content: sub.trim(), heading: chunk.heading });
          sub = sentence;
        } else {
          sub += (sub ? " " : "") + sentence;
        }
      }
      if (sub.trim()) {
        result.push({ content: sub.trim(), heading: chunk.heading });
      }
    }
  }

  return result;
}
