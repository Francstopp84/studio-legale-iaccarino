"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Loader2,
  Send,
  RefreshCw,
  List,
  Maximize2,
  Minimize2,
  Plus,
  Play,
  Pause,
  Square,
  Volume2,
  Upload,
  CreditCard,
  Headphones,
  AlertCircle,
} from "lucide-react";

interface Section { title: string; content: string; }
interface ChatMessage { role: "user" | "assistant"; content: string; }
interface SubtitleCue { start: number; end: number; text: string; }

// Split content into pages of ~CHARS_PER_PAGE characters, breaking at paragraph boundaries
const CHARS_PER_PAGE = 1800;

function paginateContent(sections: Section[]): { pageNum: number; chapterIndex: number; chapterTitle: string; text: string; isChapterStart: boolean }[] {
  const pages: { pageNum: number; chapterIndex: number; chapterTitle: string; text: string; isChapterStart: boolean }[] = [];
  let pageNum = 1;

  for (let ci = 0; ci < sections.length; ci++) {
    const sec = sections[ci];
    const paragraphs = sec.content.split(/\n\n+/);
    let currentPage = "";
    let isFirst = true;

    for (const para of paragraphs) {
      if (currentPage.length + para.length > CHARS_PER_PAGE && currentPage.length > 200) {
        pages.push({ pageNum: pageNum++, chapterIndex: ci, chapterTitle: sec.title, text: currentPage.trim(), isChapterStart: isFirst });
        currentPage = "";
        isFirst = false;
      }
      currentPage += para + "\n\n";
    }

    if (currentPage.trim()) {
      pages.push({ pageNum: pageNum++, chapterIndex: ci, chapterTitle: sec.title, text: currentPage.trim(), isChapterStart: isFirst });
    }
  }

  return pages;
}

