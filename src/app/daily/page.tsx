"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Clock, Check, RotateCcw, ChevronRight, Flame, Send } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Flashcard {
  id: number;
  front: string;
  back: string;
  deck: string;
}

interface WeakConcept {
  id: number;
  title: string;
  mastery_score: number;
  course_id: number;
  course_title: string;
}

interface DailyData {
  due_flashcards: number;
  due_review: number;
  weak_concepts: WeakConcept[];
  streak: number;
  estimated_minutes: number;
}

type SessionPhase = "loading" | "flashcards" | "concepts" | "done";

export default function DailySessionPage() {
  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [daily, setDaily] = useState<DailyData | null>(null);

  // Flashcard state
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardsReviewed, setCardsReviewed] = useState(0);

  // Concept state
  const [concepts, setConcepts] = useState<WeakConcept[]>([]);
  const [conceptIndex, setConceptIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [conceptsDone, setConceptsDone] = useState(0);

  // Session tracking
  const [startTime] = useState(() => Date.now());
  const [streak, setStreak] = useState(0);

  // Total items for progress
  const totalItems = cards.length + concepts.length;
  const completedItems = cardsReviewed + conceptsDone;

  useEffect(() => {
    async function load() {
      try {
        const [dailyRes, dueCardsRes] = await Promise.all([
          fetch("/api/daily").then((r) => r.json()),
          fetch("/api/flashcards?due=true").then((r) => r.json()),
        ]);
        setDaily(dailyRes);
        setStreak(dailyRes.streak);
        setCards(dueCardsRes.slice(0, 20)); // cap at 20 for a quick session
        setConcepts(dailyRes.weak_concepts || []);

        if (dueCardsRes.length > 0) {
          setPhase("flashcards");
        } else if (dailyRes.weak_concepts?.length > 0) {
          setPhase("concepts");
        } else {
          setPhase("done");
        }
      } catch (e) {
        console.error("Failed to load daily session", e);
        setPhase("done");
      }
    }
    load();
  }, []);

  const handleCardAnswer = useCallback(
    async (correct: boolean) => {
      const card = cards[cardIndex];
      if (!card) return;

      // Report to SM2 API
      try {
        await fetch("/api/flashcards", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: card.id, correct, timeMs: 5000 }),
        });
      } catch (e) {
        console.error("Failed to update card", e);
      }

      setCardsReviewed((p) => p + 1);
      setFlipped(false);

      if (cardIndex + 1 < cards.length) {
        setCardIndex((i) => i + 1);
      } else if (concepts.length > 0) {
        setPhase("concepts");
      } else {
        finishSession(cardsReviewed + 1, 0);
      }
    },
    [cardIndex, cards, concepts, cardsReviewed]
  );

  const handleConceptSubmit = useCallback(() => {
    if (!explanation.trim()) return;

    setConceptsDone((p) => p + 1);
    setExplanation("");

    if (conceptIndex + 1 < concepts.length) {
      setConceptIndex((i) => i + 1);
    } else {
      finishSession(cardsReviewed, conceptsDone + 1);
    }
  }, [conceptIndex, concepts, explanation, cardsReviewed, conceptsDone]);

  const skipConcept = useCallback(() => {
    setConceptsDone((p) => p + 1);
    setExplanation("");

    if (conceptIndex + 1 < concepts.length) {
      setConceptIndex((i) => i + 1);
    } else {
      finishSession(cardsReviewed, conceptsDone + 1);
    }
  }, [conceptIndex, concepts, cardsReviewed, conceptsDone]);

  async function finishSession(flashcardsCount: number, conceptsCount: number) {
    const elapsed = Math.round((Date.now() - startTime) / 60000);

    try {
      await Promise.all([
        fetch("/api/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flashcards_reviewed: flashcardsCount,
            concepts_studied: conceptsCount,
            minutes: Math.max(1, elapsed),
          }),
        }),
        fetch("/api/study-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "review",
            cards_reviewed: flashcardsCount,
            duration_seconds: Math.round((Date.now() - startTime) / 1000),
          }),
        }),
      ]);
    } catch (e) {
      console.error("Failed to log session", e);
    }

    setStreak((s) => s + (s === (daily?.streak || 0) ? 1 : 0));
    setPhase("done");
  }

  // Loading
  if (phase === "loading") {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Preparo la sessione...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Sessione rapida
            </h1>
            {phase !== "done" && daily && (
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <Clock className="w-3 h-3" />
                ~{Math.round(daily.estimated_minutes)} minuti
              </p>
            )}
          </div>
        </div>
        {phase !== "done" && totalItems > 0 && (
          <span
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: "var(--accent)15", color: "var(--accent)" }}
          >
            {completedItems}/{totalItems} completati
          </span>
        )}
      </div>

      {/* Progress bar */}
      {phase !== "done" && totalItems > 0 && (
        <div className="w-full h-1.5 rounded-full" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedItems / totalItems) * 100}%`,
              background: "linear-gradient(90deg, var(--accent), #b8912e)",
            }}
          />
        </div>
      )}

      {/* Flashcard phase */}
      {phase === "flashcards" && cards[cardIndex] && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Flashcard {cardIndex + 1} di {cards.length}
          </p>
          <div
            className="flashcard-container"
            style={{ height: 300 }}
            onClick={() => !flipped && setFlipped(true)}
          >
            <div className={`flashcard-inner w-full h-full relative ${flipped ? "flipped" : ""}`}>
              {/* Front */}
              <Card className="flashcard-front flex items-center justify-center p-8 cursor-pointer">
                <div className="text-center space-y-3">
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {cards[cardIndex].front}
                  </p>
                  {!flipped && (
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Tocca per rivelare la risposta
                    </p>
                  )}
                </div>
              </Card>
              {/* Back */}
              <Card className="flashcard-back flex items-center justify-center p-8">
                <p className="text-base leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {cards[cardIndex].back}
                </p>
              </Card>
            </div>
          </div>

          {flipped && (
            <div className="flex gap-3 justify-center">
              <Button variant="danger" size="md" onClick={() => handleCardAnswer(false)}>
                <RotateCcw className="w-4 h-4" />
                Da ripassare
              </Button>
              <Button variant="primary" size="md" onClick={() => handleCardAnswer(true)}>
                <Check className="w-4 h-4" />
                Sapevo!
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Concept review phase */}
      {phase === "concepts" && concepts[conceptIndex] && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Concetto {conceptIndex + 1} di {concepts.length} — Metodo Feynman
          </p>
          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
                  {concepts[conceptIndex].course_title}
                </p>
                <h3 className="font-display text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {concepts[conceptIndex].title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-20 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${concepts[conceptIndex].mastery_score}%`,
                        background: concepts[conceptIndex].mastery_score < 30 ? "var(--danger)" : "var(--warning)",
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {Math.round(concepts[conceptIndex].mastery_score)}% padronanza
                  </span>
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Spiega questo concetto con parole tue:
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Scrivi la tua spiegazione..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="ghost" size="sm" onClick={skipConcept}>
                  Salta
                  <ChevronRight className="w-3 h-3" />
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleConceptSubmit}
                  disabled={!explanation.trim()}
                >
                  <Send className="w-4 h-4" />
                  Invia spiegazione
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Done */}
      {phase === "done" && (
        <Card className="text-center py-12 space-y-6">
          <div>
            <Flame className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--accent)" }} />
            <h2 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {totalItems === 0 ? "Nulla da ripassare!" : "Sessione completata!"}
            </h2>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              {totalItems === 0
                ? "Tutti i concetti e le flashcard sono aggiornati. Ottimo lavoro!"
                : "Continua cosi, la costanza e la chiave della padronanza."}
            </p>
          </div>

          {totalItems > 0 && (
            <div
              className="flex items-center justify-center gap-8 py-4 border-y"
              style={{ borderColor: "var(--border)" }}
            >
              {cardsReviewed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
                    {cardsReviewed}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    flashcard
                  </p>
                </div>
              )}
              {conceptsDone > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: "var(--phase-articulate)" }}>
                    {conceptsDone}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    concetti
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: "var(--success)" }}>
                  {Math.max(1, Math.round((Date.now() - startTime) / 60000))}
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  minuti
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Flame className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <span className="font-display text-lg font-bold" style={{ color: "var(--accent)" }}>
              {streak} {streak === 1 ? "giorno" : "giorni"} di streak
            </span>
          </div>

          <Link href="/">
            <Button variant="primary" size="lg">
              Torna alla dashboard
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
