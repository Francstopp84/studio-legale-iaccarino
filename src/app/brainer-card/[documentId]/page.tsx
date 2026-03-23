"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressRing from "@/components/ui/ProgressRing";
import {
  FileText, Brain, Lightbulb, BookOpen, ClipboardList,
  StickyNote, BarChart3, Share2, Printer, ChevronDown,
  ChevronUp, ArrowLeft, Clock, Target, Layers, GitBranch,
} from "lucide-react";

interface BrainerCardData {
  document: {
    id: number;
    title: string;
    content_snippet: string | null;
    file_type: string | null;
    word_count: number;
    created_at: string;
    updated_at: string;
  };
  flashcards: Array<{
    id: number;
    front: string;
    back: string;
    deck: string;
    easiness: number;
  }>;
  quizzes: Array<{
    id: number;
    title: string;
    questions: any;
    created_at: string;
  }>;
  notes: Array<{
    id: number;
    content: string;
    type: string;
    created_at: string;
  }>;
  summary: string | null;
  concepts: Array<{
    id: number;
    title: string;
    explanation: string | null;
    keywords: string | null;
    mastery_score: number;
    times_studied: number;
    bloom_level: number;
  }>;
  studySessions: Array<{
    id: number;
    type: string;
    score: number | null;
    duration_seconds: number;
    created_at: string;
  }>;
  stats: {
    totalSessions: number;
    totalMinutes: number;
    avgScore: number | null;
    lastStudied: string | null;
  };
}

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: "var(--accent)20", color: "var(--accent)" }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-display font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {count !== undefined && count > 0 && (
        <span
          className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold"
          style={{ background: "var(--accent)20", color: "var(--accent)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  count,
  children,
  defaultOpen = true,
}: {
  icon: any;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="no-print-break">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 text-left"
      >
        <SectionHeader icon={icon} title={title} count={count} />
        <div className="ml-auto no-print" style={{ color: "var(--text-secondary)" }}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fileTypeBadge(fileType: string | null) {
  const label = fileType?.toUpperCase() || "TESTO";
  const colors: Record<string, string> = {
    PDF: "#c45c4a",
    DOCX: "#5b8fb9",
    TXT: "#6b8f71",
    TESTO: "#9a8e7a",
  };
  const color = colors[label] || "var(--accent)";
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}25`, color }}
    >
      {label}
    </span>
  );
}

export default function BrainerCardPage() {
  const params = useParams();
  const documentId = params.documentId as string;
  const [data, setData] = useState<BrainerCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/brainer-card/${documentId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Documento non trovato");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Generazione Brainer Card...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Card className="text-center p-8 max-w-md">
          <p className="text-lg font-display mb-2" style={{ color: "var(--danger)" }}>
            {error || "Errore sconosciuto"}
          </p>
          <Link href="/brainer-card">
            <Button variant="secondary" size="sm">Torna alla lista</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { document: doc, flashcards, quizzes, notes, summary, concepts, stats } = data;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Back nav */}
        <div className="no-print">
          <Link
            href="/brainer-card"
            className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Tutte le Brainer Card
          </Link>
        </div>

        {/* HEADER */}
        <Card variant="highlighted" phaseColor="var(--accent)">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                {fileTypeBadge(doc.file_type)}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {doc.word_count.toLocaleString("it-IT")} parole
                </span>
              </div>
              <h1
                className="text-3xl md:text-4xl font-display font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {doc.title}
              </h1>
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>Creato: {formatDate(doc.created_at)}</span>
                <span>Aggiornato: {formatDate(doc.updated_at)}</span>
              </div>
            </div>
            <div
              className="hidden md:flex w-20 h-20 rounded-2xl items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent)15" }}
            >
              <Brain className="w-10 h-10" style={{ color: "var(--accent)" }} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5 no-print">
            <Button variant="secondary" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              {copied ? "Link copiato!" : "Condividi link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Stampa
            </Button>
          </div>
        </Card>

        {/* SOMMARIO */}
        {(summary || doc.content_snippet) && (
          <Card>
            <SectionHeader icon={FileText} title="Sommario" />
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text-secondary)" }}
            >
              {summary || doc.content_snippet}
            </p>
          </Card>
        )}

        {/* CONCETTI CHIAVE */}
        {concepts.length > 0 && (
          <Card>
            <SectionHeader icon={Lightbulb} title="Concetti chiave" count={concepts.length} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {concepts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {c.title}
                    </h3>
                    <ProgressRing
                      value={c.mastery_score * 100}
                      size={40}
                      strokeWidth={3}
                      color={
                        c.mastery_score >= 0.8
                          ? "var(--success)"
                          : c.mastery_score >= 0.5
                          ? "var(--warning)"
                          : "var(--danger)"
                      }
                    />
                  </div>
                  {c.explanation && (
                    <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                      {c.explanation}
                    </p>
                  )}
                  {c.keywords && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.keywords.split(",").slice(0, 4).map((kw, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px]"
                          style={{ background: "var(--accent)10", color: "var(--accent)" }}
                        >
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* MAPPA MENTALE */}
        {concepts.length > 0 && (
          <Card>
            <SectionHeader icon={GitBranch} title="Mappa mentale" />
            <div
              className="rounded-xl p-6 text-center"
              style={{ background: "var(--bg-hover)", border: "1px dashed var(--border)" }}
            >
              {/* Simple tree visualization */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="px-4 py-2 rounded-xl text-sm font-display font-semibold"
                  style={{ background: "var(--accent)25", color: "var(--accent)", border: "1px solid var(--accent)" }}
                >
                  {doc.title}
                </div>
                <div className="w-px h-4" style={{ background: "var(--accent)40" }} />
                <div className="flex flex-wrap justify-center gap-3">
                  {concepts.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex flex-col items-center gap-1">
                      <div className="w-px h-3" style={{ background: "var(--border)" }} />
                      <div
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {c.title}
                      </div>
                    </div>
                  ))}
                </div>
                {concepts.length > 8 && (
                  <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                    +{concepts.length - 8} altri concetti
                  </p>
                )}
              </div>
              <Link href="/mindmap" className="no-print">
                <Button variant="ghost" size="sm" className="mt-4">
                  Apri mappa completa
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* FLASHCARD */}
        {flashcards.length > 0 && (
          <CollapsibleSection icon={Layers} title="Flashcard" count={flashcards.length}>
            <div className="space-y-2">
              {flashcards.map((fc) => (
                <div
                  key={fc.id}
                  className="rounded-lg p-3"
                  style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {fc.front}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>→</span>{" "}
                        {fc.back}
                      </p>
                    </div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}
                    >
                      {fc.deck}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* NOTE */}
        {notes.length > 0 && (
          <CollapsibleSection icon={StickyNote} title="Note" count={notes.length}>
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg p-3"
                  style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {note.content}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(note.created_at)}
                    {note.type !== "note" && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded"
                        style={{ background: "var(--accent)10", color: "var(--accent)" }}
                      >
                        {note.type}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* QUIZ */}
        {quizzes.length > 0 && (
          <CollapsibleSection icon={ClipboardList} title="Quiz" count={quizzes.length} defaultOpen={false}>
            <div className="space-y-4">
              {quizzes.map((quiz) => {
                const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
                return (
                  <div key={quiz.id} className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                      {quiz.title}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {formatDate(quiz.created_at)} — {questions.length} domande
                    </p>
                    {questions.map((q: any, qi: number) => (
                      <div
                        key={qi}
                        className="rounded-lg p-3"
                        style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                          {qi + 1}. {q.question || q.text || JSON.stringify(q)}
                        </p>
                        {q.options && Array.isArray(q.options) && (
                          <ul className="space-y-0.5 ml-3">
                            {q.options.map((opt: string, oi: number) => (
                              <li
                                key={oi}
                                className="text-[11px]"
                                style={{
                                  color:
                                    opt === q.correct || oi === q.correctIndex
                                      ? "var(--success)"
                                      : "var(--text-secondary)",
                                  fontWeight:
                                    opt === q.correct || oi === q.correctIndex ? 600 : 400,
                                }}
                              >
                                {String.fromCharCode(65 + oi)}) {opt}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.answer && (
                          <p className="text-[11px] mt-1" style={{ color: "var(--success)" }}>
                            Risposta: {q.answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* STATISTICHE */}
        <Card>
          <SectionHeader icon={BarChart3} title="Statistiche" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox
              icon={BookOpen}
              label="Sessioni"
              value={String(stats.totalSessions)}
            />
            <StatBox
              icon={Clock}
              label="Minuti totali"
              value={String(stats.totalMinutes)}
            />
            <StatBox
              icon={Target}
              label="Punteggio medio"
              value={stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
            />
            <StatBox
              icon={BarChart3}
              label="Ultimo studio"
              value={stats.lastStudied ? formatDate(stats.lastStudied) : "Mai"}
              small
            />
          </div>
        </Card>

        {/* FOOTER */}
        <div
          className="text-center py-6 space-y-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-xs font-display" style={{ color: "var(--text-secondary)" }}>
            Generata con{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>Avv. Iaccarino</span>
            {" "}— Studio Legale
          </p>
          <div className="flex items-center justify-center gap-3 no-print">
            <Button variant="secondary" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              {copied ? "Copiato!" : "Condividi"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Stampa
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: any;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 text-center space-y-1"
      style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
    >
      <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--accent)" }} />
      <p
        className={`font-bold font-display ${small ? "text-sm" : "text-xl"}`}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
    </div>
  );
}
