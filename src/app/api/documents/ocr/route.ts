import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import db from "@/lib/db";
import {
  ocrWithVision,
  ocrFullPipeline,
  ocrPdfWithVision,
} from "@/lib/ai";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Allowed image and PDF MIME types
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/bmp",
  "image/gif",
  "application/pdf",
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".tiff",
  ".tif",
  ".webp",
  ".bmp",
  ".gif",
]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "auto"; // "auto" | "vision" | "preprocessed"

    if (!file) {
      return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.has(ext);
    const isPdf = ext === ".pdf";

    if (!isImage && !isPdf) {
      return NextResponse.json(
        {
          error: `Formato non supportato: ${ext}. Formati accettati: JPG, PNG, TIFF, WebP, BMP, GIF, PDF`,
        },
        { status: 400 }
      );
    }

    // Save uploaded file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(UPLOAD_DIR, `${timestamp}_ocr_${safeFileName}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    let extractedText = "";
    let preprocessedPath: string | null = null;

    if (isPdf) {
      // PDF: use Claude vision directly on the PDF
      extractedText = await ocrPdfWithVision(filePath);
    } else if (isImage) {
      if (mode === "vision") {
        // Direct vision without preprocessing
        extractedText = await ocrWithVision(filePath);
      } else {
        // Default: preprocess then vision (best for scanned/handwritten docs)
        const result = await ocrFullPipeline(filePath);
        extractedText = result.text;
        preprocessedPath = result.preprocessedPath;
      }
    }

    // Clean up extracted text
    extractedText = extractedText.trim();

    if (!extractedText || extractedText === "[NESSUN TESTO RILEVATO]") {
      // Clean up temp files
      try {
        await unlink(filePath);
        if (preprocessedPath) await unlink(preprocessedPath);
      } catch { /* ignore */ }

      return NextResponse.json(
        { error: "Nessun testo rilevato nell'immagine", text: "" },
        { status: 200 }
      );
    }

    // Save as document in SQLite
    const title = file.name.replace(/\.[^.]+$/, "") + " (OCR)";
    const result = db
      .prepare(
        "INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)"
      )
      .run(title, extractedText, filePath, `ocr-${ext.replace(".", "")}`);

    const doc = db
      .prepare("SELECT * FROM documents WHERE id = ?")
      .get(result.lastInsertRowid);

    // Clean up preprocessed temp file (keep original)
    if (preprocessedPath) {
      try {
        await unlink(preprocessedPath);
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      document: doc,
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter((w: string) => w.length > 0).length,
      source: isPdf ? "pdf-vision" : mode === "vision" ? "vision" : "preprocessed-vision",
    });
  } catch (err: any) {
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: `OCR fallito: ${err.message}` },
      { status: 500 }
    );
  }
}
