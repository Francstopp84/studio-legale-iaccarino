"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  BookOpen,
  Upload,
  Search,
  X,
  Trash2,
  FileText,
  ChevronLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ---------- types ----------
interface LibraryBook {
  id: number;
  title: string;
  file_path: string | null;
  file_type: string | null;
  category: string;
  total_pages: number;
  total_chunks: number;
  chunk_count: number;
  created_at: string;
}

interface LibraryChunk {
  id: number;
  book_id: number;
  chunk_index: number;
  content: string;
  heading: string | null;
}

interface SearchResult {
  id: number;
  chunk_index: number;
  content: string;
  heading: string | null;
  book_id: number;
  book_title: string;
  category: string;
}

// ---------- constants ----------
const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "penale", label: "Penale", color: "#c45c4a" },
  { value: "civile", label: "Civile", color: "#5b8bd4" },
  { value: "procedura_penale", label: "Proc. Penale", color: "#9b6bc4" },
  { value: "procedura_civile", label: "Proc. Civile", color: "#4ab8a8" },
  { value: "altro", label: "Altro", color: "#d4a853" },
];

function getCategoryInfo(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) || CATEGORIES[4];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------- component ----------
export default function LibraryPage() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedBook, setSelectedBook] = useState<
    (LibraryBook & { chunks: LibraryChunk[] }) | null
  >(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- fetch books ---
  const fetchBooks = useCallback(async () => {
    const res = await fetch("/api/library");
    const data = await res.json();
    setBooks(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // --- search with debounce ---
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!search || search.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const catParam =
        activeCategory !== "all" ? `&category=${activeCategory}` : "";
      const res = await fetch(
        `/api/library/search?q=${encodeURIComponent(search)}${catParam}`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
      setSearching(false);
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, activeCategory]);

  // --- view book ---
  async function viewBook(bookId: number) {
    const res = await fetch(`/api/library/${bookId}`);
    const data = await res.json();
    setSelectedBook(data);
  }

  // --- delete book ---
  async function deleteBook(bookId: number) {
    if (!confirm("Eliminare questo libro dalla biblioteca?")) return;
    await fetch(`/api/library/${bookId}`, { method: "DELETE" });
    if (selectedBook?.id === bookId) setSelectedBook(null);
    fetchBooks();
  }

  // --- filter books ---
  const filteredBooks = books.filter((b) => {
    if (activeCategory !== "all" && b.category !== activeCategory) return false;
    if (search && !searchResults) {
      return b.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  // --- render: book detail view ---
  if (selectedBook) {
    const catInfo = getCategoryInfo(selectedBook.category);
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedBook(null)}
          className="flex items-center gap-2 mb-6 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Torna alla biblioteca
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {selectedBook.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: `${catInfo.color}20`,
                  color: catInfo.color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: catInfo.color }}
                />
                {catInfo.label}
              </span>
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {selectedBook.chunks?.length || 0} sezioni
              </span>
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => deleteBook(selectedBook.id)}
          >
            <Trash2 className="w-4 h-4" />
            Elimina
          </Button>
        </div>

        <div className="space-y-4">
          {selectedBook.chunks?.map((chunk) => (
            <Card key={chunk.id}>
              {chunk.heading && (
                <h3
                  className="font-semibold text-sm mb-2"
                  style={{ color: "var(--accent)" }}
                >
                  {chunk.heading}
                </h3>
              )}
              <p
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {chunk.content}
              </p>
              <p
                className="text-[10px] mt-2"
                style={{ color: "var(--text-secondary)" }}
              >
                Sezione {chunk.chunk_index + 1}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- render: loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--text-secondary)" }}>Caricamento...</p>
      </div>
    );
  }

  // --- render: main view ---
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-display font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Biblioteca Giuridica
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Codici, testi e riferimenti normativi permanenti
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="w-4 h-4" />
          Aggiungi libro
        </Button>
      </div>

      {/* Search bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <Search
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "var(--text-secondary)" }}
        />
        <input
          type="text"
          placeholder="Cerca nei testi della biblioteca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--text-primary)" }}
        />
        {searching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />}
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setSearchResults(null);
            }}
          >
            <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory("all")}
          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{
            background:
              activeCategory === "all"
                ? "var(--accent)20"
                : "var(--bg-card)",
            color:
              activeCategory === "all"
                ? "var(--accent)"
                : "var(--text-secondary)",
            border: `1px solid ${activeCategory === "all" ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          Tutti ({books.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = books.filter((b) => b.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background:
                  activeCategory === cat.value
                    ? `${cat.color}20`
                    : "var(--bg-card)",
                color:
                  activeCategory === cat.value
                    ? cat.color
                    : "var(--text-secondary)",
                border: `1px solid ${activeCategory === cat.value ? cat.color : "var(--border)"}`,
              }}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search results */}
      {searchResults !== null ? (
        <div>
          <p
            className="text-sm mb-4 font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {searchResults.length} risultat{searchResults.length !== 1 ? "i" : "o"}{" "}
            per &ldquo;{search}&rdquo;
          </p>
          {searchResults.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <Search
                className="w-10 h-10 mb-3"
                style={{ color: "var(--text-secondary)", opacity: 0.4 }}
              />
              <p
                className="text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Nessun risultato trovato
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {searchResults.map((r) => {
                const catInfo = getCategoryInfo(r.category);
                return (
                  <Card
                    key={r.id}
                    variant="interactive"
                    onClick={() => viewBook(r.book_id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: `${catInfo.color}20`,
                          color: catInfo.color,
                        }}
                      >
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p
                            className="font-medium text-sm"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {r.book_title}
                          </p>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: `${catInfo.color}15`,
                              color: catInfo.color,
                            }}
                          >
                            {catInfo.label}
                          </span>
                        </div>
                        {r.heading && (
                          <p
                            className="text-xs font-medium mb-1"
                            style={{ color: "var(--accent)" }}
                          >
                            {r.heading}
                          </p>
                        )}
                        <p
                          className="text-xs line-clamp-3 leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {highlightSearch(r.content, search)}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Books grid */
        <>
          {filteredBooks.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16">
              <BookOpen
                className="w-12 h-12 mb-4"
                style={{ color: "var(--text-secondary)", opacity: 0.4 }}
              />
              <p
                className="text-sm mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {books.length === 0
                  ? "La biblioteca e' vuota"
                  : "Nessun libro in questa categoria"}
              </p>
              {books.length === 0 && (
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Aggiungi codici, testi e riferimenti normativi
                </p>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBooks.map((book) => {
                const catInfo = getCategoryInfo(book.category);
                return (
                  <Card
                    key={book.id}
                    variant="interactive"
                    className="group relative"
                    onClick={() => viewBook(book.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${catInfo.color}15`,
                          color: catInfo.color,
                        }}
                      >
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-sm truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {book.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              background: `${catInfo.color}20`,
                              color: catInfo.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: catInfo.color }}
                            />
                            {catInfo.label}
                          </span>
                          <span
                            className="text-[11px]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {book.total_chunks || book.chunk_count} sezioni
                          </span>
                        </div>
                        <p
                          className="text-[11px] mt-1.5"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {book.file_type || "testo"} &middot;{" "}
                          {formatDate(book.created_at)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBook(book.id);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: "var(--bg-hover)",
                          color: "var(--danger, #c45c4a)",
                        }}
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            fetchBooks();
          }}
        />
      )}
    </div>
  );
}

// ---------- UploadModal ----------
function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("altro");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    setError("");

    if (!title.trim()) {
      setError("Inserisci un titolo");
      return;
    }

    setSaving(true);
    try {
      let res: Response;

      if (mode === "file") {
        if (!file) {
          setError("Seleziona un file");
          setSaving(false);
          return;
        }
        // Send file as FormData — server extracts text from PDF/DOCX
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("category", category);
        formData.append("file", file);
        res = await fetch("/api/library", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!textContent.trim()) {
          setError("Inserisci il contenuto");
          setSaving(false);
          return;
        }
        if (textContent.length < 50) {
          setError("Contenuto troppo corto (min 50 caratteri)");
          setSaving(false);
          return;
        }
        res = await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            content: textContent,
            category,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nel salvataggio");
      }

      const data = await res.json();
      if (data.courses_created > 0) {
        alert(`Libro salvato! ${data.courses_created} corsi creati automaticamente.\nLe lezioni verranno generate in background.`);
      }

      onUploaded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <h2
          className="text-lg font-display font-bold mb-5"
          style={{ color: "var(--text-primary)" }}
        >
          Aggiungi alla Biblioteca
        </h2>

        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm"
            style={{
              background: "rgba(196,92,74,0.15)",
              color: "var(--danger, #c45c4a)",
            }}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Title */}
        <label className="block mb-4">
          <span
            className="text-xs font-medium mb-1 block"
            style={{ color: "var(--text-secondary)" }}
          >
            Titolo
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="es. Codice Penale, Manuale di Diritto Civile..."
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
        </label>

        {/* Category */}
        <label className="block mb-4">
          <span
            className="text-xs font-medium mb-1 block"
            style={{ color: "var(--text-secondary)" }}
          >
            Categoria
          </span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background:
                    category === cat.value
                      ? `${cat.color}25`
                      : "var(--bg-card)",
                  color:
                    category === cat.value
                      ? cat.color
                      : "var(--text-secondary)",
                  border: `1px solid ${category === cat.value ? cat.color : "var(--border)"}`,
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </label>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("file")}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background:
                mode === "file" ? "var(--accent)15" : "var(--bg-card)",
              color:
                mode === "file" ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${mode === "file" ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Carica file
          </button>
          <button
            onClick={() => setMode("text")}
            className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background:
                mode === "text" ? "var(--accent)15" : "var(--bg-card)",
              color:
                mode === "text" ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${mode === "text" ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Incolla testo
          </button>
        </div>

        {/* File upload or text area */}
        {mode === "file" ? (
          <div className="mb-6">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf,.docx,.doc"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!title) {
                    setTitle(f.name.replace(/\.[^/.]+$/, ""));
                  }
                }
              }}
              className="hidden"
            />
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center py-10 rounded-xl cursor-pointer transition-all hover:border-[var(--accent)]"
              style={{
                background: "var(--bg-card)",
                border: "2px dashed var(--border)",
              }}
            >
              {file ? (
                <>
                  <FileText
                    className="w-8 h-8 mb-2"
                    style={{ color: "var(--accent)" }}
                  />
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {file.name}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(file.size / 1024 / 1024).toFixed(1)} MB — clicca per
                    cambiare
                  </p>
                </>
              ) : (
                <>
                  <Upload
                    className="w-8 h-8 mb-2"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Clicca per selezionare un file
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    TXT, PDF, DOCX
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Incolla qui il testo del codice o del libro..."
              rows={10}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {textContent.length.toLocaleString()} caratteri
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            onClick={handleUpload}
            loading={saving}
            disabled={!title.trim()}
          >
            Salva in biblioteca
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- highlight helper ----------
function highlightSearch(text: string, query: string): string {
  // Just return truncated text — highlighting would need dangerouslySetInnerHTML
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 300);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + query.length + 200);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}
