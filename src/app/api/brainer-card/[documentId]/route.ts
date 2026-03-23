import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface DocumentRow {
  id: number;
  title: string;
  content: string | null;
  file_path: string | null;
  file_type: string | null;
  created_at: string;
  updated_at: string;
}

interface FlashcardRow {
  id: number;
  front: string;
  back: string;
  deck: string;
  easiness: number;
  interval: number;
  repetitions: number;
  next_review: string;
  created_at: string;
}

interface QuizRow {
  id: number;
  title: string;
  questions: string;
  created_at: string;
}

interface NoteRow {
  id: number;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
}

interface StudySessionRow {
  id: number;
  type: string;
  score: number | null;
  cards_reviewed: number;
  duration_seconds: number;
  details: string | null;
  created_at: string;
}

interface ConceptRow {
  id: number;
  title: string;
  explanation: string | null;
  keywords: string | null;
  mastery_score: number;
  times_studied: number;
  times_correct: number;
  bloom_level: number;
  last_studied: string | null;
}

interface SessionStats {
  total_sessions: number;
  total_minutes: number;
  avg_score: number | null;
  last_studied: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const docId = parseInt(documentId, 10);

    if (isNaN(docId)) {
      return NextResponse.json({ error: 'ID documento non valido' }, { status: 400 });
    }

    // Document info
    const document = db.prepare(
      'SELECT * FROM documents WHERE id = ?'
    ).get(docId) as DocumentRow | undefined;

    if (!document) {
      return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
    }

    // Flashcards
    const flashcards = db.prepare(
      'SELECT id, front, back, deck, easiness, interval, repetitions, next_review, created_at FROM flashcards WHERE document_id = ? ORDER BY created_at ASC'
    ).all(docId) as FlashcardRow[];

    // Quizzes
    const quizzes = db.prepare(
      'SELECT id, title, questions, created_at FROM quizzes WHERE document_id = ? ORDER BY created_at DESC'
    ).all(docId) as QuizRow[];

    // Notes
    const notes = db.prepare(
      'SELECT id, content, type, created_at, updated_at FROM notes WHERE document_id = ? ORDER BY created_at DESC'
    ).all(docId) as NoteRow[];

    // Study sessions
    const studySessions = db.prepare(
      'SELECT id, type, score, cards_reviewed, duration_seconds, details, created_at FROM study_sessions WHERE document_id = ? ORDER BY created_at DESC'
    ).all(docId) as StudySessionRow[];

    // Concepts (via course_documents or direct document_id)
    const concepts = db.prepare(`
      SELECT DISTINCT c.id, c.title, c.explanation, c.keywords, c.mastery_score,
             c.times_studied, c.times_correct, c.bloom_level, c.last_studied
      FROM concepts c
      WHERE c.document_id = ?
      UNION
      SELECT DISTINCT c.id, c.title, c.explanation, c.keywords, c.mastery_score,
             c.times_studied, c.times_correct, c.bloom_level, c.last_studied
      FROM concepts c
      JOIN course_documents cd ON c.course_id = cd.course_id
      WHERE cd.document_id = ?
      ORDER BY title ASC
    `).all(docId, docId) as ConceptRow[];

    // Stats aggregation
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        COALESCE(SUM(duration_seconds), 0) / 60 as total_minutes,
        AVG(CASE WHEN score IS NOT NULL THEN score END) as avg_score,
        MAX(created_at) as last_studied
      FROM study_sessions
      WHERE document_id = ?
    `).get(docId) as SessionStats;

    // Word count from content
    const wordCount = document.content
      ? document.content.split(/\s+/).filter(Boolean).length
      : 0;

    // Find summary note
    const summary = notes.find(n => n.type === 'summary');

    return NextResponse.json({
      document: {
        ...document,
        word_count: wordCount,
        content_snippet: document.content
          ? document.content.substring(0, 300) + (document.content.length > 300 ? '...' : '')
          : null,
      },
      flashcards,
      quizzes: quizzes.map(q => ({
        ...q,
        questions: (() => {
          try { return JSON.parse(q.questions); } catch { return q.questions; }
        })(),
      })),
      notes: notes.filter(n => n.type !== 'summary'),
      summary: summary?.content || null,
      concepts,
      studySessions,
      stats: {
        totalSessions: stats.total_sessions,
        totalMinutes: Math.round(stats.total_minutes),
        avgScore: stats.avg_score ? Math.round(stats.avg_score * 10) / 10 : null,
        lastStudied: stats.last_studied,
      },
    });
  } catch (error) {
    console.error('Brainer Card API error:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero della Brainer Card' },
      { status: 500 }
    );
  }
}
