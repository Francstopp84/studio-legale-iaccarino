import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const book = db
    .prepare("SELECT * FROM library_books WHERE id = ?")
    .get(id) as any;
  if (!book) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  }

  const chunks = db
    .prepare(
      "SELECT * FROM library_chunks WHERE book_id = ? ORDER BY chunk_index"
    )
    .all(id);

  return NextResponse.json({ ...book, chunks });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cleanup = db.transaction(() => {
    db.prepare("DELETE FROM library_chunks WHERE book_id = ?").run(id);
    db.prepare("DELETE FROM library_books WHERE id = ?").run(id);
  });

  try {
    cleanup();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
