"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, FileAudio, CheckCircle, FileText, Loader2, Play, AlertCircle, X, Plus, Merge, Square, CheckSquare, Trash2, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";

interface Transcription {
  id: number;
  title: string;
  content: string;
  file_type: string;
  created_at: string;
}

interface QueueItem {
  file: File;
  status: "pending" | "uploading" | "transcribing" | "done" | "error";
  jobId?: string;
  progress?: number;
  statusText?: string;
  transcript?: string;
  error?: string;
  duration?: number;
  segments?: number;
  correcting?: boolean;
  corrected?: boolean;
  correctedText?: string;
  originalText?: string;
}

type Method = "fast" | "balanced" | "quality";

const METHODS = [
  {
    id: "fast" as Method,
    label: "Veloce",
    model: "small",
    desc: "Rapido, buona qualità",
    time: "~1 min/ora",
    color: "var(--success)",
  },
  {
    id: "balanced" as Method,
    label: "Bilanciato",
    model: "medium",
    desc: "Velocità + precisione",
    time: "~3 min/ora",
    color: "var(--warning)",
  },
  {
    id: "quality" as Method,
    label: "Qualità massima",
    model: "large-v3",
    desc: "Massima accuratezza",
    time: "~5 min/ora",
    color: "var(--accent)",
  },
];

