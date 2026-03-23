"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { BookOpen, Lightbulb, Mic, Cog, Scale, Crown, Zap, FileAudio, MessageSquare, FolderOpen, CreditCard, GitBranch, Library, RotateCcw, Sparkles, CheckCircle2, FolderClosed, Plus, ChevronRight, Trash2, Pencil, Check, Menu, X, Newspaper, Instagram, Facebook } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const phases = [
  { href: "/acquire", label: "Acquisisci", icon: BookOpen, phase: 1, color: "var(--phase-acquire)", desc: "Carica materiale" },
  { href: "/acquire", label: "Comprendi", icon: Lightbulb, phase: 2, color: "var(--phase-understand)", desc: "Prossimamente", disabled: true },
  { href: "/acquire", label: "Articola", icon: Mic, phase: 3, color: "var(--phase-articulate)", desc: "Prossimamente", disabled: true },
  { href: "/acquire", label: "Consolida", icon: Cog, phase: 4, color: "var(--phase-consolidate)", desc: "Prossimamente", disabled: true },
  { href: "/acquire", label: "Simula", icon: Scale, phase: 5, color: "var(--phase-simulate)", desc: "Prossimamente", disabled: true },
  { href: "/", label: "Padroneggia", icon: Crown, phase: 6, color: "var(--phase-master)", desc: "Dashboard" },
];

const flashcardItems = [
  { href: "/flashcards?filter=review", label: "Flashcard da ripassare", icon: RotateCcw, color: "var(--phase-simulate)", desc: "Scadute oggi", statKey: "toReview" as const, badgeColor: "#ef4444" },
  { href: "/flashcards?filter=new", label: "Flashcard mai studiate", icon: Sparkles, color: "var(--phase-articulate)", desc: "Mai aperte", statKey: "neverStudied" as const, badgeColor: "#ef4444" },
  { href: "/flashcards?filter=done", label: "Flashcard già studiate", icon: CheckCircle2, color: "var(--phase-consolidate)", desc: "Completate", statKey: "alreadyStudied" as const, badgeColor: "#22c55e" },
];

const tools = [
  { href: "/transcribe", label: "Trascrivi", icon: FileAudio, color: "var(--accent)", desc: "Audio → Testo (GPU)" },
  { href: "/documents", label: "Documenti", icon: FolderOpen, color: "var(--phase-understand)", desc: "Collezioni e fonti" },
  { href: "/chat", label: "Chat Fonte", icon: MessageSquare, color: "var(--phase-articulate)", desc: "Chatta col testo" },
  { href: "/brainer-card", label: "Brainer Card", icon: CreditCard, color: "var(--phase-master)", desc: "Mente estesa" },
  { href: "/mindmap", label: "Schemi", icon: GitBranch, color: "var(--phase-consolidate)", desc: "Mappe e schemi" },
  { href: "/library", label: "Biblioteca", icon: Library, color: "var(--phase-acquire)", desc: "Codici e testi" },
  { href: "/blog", label: "Blog", icon: Newspaper, color: "var(--phase-simulate)", desc: "Approfondimenti giuridici" },
];

interface Course {
  id: number;
  title: string;
  document_count: number;
  mastered_concepts: number;
  total_concepts: number;
  parent_id: number | null;
}

