import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog - Approfondimenti Giuridici | Avv. Iaccarino, Napoli",
  description:
    "Articoli di analisi giurisprudenziale e orientamenti recenti in diritto penale, civile e tributario. A cura dell'Avv. Francesco Iaccarino del Foro di Napoli.",
  openGraph: {
    title: "Blog - Approfondimenti Giuridici | Avv. Iaccarino",
    description:
      "Articoli di analisi giurisprudenziale e orientamenti recenti. Studio Legale Avv. Francesco Iaccarino, Napoli.",
    type: "website",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
