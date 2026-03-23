"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  FolderOpen,
  FileText,
  FileAudio,
  File,
  Plus,
  Search,
  X,
  MoreVertical,
  FolderPlus,
  Trash2,
  Edit3,
  Check,
  ChevronRight,
  Upload,
} from "lucide-react";

// ---------- types ----------
interface Collection {
  id: number;
  name: string;
  description: string | null;
  color: string;
  parent_id: number | null;
  doc_count: number;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: number;
  title: string;
  content: string | null;
  file_path: string | null;
  file_type: string | null;
  created_at: string;
  updated_at: string;
}

interface DocWithCollections extends Document {
  collections: number[];
}

// ---------- constants ----------
const PRESET_COLORS = [
  { name: "Oro", value: "#d4a853" },
  { name: "Blu", value: "#5b8bd4" },
  { name: "Verde", value: "#5bb878" },
  { name: "Rosso", value: "#c45c4a" },
  { name: "Viola", value: "#9b6bc4" },
  { name: "Teal", value: "#4ab8a8" },
];

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  audio: FileAudio,
  text: FileText,
};

// ---------- component ----------
export default function DocumentsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [documents, setDocuments] = useState<DocWithCollections[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "uncategorized" | number>("all");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [menuDocId, setMenuDocId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);

  // --- data fetching ---
  const fetchData = useCallback(async () => {
    const [colRes, docRes] = await Promise.all([
      fetch("/api/collections"),
      fetch("/api/documents"),
    ]);
    const cols: Collection[] = await colRes.json();
    const docs: Document[] = await docRes.json();

    // fetch collection memberships for each doc
    const dcRes = await fetch("/api/collections");
    const allCols: Collection[] = await dcRes.json();

    // build a map: for each collection, get its documents
    const docCollMap: Record<number, number[]> = {};
    for (const col of allCols) {
      try {
        const r = await fetch(`/api/collections/${col.id}`);
        const data = await r.json();
        if (data.documents) {
          for (const d of data.documents as Document[]) {
            if (!docCollMap[d.id]) docCollMap[d.id] = [];
            docCollMap[d.id].push(col.id);
          }
        }
      } catch { /* ignore */ }
    }

    const enriched: DocWithCollections[] = docs.map((d) => ({
      ...d,
      collections: docCollMap[d.id] || [],
    }));

    setCollections(cols);
    setDocuments(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- drag & drop ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
      }
      fetchData();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }, [fetchData]);

  // --- filtering ---
  const filtered = documents.filter((doc) => {
    const q = search.toLowerCase();
    const matchSearch = !search || doc.title.toLowerCase().includes(q) || (doc.content && doc.content.toLowerCase().includes(q));
    if (!matchSearch) return false;
    if (activeFilter === "all") return true;
    if (activeFilter === "uncategorized") return doc.collections.length === 0;
    return doc.collections.includes(activeFilter as number);
  });

  // --- handlers ---
  async function deleteDocument(id: number) {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setMenuDocId(null);
      fetchData();
    } catch (err) {
      console.error("Delete document error:", err);
    }
  }

  async function deleteCollection(id: number) {
    if (!confirm("Eliminare questa collezione? I documenti non verranno cancellati.")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (activeFilter === id) setActiveFilter("all");
    fetchData();
  }

  async function moveDocToCollection(docId: number, collectionId: number | null) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    // remove from all current collections
    for (const cid of doc.collections) {
      await fetch(`/api/collections/${cid}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      });
    }

    // add to new collection if specified
    if (collectionId !== null) {
      await fetch(`/api/collections/${collectionId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      });
    }

    setMenuDocId(null);
    fetchData();
  }

  async function addDocToCollection(docId: number, collectionId: number) {
    await fetch(`/api/collections/${collectionId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: docId }),
    });
    setMenuDocId(null);
    fetchData();
  }

  function getFileIcon(fileType: string | null) {
    if (!fileType) return File;
    if (fileType.includes("audio")) return FileAudio;
    if (fileType.includes("pdf")) return FileText;
    return FileText;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // --- render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-secondary)" }}>Caricamento...</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full gap-6 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ---- DRAG & DROP OVERLAY ---- */}
      {dragging && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl transition-all"
          style={{
            background: "rgba(10, 10, 14, 0.85)",
            border: "3px dashed var(--accent)",
            backdropFilter: "blur(4px)",
          }}
        >
          <Upload className="w-16 h-16 mb-4" style={{ color: "var(--accent)" }} />
          <p className="text-xl font-display font-bold" style={{ color: "var(--accent)" }}>
            Rilascia per caricare
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            I file verranno aggiunti alla libreria
          </p>
        </div>
      )}

      {/* ---- UPLOAD IN PROGRESS ---- */}
      {uploading && (
        <div
          className="absolute top-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
          }}
        >
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>Caricamento in corso...</span>
        </div>
      )}

      {/* ---- LEFT SIDEBAR ---- */}
      <div
        className="w-64 flex-shrink-0 rounded-2xl p-4 flex flex-col gap-1"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Collezioni
          </h2>
          <button
            onClick={() => setShowNewModal(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--accent)" }}
            title="Nuova collezione"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* All docs */}
        <SidebarItem
          label="Tutti i documenti"
          count={documents.length}
          color="var(--accent)"
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
          icon={<FolderOpen className="w-4 h-4" />}
        />

        {/* Uncategorized */}
        <SidebarItem
          label="Senza collezione"
          count={documents.filter((d) => d.collections.length === 0).length}
          color="var(--text-secondary)"
          active={activeFilter === "uncategorized"}
          onClick={() => setActiveFilter("uncategorized")}
          icon={<File className="w-4 h-4" />}
        />

        {collections.length > 0 && (
          <div
            className="my-2 border-t"
            style={{ borderColor: "var(--border)" }}
          />
        )}

        {/* Collections */}
        {collections.map((col) => (
          <div key={col.id} className="group relative">
            <SidebarItem
              label={col.name}
              count={col.doc_count}
              color={col.color}
              active={activeFilter === col.id}
              onClick={() => setActiveFilter(col.id)}
              icon={
                <span
                  className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                  style={{ background: col.color }}
                />
              }
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingCollection(col); setShowNewModal(true); }}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: "var(--text-secondary)" }}
                title="Modifica"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: "var(--danger, #c45c4a)" }}
                title="Elimina"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ---- MAIN AREA ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* top bar */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-secondary)" }} />
            <input
              type="text"
              placeholder="Cerca nella libreria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }}
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
            )}
          </div>
          <Button onClick={() => { setEditingCollection(null); setShowNewModal(true); }}>
            <FolderPlus className="w-4 h-4" />
            Nuova collezione
          </Button>
        </div>

        {/* header */}
        <div className="mb-4">
          <h1 className="text-xl font-display font-bold" style={{ color: "var(--text-primary)" }}>
            {activeFilter === "all"
              ? "Tutti i documenti"
              : activeFilter === "uncategorized"
                ? "Senza collezione"
                : collections.find((c) => c.id === activeFilter)?.name || "Documenti"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {filtered.length} document{filtered.length !== 1 ? "i" : "o"}
          </p>
        </div>

        {/* grid */}
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="w-12 h-12 mb-4" style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {search ? "Nessun documento trovato" : "Nessun documento in questa vista"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-6">
            {filtered.map((doc) => {
              const Icon = getFileIcon(doc.file_type);
              const docCollections = collections.filter((c) =>
                doc.collections.includes(c.id)
              );
              return (
                <Card key={doc.id} variant="interactive" className="relative group">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--bg-hover)", color: "var(--accent)" }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {doc.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {doc.file_type || "testo"} &middot; {formatDate(doc.updated_at)}
                      </p>
                    </div>

                    {/* menu button */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuDocId(menuDocId === doc.id ? null : doc.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuDocId === doc.id && (
                        <DocMenu
                          doc={doc}
                          collections={collections}
                          onMove={moveDocToCollection}
                          onAdd={addDocToCollection}
                          onDelete={deleteDocument}
                          onClose={() => setMenuDocId(null)}
                        />
                      )}
                    </div>
                  </div>

                  {/* collection badges */}
                  {docCollections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {docCollections.map((col) => (
                        <span
                          key={col.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            background: `${col.color}20`,
                            color: col.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: col.color }}
                          />
                          {col.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- MODAL ---- */}
      {showNewModal && (
        <CollectionModal
          existing={editingCollection}
          onClose={() => { setShowNewModal(false); setEditingCollection(null); }}
          onSaved={() => { setShowNewModal(false); setEditingCollection(null); fetchData(); }}
        />
      )}
    </div>
  );
}

// ---------- SidebarItem ----------
function SidebarItem({
  label,
  count,
  color,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left"
      style={{
        background: active ? `${color}15` : "transparent",
        borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
      }}
    >
      <span style={{ color: active ? color : "var(--text-secondary)" }}>{icon}</span>
      <span
        className="flex-1 truncate font-medium"
        style={{ color: active ? color : "var(--text-primary)" }}
      >
        {label}
      </span>
      <span
        className="text-xs tabular-nums"
        style={{ color: "var(--text-secondary)" }}
      >
        {count}
      </span>
    </button>
  );
}

// ---------- DocMenu (dropdown) ----------
function DocMenu({
  doc,
  collections,
  onMove,
  onAdd,
  onDelete,
  onClose,
}: {
  doc: DocWithCollections;
  collections: Collection[];
  onMove: (docId: number, collectionId: number | null) => void;
  onAdd: (docId: number, collectionId: number) => void;
  onDelete: (docId: number) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-8 z-50 w-56 rounded-xl py-2 shadow-xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* DELETE DOCUMENT */}
        <button
          onClick={() => {
            if (confirm("Eliminare questo documento? L'azione è irreversibile.")) {
              onDelete(doc.id);
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-red-500/10"
          style={{ color: "var(--danger, #ef4444)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Elimina documento
        </button>

        <div className="my-1" style={{ borderTop: "1px solid var(--border)" }} />

        <p
          className="px-3 py-1 text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          Sposta in collezione
        </p>
        {/* Remove from all */}
        <button
          onClick={() => onMove(doc.id, null)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <X className="w-3.5 h-3.5" />
          Nessuna collezione
        </button>
        {collections.map((col) => {
          const isIn = doc.collections.includes(col.id);
          return (
            <button
              key={col.id}
              onClick={() => isIn ? onMove(doc.id, null) : onAdd(doc.id, col.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: col.color }}
              />
              <span className="flex-1 text-left truncate">{col.name}</span>
              {isIn && <Check className="w-3.5 h-3.5" style={{ color: col.color }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------- CollectionModal ----------
function CollectionModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: Collection | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [color, setColor] = useState(existing?.color || PRESET_COLORS[0].value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    if (existing) {
      await fetch(`/api/collections/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
    } else {
      await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      {/* dialog */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <h2
          className="text-lg font-display font-bold mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          {existing ? "Modifica collezione" : "Nuova collezione"}
        </h2>

        {/* name */}
        <label className="block mb-4">
          <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Nome
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Diritto Penale"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
        </label>

        {/* description */}
        <label className="block mb-4">
          <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
            Descrizione (opzionale)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descrizione..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </label>

        {/* color picker */}
        <div className="mb-6">
          <span className="text-xs font-medium mb-2 block" style={{ color: "var(--text-secondary)" }}>
            Colore
          </span>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: c.value,
                  boxShadow: color === c.value ? `0 0 0 3px var(--bg-secondary), 0 0 0 5px ${c.value}` : "none",
                }}
                title={c.name}
              >
                {color === c.value && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
            {existing ? "Salva" : "Crea"}
          </Button>
        </div>
      </div>
    </div>
  );
}
