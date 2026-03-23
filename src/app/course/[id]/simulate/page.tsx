"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PhaseHeader from "@/components/ui/PhaseHeader";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  Scale,
  Mic,
  Keyboard,
  Send,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Timer,
  Trophy,
  AlertCircle,
  Check,
  X,
  BarChart3,
  ArrowLeft,
  Zap,
  Target,
} from "lucide-react";

/* ─── Types ─── */

interface Question {
  id: number;
  text: string;
  expected_points: string[];
  max_score: number;
}

interface Simulation {
  id: number;
  course_id: number;
  type: "exam" | "arringa";
  structure: { questions: Question[] };
  user_transcript?: string;
  score?: number;
  duration_seconds?: number;
  ai_feedback?: string;
  created_at: string;
}

interface QuestionResult {
  questionIndex: number;
  userAnswer: string;
  coveredPoints: string[];
  missedPoints: string[];
  score: number;
  maxScore: number;
}

type TimerOption = 30 | 60 | 120 | 0; // 0 = infinity
type Difficulty = "easy" | "medium" | "hard";

/* ─── Timer Hook ─── */

function useCountdown(seconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!active || seconds === 0) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, seconds, onExpire]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return { remaining, formatted: formatTime(remaining) };
}

/* ─── Score Bar ─── */