export default function TranscribePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [method, setMethod] = useState<Method>("quality");
  const [isRunning, setIsRunning] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [autoMerge, setAutoMerge] = useState(true);
  const [correctingIds, setCorrectingIds] = useState<Set<number>>(new Set());
  const [correctedDocs, setCorrectedDocs] = useState<Map<number, { original: string; corrected: string }>>(new Map());
  const [showOriginal, setShowOriginal] = useState<Set<number>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  // Keep ref in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const loadTranscriptions = useCallback(async () => {
    const docs = await fetch("/api/documents").then(r => r.json());
    const audioTypes = ["mp3", "wav", "m4a", "mp4", "mkv", "avi", "webm", "ogg", "flac"];
    setTranscriptions(docs.filter((d: any) => audioTypes.includes(d.file_type)));
  }, []);

  useEffect(() => { loadTranscriptions(); }, [loadTranscriptions]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueueItem[] = Array.from(files).map(file => ({
      file,
      status: "pending",
      progress: 0,
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const openFileDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mkv,.avi,.webm,.ogg,.flac";
    input.onchange = () => addFiles(input.files);
    input.click();
  };

  const pollJob = (jobId: string, queueIndex: number): Promise<void> => {
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/transcribe?jobId=${jobId}`);
          if (!res.ok) return;
          const job = await res.json();

          const statusLabels: Record<string, string> = {
            loading_model: "Caricamento modello...",
            transcribing: "Trascrizione in corso...",
            done: "Completato",
            error: "Errore",
          };

          setQueue(prev => prev.map((item, idx) => {
            if (idx !== queueIndex) return item;
            return {
              ...item,
              progress: job.progress || 0,
              statusText: statusLabels[job.status] || job.status,
              duration: job.duration_seconds,
              segments: job.segments_done,
              ...(job.status === "done" ? {
                status: "done" as const,
                transcript: job.transcript,
              } : {}),
              ...(job.status === "error" ? {
                status: "error" as const,
                error: job.error,
              } : {}),
            };
          }));

          if (job.status === "done" || job.status === "error") {
            clearInterval(interval);
            resolve();
          }
        } catch {
          // Network error, keep polling
        }
      }, 2000);

      pollingRef.current = interval;
    });
  };

  const transcribeAll = async () => {
    setIsRunning(true);

    // Read current queue from ref (always up to date, no async issues)
    const currentQueue = queueRef.current;
    const pendingIndices = currentQueue
      .map((item, i) => item.status === "pending" ? i : -1)
      .filter(i => i >= 0);

    let completedCount = 0;

    for (const i of pendingIndices) {
      const fileToUpload = queueRef.current[i]?.file;
      if (!fileToUpload) continue;

      // Update UI: uploading
      setQueue(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: "uploading" as const, statusText: "Caricamento file...", progress: 0 } : item
      ));

      try {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        formData.append("method", method);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload fallito");
        }

        const { jobId } = await res.json();

        setQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: "transcribing" as const, jobId, statusText: "Avvio trascrizione...", progress: 2 } : item
        ));

        await pollJob(jobId, i);
        completedCount++;
      } catch (err: any) {
        setQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: "error" as const, error: err.message } : item
        ));
      }
    }

    setIsRunning(false);
    await loadTranscriptions();

    // Auto-merge if multiple files were transcribed successfully
    if (autoMerge && completedCount >= 2) {
      const docs = await fetch("/api/documents").then(r => r.json());
      const audioTypes = ["mp3", "wav", "m4a", "mp4", "mkv", "avi", "webm", "ogg", "flac"];
      const audioDocs = docs.filter((d: any) => audioTypes.includes(d.file_type));
      const newDocs = audioDocs.slice(-completedCount);
      if (newDocs.length >= 2) {
        setMerging(true);
        try {
          await fetch("/api/documents/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentIds: newDocs.map((d: any) => d.id) }),
          });
          await loadTranscriptions();
        } catch { /* ignore */ }
        setMerging(false);
      }
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteTranscription = async (id: number) => {
    if (!confirm("Eliminare questa trascrizione?")) return;
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      if (viewingId === id) setViewingId(null);
      await loadTranscriptions();
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Eliminare ${selectedIds.size} trascrizioni?`)) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/documents/${id}`, { method: "DELETE" })
        )
      );
      setSelectedIds(new Set());
      setViewingId(null);
      await loadTranscriptions();
    } catch (err: any) {
      alert("Errore: " + err.message);
    }
  };

  const mergeSelected = async () => {
    if (selectedIds.size < 2) return;
    setMerging(true);
    try {
      const res = await fetch("/api/documents/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Errore durante l'unificazione");
        return;
      }
      setSelectedIds(new Set());
      await loadTranscriptions();
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setMerging(false);
    }
  };

  const correctTranscription = async (documentId: number) => {
    setCorrectingIds(prev => new Set(prev).add(documentId));
    try {
      const res = await fetch("/api/transcribe/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Errore durante la correzione");
        return;
      }
      const data = await res.json();
      setCorrectedDocs(prev => new Map(prev).set(documentId, { original: data.original, corrected: data.corrected }));
      await loadTranscriptions();
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setCorrectingIds(prev => { const next = new Set(prev); next.delete(documentId); return next; });
    }
  };

  const correctQueueItem = async (queueIndex: number, transcript: string) => {
    setQueue(prev => prev.map((item, idx) =>
      idx === queueIndex ? { ...item, correcting: true } : item
    ));
    try {
      const res = await fetch("/api/transcribe/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Errore durante la correzione");
        return;
      }
      const data = await res.json();
      setQueue(prev => prev.map((item, idx) =>
        idx === queueIndex ? {
          ...item,
          correcting: false,
          corrected: true,
          originalText: data.original,
          correctedText: data.corrected,
          transcript: data.corrected,
        } : item
      ));
    } catch (err: any) {
      alert("Errore: " + err.message);
    } finally {
      setQueue(prev => prev.map((item, idx) =>
        idx === queueIndex ? { ...item, correcting: false } : item
      ));
    }
  };

  const toggleOriginal = (docId: number) => {
    setShowOriginal(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const pendingCount = queue.filter(q => q.status === "pending").length;
  const doneCount = queue.filter(q => q.status === "done").length;
  const activeItem = queue.find(q => q.status === "transcribing" || q.status === "uploading");
  const viewingDoc = transcriptions.find(t => t.id === viewingId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="w-7 h-7" style={{ color: "var(--accent)" }} />
          Trascrivi
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Trascrivi lezioni audio/video con faster-whisper (GPU accelerata)
        </p>
      </div>

      {/* Upload area */}
      <div
        className="card border-2 border-dashed text-center py-10 cursor-pointer transition-colors"
        style={{ borderColor: "var(--border)" }}
        onClick={() => { if (!isRunning) openFileDialog(); }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--border)"; if (!isRunning) addFiles(e.dataTransfer.files); }}
      >
        <FileAudio className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--accent)" }} />
        <p className="font-medium text-lg">
          {queue.length === 0 ? "Seleziona file audio o video" : "Aggiungi altri file"}
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          MP3, WAV, M4A, MP4, MKV, AVI, WEBM — puoi selezionarne più di uno
        </p>
      </div>

      {/* File queue */}
      {queue.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              File in coda ({queue.length})
              {doneCount > 0 && (
                <span className="ml-2 text-sm font-normal" style={{ color: "var(--success)" }}>
                  — {doneCount} completat{doneCount === 1 ? "o" : "i"}
                </span>
              )}
            </h2>
            {!isRunning && (
              <button
                onClick={openFileDialog}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}
              >
                <Plus className="w-3 h-3" />
                Aggiungi file
              </button>
            )}
          </div>

          {/* Queue list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {queue.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="p-3 rounded-lg"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.status === "pending" && <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-secondary)" }} />}
                    {(item.status === "uploading" || item.status === "transcribing") && <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "var(--accent)" }} />}
                    {item.status === "done" && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />}
                    {item.status === "error" && <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--danger)" }} />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {(item.file.size / 1024 / 1024).toFixed(1)} MB
                        {item.duration ? ` — ${Math.round(item.duration / 60)} min di audio` : ""}
                        {item.statusText ? ` — ${item.statusText}` : ""}
                        {item.segments ? ` (${item.segments} segmenti)` : ""}
                      </p>
                    </div>
                  </div>
                  {item.status === "pending" && !isRunning && (
                    <button onClick={() => removeFromQueue(i)} className="p-1 rounded hover:bg-red-500/20">
                      <X className="w-4 h-4" style={{ color: "var(--danger)" }} />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {(item.status === "uploading" || item.status === "transcribing") && (
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.progress || 0}%`,
                        background: "linear-gradient(90deg, var(--accent), #7c3aed)",
                      }}
                    />
                  </div>
                )}

                {/* Error detail */}
                {item.status === "error" && item.error && (
                  <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{item.error}</p>
                )}

                {/* AI Correction button for completed items */}
                {item.status === "done" && item.transcript && (
                  <div className="mt-2 flex items-center gap-2">
                    {item.corrected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
                        <Sparkles className="w-3 h-3" />
                        Testo corretto dall&apos;AI
                      </span>
                    ) : (
                      <button
                        onClick={() => correctQueueItem(i, item.transcript!)}
                        disabled={item.correcting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                        style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}
                      >
                        {item.correcting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Correzione in corso...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            Correggi con AI
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Method selector */}
          {pendingCount > 0 && !isRunning && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Metodo di trascrizione</p>
                <div className="grid grid-cols-3 gap-3">
                  {METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className="p-4 rounded-xl text-left transition-all border-2"
                      style={{
                        borderColor: method === m.id ? m.color : "var(--border)",
                        background: method === m.id ? `${m.color}15` : "var(--bg-secondary)",
                      }}
                    >
                      <p className="font-semibold text-sm" style={{ color: method === m.id ? m.color : "var(--text-primary)" }}>
                        {m.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        Modello: {m.model}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        {m.desc}
                      </p>
                      <p className="text-xs mt-1 font-medium" style={{ color: m.color }}>
                        {m.time}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-merge toggle */}
              {pendingCount > 1 && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    className="w-10 h-5 rounded-full relative transition-colors"
                    style={{ background: autoMerge ? "var(--accent)" : "var(--border)" }}
                    onClick={() => setAutoMerge(!autoMerge)}
                  >
                    <div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                      style={{ left: autoMerge ? "1.25rem" : "0.125rem" }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Unifica automaticamente le trascrizioni al termine
                  </span>
                </label>
              )}

              {/* TRANSCRIBE BUTTON */}
              <button
                onClick={transcribeAll}
                className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, var(--accent), #7c3aed)" }}
              >
                <Play className="w-6 h-6" />
                TRASCRIVI {pendingCount > 1 ? `TUTTI (${pendingCount} file)` : "ORA"}
              </button>
            </>
          )}

          {/* All done */}
          {!isRunning && queue.length > 0 && pendingCount === 0 && doneCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: "var(--success)" }} />
                <p className="font-semibold" style={{ color: "var(--success)" }}>
                  Tutte le trascrizioni completate!
                </p>
              </div>
              <button
                onClick={() => setQueue([])}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                Nuova sessione
              </button>
            </div>
          )}
        </div>
      )}

      {/* Merging indicator */}
      {merging && (
        <div className="card p-4 flex items-center gap-3" style={{ borderColor: "var(--accent)" }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="font-medium">Unificazione trascrizioni in corso...</p>
        </div>
      )}

      {/* Previous transcriptions */}
      {transcriptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Trascrizioni precedenti</h2>
            <div className="flex items-center gap-2">
              {selectedIds.size >= 1 && (
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger, #ef4444)" }}
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina {selectedIds.size}
                </button>
              )}
              {selectedIds.size >= 2 && (
                <button
                  onClick={mergeSelected}
                  disabled={merging}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, var(--accent), #7c3aed)" }}
                >
                  <Merge className="w-4 h-4" />
                  Unifica {selectedIds.size}
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {transcriptions.map(t => (
              <div key={t.id}>
                <div
                  className="card flex items-center justify-between cursor-pointer"
                  style={{ borderColor: selectedIds.has(t.id) ? "var(--accent)" : viewingId === t.id ? "var(--accent)" : undefined }}
                >
                  <div className="flex items-center gap-3">
                    {/* Selection checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(t.id); }}
                      className="p-0.5 rounded hover:bg-white/10 transition-colors"
                    >
                      {selectedIds.has(t.id) ? (
                        <CheckSquare className="w-4 h-4" style={{ color: "var(--accent)" }} />
                      ) : (
                        <Square className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                      )}
                    </button>
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0"
                      onClick={() => setViewingId(viewingId === t.id ? null : t.id)}
                    >
                      <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {t.file_type.toUpperCase()} — {new Date(t.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* AI Correction button */}
                    {correctingIds.has(t.id) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs" style={{ color: "var(--accent)" }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </span>
                    ) : correctedDocs.has(t.id) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
                        <Sparkles className="w-3 h-3" />
                        Corretto
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); correctTranscription(t.id); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                        style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}
                        title="Correggi con AI"
                      >
                        <Sparkles className="w-3 h-3" />
                        Correggi
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTranscription(t.id); }}
                      className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" style={{ color: "var(--danger, #ef4444)" }} />
                    </button>
                    <FileText className="w-4 h-4 flex-shrink-0 cursor-pointer" style={{ color: "var(--text-secondary)" }} onClick={() => setViewingId(viewingId === t.id ? null : t.id)} />
                  </div>
                </div>
                {viewingId === t.id && viewingDoc && (
                  <div className="mt-1">
                    {/* Toggle original/corrected if correction exists */}
                    {correctedDocs.has(t.id) && (
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <button
                          onClick={() => toggleOriginal(t.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            background: showOriginal.has(t.id) ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
                            color: showOriginal.has(t.id) ? "var(--danger, #ef4444)" : "var(--accent)",
                          }}
                        >
                          {showOriginal.has(t.id) ? (
                            <><ToggleRight className="w-3.5 h-3.5" /> Originale</>
                          ) : (
                            <><ToggleLeft className="w-3.5 h-3.5" /> Corretto AI</>
                          )}
                        </button>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {showOriginal.has(t.id) ? "Testo originale (prima della correzione)" : "Testo corretto dall'AI"}
                        </span>
                      </div>
                    )}
                    <div
                      className="p-4 rounded-lg text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap"
                      style={{ background: "var(--bg-secondary)", maxHeight: "300px" }}
                    >
                      {correctedDocs.has(t.id) && showOriginal.has(t.id)
                        ? correctedDocs.get(t.id)!.original
                        : viewingDoc.content || "Nessun contenuto"}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
