"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Plus, Minus } from "lucide-react";
import Button from "@/components/ui/Button";
import FocusReader from "@/components/FocusReader";

interface Document {
  id: number;
  title: string;
  content: string;
  file_type: string;
}

export default function DocumentReaderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sentenceInfo, setSentenceInfo] = useState({ current: 0, total: 0 });

  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch document
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) throw new Error("Documento non trovato");
        const data = await res.json();
        setDoc(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Scroll progress tracking
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) {
        setScrollProgress(100);
        return;
      }
      setScrollProgress(Math.round((scrollTop / maxScroll) * 100));
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [doc]);

  // Escape key exits focus mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) setFocusMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusMode]);

  const handleSentenceChange = useCallback((current: number, total: number) => {
    setSentenceInfo({ current, total });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <p style={{ color: "var(--text-secondary)" }}>Caricamento...</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
        <p style={{ color: "var(--danger)" }}>{error || "Documento non trovato"}</p>
        <Button variant="secondary" onClick={() => router.push("/acquire")}>
          <ArrowLeft size={16} /> Torna indietro
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      {/* Top bar */}
      <header
        className="reader-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
          transition: "opacity 0.4s ease",
          opacity: focusMode ? 0.4 : 1,
          zIndex: 10,
        }}
        onMouseEnter={(e) => { if (focusMode) e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { if (focusMode) e.currentTarget.style.opacity = "0.4"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" size="sm" onClick={() => router.push("/acquire")}>
            <ArrowLeft size={18} />
          </Button>
          <h1
            className="font-display"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
              maxWidth: 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {doc.title}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Font size controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFontSize((s) => Math.max(12, s - 2))}
            title="Riduci dimensione testo"
          >
            <Minus size={16} />
          </Button>
          <span style={{ color: "var(--text-secondary)", fontSize: 13, minWidth: 32, textAlign: "center" }}>
            {fontSize}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFontSize((s) => Math.min(28, s + 2))}
            title="Aumenta dimensione testo"
          >
            <Plus size={16} />
          </Button>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

          {/* Focus mode toggle */}
          <Button
            variant={focusMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setFocusMode((f) => !f)}
            title={focusMode ? "Disattiva Modalita' Focus" : "Attiva Modalita' Focus"}
          >
            {focusMode ? <EyeOff size={16} /> : <Eye size={16} />}
            <span style={{ marginLeft: 4 }}>Focus</span>
          </Button>
        </div>
      </header>

      {/* Main content area */}
      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "48px 24px",
        }}
      >
        <FocusReader
          content={doc.content}
          enabled={focusMode}
          onSentenceChange={handleSentenceChange}
          fontSize={fontSize}
        />
      </div>

      {/* Floating sentence indicator (focus mode only) */}
      {focusMode && sentenceInfo.total > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 72,
            right: 32,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            color: "var(--accent)",
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            zIndex: 20,
            transition: "opacity 0.3s ease",
          }}
        >
          Frase {sentenceInfo.current + 1}/{sentenceInfo.total}
        </div>
      )}

      {/* Bottom bar - reading progress */}
      <footer
        className="reader-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 24px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
          transition: "opacity 0.4s ease",
          opacity: focusMode ? 0.3 : 1,
          zIndex: 10,
        }}
        onMouseEnter={(e) => { if (focusMode) e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { if (focusMode) e.currentTarget.style.opacity = "0.3"; }}
      >
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {focusMode
            ? `Frase ${sentenceInfo.current + 1} di ${sentenceInfo.total}`
            : `Letto: ${scrollProgress}%`}
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 300,
            height: 4,
            background: "var(--bg-hover)",
            borderRadius: 2,
            marginLeft: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: focusMode
                ? `${sentenceInfo.total > 0 ? ((sentenceInfo.current + 1) / sentenceInfo.total) * 100 : 0}%`
                : `${scrollProgress}%`,
              height: "100%",
              background: "var(--accent)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </footer>
    </div>
  );
}
