"use client";

import Link from "next/link";
import { getAllPosts, formatDate } from "@/lib/blog-data";
import { Clock, ArrowRight, Scale, Instagram, Facebook } from "lucide-react";

const CATEGORIES_COLORS: Record<string, string> = {
  "Diritto Penale": "var(--danger)",
  "Diritto Tributario": "var(--phase-understand)",
  "Diritto Civile": "var(--phase-acquire)",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Hero */}
      <section className="space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--accent)20" }}
          >
            <Scale className="w-6 h-6" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              Blog
            </p>
            <h1
              className="text-2xl font-display font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Approfondimenti Giuridici
            </h1>
          </div>
        </div>
        <p className="text-sm ml-16" style={{ color: "var(--text-secondary)" }}>
          Articoli di analisi giurisprudenziale e orientamenti recenti, a cura
          dell'Avv. Francesco Iaccarino del Foro di Napoli.
        </p>
      </section>

      {/* Posts Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          const catColor =
            CATEGORIES_COLORS[post.category] || "var(--accent)";
          return (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <article
                className="card-texture transition-all cursor-pointer group h-full flex flex-col"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "1.5rem",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px var(--accent-glow)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* Category badge */}
                <span
                  className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-4 self-start"
                  style={{
                    background: `${catColor}15`,
                    color: catColor,
                  }}
                >
                  {post.category}
                </span>

                {/* Title */}
                <h2
                  className="font-display text-lg font-bold leading-tight mb-3 group-hover:text-[var(--accent)] transition-colors"
                  style={{ color: "var(--text-primary)" }}
                >
                  {post.title}
                </h2>

                {/* Excerpt */}
                <p
                  className="text-sm leading-relaxed mb-4 flex-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {post.excerpt}
                </p>

                {/* Meta */}
                <div
                  className="flex items-center justify-between pt-4 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{formatDate(post.date)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readingTime} min
                    </span>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
              </article>
            </Link>
          );
        })}
      </section>

      {/* CTA Section */}
      <section
        className="card-texture"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "2.5rem",
          textAlign: "center",
        }}
      >
        <h2
          className="font-display text-xl font-bold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Hai bisogno di assistenza legale?
        </h2>
        <p
          className="text-sm mb-6 max-w-lg mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Lo Studio Legale dell'Avv. Francesco Iaccarino offre consulenze
          personalizzate in diritto penale, civile e tributario. Contattaci per
          una valutazione del tuo caso.
        </p>
        <a
          href="tel:+393335684659"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, var(--accent), #b8912e)",
            color: "#1a1814",
          }}
        >
          Richiedi una consulenza
        </a>

        {/* Social Links */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <a
            href="https://www.instagram.com/avv.iaccarino.napoli/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          <a
            href="https://www.facebook.com/avv.iaccarino.napoli"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="Facebook"
          >
            <Facebook className="w-5 h-5" />
          </a>
          <a
            href="https://www.tiktok.com/@avv.iaccarino.napoli"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            title="TikTok"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 004.76 1.5V7.12a4.83 4.83 0 01-1-.43z" />
            </svg>
          </a>
        </div>
      </section>

      {/* Google Reviews / Testimonials Placeholder */}
      <section className="space-y-6">
        <h2
          className="font-display text-xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Cosa dicono i nostri clienti
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Marco R.",
              rating: 5,
              text: "Professionale e disponibile. L'Avv. Iaccarino ha seguito il mio caso con competenza e dedizione, ottenendo un risultato eccellente.",
              date: "2 mesi fa",
            },
            {
              name: "Giulia S.",
              rating: 5,
              text: "Ho avuto bisogno di assistenza per una questione tributaria complessa. Studio serio e preparato, consiglio vivamente.",
              date: "1 mese fa",
            },
            {
              name: "Antonio P.",
              rating: 5,
              text: "Ottima esperienza. Chiarezza nelle spiegazioni, tempi rispettati e risultato positivo. Un punto di riferimento a Napoli.",
              date: "3 settimane fa",
            },
          ].map((review, i) => (
            <div
              key={i}
              className="card-texture"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "1.5rem",
              }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <svg
                    key={j}
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill="var(--accent)"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              {/* Text */}
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                "{review.text}"
              </p>
              {/* Author */}
              <div className="flex items-center justify-between">
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {review.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {review.date}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Google Reviews CTA */}
        <div className="text-center">
          <a
            href="https://g.page/r/studiolegaleiaccarino/review"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Lascia una recensione su Google
          </a>
        </div>
      </section>
    </div>
  );
}
