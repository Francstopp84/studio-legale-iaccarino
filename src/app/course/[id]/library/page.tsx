"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, Download, Loader2, BookOpen, Trash2, FileAudio, Image, File, Plus } from "lucide-react";

interface LibraryDoc {
  id: number;
  title: string;
  content: string;
  file_type: string;
  created_at: string;
}

export default function LibraryPage() {
  const params = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const allDocs = (data.documents || []) as LibraryDoc[];
        setDocs(allDocs);
        if (allDocs.length > 0) setSelectedId(allDocs[0].id);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const selectedDoc = docs.find((d) => d.id === selectedId) || null;

  const downloadPdf = async (doc: LibraryDoc) => {
    setDownloadingId(doc.id);
    try {
      const res = await fetch(
        `/api/courses/${params.id}/documents/${doc.id}/pdf`
      );
      if (!res.ok) throw new Error("Errore generazione PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.title.replace(/[^a-zA-Z0-9àèéìòù\s-]/g, "").trim()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteDoc = async (docId: number) => {
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => {
        const next = prev.filter((d) => d.id !== docId);
        if (selectedId === docId) {
          setSelectedId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch {}
  };

  const cleanTitle = (title: string) =>
    title.replace("[Deep Research] ", "").replace("[One Legale] ", "");

  const getDocIcon = (fileType: string) => {
    if (fileType === "transcript" || fileType?.startsWith("audio")) return FileAudio;
    if (fileType?.startsWith("ocr") || fileType?.startsWith("image")) return Image;
    if (fileType === "deep-research") return BookOpen;
    return FileText;
  };

  const getDocLabel = (fileType: string) => {
    if (fileType === "transcript") return "Trascrizione";
    if (fileType === "deep-research") return "Approfondimento";
    if (fileType === "pdf") return "PDF";
    if (fileType === "docx" || fileType === "doc") return "Word";
    if (fileType === "txt" || fileType === "md") return "Testo";
    if (fileType?.startsWith("ocr")) return "OCR";
    return fileType?.toUpperCase() || "Documento";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: "var(--accent)" }}
        />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen
          className="w-12 h-12 mx-auto mb-4"
          style={{ color: "var(--text-secondary)", opacity: 0.4 }}
        />
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Libreria vuota
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Carica PDF, trascrizioni o altri documenti per trovarli qui.
        </p>
        <button
          onClick={() => router.push(`/acquire?course=${params.id}`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          <Plus className="w-4 h-4" />
          Aggiungi materiale
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Sidebar — lista documenti */}
      <div
        className="w-64 flex-shrink-0 rounded-xl border overflow-hidden flex flex-col"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div
          className="px-3 py-2.5 flex items-center justify-between border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {docs.length} documenti
          </span>
          <button
            onClick={() => router.push(`/acquire?course=${params.id}`)}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
            title="Aggiungi materiale"
          >
            <Plus className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {docs.map((doc) => {
            const isActive = selectedId === doc.id;
            const IconComp = getDocIcon(doc.file_type);

            return (
              <div
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className="group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-all border-b"
                style={{
                  background: isActive ? "var(--accent)15" : "transparent",
                  borderColor: "var(--border)",
                  borderLeft: isActive
                    ? "3px solid var(--accent)"
                    : "3px solid transparent",
                }}
              >
                <IconComp
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium leading-tight"
                    style={{
                      color: isActive ? "var(--accent)" : "var(--text-primary)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {cleanTitle(doc.title)}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {getDocLabel(doc.file_type)}
                    {doc.content
                      ? ` · ${Math.round(doc.content.split(/\s+/).length)} parole`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Eliminare questo documento?")) deleteDoc(doc.id);
                  }}
                  className="p-1 rounded transition-colors hover:bg-red-500/20 flex-shrink-0"
                  style={{ color: "var(--danger, #ef4444)" }}
                  title="Elimina"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main panel — contenuto documento */}
      <div
        className="flex-1 rounded-xl border overflow-hidden flex flex-col"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        {selectedDoc ? (
          <>
            {/* Header documento */}
            <div
              className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <h3
                  className="text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {cleanTitle(selectedDoc.title)}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {getDocLabel(selectedDoc.file_type)}
                  {selectedDoc.content
                    ? ` · ${Math.round(selectedDoc.content.split(/\s+/).length)} parole`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => downloadPdf(selectedDoc)}
                disabled={downloadingId === selectedDoc.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: "var(--accent)20", color: "var(--accent)" }}
              >
                {downloadingId === selectedDoc.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
            </div>

            {/* Contenuto scrollabile */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--text-primary)" }}
              >
                {selectedDoc.content}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Seleziona un documento dalla lista
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
