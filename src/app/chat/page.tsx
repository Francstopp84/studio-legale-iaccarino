"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  Send,
  ChevronDown,
  ChevronUp,
  Bookmark,
  X,
  MessageSquare,
  FileText,
  Sparkles,
} from "lucide-react";

/* ───── Types ───── */
interface Document {
  id: number;
  title: string;
  content: string;
  file_type: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  selectedText?: string;
  collapsed: boolean;
  saved: boolean;
}

type VoiceStyle = "tutor" | "socratico" | "esperto" | "semplificatore";

const VOICE_LABELS: Record<VoiceStyle, string> = {
  tutor: "Tutor",
  socratico: "Metodo Socratico",
  esperto: "Esperto",
  semplificatore: "Semplificatore",
};

/* ───── Helpers ───── */
let msgCounter = 0;
function uid() {
  return `msg-${Date.now()}-${++msgCounter}`;
}

/* ───── Component ───── */
export default function ChatPage() {
  /* ── state ── */
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [floatingBtnPos, setFloatingBtnPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("tutor");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const docViewerRef = useRef<HTMLDivElement>(null);

  /* ── fetch documents list ── */
  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d) => setDocuments(d))
      .catch(() => {});
  }, []);

  /* ── fetch selected document ── */
  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      return;
    }
    const doc = documents.find((d) => d.id === selectedDocId) ?? null;
    setSelectedDoc(doc);
    setSelectedText("");
    setSelectionRange(null);
    setMessages([]);
  }, [selectedDocId, documents]);

  /* ── auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── text selection handler ── */
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setFloatingBtnPos(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setFloatingBtnPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setSelectedText(text);

    // Compute character offsets within the doc viewer
    if (docViewerRef.current) {
      const fullText = docViewerRef.current.innerText || "";
      const start = fullText.indexOf(text);
      if (start >= 0) {
        setSelectionRange({ start, end: start + text.length });
      }
    }
  }, []);

  const confirmSelection = () => {
    setFloatingBtnPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const clearSelection = () => {
    setSelectedText("");
    setSelectionRange(null);
    setFloatingBtnPos(null);
  };

  /* ── send message ── */
  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: q,
      selectedText: selectedText || undefined,
      collapsed: false,
      saved: false,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: selectedDocId,
          message: q,
          history,
          selectedText: selectedText || undefined,
          voiceStyle,
        }),
      });
      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.reply || data.error || "Errore nella risposta.",
        collapsed: false,
        saved: false,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Errore di connessione.",
          collapsed: false,
          saved: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ── message actions ── */
  const toggleCollapse = (id: string) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, collapsed: !m.collapsed } : m))
    );

  const toggleSave = (id: string) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, saved: !m.saved } : m))
    );

  const removeMessage = (id: string) =>
    setMessages((prev) => prev.filter((m) => m.id !== id));

  /* ── scroll-to-portion on click ── */
  const scrollToPortion = (text: string) => {
    if (!docViewerRef.current || !text) return;
    const fullText = docViewerRef.current.innerText || "";
    const idx = fullText.indexOf(text);
    if (idx < 0) return;

    setSelectedText(text);
    setSelectionRange({ start: idx, end: idx + text.length });

    // Find the paragraph that contains the text
    const paragraphs = docViewerRef.current.querySelectorAll("[data-paragraph]");
    for (const p of paragraphs) {
      if ((p.textContent || "").includes(text)) {
        p.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  };

  /* ── render document content with highlights ── */
  const renderDocContent = () => {
    if (!selectedDoc) return null;
    const paragraphs = selectedDoc.content.split(/\n+/).filter((p) => p.trim());
    let charOffset = 0;

    return paragraphs.map((para, i) => {
      const pStart = charOffset;
      const pEnd = charOffset + para.length;
      charOffset = pEnd + 1; // +1 for the newline

      let content: React.ReactNode = para;

      if (
        selectionRange &&
        selectedText &&
        pStart < selectionRange.end &&
        pEnd > selectionRange.start
      ) {
        // Check if this paragraph contains the selected text
        const localIdx = para.indexOf(selectedText);
        if (localIdx >= 0) {
          const before = para.slice(0, localIdx);
          const highlighted = para.slice(localIdx, localIdx + selectedText.length);
          const after = para.slice(localIdx + selectedText.length);
          content = (
            <>
              {before}
              <span
                style={{
                  background: "var(--accent)",
                  color: "#1a1814",
                  borderRadius: "3px",
                  padding: "0 2px",
                }}
              >
                {highlighted}
              </span>
              {after}
            </>
          );
        }
      }

      return (
        <p
          key={i}
          data-paragraph={i}
          className="mb-3 leading-relaxed text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {content}
        </p>
      );
    });
  };

  /* ────────── RENDER ────────── */
  return (
    <div className="flex h-full w-full" style={{ color: "var(--text-primary)" }}>
      {/* ═══ LEFT PANEL ═══ */}
      <div
        className="w-1/2 flex flex-col border-r"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Document selector */}
        <div
          className="p-4 border-b flex items-center gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--accent)" }} />
          <select
            value={selectedDocId ?? ""}
            onChange={(e) =>
              setSelectedDocId(e.target.value ? Number(e.target.value) : null)
            }
            className="flex-1 rounded-xl px-3 py-2 text-sm font-medium outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Seleziona un documento...</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Document content */}
        <div
          ref={docViewerRef}
          className="flex-1 overflow-y-auto p-6 relative"
          style={{ background: "var(--bg-primary)" }}
          onMouseUp={handleMouseUp}
        >
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <FileText className="w-12 h-12" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Seleziona un documento per iniziare
              </p>
            </div>
          ) : (
            renderDocContent()
          )}
        </div>

        {/* Floating "Chat su questa porzione" button */}
        {floatingBtnPos && (
          <div
            className="fixed z-50"
            style={{
              left: floatingBtnPos.x,
              top: floatingBtnPos.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <Button size="sm" onClick={confirmSelection}>
              <Sparkles className="w-3 h-3" />
              Chatta su questa porzione
            </Button>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <div className="w-1/2 flex flex-col" style={{ background: "var(--bg-primary)" }}>
        {/* Context indicator + voice style */}
        <div
          className="p-4 border-b flex items-center justify-between gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
            <span
              className="text-xs font-medium truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              Contesto:{" "}
              <span style={{ color: selectedText ? "var(--accent)" : "var(--text-primary)" }}>
                {selectedText
                  ? `"${selectedText.length > 60 ? selectedText.slice(0, 60) + "..." : selectedText}"`
                  : "Intero documento"}
              </span>
            </span>
            {selectedText && (
              <button
                onClick={clearSelection}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                title="Rimuovi selezione"
              >
                <X className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
              </button>
            )}
          </div>

          {/* Voice style selector */}
          <select
            value={voiceStyle}
            onChange={(e) => setVoiceStyle(e.target.value as VoiceStyle)}
            className="rounded-lg px-2 py-1.5 text-xs font-medium outline-none flex-shrink-0"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--accent)",
            }}
          >
            {(Object.keys(VOICE_LABELS) as VoiceStyle[]).map((k) => (
              <option key={k} value={k}>
                {VOICE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <MessageSquare className="w-12 h-12" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                Seleziona un documento e inizia a chattare
              </p>
              <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                Puoi selezionare una porzione di testo per chattare su un passaggio specifico
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isCollapsed = msg.collapsed && !isUser;
            const firstLine = msg.content.split("\n")[0];
            const displayContent = isCollapsed
              ? firstLine.length > 120
                ? firstLine.slice(0, 120) + "..."
                : firstLine + "..."
              : msg.content;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 relative group"
                  style={{
                    background: isUser ? "var(--accent)" : "var(--bg-card)",
                    color: isUser ? "#1a1814" : "var(--text-primary)",
                    border: isUser ? "none" : "1px solid var(--border)",
                    borderLeft: msg.saved
                      ? "3px solid var(--accent)"
                      : isUser
                      ? "none"
                      : "1px solid var(--border)",
                  }}
                >
                  {/* Selected text reference badge */}
                  {isUser && msg.selectedText && (
                    <button
                      onClick={() => scrollToPortion(msg.selectedText!)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full mb-2 block hover:opacity-80 transition-opacity"
                      style={{
                        background: "rgba(0,0,0,0.15)",
                        color: "#1a1814",
                      }}
                      title="Clicca per scorrere alla porzione"
                    >
                      Rif: &ldquo;{msg.selectedText.length > 40
                        ? msg.selectedText.slice(0, 40) + "..."
                        : msg.selectedText}&rdquo;
                    </button>
                  )}

                  {/* Content */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {displayContent}
                  </p>

                  {/* Action bar */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <button
                        onClick={() => toggleCollapse(msg.id)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                        title={msg.collapsed ? "Espandi" : "Comprimi"}
                      >
                        {msg.collapsed ? (
                          <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                        )}
                      </button>
                      <button
                        onClick={() => toggleSave(msg.id)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                        title={msg.saved ? "Rimuovi segnalibro" : "Salva"}
                      >
                        <Bookmark
                          className="w-3.5 h-3.5"
                          style={{ color: msg.saved ? "var(--accent)" : "var(--text-secondary)" }}
                          fill={msg.saved ? "var(--accent)" : "none"}
                        />
                      </button>
                      <button
                        onClick={() => removeMessage(msg.id)}
                        className="opacity-50 hover:opacity-100 transition-opacity"
                        title="Rimuovi"
                      >
                        <X className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading dots */}
          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex gap-1.5 items-center h-5">
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "var(--accent)", animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "var(--accent)", animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "var(--accent)", animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div
          className="p-4 border-t"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                selectedDoc
                  ? "Fai una domanda sul documento..."
                  : "Seleziona prima un documento"
              }
              disabled={!selectedDoc || loading}
              rows={2}
              className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none placeholder:opacity-50"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!selectedDoc || !input.trim() || loading}
              loading={loading}
              size="md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
