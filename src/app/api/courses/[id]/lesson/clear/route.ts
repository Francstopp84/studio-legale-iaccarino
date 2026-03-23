import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/courses/[id]/lesson/clear — Clear cached lesson
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  const body = await req.json().catch(() => ({}));
  const mode = body.mode;

  if (mode === "tecnico") {
    db.prepare("UPDATE courses SET lesson_tecnico = NULL WHERE id = ?").run(courseId);
  } else if (mode === "semplice") {
    db.prepare("UPDATE courses SET lesson_simple = NULL WHERE id = ?").run(courseId);
  } else {
    db.prepare("UPDATE courses SET lesson_simple = NULL, lesson_tecnico = NULL WHERE id = ?").run(courseId);
  }

  return NextResponse.json({ success: true });
}
