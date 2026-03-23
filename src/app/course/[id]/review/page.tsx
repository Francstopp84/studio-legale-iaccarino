"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Cog, Brain, HelpCircle, AlertTriangle, Check, X, ChevronRight, Sparkles, RotateCcw, Trophy } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PhaseHeader from "@/components/ui/PhaseHeader";
import ProgressRing from "@/components/ui/ProgressRing";

/* ── Types ── */

interface Flashcard {
  id: number;
  front: string;
  back: string;
  deck: string;
  easiness: number;
  interval: number;
  repetitions: number;
  next_review: string;
  document_id: number | null;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface Quiz {
  id: number;
  document_id: number;
  title: string;
  questions: string; // JSON stringified QuizQuestion[]
  created_at: string;
}

interface Concept {
  id: number;
  title: string;
  mastery_score: number;
  bloom_level: number;
}

interface CourseDoc {
  id: number;
  title: string;
}

type Mode = "dashboard" | "flashcard" | "quiz";

/* ── Page ── */

export default function ReviewPage() {
  const params = useParams();
  const courseId = params.id as string;

  // Data
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [documents, setDocuments] = useState<CourseDoc[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // UI state
  const [mode, setMode] = useState<Mode>("dashboard");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Flashcard review state
  const [fcIndex, setFcIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [fcStats, setFcStats] = useState({ reviewed: 0, correct: 0 });
  const [fcDone, setFcDone] = useState(false);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [quizStats, setQuizStats] = useState({ total: 0, correct: 0 });
  const [quizDone, setQuizDone] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  /* ── Data loading ── */

  const loadData = useCallback(async () => {
    try {
      const [courseRes, conceptsRes, cardsRes, dueRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`),
        fetch(`/api/courses/${courseId}/concepts`),
        fetch("/api/flashcards"),
        fetch("/api/flashcards?due=true"),
      ]);

      const courseData = await courseRes.json();
      const conceptsData: Concept[] = await conceptsRes.json();
      const allCardsData: Flashcard[] = await cardsRes.json();
      const dueCardsData: Flashcard[] = await dueRes.json();

      // Filter cards belonging to this course's documents
      const docIds = new Set((courseData.documents || []).map((d: CourseDoc) => d.id));
      setDocuments(courseData.documents || []);
      setConcepts(Array.isArray(conceptsData) ? conceptsData : []);
      setAllCards(allCardsData.filter((c) => c.document_id && docIds.has(c.document_id)));
      setDueCards(dueCardsData.filter((c) => c.document_id && docIds.has(c.document_id)));

      // Load quizzes for course documents
      // No dedicated quiz list API — we'll track generated quizzes locally
      setQuizzes([]);
    } catch (e) {
      console.error("Errore caricamento dati review:", e);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Derived ── */

  const weakConcepts = concepts.filter((c) => c.mastery_score < 60);
  const currentFc = dueCards[fcIndex] || null;
  const currentQ = quizQuestions[qIndex] || null;

  /* ── Flashcard handlers ── */

  const startFlashcards = () => {
    setMode("flashcard");
    setFcIndex(0);
    setFlipped(false);
    setFcStats({ reviewed: 0, correct: 0 });
    setFcDone(false);
  };

  const handleFcAnswer = async (correct: boolean) => {
    if (!currentFc) return;

    await fetch("/api/flashcards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentFc.id, correct }),
    });

    const newStats = {
      reviewed: fcStats.reviewed + 1,
      correct: fcStats.correct + (correct ? 1 : 0),
    };
    setFcStats(newStats);
    setFlipped(false);

    if (fcIndex < dueCards.length - 1) {
      setFcIndex((i) => i + 1);
    } else {
      // Session complete
      await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "flashcard",
          cards_reviewed: newStats.reviewed,
          score: (newStats.correct / newStats.reviewed) * 100,
        }),
      });
      setFcDone(true);
    }
  };

  /* ── Quiz handlers ── */

  const startQuiz = async () => {
    if (documents.length === 0) return;
    setQuizLoading(true);

    try {
      // Generate quiz from first document with content
      const doc = documents[0];
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id, count: 5 }),
      });
      const quiz = await res.json();
      if (quiz.error) {
        console.error("Errore quiz:", quiz.error);
        return;
      }

      const questions: QuizQuestion[] =
        typeof quiz.questions === "string" ? JSON.parse(quiz.questions) : quiz.questions;

      setQuizQuestions(questions);
      setQIndex(0);
      setSelectedOption(null);
      setAnswered(false);
      setQuizStats({ total: 0, correct: 0 });
      setQuizDone(false);
      setMode("quiz");
    } catch (e) {
      console.error("Errore generazione quiz:", e);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizSelect = (optionIdx: number) => {
    if (answered) return;
    setSelectedOption(optionIdx);
    setAnswered(true);

    const isCorrect = optionIdx === currentQ.correct;
    setQuizStats((s) => ({
      total: s.total + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
    }));
  };

  const nextQuestion = () => {
    if (qIndex < quizQuestions.length - 1) {
      setQIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      // Quiz complete
      fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quiz",
          score: (quizStats.correct / quizStats.total) * 100,
          cards_reviewed: quizStats.total,
        }),
      });
      setQuizDone(true);
    }
  };

  /* ── Generate flashcards for all docs ── */

  const generateFlashcards = async () => {
    if (documents.length === 0 || generating) return;
    setGenerating(true);

    try {
      for (const doc of documents) {
        await fetch("/api/ai/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: doc.id, count: 5 }),
        });
      }
      await loadData();
    } catch (e) {
      console.error("Errore generazione flashcard:", e);
    } finally {
      setGenerating(false);
    }
  };

  /* ── Render helpers ── */

  const backToDashboard = () => {
    setMode("dashboard");
    loadData();
  };

  const optionLabels = ["A", "B", "C", "D"];

  /* ── Loading ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--phase-consolidate)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MODE: FLASHCARD
     ═══════════════════════════════════════════════════════ */

  if (mode === "flashcard") {
    // Summary screen
    if (fcDone) {
      const pct = fcStats.reviewed > 0 ? Math.round((fcStats.correct / fcStats.reviewed) * 100) : 0;
      return (
        <div>
          <PhaseHeader
            phase={4}
            title="Consolida"
            description="Rinforza la memoria con flashcard, quiz e ripetizione spaziata"
            icon={Cog}
            color="var(--phase-consolidate)"
          />
          <div className="text-center py-12">
            <ProgressRing value={pct} size={120} strokeWidth={8} color="var(--phase-consolidate)" />
            <h2
              className="text-2xl font-display font-bold mt-6 mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Sessione completata!
            </h2>
            <p className="mb-1" style={{ color: "var(--text-secondary)" }}>
              {fcStats.correct} corrette su {fcStats.reviewed} flashcard
            </p>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Punteggio: {pct}%
            </p>
            <Button onClick={backToDashboard}>
              <RotateCcw className="w-4 h-4" /> Torna alla dashboard
            </Button>
          </div>
        </div>
      );
    }

    // Active review
    return (
      <div>
        <PhaseHeader
          phase={4}
          title="Consolida"
          description="Rinforza la memoria con flashcard, quiz e ripetizione spaziata"
          icon={Cog}
          color="var(--phase-consolidate)"
          progress={dueCards.length > 0 ? ((fcIndex + 1) / dueCards.length) * 100 : 0}
        />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Carta {fcIndex + 1} di {dueCards.length} &middot; Corrette: {fcStats.correct}/{fcStats.reviewed}
          </span>
          <Button variant="ghost" size="sm" onClick={backToDashboard}>
            Esci
          </Button>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full mb-6 overflow-hidden"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((fcIndex + 1) / dueCards.length) * 100}%`,
              background: "var(--phase-consolidate)",
            }}
          />
        </div>

        {/* Flashcard with 3D flip */}
        {currentFc && (
          <div className="flashcard-container mx-auto" style={{ maxWidth: 600, minHeight: 300 }}>
            <div
              className={`flashcard-inner ${flipped ? "flipped" : ""}`}
              style={{ position: "relative", minHeight: 300 }}
            >
              {/* Front */}
              <div
                className="flashcard-front rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer"
                style={{
                  background: "var(--bg-card)",
                  border: "2px solid var(--phase-consolidate)",
                  minHeight: 300,
                }}
                onClick={() => setFlipped(true)}
              >
                <p
                  className="text-xs uppercase tracking-widest mb-4 font-semibold"
                  style={{ color: "var(--phase-consolidate)" }}
                >
                  DOMANDA — clicca per girare
                </p>
                <p
                  className="text-lg text-center leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {currentFc.front}
                </p>
              </div>

              {/* Back */}
              <div
                className="flashcard-back rounded-2xl flex flex-col items-center justify-center p-8"
                style={{
                  background: "var(--bg-card)",
                  border: "2px solid var(--accent)",
                  minHeight: 300,
                }}
              >
                <p
                  className="text-xs uppercase tracking-widest mb-4 font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  RISPOSTA
                </p>
                <p
                  className="text-lg text-center leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {currentFc.back}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Answer buttons — visible after flip */}
        {flipped && (
          <div className="flex gap-4 mt-6 max-w-[600px] mx-auto">
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={() => handleFcAnswer(false)}
            >
              <X className="w-5 h-5" /> Non lo sapevo
            </Button>
            <Button
              size="lg"
              className="flex-1"
              style={{ background: "var(--success)", color: "#1a1814", border: "none" }}
              onClick={() => handleFcAnswer(true)}
            >
              <Check className="w-5 h-5" /> Lo sapevo!
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MODE: QUIZ
     ═══════════════════════════════════════════════════════ */

  if (mode === "quiz") {
    // Summary screen
    if (quizDone) {
      const pct = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0;
      return (
        <div>
          <PhaseHeader
            phase={4}
            title="Consolida"
            description="Rinforza la memoria con flashcard, quiz e ripetizione spaziata"
            icon={Cog}
            color="var(--phase-consolidate)"
          />
          <div className="text-center py-12">
            <ProgressRing value={pct} size={120} strokeWidth={8} color="var(--phase-consolidate)" />
            <h2
              className="text-2xl font-display font-bold mt-6 mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Quiz completato!
            </h2>
            <p className="mb-1" style={{ color: "var(--text-secondary)" }}>
              {quizStats.correct} corrette su {quizStats.total} domande
            </p>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Punteggio: {pct}%
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="secondary" onClick={startQuiz}>
                <RotateCcw className="w-4 h-4" /> Nuovo quiz
              </Button>
              <Button onClick={backToDashboard}>
                Torna alla dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Active quiz
    return (
      <div>
        <PhaseHeader
          phase={4}
          title="Consolida"
          description="Rinforza la memoria con flashcard, quiz e ripetizione spaziata"
          icon={Cog}
          color="var(--phase-consolidate)"
          progress={quizQuestions.length > 0 ? ((qIndex + 1) / quizQuestions.length) * 100 : 0}
        />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Domanda {qIndex + 1} di {quizQuestions.length} &middot; Corrette: {quizStats.correct}/{quizStats.total}
          </span>
          <Button variant="ghost" size="sm" onClick={backToDashboard}>
            Esci
          </Button>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full mb-6 overflow-hidden"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((qIndex + 1) / quizQuestions.length) * 100}%`,
              background: "var(--phase-consolidate)",
            }}
          />
        </div>

        {currentQ && (
          <div className="max-w-[700px] mx-auto">
            {/* Question */}
            <Card variant="highlighted" phaseColor="var(--phase-consolidate)" className="mb-6">
              <p
                className="text-lg font-display font-semibold leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {currentQ.question}
              </p>
            </Card>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {currentQ.options.map((opt, i) => {
                let borderColor = "var(--border)";
                let bg = "var(--bg-card)";
                let textColor = "var(--text-primary)";

                if (answered) {
                  if (i === currentQ.correct) {
                    borderColor = "var(--success)";
                    bg = "rgba(107, 143, 113, 0.15)";
                    textColor = "var(--success)";
                  } else if (i === selectedOption && i !== currentQ.correct) {
                    borderColor = "var(--danger)";
                    bg = "rgba(196, 92, 74, 0.15)";
                    textColor = "var(--danger)";
                  }
                } else if (i === selectedOption) {
                  borderColor = "var(--accent)";
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleQuizSelect(i)}
                    disabled={answered}
                    className="w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:hover:scale-100"
                    style={{
                      background: bg,
                      border: `2px solid ${borderColor}`,
                      color: textColor,
                    }}
                  >
                    <span
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{
                        background: answered && i === currentQ.correct
                          ? "var(--success)"
                          : answered && i === selectedOption && i !== currentQ.correct
                            ? "var(--danger)"
                            : "var(--bg-hover)",
                        color: answered && (i === currentQ.correct || i === selectedOption)
                          ? "#1a1814"
                          : "var(--text-secondary)",
                      }}
                    >
                      {optionLabels[i]}
                    </span>
                    <span className="text-sm leading-relaxed">{opt}</span>
                    {answered && i === currentQ.correct && (
                      <Check className="w-5 h-5 ml-auto shrink-0" style={{ color: "var(--success)" }} />
                    )}
                    {answered && i === selectedOption && i !== currentQ.correct && (
                      <X className="w-5 h-5 ml-auto shrink-0" style={{ color: "var(--danger)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation after answer */}
            {answered && currentQ.explanation && (
              <Card className="mb-6" style={{ borderColor: "var(--phase-consolidate)" }}>
                <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--phase-consolidate)" }}>
                  Spiegazione
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {currentQ.explanation}
                </p>
              </Card>
            )}

            {/* Next button */}
            {answered && (
              <div className="flex justify-end">
                <Button onClick={nextQuestion}>
                  {qIndex < quizQuestions.length - 1 ? (
                    <>Avanti <ChevronRight className="w-4 h-4" /></>
                  ) : (
                    <>Risultati <Trophy className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MODE: DASHBOARD (default)
     ═══════════════════════════════════════════════════════ */

  return (
    <div>
      <PhaseHeader
        phase={4}
        title="Consolida"
        description="Rinforza la memoria con flashcard, quiz e ripetizione spaziata"
        icon={Cog}
        color="var(--phase-consolidate)"
      />

      {/* 3 Dashboard cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Flashcard card */}
        <Card variant="interactive">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(107, 143, 113, 0.15)" }}
            >
              <Brain className="w-5 h-5" style={{ color: "var(--phase-consolidate)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Flashcard
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {dueCards.length} da ripassare
              </p>
            </div>
          </div>
          <div className="text-3xl font-display font-bold mb-4" style={{ color: "var(--phase-consolidate)" }}>
            {dueCards.length}
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={dueCards.length === 0}
            style={dueCards.length > 0 ? { background: "var(--phase-consolidate)", color: "#1a1814", border: "none" } : undefined}
            onClick={startFlashcards}
          >
            RIPASSA
          </Button>
        </Card>

        {/* Quiz card */}
        <Card variant="interactive">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(107, 143, 113, 0.15)" }}
            >
              <HelpCircle className="w-5 h-5" style={{ color: "var(--phase-consolidate)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Quiz
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {documents.length} documenti disponibili
              </p>
            </div>
          </div>
          <div className="text-3xl font-display font-bold mb-4" style={{ color: "var(--phase-consolidate)" }}>
            {documents.length}
          </div>
          <Button
            size="sm"
            className="w-full"
            loading={quizLoading}
            disabled={documents.length === 0}
            style={documents.length > 0 ? { background: "var(--phase-consolidate)", color: "#1a1814", border: "none" } : undefined}
            onClick={startQuiz}
          >
            INIZIA QUIZ
          </Button>
        </Card>

        {/* Weak concepts card */}
        <Card variant="interactive">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(212, 168, 83, 0.15)" }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Concetti deboli
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                padronanza &lt; 60%
              </p>
            </div>
          </div>
          <div className="text-3xl font-display font-bold mb-4" style={{ color: "var(--warning)" }}>
            {weakConcepts.length}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            disabled={weakConcepts.length === 0}
            onClick={() => {
              const el = document.getElementById("weak-concepts-section");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            RINFORZA
          </Button>
        </Card>
      </div>

      {/* Generate flashcards button */}
      <div className="mb-8">
        <Button
          variant="secondary"
          loading={generating}
          onClick={generateFlashcards}
          disabled={documents.length === 0}
        >
          <Sparkles className="w-4 h-4" />
          Genera nuove flashcard ({documents.length} documenti)
        </Button>
        {allCards.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {allCards.length} flashcard totali per questo corso
          </p>
        )}
      </div>

      {/* Concept mastery list */}
      <div id="weak-concepts-section">
        <h2
          className="text-lg font-display font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Padronanza concetti
        </h2>

        {concepts.length === 0 ? (
          <Card>
            <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              Nessun concetto trovato. Carica documenti per generare i concetti.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {concepts.map((concept) => {
              const mastery = concept.mastery_score || 0;
              const isWeak = mastery < 60;
              const barColor = isWeak ? "var(--warning)" : "var(--phase-consolidate)";

              return (
                <Card key={concept.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {concept.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${mastery}%`, background: barColor }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold shrink-0"
                        style={{ color: barColor }}
                      >
                        {Math.round(mastery)}%
                      </span>
                    </div>
                  </div>
                  {isWeak && (
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--warning)" }} />
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