// Simple markdown renderer for lesson content
function MarkdownContent({ text }: { text: string }) {
  const rendered = useMemo(() => {
    const lines = text.split("\n");
    const result: React.ReactNode[] = [];
    let key = 0;
    let para: string[] = [];

    const bold = (s: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let rem = s;
      let k = 0;
      while (rem) {
        const m = rem.match(/\*\*(.+?)\*\*/);
        if (m && m.index !== undefined) {
          if (m.index > 0) parts.push(rem.slice(0, m.index));
          parts.push(<strong key={`b${k++}`} style={{ color: "var(--accent)" }}>{m[1]}</strong>);
          rem = rem.slice(m.index + m[0].length);
        } else {
          parts.push(rem);
          break;
        }
      }
      return parts;
    };

    const flush = () => {
      if (para.length > 0) {
        result.push(<p key={key++} className="mb-3">{bold(para.join(" "))}</p>);
        para = [];
      }
    };

    for (const line of lines) {
      const t = line.trimEnd();
      if (/^#{1,3}\s/.test(t)) {
        flush();
        const txt = t.replace(/^#+\s*/, "");
        const lvl = (t.match(/^(#+)/)?.[1].length || 2);
        if (lvl <= 2)
          result.push(<h3 key={key++} className="text-base font-bold mt-5 mb-2" style={{ color: "var(--accent)" }}>{txt}</h3>);
        else
          result.push(<h4 key={key++} className="text-sm font-semibold mt-4 mb-2" style={{ color: "var(--text-primary)" }}>{txt}</h4>);
      } else if (/^\s*[-*]\s/.test(t)) {
        flush();
        result.push(
          <div key={key++} className="flex gap-2 mb-1.5 ml-4">
            <span style={{ color: "var(--accent)" }}>-</span>
            <span>{bold(t.replace(/^\s*[-*]\s/, ""))}</span>
          </div>
        );
      } else if (/^\d+\.\s/.test(t)) {
        flush();
        const num = t.match(/^(\d+)\./)?.[1] || "";
        result.push(
          <div key={key++} className="flex gap-2 mb-1.5 ml-4">
            <span className="font-mono text-xs mt-0.5" style={{ color: "var(--accent)" }}>{num}.</span>
            <span>{bold(t.replace(/^\d+\.\s*/, ""))}</span>
          </div>
        );
      } else if (t.trim() === "") {
        flush();
      } else {
        para.push(t);
      }
    }
    flush();
    return result;
  }, [text]);

  return <div>{rendered}</div>;
}

export default function LearnPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [courseTitle, setCourseTitle] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const [flashcardLoading, setFlashcardLoading] = useState(false);
  const [flashcardMsg, setFlashcardMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expandingChapter, setExpandingChapter] = useState<number | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Assisted reading (TTS + highlighting)
  const [assistedMode, setAssistedMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [currentCueIndex, setCurrentCueIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cueRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const animFrameRef = useRef<number>(0);
  const ttsCache = useRef<Map<string, { audioUrl: string; subtitles: SubtitleCue[] }>>(new Map());
  // Refs to avoid stale closures in animation frame loop
  const subtitlesRef = useRef<SubtitleCue[]>([]);
  const currentCueRef = useRef(-1);
  const assistedRef = useRef(false);
  useEffect(() => { subtitlesRef.current = subtitles; }, [subtitles]);
  useEffect(() => { currentCueRef.current = currentCueIndex; }, [currentCueIndex]);
  useEffect(() => { assistedRef.current = assistedMode; }, [assistedMode]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lessonCache = useRef<Section[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Paginate content
  const pages = useMemo(() => paginateContent(sections), [sections]);
  const totalPages = pages.length;
  const page = pages[currentPage];

  // Chapter list for TOC
  const chapters = useMemo(() => {
    const seen = new Set<number>();
    return pages.filter(p => {
      if (seen.has(p.chapterIndex)) return false;
      seen.add(p.chapterIndex);
      return true;
    }).map(p => ({ index: p.chapterIndex, title: p.chapterTitle, firstPage: pages.findIndex(pp => pp.chapterIndex === p.chapterIndex) }));
  }, [pages]);

  // ─── Navigation ───
  const goToPage = (idx: number) => {
    stopSpeaking();
    setCurrentPage(Math.max(0, Math.min(idx, totalPages - 1)));
    setSubtitles([]);
    setCurrentCueIndex(-1);
  };

  const nextPage = () => { if (currentPage < totalPages - 1) goToPage(currentPage + 1); };
  const prevPage = () => { if (currentPage > 0) goToPage(currentPage - 1); };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); nextPage(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prevPage(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentPage, totalPages]);

  // Touch swipe for mobile
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) nextPage(); else prevPage();
    }
  };

  // ─── TTS / Assisted Reading ───
  // Uses refs to always read latest subtitles/cueIndex — no stale closures
  const syncSubtitles = useCallback(() => {
    const subs = subtitlesRef.current;
    if (!audioRef.current || subs.length === 0) {
      animFrameRef.current = requestAnimationFrame(syncSubtitles);
      return;
    }
    const time = audioRef.current.currentTime;
    let found = -1;
    for (let i = 0; i < subs.length; i++) {
      if (time >= subs[i].start && time <= subs[i].end) { found = i; break; }
    }
    if (found !== currentCueRef.current) {
      currentCueRef.current = found;
      setCurrentCueIndex(found);
      if (found >= 0) {
        const el = cueRefs.current[found];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    if (!audioRef.current.paused && !audioRef.current.ended) {
      animFrameRef.current = requestAnimationFrame(syncSubtitles);
    }
  }, []); // no deps — reads from refs

  const startSpeaking = async () => {
    if (isSpeaking && isPaused && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
      animFrameRef.current = requestAnimationFrame(syncSubtitles);
      return;
    }
    if (isSpeaking || !page) return;

    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }

    // Sblocca audio su mobile: crea e riproduci un audio vuoto nell'handler click
    const warmup = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    try { await warmup.play(); } catch {}

    const cacheKey = page.text.slice(0, 100);
    setTtsLoading(true);
    setError("");

    try {
      let result = ttsCache.current.get(cacheKey);
      if (!result) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: page.text }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError("TTS fallito: " + (errData.error || `errore ${res.status}`));
          setTtsLoading(false);
          return;
        }
        const data = await res.json();
        result = { audioUrl: data.audioUrl, subtitles: data.subtitles || [] };
        ttsCache.current.set(cacheKey, result);
      }

      setSubtitles(result.subtitles);
      subtitlesRef.current = result.subtitles;
      setCurrentCueIndex(-1);
      currentCueRef.current = -1;
      cueRefs.current = [];

      const audio = new Audio(result.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => { setIsSpeaking(true); setIsPaused(false); animFrameRef.current = requestAnimationFrame(syncSubtitles); };
      audio.onpause = () => cancelAnimationFrame(animFrameRef.current);
      audio.onerror = () => {
        setError("Impossibile riprodurre l'audio.");
        setIsSpeaking(false); setTtsLoading(false);
      };
      audio.onended = () => {
        cancelAnimationFrame(animFrameRef.current);
        setIsSpeaking(false); setIsPaused(false); setCurrentCueIndex(-1);
        currentCueRef.current = -1;
        if (assistedRef.current) {
          setCurrentPage(prev => {
            const maxPage = pages.length - 1;
            if (prev < maxPage) {
              setTimeout(() => {
                setSubtitles([]);
                subtitlesRef.current = [];
                setCurrentCueIndex(-1);
                currentCueRef.current = -1;
              }, 100);
              return prev + 1;
            }
            return prev;
          });
        }
      };

      await audio.play();
    } catch (e: any) {
      console.error("[TTS] error:", e);
      setError("Lettura assistita non disponibile: " + (e.message || "riprova"));
    }
    setTtsLoading(false);
  };

  const pauseSpeaking = () => { if (audioRef.current) { audioRef.current.pause(); setIsPaused(true); } };
  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    cancelAnimationFrame(animFrameRef.current);
    setIsSpeaking(false); setIsPaused(false); setCurrentCueIndex(-1);
  };

  const toggleAssisted = () => {
    if (assistedMode) { stopSpeaking(); setAssistedMode(false); }
    else { setAssistedMode(true); startSpeaking(); }
  };

  // Auto-start TTS when page changes in assisted mode
  useEffect(() => {
    if (assistedMode && page && !isSpeaking && !ttsLoading) {
      const timer = setTimeout(() => startSpeaking(), 300);
      return () => clearTimeout(timer);
    }
  }, [currentPage, assistedMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      cancelAnimationFrame(animFrameRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // ─── Loading (zero AI — il testo caricato E la lezione) ───
  useEffect(() => {
    async function load() {
      try {
        const [courseRes, lessonRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/courses/${courseId}/lesson?mode=tecnico`),
        ]);
        const courseData = await courseRes.json();
        setCourseTitle(courseData.title || "");
        if (lessonRes.ok) {
          const lessonData = await lessonRes.json();
          if (lessonData.lesson?.sections?.length > 0) {
            setSections(lessonData.lesson.sections);
            lessonCache.current = lessonData.lesson.sections;
          }
        }
      } catch (e: any) {
        console.error("[LEARN] Load failed:", e);
        setError("Errore di caricamento: " + (e.message || "riprova"));
      }
      finally { setLoading(false); }
    }
    load();
  }, [courseId]);

  const reloadLesson = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/courses/${courseId}/lesson?mode=tecnico`);
      const data = await res.json();
      if (data.lesson?.sections?.length > 0) {
        setSections(data.lesson.sections);
        lessonCache.current = data.lesson.sections;
      }
    } catch (e: any) {
      setError("Errore: " + (e.message || "riprova"));
    }
    setLoading(false);
  };

  // Expand a single chapter with deeper content
  const expandChapter = async (chapterIndex: number) => {
    if (expandingChapter !== null) return;
    setExpandingChapter(chapterIndex);
    try {
      const res = await fetch(`/api/courses/${courseId}/lesson/expand`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIndex, mode: "tecnico" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      setSections(prev => {
        const updated = [...prev];
        updated[chapterIndex] = data.section;
        lessonCache.current = updated;
        return updated;
      });
    } catch (e: any) {
      setError("Espansione fallita: " + (e.message || "riprova"));
      setTimeout(() => setError(""), 5000);
    } finally {
      setExpandingChapter(null);
    }
  };

  // Chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory); setChatInput(""); setChatLoading(true);
    try {
      const context = page ? `Capitolo: "${page.chapterTitle}", Pagina ${page.pageNum}\n\n${page.text}` : "";
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Lezione "${courseTitle}". ${context}\n\nDomanda: ${userMsg.content}`, history: newHistory.slice(-6) }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply || "Errore." }]);
    } catch { setChatMessages(prev => [...prev, { role: "assistant", content: "Errore di connessione." }]); }
    finally { setChatLoading(false); }
  };

  // Flashcards
  const generateFlashcards = async () => {
    setFlashcardLoading(true);
    try {
      const courseRes = await fetch(`/api/courses/${courseId}`);
      const courseData = await courseRes.json();
      let total = 0;
      for (const doc of (courseData.documents || [])) {
        const res = await fetch("/api/ai/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: doc.id, count: 10 }) });
        if (res.ok) { const d = await res.json(); total += d.count || 0; }
      }
      setFlashcardMsg(total > 0 ? `${total} flashcard generate!` : "Già presenti");
      setTimeout(() => setFlashcardMsg(""), 4000);
    } catch { setFlashcardMsg("Errore"); setTimeout(() => setFlashcardMsg(""), 4000); }
    finally { setFlashcardLoading(false); }
  };

  // Upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData(); formData.append("file", file);
        const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        const doc = await res.json();
        if (doc.id) await fetch(`/api/courses/${courseId}/documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: doc.id }) });
      }
      lessonCache.current = []; setSections([]); await reloadLesson();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  // ─── RENDER ───

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      <p style={{ color: "var(--text-secondary)" }}>Caricamento corso...</p>
    </div>
  );


  if (sections.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
      {error ? (
        <>
          <AlertCircle className="w-10 h-10" style={{ color: "var(--danger)" }} />
          <p className="text-center text-sm px-4 py-2 rounded-lg" style={{ color: "#e74c3c", background: "rgba(231,76,60,0.1)" }}>{error}</p>
          <Button onClick={reloadLesson}>
            <RefreshCw className="w-4 h-4" /> Riprova caricamento
          </Button>
        </>
      ) : (
        <>
          <Upload className="w-10 h-10 opacity-40" style={{ color: "var(--text-secondary)" }} />
          <p style={{ color: "var(--text-secondary)" }}>Nessun manuale caricato. Carica un file per iniziare a studiare.</p>
        </>
      )}
      <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.doc,.txt,.md" onChange={e => handleFileUpload(e.target.files)} />
      <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Caricamento...</> : <><Plus className="w-4 h-4" /> Carica manuale</>}
      </Button>
    </div>
  );

  // ─── BOOK MODE (normal) ───
  return (
    <div className={`flex ${fullscreen ? "fixed inset-0 z-[100]" : ""}`}
      style={{ height: fullscreen ? "100vh" : "calc(100vh - 180px)", background: fullscreen ? "var(--bg-primary)" : undefined }}>

      {/* TOC Sidebar — hidden on mobile */}
      <aside className={`shrink-0 flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? "flex" : "hidden sm:flex"}`}
        style={{ width: sidebarOpen ? 240 : 0, opacity: sidebarOpen ? 1 : 0, background: "var(--bg-card)", borderRight: "1px solid var(--border)" }}>
        <div className="p-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Indice del manuale</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {chapters.map((ch) => {
            const isActive = page && page.chapterIndex === ch.index;
            return (
              <button key={ch.index} onClick={() => goToPage(ch.firstPage)}
                className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                style={{ background: isActive ? "rgba(212,168,83,0.12)" : "transparent", color: isActive ? "var(--accent)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400 }}>
                <span className="shrink-0 text-xs font-mono mt-0.5" style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)", opacity: 0.6 }}>
                  p.{ch.firstPage + 1}
                </span>
                <span className="leading-tight">{ch.title}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-5 py-2"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-white/5" title="Indice">
              <List className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
            </button>
            <h2 className="font-semibold text-sm truncate hidden sm:block" style={{ color: "var(--text-primary)" }}>{courseTitle}</h2>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png" onChange={e => handleFileUpload(e.target.files)} />

            {/* Assisted reading toggle */}
            <button onClick={toggleAssisted}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${assistedMode ? "ring-1" : ""}`}
              style={{
                background: assistedMode ? "rgba(212,168,83,0.2)" : "transparent",
                color: assistedMode ? "var(--accent)" : "var(--text-secondary)",
              }}
              title="Lettura assistita">
              <Headphones className="w-4 h-4" />
              <span className="hidden sm:inline">{assistedMode ? "Assistita ON" : "Lettura assistita"}</span>
            </button>

            {/* TTS controls — play/pause/stop always visible when speaking */}
            {isSpeaking && !isPaused ? (
              <button onClick={pauseSpeaking} className="p-1.5 rounded-lg hover:bg-white/10" title="Pausa">
                <Pause className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </button>
            ) : !isSpeaking && !assistedMode ? (
              <button onClick={startSpeaking} disabled={ttsLoading} className="p-1.5 rounded-lg hover:bg-white/10" title="Leggi">
                {ttsLoading ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} /> : <Volume2 className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />}
              </button>
            ) : isPaused ? (
              <button onClick={startSpeaking} className="p-1.5 rounded-lg hover:bg-white/10" title="Riprendi">
                <Play className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </button>
            ) : null}
            {isSpeaking && (
              <button onClick={() => { stopSpeaking(); if (assistedMode) setAssistedMode(false); }} className="p-1.5 rounded-lg hover:bg-white/10" title="Ferma lettura">
                <Square className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
              </button>
            )}

            <button onClick={generateFlashcards} disabled={flashcardLoading} className="p-1.5 rounded-lg hover:bg-white/10 relative" title="Flashcard" style={{ color: "var(--text-secondary)" }}>
              {flashcardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {flashcardMsg && <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs px-2 py-0.5 rounded z-50" style={{ background: "var(--accent)", color: "#1a1814" }}>{flashcardMsg}</span>}
            </button>

            <div className="w-px h-5 mx-0.5" style={{ background: "var(--border)" }} />
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/10" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-secondary)" }} /> : <Plus className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />}
            </button>
            <button onClick={reloadLesson} className="p-1.5 rounded-lg hover:bg-white/10" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-secondary)" }} />
            </button>
            <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-lg hover:bg-white/10">
              {fullscreen ? <Minimize2 className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /> : <Maximize2 className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="shrink-0 h-1" style={{ background: "var(--border)" }}>
          <div className="h-full transition-all duration-500" style={{ width: `${totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0}%`, background: "linear-gradient(90deg, var(--accent), #b8892e)" }} />
        </div>

        {/* Book content area */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}>

            {/* Page content */}
            <div className="flex-1 overflow-y-auto flex justify-center">
              <div className="w-full max-w-3xl px-4 sm:px-10 py-6 sm:py-8">
                {/* Chapter title on first page of chapter */}
                {page?.isChapterStart && (
                  <div className="mb-6 sm:mb-8 pb-4" style={{ borderBottom: "2px solid var(--accent)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
                          {page.chapterTitle.match(/^Capitolo \d+/) ? page.chapterTitle.match(/^Capitolo \d+/)![0] : `Capitolo`}
                        </p>
                        <h1 className="text-xl sm:text-2xl font-display font-bold" style={{ color: "var(--text-primary)" }}>
                          {page.chapterTitle.replace(/^Capitolo \d+ — /, "")}
                        </h1>
                      </div>
                      <button
                        onClick={() => expandChapter(page.chapterIndex)}
                        disabled={expandingChapter !== null}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 mt-1"
                        style={{ background: "rgba(212,168,83,0.12)", color: "var(--accent)" }}
                        title="Genera contenuto piu approfondito per questo capitolo"
                      >
                        {expandingChapter === page.chapterIndex ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Espando...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5" /> Approfondisci</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Text content — with optional highlighting */}
                <div className="prose prose-invert max-w-none text-[15px] sm:text-base leading-[1.9] sm:leading-[2]" style={{ color: "var(--text-primary)" }}>
                  {(assistedMode || isSpeaking) && subtitles.length > 0 ? (
                    subtitles.map((cue, i) => {
                      const isActive = i === currentCueIndex;
                      return (
                        <span key={i} ref={el => { cueRefs.current[i] = el; }}
                          className="transition-all duration-200"
                          style={{
                            background: isActive ? "rgba(212,168,83,0.3)" : "transparent",
                            color: isActive ? "var(--accent)" : "var(--text-primary)",
                            borderRadius: isActive ? "4px" : "0",
                            padding: isActive ? "2px 6px" : "0",
                            fontWeight: isActive ? 600 : 400,
                          }}>
                          {cue.text}{" "}
                        </span>
                      );
                    })
                  ) : (
                    <MarkdownContent text={page?.text || ""} />
                  )}
                </div>
              </div>
            </div>

            {/* Page navigation footer */}
            <div className="shrink-0 flex items-center justify-between px-4 sm:px-8 py-3"
              style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <button onClick={prevPage} disabled={currentPage === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all disabled:opacity-20 hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}>
                <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Pagina precedente</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                  Pag. {page ? page.pageNum : 0} di {totalPages}
                </span>
                {page && (
                  <span className="text-xs hidden sm:inline px-2 py-0.5 rounded-full" style={{ background: "rgba(212,168,83,0.1)", color: "var(--accent)" }}>
                    {page.chapterTitle.replace(/^Capitolo \d+ — /, "").slice(0, 30)}
                  </span>
                )}
              </div>

              {currentPage < totalPages - 1 ? (
                <button onClick={nextPage}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-white/5"
                  style={{ color: "var(--accent)" }}>
                  <span className="hidden sm:inline">Pagina successiva</span> <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <Link href={`/course/${courseId}/speak`}>
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ color: "var(--accent)" }}>
                    <span className="hidden sm:inline">Vai ad Articola</span> <ChevronRight className="w-4 h-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Chat panel — hidden on mobile */}
          <div className="hidden md:flex w-72 shrink-0 flex-col" style={{ borderLeft: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Chiedi al professore</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {chatMessages.length === 0 && (
                <div className="text-center py-6" style={{ color: "var(--text-secondary)" }}>
                  <Sparkles className="w-5 h-5 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Non hai capito?<br />Chiedi qui.</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[90%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap"
                    style={{ background: msg.role === "user" ? "rgba(212,168,83,0.15)" : "var(--bg-secondary)", color: msg.role === "user" ? "var(--accent)" : "var(--text-primary)" }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="px-3 py-2 rounded-xl text-sm flex items-center gap-2" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}><Loader2 className="w-3 h-3 animate-spin" /> Penso...</div></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="shrink-0 px-2 py-2 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Domanda..."
                className="flex-1 text-sm outline-none px-3 py-1.5 rounded-lg"
                style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: "var(--accent)" }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
