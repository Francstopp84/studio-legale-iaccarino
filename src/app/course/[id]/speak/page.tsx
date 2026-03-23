"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PhaseHeader from "@/components/ui/PhaseHeader";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  Mic,
  Keyboard,
  Send,
  ChevronRight,
  RefreshCw,
  BookOpen,
  PartyPopper,
  Check,
  Circle,
  AlertCircle,
} from "lucide-react";

interface Concept {
  id: number;
  course_id: number;
  title: string;
  explanation: string | null;
  mastery_score: number;
  bloom_level: number;
  last_studied: string | null;
  times_studied: number;
  order_index: number;
}

interface Evaluation {
  completeness: number;
  accuracy: number;
  terminology: number;
  feedback: string;
  passed: boolean;
  mastery_score: number;
}

function ScoreBar({ label, score, delay }: { label: string; score: number; delay: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimated(score);
    }, delay);
    return () => clearTimeout(timeout);
  }, [score, delay]);

  const getColor = (s: number) => {
    if (s >= 80) return "var(--success)";
    if (s >= 60) return "var(--accent)";
    return "var(--danger)";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: getColor(score), fontWeight: 600 }}>{score}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${animated}%`,
            background: getColor(score),
          }}
        />
      </div>
    </div>
  );
}

export default function SpeakPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Input
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [voiceText, setVoiceText] = useState("");

  // Evaluation
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [allDone, setAllDone] = useState(false);

  // Load concepts
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/courses/${courseId}/concepts`);
        const data: Concept[] = await res.json();
        setConcepts(data);

        if (Array.isArray(data) && data.length > 0) {
          // Find first concept not yet articulated (bloom < 3 or mastery < 70)
          const firstPending = data.findIndex(
            (c) => !c.bloom_level || c.bloom_level < 3 || c.mastery_score < 70
          );

          if (firstPending >= 0) {
            setCurrentIndex(firstPending);
          } else {
            setAllDone(true);
          }
        }
      } catch (e) {
        console.error("Errore caricamento concetti:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const currentConcept = concepts[currentIndex] || null;
  const articulatedCount = concepts.filter(
    (c) => c.bloom_level >= 3 && c.mastery_score >= 70
  ).length;

  const currentText = inputMode === "voice" ? voiceText : textInput;

  // Reset state when changing concept
  useEffect(() => {
    setTextInput("");
    setVoiceText("");
    setEvaluation(null);
  }, [currentIndex]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setVoiceText(text);
  }, []);

  const submitArticulation = async () => {
    if (!currentConcept || !currentText.trim() || submitting) return;
    setSubmitting(true);
    setEvaluation(null);

    try {
      const res = await fetch("/api/articulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept_id: currentConcept.id,
          user_response: currentText.trim(),
        }),
      });
      const data = await res.json();

      setEvaluation({
        completeness: data.completeness,
        accuracy: data.accuracy,
        terminology: data.terminology,
        feedback: data.feedback,
        passed: data.passed,
        mastery_score: data.mastery_score,
      });

      // Update local concept state
      if (data.passed) {
        setConcepts((prev) =>
          prev.map((c) =>
            c.id === currentConcept.id
              ? { ...c, bloom_level: Math.max(c.bloom_level, 3), mastery_score: data.mastery_score }
              : c
          )
        );
      }
    } catch {
      setEvaluation(null);
    } finally {
      setSubmitting(false);
    }
  };

  const goToNext = () => {
    const nextPending = concepts.findIndex(
      (c, i) => i > currentIndex && (!c.bloom_level || c.bloom_level < 3 || c.mastery_score < 70)
    );

    if (nextPending >= 0) {
      setCurrentIndex(nextPending);
    } else {
      // Check for any remaining
      const anyRemaining = concepts.findIndex(
        (c) => !c.bloom_level || c.bloom_level < 3 || c.mastery_score < 70
      );
      if (anyRemaining >= 0) {
        setCurrentIndex(anyRemaining);
      } else {
        setAllDone(true);
      }
    }
  };

  const retry = () => {
    setTextInput("");
    setVoiceText("");
    setEvaluation(null);
  };

  const goToConcept = (index: number) => {
    setCurrentIndex(index);
    setAllDone(false);
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin w-8 h-8 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--phase-articulate)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!concepts.length) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--text-secondary)" }}>
          Nessun concetto trovato. Completa prima la fase Comprendi.
        </p>
        <Link href={`/course/${courseId}/learn`}>
          <Button className="mt-4">Vai a Comprendi</Button>
        </Link>
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="text-center py-16">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{ background: "rgba(107, 143, 113, 0.2)" }}
        >
          <PartyPopper className="w-10 h-10" style={{ color: "var(--success)" }} />
        </div>
        <h2
          className="text-2xl font-display font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Fase Articola completata!
        </h2>
        <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
          Hai spiegato tutti i concetti con successo. Passa alla fase Consolida per rafforzare la memoria.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="ghost" onClick={() => { setAllDone(false); setCurrentIndex(0); }}>
            Rivedi i concetti
          </Button>
          <Link href={`/course/${courseId}/review`}>
            <Button>
              Vai a Consolida <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PhaseHeader
        phase={3}
        title="Articola"
        description="Spiega i concetti con parole tue — Metodo Feynman"
        icon={Mic}
        color="var(--phase-articulate)"
        progress={Math.round((articulatedCount / concepts.length) * 100)}
      />

      <div className="flex gap-6" style={{ minHeight: "calc(100vh - 320px)" }}>
        {/* LEFT SIDEBAR — Concept Index */}
        <aside
          className="w-56 shrink-0 rounded-xl p-3 overflow-y-auto hidden md:block"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            maxHeight: "calc(100vh - 320px)",
          }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-3 px-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Concetti ({articulatedCount}/{concepts.length})
          </h3>
          <ul className="space-y-0.5">
            {concepts.map((c, i) => {
              const isActive = i === currentIndex;
              const isDone = c.bloom_level >= 3 && c.mastery_score >= 70;

              return (
                <li key={c.id}>
                  <button
                    onClick={() => goToConcept(i)}
                    className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all"
                    style={{
                      background: isActive ? "rgba(196, 125, 91, 0.12)" : "transparent",
                      color: isActive
                        ? "var(--phase-articulate)"
                        : isDone
                          ? "var(--success)"
                          : "var(--text-secondary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                      {isDone ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isActive ? (
                        <Circle
                          className="w-3 h-3"
                          fill="var(--phase-articulate)"
                          stroke="none"
                        />
                      ) : (
                        <Circle className="w-3 h-3" strokeWidth={1.5} />
                      )}
                    </span>
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Concept Card */}
          <Card variant="highlighted" phaseColor="var(--phase-articulate)">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(196, 125, 91, 0.15)",
                  color: "var(--phase-articulate)",
                }}
              >
                Concetto {currentIndex + 1} di {concepts.length}
              </span>
            </div>
            <h2
              className="text-xl font-display font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              {currentConcept?.title}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Spiegami questo concetto con parole tue, come se lo stessi insegnando a qualcuno che non lo conosce.
            </p>
          </Card>

          {/* Input Area */}
          {!evaluation && (
            <Card>
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setInputMode("voice")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: inputMode === "voice" ? "rgba(196, 125, 91, 0.15)" : "transparent",
                    color: inputMode === "voice" ? "var(--phase-articulate)" : "var(--text-secondary)",
                    border: inputMode === "voice" ? "1px solid var(--phase-articulate)" : "1px solid var(--border)",
                  }}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Voce
                </button>
                <button
                  onClick={() => setInputMode("text")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: inputMode === "text" ? "rgba(196, 125, 91, 0.15)" : "transparent",
                    color: inputMode === "text" ? "var(--phase-articulate)" : "var(--text-secondary)",
                    border: inputMode === "text" ? "1px solid var(--phase-articulate)" : "1px solid var(--border)",
                  }}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Scrivi
                </button>
              </div>

              {/* Voice Input */}
              {inputMode === "voice" && (
                <div className="space-y-4">
                  <VoiceRecorder onTranscript={handleVoiceTranscript} disabled={submitting} />
                  {voiceText && (
                    <div
                      className="rounded-xl p-4 text-sm leading-relaxed"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <p className="text-xs mb-2 font-semibold" style={{ color: "var(--phase-articulate)" }}>
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
                  placeholder="Scrivi la tua spiegazione qui..."
                  rows={6}
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

              {/* Submit Button */}
              <div className="flex justify-end mt-4">
                <Button
                  size="md"
                  loading={submitting}
                  disabled={!currentText.trim()}
                  onClick={submitArticulation}
                  style={{
                    background: currentText.trim()
                      ? "linear-gradient(135deg, var(--phase-articulate), #a05e3a)"
                      : undefined,
                  }}
                >
                  <Send className="w-4 h-4" />
                  Invia spiegazione
                </Button>
              </div>
            </Card>
          )}

          {/* Evaluation Results */}
          {evaluation && (
            <Card
              variant="highlighted"
              phaseColor={evaluation.passed ? "var(--success)" : "var(--danger)"}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: evaluation.passed
                      ? "rgba(107, 143, 113, 0.2)"
                      : "rgba(196, 92, 74, 0.2)",
                  }}
                >
                  {evaluation.passed ? (
                    <Check className="w-5 h-5" style={{ color: "var(--success)" }} />
                  ) : (
                    <AlertCircle className="w-5 h-5" style={{ color: "var(--danger)" }} />
                  )}
                </div>
                <div>
                  <h3
                    className="text-lg font-display font-bold"
                    style={{
                      color: evaluation.passed ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {evaluation.passed ? "Ottimo lavoro!" : "Serve ancora pratica"}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Media: {Math.round((evaluation.completeness + evaluation.accuracy + evaluation.terminology) / 3)}%
                    {evaluation.passed ? " — Superato" : " — Soglia: 70%"}
                  </p>
                </div>
              </div>

              {/* Score Bars */}
              <div className="space-y-3 mb-5">
                <ScoreBar label="Completezza" score={evaluation.completeness} delay={200} />
                <ScoreBar label="Accuratezza" score={evaluation.accuracy} delay={400} />
                <ScoreBar label="Terminologia" score={evaluation.terminology} delay={600} />
              </div>

              {/* Feedback */}
              <div
                className="rounded-xl p-4 text-sm leading-relaxed mb-5"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--phase-articulate)" }}>
                  Feedback AI
                </p>
                {evaluation.feedback}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                {evaluation.passed ? (
                  <Button onClick={goToNext}>
                    Avanti <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <>
                    <Link href={`/course/${courseId}/learn`}>
                      <Button variant="ghost" size="sm">
                        <BookOpen className="w-4 h-4" />
                        Torna a studiare
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={retry}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Riprova
                    </Button>
                  </>
                )}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
