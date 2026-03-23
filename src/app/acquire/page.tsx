"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Upload,
  FileAudio,
  FileText,
  StickyNote,
  CheckCircle,
  Loader2,
  X,
  AlertCircle,
  Play,
  Sparkles,
  ArrowRight,
  Trash2,
  Eye,
  Edit3,
  Save,
  ChevronUp,
  FolderOpen,
  Image,
  ScanLine,
} from "lucide-react";
import PhaseHeader from "@/components/ui/PhaseHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// --- Types ---

interface Document {
  id: number;
  title: string;
  content: string;
  file_path: string | null;
  file_type: string;
  created_at: string;
  updated_at: string;
}

interface AudioQueueItem {
  file: File;
  fileName?: string; // persisted name (File not serializable)
  fileSize?: number;
  status: "pending" | "uploading" | "transcribing" | "done" | "error";
  method: Method;
  jobId?: string;
  progress?: number;
  statusText?: string;
  transcript?: string;
  error?: string;
  duration?: number;
  segments?: number;
  documentId?: number;
}

// ── Global state that survives navigation (module-level, keeps File objects) ──
let globalAudioQueue: AudioQueueItem[] = [];
let globalDocQueue: DocQueueItem[] = [];
let globalActiveTab: Tab = "audio";
let globalIsTranscribing = false;

interface DocQueueItem {
  file: File;
  relativePath?: string;
  status: "pending" | "uploading" | "done" | "error";
  progress?: number;
  documentId?: number;
  error?: string;
  action?: "transcribe" | "saved";
}

// File type categories
const AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg", "flac", "webm"];
const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov"];
const TEXT_EXTENSIONS = ["pdf", "docx", "doc", "txt", "md"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "tif"];
const ALL_EXTENSIONS = [
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
];

function getFileExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function isAudioVideo(name: string): boolean {
  const ext = getFileExt(name);
  return AUDIO_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext);
}

function isTextFile(name: string): boolean {
  const ext = getFileExt(name);
  return TEXT_EXTENSIONS.includes(ext);
}

function isImageFile(name: string): boolean {
  const ext = getFileExt(name);
  return IMAGE_EXTENSIONS.includes(ext);
}

