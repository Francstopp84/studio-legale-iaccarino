import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

// GET /api/courses/[id]/documents/[docId]/pdf — Generate PDF from document
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id, docId } = await params;

  // Verify document belongs to course
  const doc = db.prepare(`
    SELECT d.* FROM documents d
    JOIN course_documents cd ON cd.document_id = d.id
    WHERE cd.course_id = ? AND d.id = ?
  `).get(Number(id), Number(docId)) as any;

  if (!doc) {
    return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  }

  const title = doc.title
    .replace("[Deep Research] ", "")
    .replace("[One Legale] ", "");
  const content = doc.content || "";

  // Generate PDF in memory
  const chunks: Buffer[] = [];

  return new Promise<NextResponse>((resolve) => {
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: title,
        Author: "Avv. Iaccarino Studio — Deep Research",
      },
    });

    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.pdf"`,
            "Content-Length": buffer.length.toString(),
          },
        })
      );
    });

    // Title
    pdf.fontSize(18).font("Helvetica-Bold").text(title, { align: "center" });
    pdf.moveDown(0.5);

    // Separator line
    pdf
      .moveTo(60, pdf.y)
      .lineTo(pdf.page.width - 60, pdf.y)
      .strokeColor("#cccccc")
      .stroke();
    pdf.moveDown(1);

    // Content — parse simple markdown-like formatting
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        pdf.moveDown(0.4);
        continue;
      }

      // Headers (### or ##)
      if (trimmed.startsWith("### ")) {
        pdf.moveDown(0.3);
        pdf.fontSize(12).font("Helvetica-Bold").text(trimmed.slice(4));
        pdf.moveDown(0.2);
      } else if (trimmed.startsWith("## ")) {
        pdf.moveDown(0.4);
        pdf.fontSize(14).font("Helvetica-Bold").text(trimmed.slice(3));
        pdf.moveDown(0.2);
      } else if (trimmed.startsWith("# ")) {
        pdf.moveDown(0.5);
        pdf.fontSize(16).font("Helvetica-Bold").text(trimmed.slice(2));
        pdf.moveDown(0.3);
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        // Bullet points
        const bulletText = trimmed.slice(2);
        pdf.fontSize(10).font("Helvetica").text(`  \u2022  ${cleanMarkdown(bulletText)}`, {
          indent: 10,
          align: "justify",
        });
      } else if (/^\d+\.\s/.test(trimmed)) {
        // Numbered list
        pdf.fontSize(10).font("Helvetica").text(`  ${cleanMarkdown(trimmed)}`, {
          indent: 10,
          align: "justify",
        });
      } else {
        // Regular paragraph — handle bold fragments
        const cleaned = cleanMarkdown(trimmed);
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          pdf.fontSize(10).font("Helvetica-Bold").text(cleaned, { align: "justify" });
        } else {
          pdf.fontSize(10).font("Helvetica").text(cleaned, { align: "justify" });
        }
      }

      // Check page break
      if (pdf.y > pdf.page.height - 80) {
        pdf.addPage();
      }
    }

    // Footer
    pdf.moveDown(2);
    pdf
      .moveTo(60, pdf.y)
      .lineTo(pdf.page.width - 60, pdf.y)
      .strokeColor("#cccccc")
      .stroke();
    pdf.moveDown(0.5);
    pdf
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#999999")
      .text("Generato da Avv. Iaccarino Studio — Deep Research", { align: "center" });

    pdf.end();
  });
}

// Strip markdown bold/italic markers
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
