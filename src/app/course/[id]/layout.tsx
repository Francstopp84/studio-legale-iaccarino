"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Lightbulb, Mic, RotateCcw, Scale, ArrowLeft, Plus, Search, Loader2, BookOpen, Square } from "lucide-react";

const tabs = [
  { href: "learn", label: "Comprendi", icon: Lightbulb, color: "var(--phase-understand)" },
  { href: "speak", label: "Articola", icon: Mic, color: "var(--phase-articulate)" },
  { href: "review", label: "Consolida", icon: RotateCcw, color: "var(--phase-consolidate)" },
  { href: "simulate", label: "Simula", icon: Scale, color: "var(--phase-simulate)" },
  { href: "library", label: "Libreria", icon: BookOpen, color: "var(--accent)" },
];

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const [course, setCourse] = useState<any>(null);
  const [researching, setResearching] = useState(false);
  const [researchMsg, setResearchMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${params.id}`).then((r) => r.json()).then(setCourse);
  }, [params.id]);

  const toggleDeepResearch = async () => {
    // Se è in corso, annulla
    if (researching) {
      abortRef.current?.abort();
      abortRef.current = null;
      setResearching(false);
      setResearchMsg("Deep Research interrotta.");
      setTimeout(() => setResearchMsg(""), 4000);
      return;
    }

    // Avvia
    const controller = new AbortController();
    abortRef.current = controller;
    setResearching(true);
    setResearchMsg("Analisi del materiale in corso...");
    try {
      const res = await fetch(`/api/courses/${params.id}/deep-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        setResearchMsg(`Errore: ${data.error}`);
      } else {
        setResearchMsg(`Trovati ${data.documentsAdded} nuovi documenti! Lezione rigenerata.`);
        fetch(`/api/courses/${params.id}`).then(r => r.json()).then(setCourse);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setResearchMsg(`Errore: ${err.message}`);
    } finally {
      abortRef.current = null;
      setResearching(false);
      setTimeout(() => setResearchMsg(""), 8000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/"
          className="p-2 rounded-lg transition-colors hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1
            className="text-xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {course?.title || "Caricamento..."}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {course?.documents?.length || 0} documenti &middot;{" "}
            {course?.total_concepts || 0} concetti &middot;{" "}
            {course?.mastered_concepts || 0} padroneggiati
          </p>
        </div>
        <button
          onClick={toggleDeepResearch}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: researching ? "rgba(239,68,68,0.15)" : "var(--phase-simulate)20",
            color: researching ? "#ef4444" : "var(--phase-simulate)",
          }}
        >
          {researching ? <Square className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          {researching ? "Ferma" : "Deep Research"}
        </button>
        <Link
          href={`/acquire?course=${params.id}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
          style={{ background: "var(--accent)20", color: "var(--accent)" }}
        >
          <Plus className="w-4 h-4" />
          Aggiungi materiale
        </Link>
      </div>
      {researchMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm" style={{
          background: researchMsg.startsWith("Errore") ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
          color: researchMsg.startsWith("Errore") ? "#ef4444" : "#22c55e",
          border: `1px solid ${researchMsg.startsWith("Errore") ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
        }}>
          {researchMsg}
        </div>
      )}

      {/* Phase tabs */}
      <div
        className="flex gap-1 mb-8 p-1 rounded-xl"
        style={{ background: "var(--bg-secondary)" }}
      >
        {tabs.map(({ href, label, icon: Icon, color }) => {
          const active = pathname.endsWith(`/${href}`);
          return (
            <Link
              key={href}
              href={`/course/${params.id}/${href}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? `${color}20` : "transparent",
                color: active ? color : "var(--text-secondary)",
                borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
