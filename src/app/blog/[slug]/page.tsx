"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getAllPosts, formatDate } from "@/lib/blog-data";
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  Share2,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
} from "lucide-react";

const CATEGORIES_COLORS: Record<string, string> = {
  "Diritto Penale": "var(--danger)",
  "Diritto Tributario": "var(--phase-understand)",
  "Diritto Civile": "var(--phase-acquire)",
};

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join(" ");
      // Process bold text
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p
          key={key++}
          className="text-sm leading-relaxed mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          {parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={i} style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      elements.push(
        <h2
          key={key++}
          className="font-display text-lg font-bold mt-8 mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      elements.push(
        <h3
          key={key++}
          className="font-display text-base font-bold mt-6 mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s/.test(trimmed)) {
      flushParagraph();
      const listText = trimmed.replace(/^\d+\.\s/, "");
      const parts = listText.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <div
          key={key++}
          className="flex gap-3 mb-2 ml-4 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 600, flexShrink: 0 }}>
            {trimmed.match(/^\d+/)![0]}.
          </span>
          <span>
            {parts.map((part, i) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={i} style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </span>
        </div>
      );
      continue;
    }

    // Unordered list items
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      const listText = trimmed.slice(2);
      const parts = listText.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <div
          key={key++}
          className="flex gap-3 mb-2 ml-4 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <span
            className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--accent)" }}
          />
          <span>
            {parts.map((part, i) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={i} style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </span>
        </div>
      );
      continue;
    }

    // Italic items (used for sub-items like *Mancata comparizione*)
    if (trimmed.startsWith("*") && !trimmed.startsWith("**")) {
      currentParagraph.push(trimmed);
      continue;
    }

    currentParagraph.push(trimmed);
  }

  flushParagraph();
  return elements;
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = getPostBySlug(slug);
  const allPosts = getAllPosts();

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <h1
          className="font-display text-2xl font-bold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          Articolo non trovato
        </h1>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          L'articolo richiesto non esiste o e stato rimosso.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ color: "var(--accent)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al blog
        </Link>
      </div>
    );
  }

  const catColor = CATEGORIES_COLORS[post.category] || "var(--accent)";

  // Related posts (other posts from the collection, excluding current)
  const relatedPosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm font-medium transition-all hover:gap-3"
        style={{ color: "var(--accent)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Tutti gli articoli
      </Link>

      {/* Article header */}
      <header className="space-y-4">
        <span
          className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{ background: `${catColor}15`, color: catColor }}
        >
          {post.category}
        </span>

        <h1
          className="font-display text-3xl font-bold leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {post.title}
        </h1>

        <div
          className="flex flex-wrap items-center gap-4 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {post.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(post.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {post.readingTime} min di lettura
          </span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 ml-auto transition-colors hover:text-[var(--accent)]"
            title="Condividi"
          >
            <Share2 className="w-3.5 h-3.5" />
            Condividi
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "var(--bg-hover)",
                color: "var(--text-secondary)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* Article content */}
      <article className="space-y-0">{renderContent(post.content)}</article>

      {/* Divider */}
      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* CTA Box */}
      <section
        className="card-texture"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--accent)",
          borderRadius: "16px",
          padding: "2rem",
          boxShadow: "0 0 30px var(--accent-glow)",
        }}
      >
        <h3
          className="font-display text-xl font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Richiedi una consulenza
        </h3>
        <p
          className="text-sm mb-5 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Hai una situazione simile a quella descritta in questo articolo?
          L'Avv. Francesco Iaccarino offre consulenze personalizzate per
          valutare il tuo caso e individuare la strategia difensiva piu
          efficace.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <a
            href="tel:+393335684659"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, var(--accent), #b8912e)",
              color: "#1a1814",
            }}
          >
            <Phone className="w-4 h-4" />
            Chiama ora: 333 568 4659
          </a>
          <a
            href="mailto:studiolegalefrancescoiaccarino@outlook.com"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            <Mail className="w-4 h-4" />
            Scrivi un'email
          </a>
        </div>

        <div
          className="flex flex-wrap items-center gap-4 text-xs pt-4 border-t"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            Via Toledo 205, 80132 Napoli
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <a
              href="https://www.instagram.com/avv.iaccarino.napoli/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "var(--bg-hover)" }}
              title="Instagram"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://www.facebook.com/avv.iaccarino.napoli"
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "var(--bg-hover)" }}
              title="Facebook"
            >
              <Facebook className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://www.tiktok.com/@avv.iaccarino.napoli"
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "var(--bg-hover)" }}
              title="TikTok"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 004.76 1.5V7.12a4.83 4.83 0 01-1-.43z" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Author Box */}
      <section
        className="card-texture flex items-start gap-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "1.5rem",
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: "var(--accent)20",
            color: "var(--accent)",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: "1.1rem",
          }}
        >
          FI
        </div>
        <div>
          <p
            className="font-display font-bold text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            Avv. Francesco Iaccarino
          </p>
          <p className="text-xs mb-2" style={{ color: "var(--accent)" }}>
            Foro di Napoli
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Avvocato penalista e civilista con studio in Via Toledo 205, Napoli.
            Specializzato in diritto penale, diritto civile e contenzioso tributario.
          </p>
        </div>
      </section>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="space-y-4">
          <h3
            className="font-display text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Articoli correlati
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedPosts.map((related) => {
              const relCatColor =
                CATEGORIES_COLORS[related.category] || "var(--accent)";
              return (
                <Link key={related.slug} href={`/blog/${related.slug}`}>
                  <div
                    className="card-texture transition-all cursor-pointer group"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "16px",
                      padding: "1.25rem",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "var(--border)";
                    }}
                  >
                    <span
                      className="inline-block text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3"
                      style={{
                        background: `${relCatColor}15`,
                        color: relCatColor,
                      }}
                    >
                      {related.category}
                    </span>
                    <h4
                      className="font-display text-sm font-bold leading-snug mb-2 group-hover:text-[var(--accent)] transition-colors"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {related.title}
                    </h4>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDate(related.date)} - {related.readingTime} min
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
