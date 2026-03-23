"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { Brain, Layers, StickyNote, Clock, CreditCard } from "lucide-react";

interface DocumentSummary {
  id: number;
  title: string;
  file_type: string | null;
  updated_at: string;
  flashcard_count: number;
  note_count: number;
  quiz_count: number;
  last_studied: string | null;
}

export default function BrainerCardList() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) return;
        const docs: Array<{ id: number; title: string; file_type: string | null; updated_at: string }> = await res.json();

        // For each document, fetch counts
        const summaries = await Promise.all(
          docs.map(async (doc) => {
            try {
              const cardRes = await fetch(`/api/brainer-card/${doc.id}`);
              if (!cardRes.ok) return null;
              const cardData = await cardRes.json();
              const hasData =
                cardData.flashcards.length > 0 ||
                cardData.notes.length > 0 ||
                cardData.quizzes.length > 0 ||
                cardData.concepts.length > 0 ||
                cardData.studySessions.length > 0 ||
                cardData.summary;
              if (!hasData) return null;
              return {
                id: doc.id,
                title: doc.title,
                file_type: doc.file_type,
                updated_at: doc.updated_at,
                flashcard_count: cardData.flashcards.length,
                note_count: cardData.notes.length,
                quiz_count: cardData.quizzes.length,
                last_studied: cardData.stats.lastStudied,
              } as DocumentSummary;
            } catch {
              return null;
            }
          })
        );

        setDocuments(summaries.filter((s): s is DocumentSummary => s !== null));
      } catch (err) {
        console.error("Error loading brainer cards:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, []);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Mai";
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent)15" }}
          >
            <CreditCard className="w-7 h-7" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold" style={{ color: "var(--text-primary)" }}>
              Brainer Card
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              La tua mente estesa — tutto lo studio su ogni documento, in una scheda
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        ) : documents.length === 0 ? (
          <Card className="text-center py-16">
            <Brain className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
            <h2 className="text-xl font-display font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Nessuna Brainer Card disponibile
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Studia un documento per generare la tua prima Brainer Card.
              <br />
              Crea flashcard, note, quiz o concetti da un documento per iniziare.
            </p>
            <Link
              href="/acquire"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, var(--accent), #b8912e)",
                color: "#1a1814",
              }}
            >
              Carica un documento
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Link key={doc.id} href={`/brainer-card/${doc.id}`}>
                <Card variant="interactive" className="h-full">
                  <div className="space-y-3">
                    {/* File type badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: "var(--accent)15",
                          color: "var(--accent)",
                        }}
                      >
                        {doc.file_type?.toUpperCase() || "TESTO"}
                      </span>
                      <Brain className="w-4 h-4" style={{ color: "var(--accent)", opacity: 0.5 }} />
                    </div>

                    {/* Title */}
                    <h3
                      className="font-display font-semibold text-base line-clamp-2 leading-snug"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {doc.title}
                    </h3>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {doc.flashcard_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {doc.flashcard_count}
                        </span>
                      )}
                      {doc.note_count > 0 && (
                        <span className="flex items-center gap-1">
                          <StickyNote className="w-3 h-3" />
                          {doc.note_count}
                        </span>
                      )}
                      {doc.quiz_count > 0 && (
                        <span className="flex items-center gap-1">
                          Q: {doc.quiz_count}
                        </span>
                      )}
                    </div>

                    {/* Last studied */}
                    <div
                      className="flex items-center gap-1.5 text-[10px] pt-2 border-t"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      <Clock className="w-3 h-3" />
                      Ultimo studio: {formatDate(doc.last_studied)}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
