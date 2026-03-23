"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onTranscript, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";

    recognition.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + " ";
          onTranscript(finalText.trim());
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => {
      setIsRecording(false);
      setInterim("");
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={disabled}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
        style={{
          background: isRecording ? "var(--danger)" : "var(--phase-articulate)",
          color: "#fff",
          boxShadow: isRecording ? "0 0 20px rgba(196,92,74,0.4)" : "none",
          animation: isRecording ? "pulse 1.5s ease-in-out infinite" : "none",
        }}
      >
        {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <div className="text-sm" style={{ color: isRecording ? "var(--phase-articulate)" : "var(--text-secondary)" }}>
        {isRecording ? (
          <span>Sto ascoltando... {interim && <span className="opacity-60">{interim}</span>}</span>
        ) : (
          "Premi per parlare"
        )}
      </div>
    </div>
  );
}
