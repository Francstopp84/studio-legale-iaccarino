import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for large file processing

export async function POST(req: NextRequest) {
  let tmpPath = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const relativePath = (formData.get("relativePath") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "Nessun file fornito" }, { status: 400 });
    }

    // Validate size
    if (file.size === 0) {
      return NextResponse.json(
        { error: `File vuoto (0 bytes): ${file.name}. Verifica che il file sia stato scaricato correttamente.` },
        { status: 400 }
      );
    }
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 100MB)` },
        { status: 413 }
      );
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    // Sanitize filename for temp paths (remove special chars, path separators)
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const title = relativePath
      ? relativePath.replace(/\.[^.]+$/, "").replace(/[\\/]/g, " / ")
      : file.name.replace(/\.[^.]+$/, "");

    // Determine file category
    const textExtensions = ["pdf", "docx", "doc", "txt", "md"];
    const audioExtensions = ["mp3", "wav", "m4a", "ogg", "flac", "webm"];
    const videoExtensions = ["mp4", "mkv", "avi", "webm", "mov"];
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];

    const isText = textExtensions.includes(ext);
    const isAudio = audioExtensions.includes(ext);
    const isVideo = videoExtensions.includes(ext);
    const isImage = imageExtensions.includes(ext);

    if (!isText && !isAudio && !isVideo && !isImage) {
      return NextResponse.json(
        { error: `Tipo file non supportato: .${ext}` },
        { status: 400 }
      );
    }

    // For audio/video files, signal that they need transcription
    if (isAudio || isVideo) {
      return NextResponse.json({
        action: "transcribe",
        fileName: file.name,
        fileType: ext,
        message: "File audio/video: usare /api/transcribe per la trascrizione",
      });
    }

    // For images, run OCR to extract text (supports handwritten + printed)
    if (isImage) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const UPLOAD_DIR = path.join(process.cwd(), "uploads");
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const imgPath = path.join(UPLOAD_DIR, `${Date.now()}_ocr_${safeFileName}`);
      fs.writeFileSync(imgPath, buffer);

      try {
        const { ocrFullPipeline } = await import("@/lib/ai");
        const { text: ocrText, preprocessedPath } = await ocrFullPipeline(imgPath);

        // Clean up preprocessed temp file
        if (preprocessedPath && fs.existsSync(preprocessedPath)) {
          try { fs.unlinkSync(preprocessedPath); } catch { /* ignore */ }
        }

        const content = ocrText && ocrText !== "[NESSUN TESTO RILEVATO]"
          ? ocrText
          : `[Immagine senza testo rilevabile: ${file.name}]`;

        const result = db
          .prepare(
            "INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)"
          )
          .run(
            title + (ocrText ? " (OCR)" : ""),
            content,
            imgPath,
            `ocr-${ext}`
          );
        const doc = db
          .prepare("SELECT * FROM documents WHERE id = ?")
          .get(result.lastInsertRowid);
        return NextResponse.json(doc, { status: 201 });
      } catch (ocrErr: any) {
        console.error("OCR error for image:", ocrErr);
        // Fallback: save as placeholder if OCR fails
        const result = db
          .prepare(
            "INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)"
          )
          .run(
            title,
            `[Immagine: ${file.name}] (OCR fallito: ${ocrErr.message})`,
            imgPath,
            ext
          );
        const doc = db
          .prepare("SELECT * FROM documents WHERE id = ?")
          .get(result.lastInsertRowid);
        return NextResponse.json(doc, { status: 201 });
      }
    }

    // --- Text extraction for PDF, DOCX, TXT ---
    let content = "";

    if (ext === "txt" || ext === "md") {
      const buffer = Buffer.from(await file.arrayBuffer());
      content = buffer.toString("utf-8");
    } else if (ext === "docx" || ext === "doc") {
      // Write to temp file, extract with mammoth (already installed) or pandoc
      const buffer = Buffer.from(await file.arrayBuffer());
      tmpPath = path.join(os.tmpdir(), `ais_${Date.now()}.${ext}`);
      fs.writeFileSync(tmpPath, buffer);

      try {
        // Try mammoth first (already a dependency)
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ path: tmpPath });
        content = result.value;
      } catch {
        // Fallback to pandoc
        try {
          content = execSync(`pandoc "${tmpPath}" -t plain`, {
            encoding: "utf-8",
            maxBuffer: 50 * 1024 * 1024,
            timeout: 60000,
          });
        } catch (pandocErr: any) {
          return NextResponse.json(
            { error: `Impossibile leggere il file DOCX: ${pandocErr.message}` },
            { status: 500 }
          );
        }
      }
    } else if (ext === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      tmpPath = path.join(os.tmpdir(), `ais_${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, buffer);

      try {
        // pdftotext (poppler) — reliable, fast, installed
        content = execSync(`pdftotext "${tmpPath}" -`, {
          encoding: "utf-8", maxBuffer: 50 * 1024 * 1024, timeout: 120000,
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: `Impossibile leggere il PDF: ${err.message}` },
          { status: 500 }
        );
      }

      // If PDF has very little text, it's likely scanned — run OCR via Claude Vision
      const wordCount = content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
      if (wordCount < 20) {
        try {
          const { ocrPdfWithVision } = await import("@/lib/ai");
          const ocrText = await ocrPdfWithVision(tmpPath);
          if (ocrText && ocrText.trim().length > content.trim().length) {
            content = ocrText;
            // Update title to indicate OCR was used
          }
        } catch (ocrErr: any) {
          console.error("PDF OCR fallback error:", ocrErr);
          // Keep whatever text we extracted normally
        }
      }
    }

    // Clean up temp file
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }

    if (!content || content.trim().length === 0) {
      content = "[Contenuto vuoto o non estraibile]";
    }

    // Save to database
    const result = db
      .prepare(
        "INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)"
      )
      .run(title, content.trim(), null, ext);

    const doc = db
      .prepare("SELECT * FROM documents WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(doc, { status: 201 });
  } catch (err: any) {
    // Clean up temp file on error
    if (tmpPath && fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    }
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante l'upload" },
      { status: 500 }
    );
  }
}
