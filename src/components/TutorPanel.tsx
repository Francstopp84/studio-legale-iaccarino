"use client";
import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { Brain, X, Send, Loader2, Minus } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TutorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Pulse animation only on first load
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
          pageContext: `Pagina: ${pathname}`,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Errore: ${err.message || "Impossibile contattare il tutor."}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pathname]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, var(--accent), #b8892e)",
            boxShadow: "0 4px 20px rgba(212, 168, 83, 0.4)",
            animation: hasAnimated ? "none" : "tutorPulse 2s ease-in-out infinite",
          }}
          title="Tutor AI"
        >
          <Brain size={26} color="#1a1814" />
        </button>
      )}

      {/* Panel */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col"
        style={{
          width: 400,
          height: 520,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.8) translateY(20px)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "transform 0.25s ease, opacity 0.2s ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{
            background: "linear-gradient(135deg, var(--accent), #b8892e)",
            color: "#1a1814",
          }}
        >
          <div className="flex items-center gap-2">
            <Brain size={20} />
            <span className="font-semibold text-sm">Tutor AI</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(26,24,20,0.2)" }}
            >
              Llama 70B
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-black/10 transition-colors cursor-pointer"
              title="Minimizza"
            >
              <Minus size={18} />
            </button>
            <button
              onClick={() => { setIsOpen(false); setMessages([]); }}
              className="p-1 rounded-md hover:bg-black/10 transition-colors cursor-pointer"
              title="Chiudi"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
          {messages.length === 0 && (
            <div className="text-center py-8" style={{ color: "var(--text-secondary)" }}>
              <Brain size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Ciao! Sono il tuo Tutor AI.
              </p>
              <p className="text-xs mt-1">
                Chiedimi qualsiasi cosa: studio, organizzazione, ragionamento.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap"
                style={{
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, var(--accent), #b8892e)"
                      : "var(--bg-hover)",
                  color: msg.role === "user" ? "#1a1814" : "var(--text-primary)",
                  borderBottomRightRadius: msg.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: msg.role === "assistant" ? 4 : 12,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3 py-2 rounded-xl flex items-center gap-2 text-sm"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                <Loader2 size={14} className="animate-spin" />
                Sto pensando...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="shrink-0 px-3 py-3 flex items-end gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi al tutor..."
            rows={1}
            className="flex-1 resize-none text-sm px-3 py-2 rounded-lg outline-none"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              maxHeight: 80,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{
              background: input.trim() && !loading ? "var(--accent)" : "var(--bg-hover)",
              color: input.trim() && !loading ? "#1a1814" : "var(--text-secondary)",
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Pulse keyframes */}
      <style jsx global>{`
        @keyframes tutorPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(212, 168, 83, 0.4); }
          50% { box-shadow: 0 4px 30px rgba(212, 168, 83, 0.7); }
        }
      `}</style>
    </>
  );
}
