import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type FixMode = "correct" | "analyze" | "full";

async function askLLMLocal(prompt: string): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL_DEFAULT || "llama-3.3-70b-versatile";
  const apiKey = process.env.LLM_API_KEY || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) throw new Error(`LLM errore: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// POST /api/documents/[id]/fix
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { mode?: string } = {};
  try { body = await req.json(); } catch { /* default */ }
  const mode: FixMode = (["correct", "analyze", "full"].includes(body.mode || "") ? body.mode : "full") as FixMode;

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id)) as any;
  if (!doc) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  if (!doc.content?.trim()) return NextResponse.json({ error: "Il documento non ha contenuto" }, { status: 400 });

  try {
    let result = "";

    if (mode === "correct" || mode === "full") {
      // STEP 1: Revisione testuale completa
      result = await stepCorrect(doc.content);
    }

    if (mode === "analyze" || mode === "full") {
      const baseText = result || doc.content;

      // STEP 2: Analisi Q&A
      const qa = await stepAnalyzeQA(baseText);

      // STEP 3: Ricostruzione logica articolata
      const logic = await stepLogicalReconstruction(baseText);

      // Componi output finale
      if (mode === "full") {
        result = `${result}\n\n${"═".repeat(60)}\n\n## ANALISI DEI CONTENUTI — DOMANDE E RISPOSTE\n\n${qa}\n\n${"═".repeat(60)}\n\n## RICOSTRUZIONE LOGICA DEL CONTENUTO\n\n${logic}`;
      } else {
        result = `## ANALISI DEI CONTENUTI — DOMANDE E RISPOSTE\n\n${qa}\n\n${"═".repeat(60)}\n\n## RICOSTRUZIONE LOGICA DEL CONTENUTO\n\n${logic}`;
      }
    }

    // Save
    db.prepare("UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(result, Number(id));

    return NextResponse.json({
      success: true,
      content: result,
      mode,
      stats: {
        words_before: doc.content.trim().split(/\s+/).length,
        words_after: result.trim().split(/\s+/).length,
      },
    });
  } catch (err: any) {
    console.error("AI fix error:", err);
    return NextResponse.json(
      { error: err.message || "Errore nella correzione AI" },
      { status: 500 }
    );
  }
}

// ── STEP 1: Revisione testuale completa ──
async function stepCorrect(content: string): Promise<string> {
  // Per trascrizioni molto lunghe, dividi in blocchi da ~4000 parole
  const words = content.split(/\s+/);
  const chunkSize = 4000;

  if (words.length <= chunkSize) {
    return await correctChunk(content, 1, 1);
  }

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  // Genera tutti i segmenti IN PARALLELO per velocità
  const corrected = await Promise.all(
    chunks.map((chunk, i) => correctChunk(chunk, i + 1, chunks.length))
  );

  return corrected.join("\n\n");
}

async function correctChunk(chunk: string, num: number, total: number): Promise<string> {
  const prompt = `Sei un trascrittore professionista italiano. Ti viene data una trascrizione automatica da audio (segmento ${num}/${total}).

IL TUO COMPITO È SEMPLICE: riscrivi il testo INTERO correggendo SOLO:
- Errori di riconoscimento vocale (parole storpiate, omofoni sbagliati)
- Punteggiatura mancante o errata
- Errori grammaticali evidenti (concordanze, coniugazioni)
- Maiuscole a inizio frase e nomi propri

REGOLE FERREE:
- OGNI frase dell'originale DEVE apparire nel tuo output
- NON riassumere, NON sintetizzare, NON accorciare
- NON eliminare ripetizioni, esitazioni o digressioni del parlante
- NON aggiungere contenuto che non c'era
- NON aggiungere commenti, note, intestazioni
- Il tuo output deve avere ALMENO lo stesso numero di parole dell'input
- Inizia DIRETTAMENTE col testo corretto, senza preamboli

TRASCRIZIONE DA CORREGGERE:
${chunk}`;

  return await askLLMLocal(prompt);
}

// ── STEP 2: Analisi Q&A ──
async function stepAnalyzeQA(content: string): Promise<string> {
  // Usa i primi 15000 caratteri per contesto (Claude gestisce bene)
  const prompt = `Sei un analista giuridico esperto. Hai appena letto la trascrizione di una lezione/relazione giuridica.

TRASCRIZIONE:
${content.slice(0, 30000)}
${content.length > 30000 ? `\n[... continua per altre ${Math.round((content.length - 30000) / 5)} parole circa ...]` : ""}

COMPITO: Analizza in profondità il contenuto e produci una serie completa di DOMANDE e RISPOSTE che coprano TUTTI i temi trattati.

Per ogni tema/argomento discusso dai relatori:
1. **Cosa hanno detto esattamente?** — Riporta le tesi sostenute
2. **Perché la questione è stata risolta così?** — Spiega il ragionamento giuridico sottostante
3. **Quali sono le implicazioni pratiche?** — Cosa significa per la pratica forense
4. **Quali riferimenti normativi/giurisprudenziali emergono?** — Norme, articoli, sentenze citate

FORMATO: Per ogni argomento scrivi:
**D:** [domanda precisa]
**R:** [risposta articolata e completa, 100-300 parole]

Devi produrre ALMENO 15-20 coppie Q&A. Copri TUTTO il contenuto, non solo i punti principali.
Non inventare nulla che non sia nel testo. Sii fedele a ciò che i relatori hanno effettivamente detto.`;

  return await askLLMLocal(prompt);
}

// ── STEP 3: Ricostruzione logica articolata ──
async function stepLogicalReconstruction(content: string): Promise<string> {
  const prompt = `Sei un giurista italiano di altissimo livello. Hai ascoltato una lezione/relazione giuridica.

TRASCRIZIONE:
${content.slice(0, 30000)}
${content.length > 30000 ? `\n[... continua per altre ${Math.round((content.length - 30000) / 5)} parole circa ...]` : ""}

COMPITO: Produci una RICOSTRUZIONE LOGICA COMPLETA E ARTICOLATA di tutto il contenuto.

Questo NON è un riassunto. È una rielaborazione organica che:
1. Ricostruisce il filo logico dell'intero discorso
2. Spiega PERCHÉ ogni questione è stata affrontata in quel modo
3. Collega i vari argomenti tra loro mostrando il quadro d'insieme
4. Usa terminologia giuridica precisa e aggiornata
5. Evidenzia i passaggi argomentativi chiave dei relatori
6. Cattura la ratio delle soluzioni proposte

REQUISITI:
- ALMENO 2000-3000 parole — questo deve essere un elaborato COMPLETO, non un riassunto
- Struttura in sezioni numerate con titoli
- Per ogni sezione: il tema, il ragionamento dei relatori, la conclusione, le implicazioni
- Linguaggio forense formale ma comprensibile
- NON inventare contenuto che non era nella trascrizione
- Se i relatori hanno fatto esempi pratici, RIPORTALI

Questo elaborato servirà come BASE DI STUDIO per un avvocato che deve padroneggiare la materia.
Scrivi in modo che, leggendolo, si capisca la materia come se si fosse stati presenti alla lezione.`;

  return await askLLMLocal(prompt);
}