function isSupportedFile(name: string): boolean {
  const ext = getFileExt(name);
  return ALL_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type Method = "fast" | "balanced" | "quality";
type Tab = "audio" | "documents" | "notes";

const METHODS: { id: Method; label: string; desc: string }[] = [
  { id: "fast", label: "Veloce", desc: "~30 sec/ora" },
  { id: "balanced", label: "Bilanciato", desc: "~1 min/ora" },
  { id: "quality", label: "Qualità", desc: "~2 min/ora" },
];

// --- Component ---

import { Suspense } from "react";

function AcquirePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingCourseId = searchParams.get("course"); // ?course=14 → aggiungi materiale a corso esistente

  // Tab state — restore from global
  const [activeTab, setActiveTab] = useState<Tab>(globalActiveTab);

  // Audio tab — init from global module state (survives navigation)
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>(globalAudioQueue);
  const audioQueueRef = useRef<AudioQueueItem[]>(globalAudioQueue);
  const [isTranscribing, setIsTranscribing] = useState(globalIsTranscribing);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref + global in sync with state
  useEffect(() => {
    audioQueueRef.current = audioQueue;
    globalAudioQueue = audioQueue;
  }, [audioQueue]);

  useEffect(() => { globalActiveTab = activeTab; }, [activeTab]);
  useEffect(() => { globalIsTranscribing = isTranscribing; }, [isTranscribing]);

  // Documents tab
  const [docQueue, setDocQueue] = useState<DocQueueItem[]>(globalDocQueue);
  useEffect(() => { globalDocQueue = docQueue; }, [docQueue]);

  // Notes tab
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // All materials (documents from API)
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Document viewer/editor
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [fixingDocId, setFixingDocId] = useState<number | null>(null);

  // Global drag & drop
  const [globalDragging, setGlobalDragging] = useState(false);
  const [globalUploading, setGlobalUploading] = useState(false);
  const globalDragCounter = useRef(0);

  // Course creation / addition
  const [courseName, setCourseName] = useState("");
  const [courseInstructions, setCourseInstructions] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseResult, setCourseResult] = useState<{
    courseId: number;
    conceptCount: number;
  } | null>(null);
  const [existingCourseName, setExistingCourseName] = useState("");

  // Load existing course name if ?course=ID
  useEffect(() => {
    if (existingCourseId) {
      fetch(`/api/courses/${existingCourseId}`)
        .then(r => r.json())
        .then(c => {
          setExistingCourseName(c.title || "");
          setCourseName(c.title || "");
        })
        .catch(() => {});
    }
  }, [existingCourseId]);

  // --- Load existing documents ---
  const loadDocuments = useCallback(async () => {
    try {
      // Load unlinked docs + docs already linked to this course (so user can delete them)
      const [unlinkedRes, courseDocsRes] = await Promise.all([
        fetch("/api/documents?unlinked=true"),
        existingCourseId ? fetch(`/api/courses/${existingCourseId}`) : null,
      ]);
      const unlinked: Document[] = unlinkedRes.ok ? await unlinkedRes.json() : [];
      let courseDocs: Document[] = [];
      if (courseDocsRes?.ok) {
        const courseData = await courseDocsRes.json();
        courseDocs = (courseData.documents || []) as Document[];
      }
      // Merge, avoiding duplicates
      const seen = new Set<number>();
      const merged: Document[] = [];
      for (const doc of [...courseDocs, ...unlinked]) {
        if (!seen.has(doc.id)) { seen.add(doc.id); merged.push(doc); }
      }
      setDocuments(merged);
    } catch {
      // silent
    } finally {
      setLoadingDocs(false);
    }
  }, [existingCourseId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // --- global drag & drop handlers ---
  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalDragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setGlobalDragging(true);
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    globalDragCounter.current--;
    if (globalDragCounter.current === 0) {
      setGlobalDragging(false);
    }
  }, []);

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleGlobalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragging(false);
    globalDragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Check if drop target is already a specific drop zone — if so, let it handle
    const target = e.target as HTMLElement;
    if (target.closest("[data-dropzone]")) return;

    setGlobalUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
      }
      loadDocuments();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setGlobalUploading(false);
    }
  }, [loadDocuments]);

  // --- Audio helpers ---

  const addAudioFiles = (files: FileList | null) => {
    if (!files) return;
    const items: AudioQueueItem[] = Array.from(files).map((file) => ({
      file,
      fileName: file.name,
      fileSize: file.size,
      status: "pending" as const,
      method: "fast" as Method,
      progress: 0,
    }));
    setAudioQueue((prev) => [...prev, ...items]);
  };

  const removeAudioItem = (index: number) => {
    // If removing an item that's currently being polled, cancel the polling
    const item = audioQueueRef.current[index];
    if (item && (item.status === "uploading" || item.status === "transcribing")) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    setAudioQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const setItemMethod = (index: number, method: Method) => {
    setAudioQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, method } : item))
    );
  };

  const openAudioDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept =
      "audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mkv,.avi,.webm,.ogg,.flac";
    input.onchange = () => addAudioFiles(input.files);
    input.click();
  };

  const pollJob = (
    jobId: string,
    queueIndex: number
  ): Promise<number | undefined> => {
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

          setAudioQueue((prev) =>
            prev.map((item, idx) => {
              if (idx !== queueIndex) return item;
              return {
                ...item,
                progress: job.progress || 0,
                statusText: statusLabels[job.status] || job.status,
                duration: job.duration_seconds,
                segments: job.segments_done,
                ...(job.status === "done"
                  ? {
                      status: "done" as const,
                      transcript: job.transcript,
                      documentId: job.documentId,
                    }
                  : {}),
                ...(job.status === "error"
                  ? { status: "error" as const, error: job.error }
                  : {}),
              };
            })
          );

          if (job.status === "done" || job.status === "error") {
            clearInterval(interval);
            resolve(job.documentId);
          }
        } catch {
          // keep polling
        }
      }, 2000);

      pollingRef.current = interval;
    });
  };

  // On mount: resume polling for any items that were transcribing
  useEffect(() => {
    const queue = audioQueueRef.current;
    if (queue.length > 0) {
      queue.forEach((item, i) => {
        if (item.status === "transcribing" && item.jobId) {
          pollJob(item.jobId, i).then(() => {
            setIsTranscribing(false);
            loadDocuments();
          });
          setIsTranscribing(true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transcribeItem = async (index: number) => {
    setIsTranscribing(true);
    let fileToUpload: File | null = null;
    let method: Method = "quality";

    setAudioQueue((prev) => {
      fileToUpload = prev[index]?.file || null;
      method = prev[index]?.method || "quality";
      return prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              status: "uploading" as const,
              statusText: "Caricamento file...",
              progress: 0,
            }
          : item
      );
    });

    await new Promise((r) => setTimeout(r, 50));
    if (!fileToUpload) {
      setIsTranscribing(false);
      return;
    }

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

      setAudioQueue((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                status: "transcribing" as const,
                jobId,
                statusText: "Avvio trascrizione...",
                progress: 2,
              }
            : item
        )
      );

      await pollJob(jobId, index);
    } catch (err: any) {
      setAudioQueue((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? { ...item, status: "error" as const, error: err.message }
            : item
        )
      );
    }

    setIsTranscribing(false);
    loadDocuments();
  };

  const transcribeAll = async () => {
    setIsTranscribing(true);

    // Read queue synchronously via ref
    const pendingIndices: number[] = [];
    audioQueueRef.current.forEach((item, i) => {
      if (item.status === "pending") pendingIndices.push(i);
    });

    const completedDocIds: number[] = [];

    for (const i of pendingIndices) {
      const fileToUpload = audioQueueRef.current[i]?.file || null;
      const method: Method = audioQueueRef.current[i]?.method || "quality";

      setAudioQueue((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? {
                ...item,
                status: "uploading" as const,
                statusText: "Caricamento file...",
                progress: 0,
              }
            : item
        )
      );

      if (!fileToUpload) continue;

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

        setAudioQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "transcribing" as const,
                  jobId,
                  statusText: "Avvio trascrizione...",
                  progress: 2,
                }
              : item
          )
        );

        const docId = await pollJob(jobId, i);
        if (docId) {
          completedDocIds.push(docId);
          // Auto-link to course
          if (existingCourseId) {
            fetch(`/api/courses/${existingCourseId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ add_document_ids: [docId] }),
            }).catch(() => {});
          }
        }
        // Small delay between files to let VRAM free up
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        setAudioQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error" as const, error: err.message }
              : item
          )
        );
      }
    }

    // Se più di un file trascritto, unisci in un unico documento
    if (completedDocIds.length > 1) {
      try {
        const res = await fetch("/api/documents/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: completedDocIds }),
        });
        if (res.ok) {
          const merged = await res.json();
          // Update queue items to reference merged doc
          setAudioQueue((prev) =>
            prev.map((item) =>
              item.status === "done" ? { ...item, documentId: merged.id } : item
            )
          );
          // Auto-link merged doc to course
          if (existingCourseId) {
            fetch(`/api/courses/${existingCourseId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ add_document_ids: [merged.id] }),
            }).catch(() => {});
          }
        }
      } catch {
        // Se il merge fallisce, i documenti singoli restano disponibili
      }
    }

    setIsTranscribing(false);
    loadDocuments();
  };

  // --- Document helpers ---

  const [folderUploading, setFolderUploading] = useState(false);

  const uploadSingleFile = async (
    file: File,
    relativePath?: string
  ): Promise<{ docId?: number; action?: string; error?: string }> => {
    // Validate file before uploading
    if (file.size === 0) {
      return { error: `File vuoto (0 bytes): ${file.name}` };
    }
    if (file.size > 100 * 1024 * 1024) {
      return { error: `File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 100MB)` };
    }

    // Use fetch instead of XHR for better error handling
    const formData = new FormData();
    formData.append("file", file);
    if (relativePath) {
      formData.append("relativePath", relativePath);
    }

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        if (data.action === "transcribe") {
          return { action: "transcribe" };
        }
        return { docId: data.id };
      } else {
        return { error: data.error || `Errore server (${res.status})` };
      }
    } catch (err: any) {
      return { error: `Errore connessione: ${err.message}` };
    }
  };

  const addDocFiles = async (files: FileList | File[] | null, fromFolder = false) => {
    if (!files) return;
    const fileArray = Array.from(files);

    // Filter supported files
    const supported = fileArray.filter((f) => isSupportedFile(f.name));
    const unsupported = fileArray.filter((f) => !isSupportedFile(f.name));

    if (supported.length === 0) {
      if (unsupported.length > 0) {
        alert(
          `Nessun file supportato trovato. Tipi non supportati: ${unsupported
            .map((f) => getFileExt(f.name))
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ")}`
        );
      }
      return;
    }

    // Separate audio/video from text/image files
    const audioVideoFiles = supported.filter((f) => isAudioVideo(f.name));
    const docFiles = supported.filter((f) => !isAudioVideo(f.name));

    // Add audio/video files to audio queue
    if (audioVideoFiles.length > 0) {
      const audioItems: AudioQueueItem[] = audioVideoFiles.map((file) => ({
        file,
        fileName: file.name,
        fileSize: file.size,
        status: "pending" as const,
        method: "fast" as Method,
        progress: 0,
      }));
      setAudioQueue((prev) => [...prev, ...audioItems]);
      // Switch to audio tab if we have audio files
      if (docFiles.length === 0) {
        setActiveTab("audio");
      }
    }

    // Add text/image files to doc queue
    if (docFiles.length > 0) {
      const newItems: DocQueueItem[] = docFiles.map((f) => ({
        file: f,
        relativePath: fromFolder ? ((f as any).webkitRelativePath || f.name) : undefined,
        status: "pending" as const,
        progress: 0,
      }));
      setDocQueue((prev) => [...prev, ...newItems]);

      setFolderUploading(true);

      // Process files sequentially to avoid overwhelming the server
      for (const file of docFiles) {
        // Mark as uploading
        setDocQueue((prev) =>
          prev.map((item) =>
            item.file === file
              ? { ...item, status: "uploading" as const, progress: 0 }
              : item
          )
        );

        const relativePath = fromFolder
          ? ((file as any).webkitRelativePath || file.name)
          : undefined;

        const result = await uploadSingleFile(file, relativePath);

        if (result.error) {
          setDocQueue((prev) =>
            prev.map((item) =>
              item.file === file
                ? { ...item, status: "error" as const, error: result.error }
                : item
            )
          );
        } else if (result.action === "transcribe") {
          // Move to audio queue instead
          setDocQueue((prev) =>
            prev.map((item) =>
              item.file === file
                ? {
                    ...item,
                    status: "done" as const,
                    action: "transcribe" as const,
                  }
                : item
            )
          );
          // Already added to audio queue above
        } else {
          setDocQueue((prev) =>
            prev.map((item) =>
              item.file === file
                ? {
                    ...item,
                    status: "done" as const,
                    progress: 100,
                    documentId: result.docId,
                    action: "saved" as const,
                  }
                : item
            )
          );
          // Auto-link document to course if we have one
          if (existingCourseId && result.docId) {
            fetch(`/api/courses/${existingCourseId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ add_document_ids: [result.docId] }),
            }).catch(() => {});
          }
        }
      }

      setFolderUploading(false);
      loadDocuments();
    }

    // Notify about unsupported files
    if (unsupported.length > 0) {
      console.warn(
        `${unsupported.length} file ignorati (tipo non supportato):`,
        unsupported.map((f) => f.name)
      );
    }
  };

  const openDocDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept =
      ".pdf,.docx,.doc,.txt,.md,.mp3,.wav,.m4a,.mp4,.mkv,.avi,.jpg,.jpeg,.png,.gif,.webp,.tiff,.tif,.bmp";
    input.onchange = () => addDocFiles(input.files);
    input.click();
  };

  const openFolderDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;
    (input as any).directory = true;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        addDocFiles(input.files, true);
      }
    };
    input.click();
  };

  // --- Notes helpers ---

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const title = `Appunti ${new Date().toLocaleDateString("it-IT")} ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: noteText,
          file_type: "note",
        }),
      });
      if (res.ok) {
        setNoteText("");
        loadDocuments();
      }
    } catch {
      // silent
    } finally {
      setSavingNote(false);
    }
  };

  // --- Document management ---

  const deleteDocument = async (id: number) => {
    setDeletingDocId(id);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setSelectedDocIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (viewingDocId === id) { setViewingDocId(null); setEditingDocId(null); }
      await loadDocuments();
    } catch { /* silent */ }
    setDeletingDocId(null);
  };

  const startEditing = (doc: Document) => {
    setEditingDocId(doc.id);
    setEditContent(doc.content || "");
    setViewingDocId(doc.id);
  };

  const saveEdit = async () => {
    if (!editingDocId) return;
    setSavingEdit(true);
    try {
      await fetch(`/api/documents/${editingDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      setEditingDocId(null);
      await loadDocuments();
    } catch { /* silent */ }
    setSavingEdit(false);
  };

  const cancelEdit = () => {
    setEditingDocId(null);
    setEditContent("");
  };

  const [fixMode, setFixMode] = useState<string>("");

  const fixDocument = async (id: number, mode: "correct" | "analyze" | "full" = "full") => {
    setFixingDocId(id);
    setFixMode(mode === "correct" ? "Correzione testo..." : mode === "analyze" ? "Analisi AI..." : "Elaborazione completa (3 step)...");
    try {
      const res = await fetch(`/api/documents/${id}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore correzione AI");
      }
      await loadDocuments();
      setViewingDocId(id);
    } catch (err: any) {
      alert(`Correzione AI fallita: ${err.message}`);
    }
    setFixingDocId(null);
  };

  // --- Course creation ---

  const toggleDocSelection = (id: number) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDocs = () => {
    if (selectedDocIds.size === documents.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
    }
  };

  const createCourse = async () => {
    if (selectedDocIds.size === 0) return;
    setCreatingCourse(true);
    setCourseResult(null);

    try {
      let courseId: number;

      if (existingCourseId) {
        // ADD documents to existing course
        courseId = Number(existingCourseId);
        const res = await fetch(`/api/courses/${courseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            add_document_ids: Array.from(selectedDocIds),
            instructions: courseInstructions.trim() || undefined,
          }),
        });
        if (!res.ok) throw new Error("Errore aggiunta documenti");
      } else {
        // CREATE new course
        if (!courseName.trim()) return;
        const courseRes = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: courseName,
            description: courseInstructions.trim() || `Corso creato da ${selectedDocIds.size} document${selectedDocIds.size === 1 ? "o" : "i"}`,
            instructions: courseInstructions.trim() || null,
            document_ids: Array.from(selectedDocIds),
          }),
        });
        if (!courseRes.ok) throw new Error("Errore creazione corso");
        const course = await courseRes.json();
        courseId = course.id;
      }

      // Extract concepts from linked documents via AI (await result)
      let conceptCount = 0;
      try {
        const extractRes = await fetch(`/api/courses/${courseId}/extract-concepts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (extractRes.ok) {
          const extractData = await extractRes.json();
          conceptCount = extractData.total || 0;
        }
      } catch (e) {
        console.error("Concept extraction failed:", e);
      }

      // Pre-generate lesson in background (this one can stay fire-and-forget)
      fetch(`/api/courses/${courseId}/lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tecnico" }),
      }).catch(() => {});

      setCourseResult({ courseId, conceptCount });

      // Pulisci la coda documenti — i materiali sono già nel corso, non servono più qui
      globalDocQueue = [];
      setDocQueue([]);
      setSelectedDocIds(new Set());
    } catch (err: any) {
      console.error("Course creation error:", err);
    } finally {
      setCreatingCourse(false);
    }
  };

  // --- Derived ---

  const pendingAudioCount = audioQueue.filter(
    (q) => q.status === "pending"
  ).length;
  const wordCount = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

  const tabs: { id: Tab; label: string; icon: typeof FileAudio }[] = [
    { id: "audio", label: "Audio/Video", icon: FileAudio },
    { id: "documents", label: "Documenti", icon: FileText },
    { id: "notes", label: "Appunti", icon: StickyNote },
  ];

  // --- Render ---

  return (
    <div
      className="max-w-4xl mx-auto space-y-6 relative"
      onDragEnter={handleGlobalDragEnter}
      onDragLeave={handleGlobalDragLeave}
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      {/* ---- GLOBAL DRAG & DROP OVERLAY ---- */}
      {globalDragging && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center transition-all"
          style={{
            background: "rgba(10, 10, 14, 0.85)",
            border: "3px dashed var(--accent)",
            backdropFilter: "blur(4px)",
          }}
        >
          <Upload
            className="w-16 h-16 mb-4"
            style={{ color: "var(--accent)" }}
          />
          <p className="text-xl font-display font-bold" style={{ color: "var(--accent)" }}>
            Rilascia per caricare
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            I file verranno aggiunti alla libreria
          </p>
        </div>
      )}

      {/* ---- UPLOAD IN PROGRESS ---- */}
      {globalUploading && (
        <div
          className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
          }}
        >
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>Caricamento in corso...</span>
        </div>
      )}

      {/* Section 1: Phase Header */}
      <PhaseHeader
        phase={1}
        title="Acquisisci"
        description="Carica il tuo materiale di studio — lezioni, dispense, appunti"
        icon={BookOpen}
        color="var(--phase-acquire)"
      />

      {/* Section 2: Material Upload */}
      <Card>
        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: "var(--bg-secondary)" }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: isActive ? "var(--bg-card)" : "transparent",
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  boxShadow: isActive
                    ? "0 2px 8px rgba(0,0,0,0.2)"
                    : "none",
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab: Audio/Video */}
        {activeTab === "audio" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              className="border-2 border-dashed rounded-xl text-center py-10 cursor-pointer transition-colors"
              style={{ borderColor: "var(--border)" }}
              onClick={() => {
                if (!isTranscribing) openAudioDialog();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--phase-acquire)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                if (!isTranscribing) addAudioFiles(e.dataTransfer.files);
              }}
            >
              <Upload
                className="w-10 h-10 mx-auto mb-3"
                style={{ color: "var(--phase-acquire)" }}
              />
              <p className="font-medium">
                Trascina file audio o video, oppure clicca per selezionare
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                MP3, WAV, M4A, MP4, MKV, AVI, WEBM
              </p>
            </div>

            {/* Queue */}
            {audioQueue.length > 0 && (
              <div className="space-y-3">
                {audioQueue.map((item, i) => (
                  <div
                    key={`${item.fileName || item.file?.name || i}-${i}`}
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: "var(--bg-secondary)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.status === "pending" && (
                          <FileAudio
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--text-secondary)" }}
                          />
                        )}
                        {(item.status === "uploading" ||
                          item.status === "transcribing") && (
                          <Loader2
                            className="w-4 h-4 flex-shrink-0 animate-spin"
                            style={{ color: "var(--phase-acquire)" }}
                          />
                        )}
                        {item.status === "done" && (
                          <CheckCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--success, #4ade80)" }}
                          />
                        )}
                        {item.status === "error" && (
                          <AlertCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--danger, #ef4444)" }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.fileName || item.file?.name || "File"}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {((item.fileSize || item.file?.size || 0) / 1024 / 1024).toFixed(1)} MB
                            {item.duration
                              ? ` — ${Math.round(item.duration / 60)} min`
                              : ""}
                            {item.statusText ? ` — ${item.statusText}` : ""}
                            {item.status === "done" && item.transcript
                              ? ` — ${wordCount(item.transcript).toLocaleString()} parole`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeAudioItem(i)}
                          className="p-2 rounded hover:bg-red-500/20"
                          title="Rimuovi"
                        >
                          <X
                            className="w-4 h-4"
                            style={{ color: "var(--danger, #ef4444)" }}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Method selector (per file) */}
                    {item.status === "pending" && !isTranscribing && (
                      <div className="flex gap-2">
                        {METHODS.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setItemMethod(i, m.id)}
                            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all border"
                            style={{
                              borderColor:
                                item.method === m.id
                                  ? "var(--phase-acquire)"
                                  : "var(--border)",
                              background:
                                item.method === m.id
                                  ? "rgba(91, 143, 185, 0.15)"
                                  : "transparent",
                              color:
                                item.method === m.id
                                  ? "var(--phase-acquire)"
                                  : "var(--text-secondary)",
                            }}
                          >
                            {m.label}{" "}
                            <span style={{ opacity: 0.7 }}>{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Progress bar */}
                    {(item.status === "uploading" ||
                      item.status === "transcribing") && (
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.progress || 0}%`,
                            background: "var(--phase-acquire)",
                          }}
                        />
                      </div>
                    )}

                    {/* Error */}
                    {item.status === "error" && item.error && (
                      <p
                        className="text-xs"
                        style={{ color: "var(--danger, #ef4444)" }}
                      >
                        {item.error}
                      </p>
                    )}
                  </div>
                ))}

                {/* Transcribe All button */}
                {pendingAudioCount >= 1 && !isTranscribing && (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={transcribeAll}
                  >
                    <Play className="w-5 h-5" />
                    {pendingAudioCount === 1
                      ? "TRASCRIVI ORA"
                      : `TRASCRIVI E UNISCI (${pendingAudioCount} file)`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Documenti */}
        {activeTab === "documents" && (
          <div className="space-y-4">
            {/* Upload area */}
            <div
              className="border-2 border-dashed rounded-xl text-center py-8 cursor-pointer transition-colors"
              style={{ borderColor: "var(--border)" }}
              onClick={openDocDialog}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--phase-acquire)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                addDocFiles(e.dataTransfer.files);
              }}
            >
              <Upload
                className="w-10 h-10 mx-auto mb-3"
                style={{ color: "var(--phase-acquire)" }}
              />
              <p className="font-medium">
                Trascina file, oppure clicca per selezionare
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                PDF, DOCX, TXT, MP3, WAV, M4A, MP4, JPG, PNG, TIFF (max 100MB) — OCR automatico per immagini
              </p>
            </div>

            {/* Folder upload button */}
            <button
              onClick={openFolderDialog}
              disabled={folderUploading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-sm font-medium transition-all border"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                opacity: folderUploading ? 0.6 : 1,
                cursor: folderUploading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!folderUploading) {
                  e.currentTarget.style.borderColor = "var(--phase-acquire)";
                  e.currentTarget.style.background = "rgba(91, 143, 185, 0.08)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
            >
              {folderUploading ? (
                <Loader2
                  className="w-5 h-5 animate-spin"
                  style={{ color: "var(--phase-acquire)" }}
                />
              ) : (
                <FolderOpen
                  className="w-5 h-5"
                  style={{ color: "var(--phase-acquire)" }}
                />
              )}
              {folderUploading
                ? "Caricamento cartella in corso..."
                : "Carica cartella"}
            </button>

            {/* Upload queue with progress */}
            {docQueue.length > 0 && (
              <div className="space-y-2">
                {/* Summary */}
                {docQueue.length > 1 && (
                  <div
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>
                      {docQueue.filter((q) => q.status === "done").length}/
                      {docQueue.length} completati
                    </span>
                    <button
                      onClick={() =>
                        setDocQueue((prev) =>
                          prev.filter(
                            (q) =>
                              q.status !== "done" && q.status !== "error"
                          )
                        )
                      }
                      className="hover:underline"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Pulisci completati
                    </button>
                  </div>
                )}

                {docQueue.map((item, i) => {
                  const IconComponent = isAudioVideo(item.file.name)
                    ? FileAudio
                    : isImageFile(item.file.name)
                      ? Image
                      : FileText;

                  return (
                    <div
                      key={`doc-${item.file.name}-${i}`}
                      className="p-3 rounded-lg space-y-2"
                      style={{ background: "var(--bg-secondary)" }}
                    >
                      <div className="flex items-center gap-3">
                        {item.status === "pending" && (
                          <IconComponent
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--text-secondary)" }}
                          />
                        )}
                        {item.status === "uploading" && (
                          <Loader2
                            className="w-4 h-4 animate-spin flex-shrink-0"
                            style={{ color: "var(--phase-acquire)" }}
                          />
                        )}
                        {item.status === "done" && (
                          <CheckCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--success, #4ade80)" }}
                          />
                        )}
                        {item.status === "error" && (
                          <AlertCircle
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: "var(--danger, #ef4444)" }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.relativePath || item.file.name}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {getFileExt(item.file.name).toUpperCase()} — {formatFileSize(item.file.size)}
                            {item.status === "uploading" && isImageFile(item.file.name)
                              ? " — OCR in corso (lettura testo con AI)..."
                              : item.status === "uploading" && item.progress !== undefined
                                ? ` — ${item.progress}%`
                                : ""}
                            {item.status === "done" && item.action === "transcribe"
                              ? " — Aggiunto a coda audio"
                              : ""}
                            {item.status === "done" && isImageFile(item.file.name) && item.action !== "transcribe"
                              ? " — Testo estratto con OCR"
                              : ""}
                          </p>
                        </div>
                        {(item.status === "pending" || item.status === "error") && (
                          <button
                            onClick={() =>
                              setDocQueue((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="p-1 rounded hover:bg-red-500/20"
                          >
                            <X
                              className="w-4 h-4"
                              style={{ color: "var(--danger, #ef4444)" }}
                            />
                          </button>
                        )}
                      </div>

                      {/* Progress bar for large uploads */}
                      {item.status === "uploading" && (
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--border)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${item.progress || 0}%`,
                              background: "var(--phase-acquire)",
                            }}
                          />
                        </div>
                      )}

                      {/* Error message */}
                      {item.status === "error" && item.error && (
                        <p
                          className="text-xs"
                          style={{ color: "var(--danger, #ef4444)" }}
                        >
                          {item.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Appunti */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Scrivi o incolla i tuoi appunti qui..."
              rows={10}
              className="w-full rounded-xl p-4 text-sm resize-y font-body"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                minHeight: "200px",
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {noteText.trim()
                  ? `${wordCount(noteText).toLocaleString()} parole`
                  : "Nessun contenuto"}
              </p>
              <Button
                variant="primary"
                onClick={saveNote}
                loading={savingNote}
                disabled={!noteText.trim()}
              >
                <StickyNote className="w-4 h-4" />
                Salva appunti
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Section 3: Materials Library & Course Creation */}
      {loadingDocs ? (
        <Card>
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: "var(--text-secondary)" }}
            />
            <p style={{ color: "var(--text-secondary)" }}>
              Caricamento materiali...
            </p>
          </div>
        </Card>
      ) : documents.length > 0 ? (
        <Card>
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-lg font-display font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  I tuoi materiali
                </h2>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {documents.length} document
                  {documents.length === 1 ? "o" : "i"} disponibil
                  {documents.length === 1 ? "e" : "i"}
                </p>
              </div>
              <button
                onClick={selectAllDocs}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: "var(--phase-acquire)",
                  background: "rgba(91, 143, 185, 0.1)",
                }}
              >
                {selectedDocIds.size === documents.length
                  ? "Deseleziona tutti"
                  : "Seleziona tutti"}
              </button>
            </div>

            {/* Document list with checkboxes + actions */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {documents.map((doc) => {
                const isSelected = selectedDocIds.has(doc.id);
                const isViewing = viewingDocId === doc.id;
                const isEditing = editingDocId === doc.id;
                const wc = doc.content ? wordCount(doc.content) : 0;
                return (
                  <div key={doc.id}>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg transition-all"
                      style={{
                        background: isSelected
                          ? "rgba(91, 143, 185, 0.1)"
                          : "var(--bg-secondary)",
                        border: `1px solid ${isSelected ? "var(--phase-acquire)" : isViewing ? "var(--accent)" : "transparent"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDocSelection(doc.id)}
                        className="w-4 h-4 rounded accent-[#5b8fb9] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {doc.title}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {doc.file_type?.toUpperCase() || "TXT"}
                          {wc > 0 ? ` — ${wc.toLocaleString()} parole` : ""}
                          {" — "}
                          {new Date(doc.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Delete — FIRST so always visible on mobile */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                          disabled={deletingDocId === doc.id}
                          className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                          title="Elimina documento"
                        >
                          {deletingDocId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--danger)" }} />
                          ) : (
                            <Trash2 className="w-4 h-4" style={{ color: "var(--danger)" }} />
                          )}
                        </button>
                        {/* View/collapse */}
                        <button
                          onClick={() => setViewingDocId(isViewing ? null : doc.id)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/5"
                          title={isViewing ? "Chiudi anteprima" : "Anteprima"}
                        >
                          {isViewing ? (
                            <ChevronUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                          ) : (
                            <Eye className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                          )}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => isEditing ? cancelEdit() : startEditing(doc)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/5"
                          title={isEditing ? "Annulla modifica" : "Modifica trascrizione"}
                        >
                          <Edit3
                            className="w-4 h-4"
                            style={{ color: isEditing ? "var(--accent)" : "var(--text-secondary)" }}
                          />
                        </button>
                        {/* AI Full Pipeline */}
                        <button
                          onClick={() => fixDocument(doc.id, "full")}
                          disabled={fixingDocId !== null}
                          className="p-2 rounded-lg transition-colors hover:bg-purple-500/20"
                          title="Elabora con AI — correzione + Q&A + ricostruzione logica"
                        >
                          {fixingDocId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#a855f7" }} />
                          ) : (
                            <Sparkles className="w-4 h-4" style={{ color: "#a855f7" }} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Viewer / Editor panel */}
                    {isViewing && (
                      <div
                        className="mt-1 rounded-lg overflow-hidden"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full p-4 text-sm resize-y font-body"
                              style={{
                                background: "var(--bg-secondary)",
                                color: "var(--text-primary)",
                                minHeight: "300px",
                                maxHeight: "500px",
                                border: "none",
                                outline: "none",
                              }}
                            />
                            <div
                              className="flex items-center justify-between px-4 py-2"
                              style={{ background: "var(--bg-hover)", borderTop: "1px solid var(--border)" }}
                            >
                              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                {wordCount(editContent).toLocaleString()} parole — Correggi errori di trascrizione, aggiungi parti mancanti
                              </p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                  Annulla
                                </Button>
                                <Button size="sm" variant="primary" onClick={saveEdit} loading={savingEdit}>
                                  <Save className="w-3 h-3" />
                                  Salva correzioni
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="p-4 text-sm leading-relaxed overflow-y-auto"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                              maxHeight: "300px",
                            }}
                          >
                            {doc.content ? (
                              doc.content.split("\n").map((line, i) => (
                                <p key={i} className="mb-1">{line || "\u00A0"}</p>
                              ))
                            ) : (
                              <p style={{ color: "var(--text-secondary)" }}>Nessun contenuto</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI Processing Banner */}
            {fixingDocId !== null && (
              <div
                className="flex items-center gap-3 p-4 rounded-xl animate-pulse"
                style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)" }}
              >
                <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: "#a855f7" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#a855f7" }}>
                    {fixMode || "Elaborazione AI in corso..."}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    3 step: Revisione testuale → Analisi Q&A → Ricostruzione logica. Può richiedere qualche minuto.
                  </p>
                </div>
              </div>
            )}

            {/* Course name + create button */}
            <div
              className="pt-4 space-y-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div>
                {existingCourseId ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--accent)10", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                    <FolderOpen className="w-4 h-4" />
                    Aggiungi materiale a: <strong>{existingCourseName}</strong>
                  </div>
                ) : (
                  <>
                    <label
                      className="text-sm font-medium block mb-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Nome del percorso
                    </label>
                    <input
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="es. Diritto Penale — Parte Speciale"
                      className="w-full rounded-xl px-4 py-3 text-sm"
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </>
                )}
              </div>

              <div>
                <label
                  className="text-sm font-medium block mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  Istruzioni per il professore <span className="font-normal" style={{ color: "var(--text-secondary)" }}>(opzionale)</span>
                </label>
                <textarea
                  value={courseInstructions}
                  onChange={(e) => setCourseInstructions(e.target.value)}
                  placeholder="es. Spiegami solo il Capitolo 1, oppure: Concentrati sui primi 5 paragrafi, oppure: Approfondisci il tema della legittima difesa..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Create button / Loading / Result */}
              {courseResult ? (
                <div className="space-y-4">
                  <div
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{
                      background: "rgba(91, 143, 185, 0.1)",
                      border: "1px solid var(--phase-acquire)",
                    }}
                  >
                    <Sparkles
                      className="w-6 h-6 flex-shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                    <div>
                      <p className="font-semibold">
                        Ho trovato {courseResult.conceptCount} concetti chiave
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Percorso stimato: ~
                        {Math.max(1, Math.round(courseResult.conceptCount * 0.3))}{" "}
                        ore
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() =>
                      router.push(`/course/${courseResult.courseId}/learn`)
                    }
                  >
                    INIZIA A STUDIARE
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={createCourse}
                  loading={creatingCourse}
                  disabled={
                    (!existingCourseId && !courseName.trim()) ||
                    selectedDocIds.size === 0 ||
                    creatingCourse
                  }
                >
                  {creatingCourse ? (
                    "Sto analizzando il materiale..."
                  ) : existingCourseId ? (
                    <>
                      <Sparkles className="w-5 h-5" />
                      AGGIUNGI A &ldquo;{existingCourseName}&rdquo;
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      ANALIZZA E CREA PERCORSO
                    </>
                  )}
                </Button>
              )}

              {selectedDocIds.size === 0 && !courseResult && (
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Seleziona almeno un documento per creare il percorso
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default function AcquirePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" style={{ color: "var(--accent)" }} /></div>}>
      <AcquirePageInner />
    </Suspense>
  );
}
