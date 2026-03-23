"use client";

import { useEffect, useState } from "react";
import { Plus, AlertTriangle, Flame, Clock, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressRing from "@/components/ui/ProgressRing";

interface Course {
  id: number;
  title: string;
  total_concepts: number;
  mastered_concepts: number;
  current_phase: number;
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
  progress: {
    concepts_studied: number;
    flashcards_reviewed: number;
    articulations_done: number;
    simulations_done: number;
    total_minutes: number;
  };
  streak: number;
  estimated_minutes: number;
}

interface StudySession {
  id: number;
  type: string;
  score: number | null;
  cards_reviewed: number;
  duration_seconds: number;
  created_at: string;
}

const PHASE_LABELS = [
  "",
  "Acquisisci",
  "Comprendi",
  "Articola",
  "Consolida",
  "Simula",
  "Padroneggia",
];

const PHASE_COLORS = [
  "",
  "var(--phase-acquire)",
  "var(--phase-understand)",
  "var(--phase-articulate)",
  "var(--phase-consolidate)",
  "var(--phase-simulate)",
  "var(--phase-master)",
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function getDailySuggestion(daily: DailyData | null): string {
  if (!daily) return "Carica il tuo primo materiale di studio per iniziare.";
  if (daily.due_flashcards > 0)
    return `Hai ${daily.due_flashcards} flashcard da ripassare e ${daily.weak_concepts.length} concetti da rafforzare.`;
  if (daily.weak_concepts.length > 0)
    return `${daily.weak_concepts.length} concetti hanno bisogno di attenzione. Una sessione rapida li rafforza.`;
  return "Ottimo lavoro! Tutti i concetti sono in buona forma. Continua cosi.";
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ieri";
  return `${diffD} giorni fa`;
}

function getSessionLabel(type: string): string {
  const map: Record<string, string> = {
    flashcard: "Flashcard",
    quiz: "Quiz",
    articulation: "Articolazione",
    simulation: "Simulazione",
    review: "Ripasso",
  };
  return map[type] || type;
}

function getSessionColor(type: string): string {
  const map: Record<string, string> = {
    flashcard: "var(--phase-consolidate)",
    quiz: "var(--phase-understand)",
    articulation: "var(--phase-articulate)",
    simulation: "var(--phase-simulate)",
    review: "var(--accent)",
  };
  return map[type] || "var(--text-secondary)";
}

export default function Dashboard() {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/daily").then((r) => r.json()),
      fetch("/api/courses").then((r) => r.json()),
      fetch("/api/study-sessions").then((r) => r.json()),
    ])
      .then(([d, c, s]) => {
        setDaily(d);
        setCourses(c);
        setSessions(s.slice(0, 5));
      })
      .catch((e) => console.error("Failed to load dashboard", e))
      .finally(() => setLoading(false));
  }, []);

  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 border-2 rounded-full animate-spin mx-auto"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
          />
          <p style={{ color: "var(--text-secondary)" }}>Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Hero greeting */}
      <section className="space-y-4">
        <div>
          <h1
            className="font-display text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {greeting},{" "}
            <span style={{ color: "var(--accent)" }}>Avvocato.</span>
          </h1>
          <p
            className="mt-2 text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {getDailySuggestion(daily)}
          </p>
        </div>
        <Link href="/daily">
          <Button variant="primary" size="lg">
            <Clock className="w-5 h-5" />
            Sessione rapida — {daily?.estimated_minutes ? Math.round(daily.estimated_minutes) : 5} minuti
          </Button>
        </Link>
      </section>

      {/* Courses */}
      <section>
        <h2
          className="font-display text-lg font-semibold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          I tuoi corsi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => {
            const mastery =
              course.total_concepts > 0
                ? Math.round((course.mastered_concepts / course.total_concepts) * 100)
                : 0;
            const phase = course.current_phase || 1;
            return (
              <Link key={course.id} href={`/course/${course.id}/learn`}>
                <Card variant="interactive" className="flex flex-col items-center gap-4 text-center">
                  <ProgressRing
                    value={mastery}
                    size={72}
                    strokeWidth={5}
                    color={PHASE_COLORS[phase] || "var(--accent)"}
                  />
                  <div className="space-y-1 min-w-0 w-full">
                    <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {course.title}
                    </p>
                    <p className="text-xs" style={{ color: PHASE_COLORS[phase] || "var(--text-secondary)" }}>
                      Fase {phase} — {PHASE_LABELS[phase] || ""}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {course.mastered_concepts}/{course.total_concepts} concetti padroneggiati
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}

          {/* + Nuovo corso */}
          <Link href="/acquire">
            <Card
              variant="interactive"
              className="flex flex-col items-center justify-center gap-3 text-center"
              style={{ minHeight: 180, borderStyle: "dashed" }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "var(--accent)15", color: "var(--accent)" }}
              >
                <Plus className="w-6 h-6" />
              </div>
              <p className="font-semibold text-sm" style={{ color: "var(--accent)" }}>
                Nuovo corso
              </p>
            </Card>
          </Link>
        </div>
      </section>

      {/* Bottom grid: weak concepts + streak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weak concepts */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "var(--danger)" }} />
              Concetti critici
            </h3>
            {daily && daily.weak_concepts.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--danger)15", color: "var(--danger)" }}>
                {daily.weak_concepts.length}
              </span>
            )}
          </div>
          {daily && daily.weak_concepts.length > 0 ? (
            <div className="space-y-3">
              {daily.weak_concepts.map((concept) => (
                <Link
                  key={concept.id}
                  href={`/course/${concept.course_id}/learn`}
                  className="flex items-center gap-3 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                      {concept.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {concept.course_title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Mini progress bar */}
                    <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${concept.mastery_score}%`,
                          background: concept.mastery_score < 30 ? "var(--danger)" : "var(--warning)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right" style={{ color: "var(--text-secondary)" }}>
                      {Math.round(concept.mastery_score)}%
                    </span>
                  </div>
                </Link>
              ))}
              <Link href="/daily">
                <Button variant="secondary" size="sm" className="w-full mt-2">
                  Rafforza questi concetti
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Nessun concetto critico. Ottimo lavoro!
            </p>
          )}
        </Card>

        {/* Streak */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <h3 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
              Streak
            </h3>
          </div>
          <div className="text-center space-y-4">
            <div>
              <span
                className="font-display text-5xl font-bold"
                style={{ color: "var(--accent)" }}
              >
                {daily?.streak || 0}
              </span>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {(daily?.streak || 0) === 1 ? "giorno consecutivo" : "giorni consecutivi"}
              </p>
            </div>
            {/* Weekly grid */}
            <WeeklyGrid streak={daily?.streak || 0} />
          </div>
          {daily?.progress && daily.progress.total_minutes > 0 && (
            <div
              className="mt-4 pt-3 border-t text-xs text-center"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Oggi: {daily.progress.total_minutes} min studiati
              {daily.progress.flashcards_reviewed > 0 && ` | ${daily.progress.flashcards_reviewed} flashcard`}
              {daily.progress.concepts_studied > 0 && ` | ${daily.progress.concepts_studied} concetti`}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      {sessions.length > 0 && (
        <section>
          <h2
            className="font-display text-lg font-semibold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Attivita recente
          </h2>
          <Card>
            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2.5 border-b last:border-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: getSessionColor(s.type) }}
                    />
                    <div>
                      <p className="text-sm font-medium">{getSessionLabel(s.type)}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {formatRelativeDate(s.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {s.score !== null && (
                      <span
                        className="font-medium"
                        style={{ color: s.score >= 70 ? "var(--success)" : "var(--danger)" }}
                      >
                        {Math.round(s.score)}%
                      </span>
                    )}
                    {s.cards_reviewed > 0 && <span>{s.cards_reviewed} carte</span>}
                    {s.duration_seconds > 0 && (
                      <span>{Math.round(s.duration_seconds / 60)} min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

/** Simple weekly streak grid: L M M G V S D */
function WeeklyGrid({ streak }: { streak: number }) {
  const days = ["L", "M", "M", "G", "V", "S", "D"];
  const today = new Date().getDay(); // 0=Sun
  // Map JS day (0=Sun) to our grid (0=Mon)
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div className="flex items-center justify-center gap-2">
      {days.map((label, i) => {
        // How many days ago is this cell relative to today
        const daysAgo = todayIdx - i;
        const active = daysAgo >= 0 && daysAgo < streak;
        const isToday = i === todayIdx;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {label}
            </span>
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: active ? "var(--accent)25" : "var(--bg-hover)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                border: isToday ? "1.5px solid var(--accent)" : "1.5px solid transparent",
              }}
            >
              {active ? "\u2713" : "\u00B7"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