function ScoreBar({ label, score, max, delay }: { label: string; score: number; max: number; delay: number }) {
  const [animated, setAnimated] = useState(0);
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  const getColor = (p: number) => {
    if (p >= 80) return "var(--success)";
    if (p >= 50) return "var(--accent)";
    return "var(--danger)";
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: getColor(pct), fontWeight: 600 }}>
          {score}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${animated}%`, background: getColor(pct) }}
        />
      </div>
    </div>
  );
}

/* ─── Past Simulation Row ─── */

function PastSimulationRow({ sim }: { sim: Simulation }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(sim.created_at);
  const dateStr = date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const scorePct = sim.score !== undefined && sim.score !== null ? sim.score : null;

  return (
    <div
      className="rounded-xl transition-all"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(155, 107, 158, 0.15)" }}
          >
            <Scale className="w-4 h-4" style={{ color: "var(--phase-simulate)" }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {sim.type === "exam" ? "Interrogazione" : "Arringa"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {dateStr} &middot; {timeStr}
              {sim.duration_seconds ? ` · ${Math.floor(sim.duration_seconds / 60)}m ${sim.duration_seconds % 60}s` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {scorePct !== null && (
            <span
              className="text-sm font-bold px-2.5 py-1 rounded-full"
              style={{
                background: scorePct >= 70 ? "rgba(107, 143, 113, 0.15)" : "rgba(196, 92, 74, 0.15)",
                color: scorePct >= 70 ? "var(--success)" : "var(--danger)",
              }}
            >
              {scorePct}%
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          )}
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 text-sm"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          <div className="pt-3 space-y-3">
            {sim.ai_feedback && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--phase-simulate)" }}>
                  Feedback AI
                </p>
                <p className="leading-relaxed">{sim.ai_feedback}</p>
              </div>
            )}
            {sim.structure?.questions && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--phase-simulate)" }}>
                  Domande ({sim.structure.questions.length})
                </p>
                <ul className="space-y-1">
                  {sim.structure.questions.map((q, i) => (
                    <li key={i} className="text-xs pl-3" style={{ borderLeft: "2px solid var(--border)" }}>
                      {q.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */

export default function SimulatePage() {
  const params = useParams();
  const courseId = params.id as string;

  /* ── State: mode selection ── */
  const [timerOption, setTimerOption] = useState<TimerOption>(60);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  /* ── State: exam flow ── */
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [examActive, setExamActive] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [currentResult, setCurrentResult] = useState<QuestionResult | null>(null);
  const [examFinished, setExamFinished] = useState(false);
  const [startingExam, setStartingExam] = useState(false);
  const [savingResults, setSavingResults] = useState(false);

  /* ── State: input ── */
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [voiceText, setVoiceText] = useState("");

  /* ── State: past simulations ── */
  const [pastSims, setPastSims] = useState<Simulation[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);

  /* ── Timer ── */
  const [timerExpired, setTimerExpired] = useState(false);
  const handleTimerExpire = useCallback(() => setTimerExpired(true), []);
  const { remaining, formatted: timerFormatted } = useCountdown(
    timerOption,
    examActive && !showingFeedback && !examFinished && timerOption > 0,
    handleTimerExpire
  );

  const currentText = inputMode === "voice" ? voiceText : textInput;

  /* ── Load past simulations ── */
  useEffect(() => {
    async function loadPast() {
      try {
        const res = await fetch(`/api/simulations?course_id=${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setPastSims(Array.isArray(data) ? data : []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoadingPast(false);
      }
    }
    loadPast();
  }, [courseId]);

  /* ── Reset input when question changes ── */
  useEffect(() => {
    setTextInput("");
    setVoiceText("");
    setTimerExpired(false);
    setShowingFeedback(false);
    setCurrentResult(null);
  }, [currentQ]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setVoiceText(text);
  }, []);

  /* ── Start exam ── */
  const startExam = async () => {
    setStartingExam(true);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: parseInt(courseId), type: "exam" }),
      });
      const data: Simulation = await res.json();
      setSimulation(data);
      const qs = data.structure?.questions || [];
      setQuestions(qs);
      setCurrentQ(0);
      setResults([]);
      setExamActive(true);
      setExamStartTime(Date.now());
      setExamFinished(false);
    } catch (err) {
      console.error("Errore avvio simulazione:", err);
    } finally {
      setStartingExam(false);
    }
  };

  /* ── Submit answer ── */
  const submitAnswer = async () => {
    if (!currentText.trim() || submittingAnswer) return;
    setSubmittingAnswer(true);

    const question = questions[currentQ];
    const answer = currentText.trim();

    // Evaluate locally: check which expected points the user covered
    const coveredPoints: string[] = [];
    const missedPoints: string[] = [];
    const lowerAnswer = answer.toLowerCase();

    for (const point of question.expected_points) {
      // Simple keyword matching — in production the API would do AI evaluation
      const keywords = point.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matched = keywords.some((kw) => lowerAnswer.includes(kw));
      if (matched) {
        coveredPoints.push(point);
      } else {
        missedPoints.push(point);
      }
    }

    const score =
      question.expected_points.length > 0
        ? Math.round((coveredPoints.length / question.expected_points.length) * question.max_score)
        : 0;

    const result: QuestionResult = {
      questionIndex: currentQ,
      userAnswer: answer,
      coveredPoints,
      missedPoints,
      score,
      maxScore: question.max_score,
    };

    setCurrentResult(result);
    setResults((prev) => [...prev, result]);
    setShowingFeedback(true);
    setSubmittingAnswer(false);
  };

  /* ── Auto-submit when timer expires ── */
  useEffect(() => {
    if (timerExpired && examActive && !showingFeedback) {
      if (currentText.trim()) {
        submitAnswer();
      } else {
        // No answer — zero score
        const question = questions[currentQ];
        const result: QuestionResult = {
          questionIndex: currentQ,
          userAnswer: "",
          coveredPoints: [],
          missedPoints: question?.expected_points || [],
          score: 0,
          maxScore: question?.max_score || 10,
        };
        setCurrentResult(result);
        setResults((prev) => [...prev, result]);
        setShowingFeedback(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerExpired]);

  /* ── Next question / finish ── */
  const nextQuestion = () => {
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      finishExam();
    }
  };

  /* ── Finish exam & save ── */
  const finishExam = async () => {
    setExamActive(false);
    setExamFinished(true);
    setSavingResults(true);

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalMax = results.reduce((sum, r) => sum + r.maxScore, 0);
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const durationSec = Math.round((Date.now() - examStartTime) / 1000);

    const weakConcepts = results
      .filter((r) => r.score / r.maxScore < 0.5)
      .map((r) => questions[r.questionIndex]?.text || "")
      .filter(Boolean);

    const feedback = weakConcepts.length
      ? `Punti deboli: ${weakConcepts.join("; ")}`
      : "Prestazione eccellente su tutti i quesiti.";

    try {
      await fetch("/api/simulations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulation_id: simulation?.id,
          user_transcript: results.map((r) => r.userAnswer).join("\n---\n"),
          score: pct,
          duration_seconds: durationSec,
          ai_feedback: feedback,
        }),
      });
    } catch {
      /* ignore save errors */
    } finally {
      setSavingResults(false);
    }
  };

  /* ── Reset to mode selection ── */
  const resetToSelection = () => {
    setSimulation(null);
    setQuestions([]);
    setCurrentQ(0);
    setResults([]);
    setExamActive(false);
    setExamFinished(false);
    setCurrentResult(null);
    setShowingFeedback(false);
    // Reload past sims
    fetch(`/api/simulations?course_id=${courseId}`)
      .then((r) => r.json())
      .then((data) => setPastSims(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  /* ═══════════ RENDER ═══════════ */

  const PHASE_COLOR = "var(--phase-simulate)";
  const PHASE_BG = "rgba(155, 107, 158, 0.15)";

  /* ─── EXAM FINISHED — Summary ─── */
  if (examFinished) {
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalMax = results.reduce((sum, r) => sum + r.maxScore, 0);
    const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    const durationSec = Math.round((Date.now() - examStartTime) / 1000);
    const durationMin = Math.floor(durationSec / 60);
    const durationSecRem = durationSec % 60;
    const passed = pct >= 60;

    return (
      <div>
        <PhaseHeader phase={5} title="Simula" description="Risultati della simulazione" icon={Scale} color={PHASE_COLOR} />

        {/* Summary Hero */}
        <Card variant="highlighted" phaseColor={passed ? "var(--success)" : "var(--danger)"} className="mb-6">
          <div className="text-center py-6">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
              style={{ background: passed ? "rgba(107, 143, 113, 0.2)" : "rgba(196, 92, 74, 0.2)" }}
            >
              <Trophy className="w-10 h-10" style={{ color: passed ? "var(--success)" : "var(--danger)" }} />
            </div>
            <h2 className="text-3xl font-display font-bold mb-2" style={{ color: passed ? "var(--success)" : "var(--danger)" }}>
              {pct}%
            </h2>
            <p className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
              {passed ? "Simulazione superata!" : "Serve ancora pratica"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {totalScore}/{totalMax} punti &middot; {durationMin}m {durationSecRem}s
            </p>
          </div>
        </Card>

        {/* Per-question breakdown */}
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Dettaglio domande
          </h3>
          {results.map((r, i) => {
            const q = questions[r.questionIndex];
            const qPct = r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0;

            return (
              <Card key={i}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: qPct >= 60 ? "rgba(107, 143, 113, 0.15)" : "rgba(196, 92, 74, 0.15)",
                    }}
                  >
                    {qPct >= 60 ? (
                      <Check className="w-4 h-4" style={{ color: "var(--success)" }} />
                    ) : (
                      <X className="w-4 h-4" style={{ color: "var(--danger)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                      {q?.text}
                    </p>
                    <ScoreBar label={`Domanda ${i + 1}`} score={r.score} max={r.maxScore} delay={i * 150} />
                    {r.missedPoints.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs" style={{ color: "var(--danger)" }}>
                          Punti mancati:
                        </p>
                        <ul className="text-xs mt-1 space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                          {r.missedPoints.map((p, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="mt-1 shrink-0"><AlertCircle className="w-3 h-3" style={{ color: "var(--danger)" }} /></span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={resetToSelection}>
            <ArrowLeft className="w-4 h-4" />
            Torna alla selezione
          </Button>
          <Link href={`/course/${courseId}/learn`}>
            <Button>
              Torna alla Dashboard <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  /* ─── EXAM ACTIVE — Question View ─── */
  if (examActive && questions.length > 0) {
    const question = questions[currentQ];
    const isLastQuestion = currentQ === questions.length - 1;
    const timerWarning = timerOption > 0 && remaining <= 10 && remaining > 0;
    const timerDanger = timerOption > 0 && remaining <= 5;

    return (
      <div>
        {/* Minimal header during exam — immersive */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: PHASE_BG }}>
              <Scale className="w-5 h-5" style={{ color: PHASE_COLOR }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: PHASE_COLOR }}>
                Interrogazione
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Domanda {currentQ + 1} di {questions.length}
              </p>
            </div>
          </div>

          {/* Timer */}
          {timerOption > 0 && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-mono font-bold transition-all"
              style={{
                background: timerDanger
                  ? "rgba(196, 92, 74, 0.2)"
                  : timerWarning
                    ? "rgba(196, 125, 91, 0.15)"
                    : PHASE_BG,
                color: timerDanger
                  ? "var(--danger)"
                  : timerWarning
                    ? "var(--accent)"
                    : PHASE_COLOR,
                animation: timerDanger ? "pulse 0.8s ease-in-out infinite" : "none",
              }}
            >
              <Timer className="w-5 h-5" />
              {timerFormatted}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((currentQ + (showingFeedback ? 1 : 0)) / questions.length) * 100}%`,
              background: PHASE_COLOR,
            }}
          />
        </div>

        {/* Question */}
        <Card variant="highlighted" phaseColor={PHASE_COLOR} className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: PHASE_BG, color: PHASE_COLOR }}
            >
              {question.max_score} punti
            </span>
          </div>
          <h2 className="text-xl font-display font-bold leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {question.text}
          </h2>
        </Card>

        {/* Answer area or feedback */}
        {!showingFeedback ? (
          <Card className="mb-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMode("voice")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: inputMode === "voice" ? PHASE_BG : "transparent",
                  color: inputMode === "voice" ? PHASE_COLOR : "var(--text-secondary)",
                  border: inputMode === "voice" ? `1px solid ${PHASE_COLOR}` : "1px solid var(--border)",
                }}
              >
                <Mic className="w-3.5 h-3.5" />
                Voce
              </button>
              <button
                onClick={() => setInputMode("text")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: inputMode === "text" ? PHASE_BG : "transparent",
                  color: inputMode === "text" ? PHASE_COLOR : "var(--text-secondary)",
                  border: inputMode === "text" ? `1px solid ${PHASE_COLOR}` : "1px solid var(--border)",
                }}
              >
                <Keyboard className="w-3.5 h-3.5" />
                Scrivi
              </button>
            </div>

            {/* Voice Input */}
            {inputMode === "voice" && (
              <div className="space-y-4">
                <VoiceRecorder onTranscript={handleVoiceTranscript} disabled={submittingAnswer} />
                {voiceText && (
                  <div
                    className="rounded-xl p-4 text-sm leading-relaxed"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <p className="text-xs mb-2 font-semibold" style={{ color: PHASE_COLOR }}>
                      Trascrizione:
                    </p>
                    {voiceText}
                  </div>
                )}
              </div>
            )}

            {/* Text Input */}
            {inputMode === "text" && (
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Scrivi la tua risposta..."
                rows={5}
                autoFocus
                className="w-full text-sm outline-none resize-none"
                style={{
                  color: "var(--text-primary)",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  lineHeight: 1.7,
                }}
              />
            )}

            {/* Submit */}
            <div className="flex justify-end mt-4">
              <Button
                size="md"
                loading={submittingAnswer}
                disabled={!currentText.trim()}
                onClick={submitAnswer}
                style={{
                  background: currentText.trim()
                    ? "linear-gradient(135deg, var(--phase-simulate), #7a4f7d)"
                    : undefined,
                }}
              >
                <Send className="w-4 h-4" />
                Rispondi
              </Button>
            </div>
          </Card>
        ) : (
          /* ── Question Feedback ── */
          currentResult && (
            <Card
              variant="highlighted"
              phaseColor={currentResult.score / currentResult.maxScore >= 0.5 ? "var(--success)" : "var(--danger)"}
              className="mb-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      currentResult.score / currentResult.maxScore >= 0.5
                        ? "rgba(107, 143, 113, 0.2)"
                        : "rgba(196, 92, 74, 0.2)",
                  }}
                >
                  {currentResult.score / currentResult.maxScore >= 0.5 ? (
                    <Check className="w-5 h-5" style={{ color: "var(--success)" }} />
                  ) : (
                    <AlertCircle className="w-5 h-5" style={{ color: "var(--danger)" }} />
                  )}
                </div>
                <div>
                  <h3
                    className="text-lg font-display font-bold"
                    style={{
                      color:
                        currentResult.score / currentResult.maxScore >= 0.5
                          ? "var(--success)"
                          : "var(--danger)",
                    }}
                  >
                    {currentResult.score}/{currentResult.maxScore} punti
                  </h3>
                </div>
              </div>

              {/* Covered points */}
              {currentResult.coveredPoints.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--success)" }}>
                    Punti coperti
                  </p>
                  <ul className="space-y-1">
                    {currentResult.coveredPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                        <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--success)" }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missed points */}
              {currentResult.missedPoints.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--danger)" }}>
                    Punti mancati
                  </p>
                  <ul className="space-y-1">
                    {currentResult.missedPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <X className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next / Finish */}
              <div className="flex justify-end">
                <Button onClick={nextQuestion} style={{ background: "linear-gradient(135deg, var(--phase-simulate), #7a4f7d)" }}>
                  {isLastQuestion ? (
                    <>
                      <BarChart3 className="w-4 h-4" />
                      Vedi risultati
                    </>
                  ) : (
                    <>
                      Prossima domanda
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )
        )}
      </div>
    );
  }

  /* ─── MODE SELECTION (default view) ─── */

  const timerOptions: { value: TimerOption; label: string }[] = [
    { value: 30, label: "30s" },
    { value: 60, label: "60s" },
    { value: 120, label: "120s" },
    { value: 0, label: "\u221E" },
  ];

  const difficultyOptions: { value: Difficulty; label: string }[] = [
    { value: "easy", label: "Facile" },
    { value: "medium", label: "Media" },
    { value: "hard", label: "Difficile" },
  ];

  return (
    <div>
      <PhaseHeader
        phase={5}
        title="Simula"
        description="Mettiti alla prova sotto pressione"
        icon={Scale}
        color={PHASE_COLOR}
      />

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* INTERROGAZIONE */}
        <Card variant="interactive" className="flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: PHASE_BG }}>
              <Scale className="w-6 h-6" style={{ color: PHASE_COLOR }} />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold" style={{ color: "var(--text-primary)" }}>
                Interrogazione
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Esame orale simulato con domande AI
              </p>
            </div>
          </div>

          {/* Timer selector */}
          <div className="mb-3">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Tempo per domanda
            </p>
            <div className="flex gap-1.5">
              {timerOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimerOption(opt.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: timerOption === opt.value ? PHASE_BG : "var(--bg-secondary)",
                    color: timerOption === opt.value ? PHASE_COLOR : "var(--text-secondary)",
                    border: timerOption === opt.value ? `1px solid var(--phase-simulate)` : "1px solid var(--border)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty selector */}
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
              <Target className="w-3.5 h-3.5 inline mr-1" />
              Difficolta
            </p>
            <div className="flex gap-1.5">
              {difficultyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDifficulty(opt.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: difficulty === opt.value ? PHASE_BG : "var(--bg-secondary)",
                    color: difficulty === opt.value ? PHASE_COLOR : "var(--text-secondary)",
                    border: difficulty === opt.value ? `1px solid var(--phase-simulate)` : "1px solid var(--border)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <Button
              size="lg"
              loading={startingExam}
              onClick={startExam}
              className="w-full"
              style={{ background: "linear-gradient(135deg, var(--phase-simulate), #7a4f7d)" }}
            >
              <Zap className="w-5 h-5" />
              Inizia Esame
            </Button>
          </div>
        </Card>

        {/* ARRINGA (coming soon) */}
        <Card className="flex flex-col relative overflow-hidden" style={{ opacity: 0.6 }}>
          {/* Coming soon overlay */}
          <div
            className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: PHASE_BG, color: PHASE_COLOR }}
          >
            Prossimamente
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: PHASE_BG }}>
              <Mic className="w-6 h-6" style={{ color: PHASE_COLOR }} />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold" style={{ color: "var(--text-primary)" }}>
                Arringa
              </h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Pratica la tua arringa davanti al Giudice AI
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--text-secondary)" }}>
            Costruisci la tua arringa strutturata. Il Giudice AI valutera logica, retorica e padronanza degli argomenti.
          </p>

          <div className="mt-5">
            <Button size="lg" disabled className="w-full" variant="secondary">
              <Mic className="w-5 h-5" />
              Prossimamente
            </Button>
          </div>
        </Card>
      </div>

      {/* Past Simulations */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          <BarChart3 className="w-4 h-4" />
          Simulazioni passate
        </h3>

        {loadingPast ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin w-6 h-6 rounded-full border-2 border-t-transparent"
              style={{ borderColor: PHASE_COLOR, borderTopColor: "transparent" }}
            />
          </div>
        ) : pastSims.length === 0 ? (
          <Card>
            <p className="text-sm text-center py-4" style={{ color: "var(--text-secondary)" }}>
              Nessuna simulazione completata. Inizia la tua prima interrogazione!
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {pastSims.map((sim) => (
              <PastSimulationRow key={sim.id} sim={sim} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
