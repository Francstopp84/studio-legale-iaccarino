"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

interface FocusReaderProps {
  content: string;
  enabled: boolean;
  onSentenceChange?: (current: number, total: number) => void;
  fontSize: number;
}

interface Sentence {
  text: string;
  paragraphIndex: number;
}

function parseSentences(content: string): { paragraphs: string[]; sentences: Sentence[] } {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const sentences: Sentence[] = [];

  paragraphs.forEach((para, pIdx) => {
    // Split by sentence-ending punctuation, keeping the punctuation attached
    const parts = para.match(/[^.!?]*[.!?]+[\s]*/g);
    if (parts && parts.length > 0) {
      // Check if there's remaining text after the last punctuation
      const joined = parts.join("");
      const remainder = para.slice(joined.length).trim();
      parts.forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) sentences.push({ text: trimmed, paragraphIndex: pIdx });
      });
      if (remainder) {
        sentences.push({ text: remainder, paragraphIndex: pIdx });
      }
    } else {
      // No sentence-ending punctuation found, treat whole paragraph as one sentence
      const trimmed = para.trim();
      if (trimmed) sentences.push({ text: trimmed, paragraphIndex: pIdx });
    }
  });

  return { paragraphs, sentences };
}

export default function FocusReader({ content, enabled, onSentenceChange, fontSize }: FocusReaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<Map<number, HTMLSpanElement>>(new Map());

  const { paragraphs, sentences } = useMemo(() => parseSentences(content), [content]);
  const totalSentences = sentences.length;

  // Notify parent of sentence changes
  useEffect(() => {
    if (enabled && onSentenceChange) {
      onSentenceChange(currentIndex, totalSentences);
    }
  }, [currentIndex, totalSentences, enabled, onSentenceChange]);

  // Reset index when toggling focus mode
  useEffect(() => {
    if (enabled) setCurrentIndex(0);
  }, [enabled]);

  // Scroll current sentence into view
  useEffect(() => {
    if (!enabled) return;
    const el = sentenceRefs.current.get(currentIndex);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, enabled]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(prev + 1, totalSentences - 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
      }
    },
    [enabled, totalSentences]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSentenceClick = (index: number) => {
    if (enabled) setCurrentIndex(index);
  };

  // Build paragraph-grouped rendering
  const paragraphSentences = useMemo(() => {
    const grouped: Map<number, { globalIndex: number; text: string }[]> = new Map();
    sentences.forEach((s, i) => {
      if (!grouped.has(s.paragraphIndex)) grouped.set(s.paragraphIndex, []);
      grouped.get(s.paragraphIndex)!.push({ globalIndex: i, text: s.text });
    });
    return grouped;
  }, [sentences]);

  return (
    <div
      ref={containerRef}
      className="focus-reader-container"
      style={{
        maxWidth: 720,
        margin: "0 auto",
        fontSize: `${fontSize}px`,
        lineHeight: 1.8,
        color: "var(--text-primary)",
      }}
    >
      {paragraphs.map((_, pIdx) => {
        const pSentences = paragraphSentences.get(pIdx);
        if (!pSentences) return null;
        return (
          <p key={pIdx} style={{ marginBottom: "1.5em" }}>
            {pSentences.map(({ globalIndex, text }) => {
              const isActive = enabled && globalIndex === currentIndex;
              const isDimmed = enabled && globalIndex !== currentIndex;
              return (
                <span
                  key={globalIndex}
                  ref={(el) => {
                    if (el) sentenceRefs.current.set(globalIndex, el);
                  }}
                  data-sentence-index={globalIndex}
                  className={`focus-sentence ${isActive ? "active" : ""} ${isDimmed ? "dimmed" : ""}`}
                  onClick={() => handleSentenceClick(globalIndex)}
                  style={enabled ? { cursor: "pointer" } : undefined}
                >
                  {text}{" "}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