export default function FunnelNav() {
  const pathname = usePathname();
  const [flashcardStats, setFlashcardStats] = useState({ toReview: 0, neverStudied: 0, alreadyStudied: 0 });
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesOpen, setCoursesOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const deleteCourse = async (id: number) => {
    try {
      // Elimina anche tutti i sotto-corsi se è una cartella
      const children = courses.filter(c => c.parent_id === id);
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      for (const child of children) {
        await fetch(`/api/courses/${child.id}`, { method: "DELETE" });
      }
      setCourses(prev => prev.filter(c => c.id !== id && c.parent_id !== id));
    } catch {}
  };

  const toggleFolder = (id: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renameCourse = async (id: number) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      setCourses(prev => prev.map(c => c.id === id ? { ...c, title: renameValue.trim() } : c));
    } catch {}
    setRenamingId(null);
  };

  // Refresh courses on mount AND on route change (so new course appears immediately)
  useEffect(() => {
    fetch("/api/flashcards/stats")
      .then(r => r.json())
      .then(setFlashcardStats)
      .catch((e) => console.error("[FunnelNav] flashcard stats error:", e));
    fetch("/api/courses")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Course[]) => {
        console.log("[FunnelNav] Corsi caricati:", data.length);
        setCourses(data);
      })
      .catch((e) => console.error("[FunnelNav] courses fetch error:", e));
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger button — always rendered, hidden via CSS on desktop */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="mobile-menu-btn"
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 60,
            padding: 10,
            borderRadius: 10,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--accent)",
            cursor: "pointer",
          }}
          aria-label="Apri menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.6)",
          }}
        />
      )}

      <aside
        className="sidebar-nav"
        style={{
          width: 288,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
          zIndex: 80,
          transition: "transform 0.3s ease-in-out",
          ...(mobileOpen
            ? { position: "fixed", top: 0, left: 0, transform: "translateX(0)" }
            : { position: "fixed", top: 0, left: 0, transform: "translateX(-100%)" }
          ),
        }}
      >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
        <Link href="/" className="block flex-1">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 4C10.5 4 6 8.5 6 14c0 3.5 1.8 6.5 4.5 8.3V26a2 2 0 002 2h7a2 2 0 002-2v-3.7C24.2 20.5 26 17.5 26 14c0-5.5-4.5-10-10-10z" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
              <path d="M12 28h8M13 30h6" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 9v4M13 11l3 2 3-2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 15c0 0 1.5 2 5 2s5-2 5-2" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="13" cy="18" r="1" fill="var(--accent)" opacity="0.6"/>
              <circle cx="19" cy="18" r="1" fill="var(--accent)" opacity="0.6"/>
            </svg>
            <h1
              style={{
                color: "var(--accent)",
                fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
                fontSize: "1.5rem",
                fontWeight: 700,
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Avv. Iaccarino
            </h1>
          </div>
          <p
            style={{
              color: "var(--text-secondary)",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: "0.75rem",
              marginTop: "0.35rem",
              paddingLeft: "42px",
            }}
          >
            Il tuo tutor personale
          </p>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="mobile-menu-btn"
          style={{ color: "var(--text-secondary)", padding: 6, borderRadius: 8, background: "none", border: "none", cursor: "pointer" }}
          aria-label="Chiudi menu"
        >
          <X className="w-5 h-5" />
        </button>
        </div>
      </div>

      {/* Funnel phases */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest px-3 mb-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Percorso di studio
        </p>
        {phases.map(({ href, label, icon: Icon, phase, color, desc, disabled }) => {
          const active = !disabled && isActive(href);
          const Wrapper = disabled ? "div" : Link;
          const linkProps = disabled ? {} : { href };
          return (
            <Wrapper
              key={`phase-${phase}`}
              {...linkProps as any}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all group relative"
              style={{
                background: active ? `${color}15` : "transparent",
                borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: active ? `${color}25` : "var(--bg-hover)",
                  color: active ? color : "var(--text-secondary)",
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p
                  className="font-medium truncate"
                  style={{ color: active ? color : "var(--text-primary)" }}
                >
                  {label}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
              <span
                className="ml-auto text-[10px] font-bold opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                {phase}
              </span>
            </Wrapper>
          );
        })}

        {/* I Miei Corsi — Cartelle */}
        <div className="mt-5">
          <button
            onClick={() => setCoursesOpen(!coursesOpen)}
            className="flex items-center gap-1 w-full text-[10px] uppercase tracking-widest px-3 mb-2 font-semibold"
            style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
          >
            <ChevronRight className={`w-3 h-3 transition-transform ${coursesOpen ? "rotate-90" : ""}`} />
            I Miei Corsi
            <span className="ml-auto text-[9px] font-normal" style={{ color: "var(--text-secondary)" }}>
              {courses.length}
            </span>
          </button>
          {coursesOpen && (
            <div className="space-y-0.5">
              {/* Cartelle padre (corsi con figli) + corsi standalone (senza parent_id e senza figli) */}
              {(() => {
                const parentIds = new Set(courses.filter(c => c.parent_id !== null).map(c => c.parent_id!));
                const folders = courses.filter(c => c.parent_id === null && parentIds.has(c.id));
                const standalone = courses.filter(c => c.parent_id === null && !parentIds.has(c.id));
                const children = (parentId: number) => courses.filter(c => c.parent_id === parentId);

                const renderCourseItem = (course: Course, indent: boolean = false) => {
                  const active = pathname === `/course/${course.id}/learn` || pathname.startsWith(`/course/${course.id}`);
                  const progress = course.total_concepts > 0
                    ? Math.round((course.mastered_concepts / course.total_concepts) * 100)
                    : 0;
                  return (
                    <div key={course.id} className="relative group">
                      {renamingId === course.id ? (
                        <div className="flex items-center gap-1.5 py-1.5 rounded-xl" style={{ paddingLeft: indent ? 28 : 12, paddingRight: 8, background: "var(--bg-hover)", borderLeft: "3px solid var(--accent)" }}>
                          <FolderClosed className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameCourse(course.id); if (e.key === "Escape") setRenamingId(null); }}
                            className="flex-1 min-w-0 text-[12px] font-medium bg-transparent outline-none"
                            style={{ color: "var(--text-primary)" }}
                          />
                          <button onClick={() => renameCourse(course.id)} className="p-1 rounded hover:bg-white/10" title="Conferma">
                            <Check className="w-3 h-3" style={{ color: "#22c55e" }} />
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={`/course/${course.id}/learn`}
                          className="flex items-center gap-2 py-1.5 pr-1 rounded-lg text-sm transition-all"
                          style={{
                            paddingLeft: indent ? 28 : 12,
                            background: active ? "var(--accent)15" : "transparent",
                            borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
                          }}
                        >
                          <FolderClosed
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-[12px]" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                              {course.title}
                            </p>
                            {!indent && (
                              <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                                {course.document_count} doc{course.document_count !== 1 ? "." : ""}{progress > 0 ? ` · ${progress}%` : ""}
                              </p>
                            )}
                          </div>
                          <span
                            role="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRenameValue(course.title); setRenamingId(course.id); }}
                            className="p-1 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                            title="Rinomina"
                          >
                            <Pencil className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                          </span>
                          <span
                            role="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCourse(course.id); }}
                            className="p-1 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                            title="Elimina"
                          >
                            <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                          </span>
                        </Link>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Cartelle (libri con capitoli) */}
                    {folders.map((folder) => {
                      const isExpanded = expandedFolders.has(folder.id);
                      const kids = children(folder.id);
                      const anyChildActive = kids.some(c => pathname.startsWith(`/course/${c.id}`));
                      return (
                        <div key={folder.id}>
                          <div className="relative group">
                            <button
                              onClick={() => toggleFolder(folder.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left"
                              style={{
                                background: anyChildActive ? "var(--accent)08" : "transparent",
                              }}
                            >
                              <ChevronRight className={`w-3 h-3 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`} style={{ color: "var(--accent)" }} />
                              <Library className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                                  {folder.title}
                                </p>
                                <p className="text-[9px]" style={{ color: "var(--text-secondary)" }}>
                                  {kids.length} capitol{kids.length !== 1 ? "i" : "o"}
                                </p>
                              </div>
                              <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); setRenameValue(folder.title); setRenamingId(folder.id); }}
                                className="p-1 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                title="Rinomina cartella"
                              >
                                <Pencil className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                              </span>
                              <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); deleteCourse(folder.id); }}
                                className="p-1 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                                title="Elimina cartella e capitoli"
                              >
                                <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                              </span>
                            </button>
                            {renamingId === folder.id && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "var(--bg-hover)", borderLeft: "3px solid var(--accent)" }}>
                                <Library className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") renameCourse(folder.id); if (e.key === "Escape") setRenamingId(null); }}
                                  className="flex-1 min-w-0 text-[12px] font-medium bg-transparent outline-none"
                                  style={{ color: "var(--text-primary)" }}
                                />
                                <button onClick={() => renameCourse(folder.id)} className="p-1 rounded hover:bg-white/10">
                                  <Check className="w-3 h-3" style={{ color: "#22c55e" }} />
                                </button>
                              </div>
                            )}
                          </div>
                          {isExpanded && kids.map(child => renderCourseItem(child, true))}
                        </div>
                      );
                    })}
                    {/* Corsi standalone (non in cartella) */}
                    {standalone.map(course => renderCourseItem(course, false))}
                  </>
                );
              })()}
              <Link
                href="/acquire"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all opacity-60 hover:opacity-100"
              >
                <Plus className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <p className="text-[12px]" style={{ color: "var(--accent)" }}>Nuovo corso</p>
              </Link>
            </div>
          )}
        </div>

        {/* Strumenti */}
        <p className="text-[10px] uppercase tracking-widest px-3 mt-5 mb-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Strumenti
        </p>
        {tools.map(({ href, label, icon: Icon, color, desc }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all group relative"
              style={{
                background: active ? `${color}15` : "transparent",
                borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: active ? `${color}25` : "var(--bg-hover)",
                  color: active ? color : "var(--text-secondary)",
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: active ? color : "var(--text-primary)" }}>
                  {label}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
            </Link>
          );
        })}

        {/* Mazzi Flashcard */}
        <p className="text-[10px] uppercase tracking-widest px-3 mt-5 mb-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
          Mazzi Flashcard
        </p>
        {flashcardItems.map(({ href, label, icon: Icon, color, desc, statKey, badgeColor }) => {
          const active = pathname === "/flashcards" && href.includes(new URLSearchParams(href.split("?")[1]).get("filter") || "");
          const count = flashcardStats[statKey];
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all group relative"
              style={{
                background: active ? `${color}15` : "transparent",
                borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                style={{
                  background: active ? `${color}25` : "var(--bg-hover)",
                  color: active ? color : "var(--text-secondary)",
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate" style={{ color: active ? color : "var(--text-primary)" }}>
                  {label}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
              {count > 0 && (
                <span
                  className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ background: badgeColor }}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick session + footer */}
      <div className="p-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/daily"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "var(--accent)15",
            color: "var(--accent)",
          }}
        >
          <Zap className="w-4 h-4" />
          Sessione rapida
        </Link>
        <div className="px-3 flex items-center justify-between">
          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>Avv. Iaccarino Studio</p>
            <p>v2.0</p>
          </div>
          <ThemeToggle />
        </div>
        {/* Social Links */}
        <div className="px-3 flex items-center gap-2 mt-2">
          <a
            href="https://www.instagram.com/avv.iaccarino.napoli/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="Instagram"
          >
            <Instagram className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://www.facebook.com/avv.iaccarino.napoli"
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="Facebook"
          >
            <Facebook className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://www.tiktok.com/@avv.iaccarino.napoli"
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="TikTok"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 004.76 1.5V7.12a4.83 4.83 0 01-1-.43z" />
            </svg>
          </a>
        </div>
      </div>
    </aside>
    </>
  );
}
