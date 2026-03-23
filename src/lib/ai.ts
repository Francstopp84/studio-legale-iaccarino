import * as path from "path";
import * as fs from "fs";
import db from "@/lib/db";

// === LLM: Gemini (principale) + Ollama locale (fallback offline) ===

interface LLMConfig {
  baseUrl: string;
  modelDefault: string;
  modelReasoning: string;
  apiKey: string;
  temperature: number;
  fallbackEnabled: boolean;
  fallbackBaseUrl: string;
  fallbackModel: string;
}

function getConfig(): LLMConfig {
  return {
    baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    modelDefault: process.env.LLM_MODEL_DEFAULT || "llama-3.3-70b-versatile",
    modelReasoning: process.env.LLM_MODEL_REASONING || "llama-3.3-70b-versatile",
    apiKey: process.env.LLM_API_KEY || "",
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.2"),
    fallbackEnabled: process.env.LLM_FALLBACK_ENABLED === "true",
    fallbackBaseUrl: process.env.LLM_FALLBACK_BASE_URL || "http://localhost:11434/v1",
    fallbackModel: process.env.LLM_FALLBACK_MODEL || "qwen2.5:7b",
  };
}

const SYSTEM_IDENTITY = "Sei l'assistente AI di Avv. Iaccarino Studio, studio legale a Napoli. Rispondi sempre in italiano. Non identificarti mai come Qwen, Llama, ChatGPT o altro — sei il Tutor AI di Avv. Iaccarino Studio.";

// Core: chiama LLM via OpenAI-compatible API (Groq → Ollama fallback)
async function askLLM(
  prompt: string,
  opts?: { mode?: "default" | "reasoning"; systemPrompt?: string; maxTokens?: number; signal?: AbortSignal; model?: string }
): Promise<string> {
  const config = getConfig();
  const model = opts?.model || (opts?.mode === "reasoning" ? config.modelReasoning : config.modelDefault);
  const messages: { role: string; content: string }[] = [];

  // System prompt: usa quello personalizzato o quello di identità default
  messages.push({ role: "system", content: opts?.systemPrompt || SYSTEM_IDENTITY });
  messages.push({ role: "user", content: prompt });

  const body = {
    model,
    messages,
    temperature: config.temperature,
    max_tokens: opts?.maxTokens || 8192,
  };

  // Tentativo 1: LLM principale con retry su 429 (exponential backoff)
  const MAX_RETRIES = 3;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: opts?.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = res.headers.get("retry-after");
        // Cap retry a 5s max — Cerebras chiede 60s ma noi riproviamo subito
        const rawMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000;
        const waitMs = Math.min(rawMs, 5000);
        console.warn(`[LLM] 429 Rate limited — retry ${attempt + 1}/${MAX_RETRIES} tra ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        opts?.signal?.throwIfAborted();
        continue;
      }

      const errText = await res.text().catch(() => "");
      console.error(`[LLM] Errore: ${res.status} ${errText.slice(0, 200)}`);
      break; // Non-429 error, passa al fallback
    } catch (err: any) {
      console.error(`[LLM] Non raggiungibile: ${err.message}`);
      break; // Network error, passa al fallback
    }
  }

  // Tentativo 2: Fallback Ollama locale (offline)
  if (config.fallbackEnabled) {
    console.log("[LLM] Fallback a Ollama locale...");
    try {
      const fallbackBody = { ...body, model: config.fallbackModel };
      const res = await fetch(`${config.fallbackBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
      }
      console.error(`[LLM] Ollama errore: ${res.status}`);
    } catch (err: any) {
      console.error(`[LLM] Ollama fallback fallito: ${err.message}`);
    }
  }

  throw new Error("LLM non disponibile. Controlla la API key Gemini o avvia Ollama per il fallback offline.");
}

// Alias backward-compatible
async function askClaude(prompt: string, _model?: string, maxTokens?: number, signal?: AbortSignal): Promise<string> {
  return askLLM(prompt, { maxTokens, signal });
}

export async function generateFlashcardsAI(
  title: string,
  content: string,
  count: number = 10
): Promise<{ front: string; back: string }[]> {
  const prompt = `Sei un esperto di diritto italiano. Dal seguente documento, genera esattamente ${count} flashcard di studio.

DOCUMENTO: "${title}"
---
${content.slice(0, 6000)}
---

Rispondi SOLO con un array JSON valido, senza markdown, senza backtick, senza spiegazioni.
Formato: [{"front": "domanda chiara e precisa", "back": "risposta completa ma concisa"}]

Le domande devono essere:
- Specifiche e verificabili
- Utili per la preparazione di un esame o per la pratica forense
- Coprire i concetti chiave del documento
- In italiano`;

  const text = await askClaude(prompt);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Risposta AI non valida");
  return JSON.parse(jsonMatch[0]);
}

export async function generateQuizAI(
  title: string,
  content: string,
  count: number = 5
): Promise<
  {
    question: string;
    options: string[];
    correct: number;
    explanation: string;
  }[]
> {
  const prompt = `Sei un esperto di diritto italiano. Dal seguente documento, genera esattamente ${count} domande quiz a risposta multipla.

DOCUMENTO: "${title}"
---
${content.slice(0, 6000)}
---

Rispondi SOLO con un array JSON valido, senza markdown, senza backtick, senza spiegazioni.
Formato: [{"question": "domanda", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "spiegazione della risposta corretta"}]

Dove "correct" e' l'indice (0-3) dell'opzione corretta.

Le domande devono essere:
- Di difficolta' media-alta
- Con opzioni plausibili (non banali)
- Utili per la preparazione forense
- In italiano`;

  const text = await askClaude(prompt);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Risposta AI non valida");
  return JSON.parse(jsonMatch[0]);
}

export async function generateMindmapAI(
  title: string,
  content: string
): Promise<{
  nodes: { id: string; label: string; level: number }[];
  edges: { source: string; target: string }[];
}> {
  const prompt = `Sei un esperto di diritto italiano. Dal seguente documento, genera una mappa concettuale.

DOCUMENTO: "${title}"
---
${content.slice(0, 6000)}
---

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza spiegazioni.
Formato:
{"nodes": [{"id": "root", "label": "Titolo principale", "level": 0}, {"id": "n1", "label": "Concetto 1", "level": 1}, {"id": "n1a", "label": "Sotto-concetto", "level": 2}], "edges": [{"source": "root", "target": "n1"}, {"source": "n1", "target": "n1a"}]}

Regole:
- Un solo nodo root (level 0) col tema principale
- 4-6 nodi level 1 (concetti chiave)
- 2-3 nodi level 2 per ogni level 1 (dettagli)
- ID brevi e univoci
- Label concise (max 8 parole)
- In italiano`;

  const text = await askClaude(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Risposta AI non valida");
  return JSON.parse(jsonMatch[0]);
}

export async function summarizeDocumentAI(
  content: string
): Promise<string> {
  const prompt = `Sei un avvocato italiano esperto. Riassumi il seguente testo in modo chiaro e strutturato, evidenziando i punti giuridici chiave:

${content.slice(0, 8000)}

Scrivi un riassunto di 200-400 parole in italiano, con bullet points per i concetti principali.`;

  return await askClaude(prompt);
}

export async function chatWithDocumentAI(
  documentContent: string,
  userQuestion: string,
  chatHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<string> {
  let context = "";
  if (documentContent) {
    context = `Contesto - documento di studio:
---
${documentContent.slice(0, 6000)}
---

`;
  }

  // Search library for relevant legal references based on the user's question
  const libraryContext = getLibraryContext(userQuestion, 3000);

  const historyText = chatHistory
    .map((m) => `${m.role === "user" ? "UTENTE" : "ASSISTENTE"}: ${m.content}`)
    .join("\n\n");

  const prompt = `Sei un assistente di studio legale AI per l'Avv. Francesco Iaccarino del Foro di Napoli.
Rispondi in italiano, in modo preciso e utile per la pratica forense.${libraryContext ? "\nQuando pertinente, cita i riferimenti normativi dalla biblioteca giuridica." : ""}

${context}${libraryContext}${historyText ? `\nConversazione precedente:\n${historyText}\n\n` : "\n"}UTENTE: ${userQuestion}

Rispondi come ASSISTENTE:`;

  return await askClaude(prompt);
}

export async function extractConceptsAI(title: string, content: string): Promise<{title: string, explanation: string, keywords: string[]}[]> {
  const prompt = `Sei un tutor esperto. Analizza questo materiale didattico e estrai i concetti chiave.

Titolo: ${title}

Contenuto (primi 8000 caratteri):
${content.slice(0, 8000)}

Rispondi SOLO con un array JSON valido. Ogni concetto ha:
- "title": nome breve del concetto (max 50 caratteri)
- "explanation": spiegazione chiara in 2-3 frasi
- "keywords": array di 3-5 parole chiave

Estrai tra 5 e 30 concetti, ordinati dal più semplice al più complesso.
Rispondi SOLO con il JSON array, nessun altro testo.`;

  const text = await askClaude(prompt);
  return parseJsonArray(text);
}

export async function explainConceptAI(concept: string, context: string, level: string = "normale"): Promise<string> {
  const levelInstructions: Record<string, string> = {
    semplice: "Spiega come se avessi 10 anni, con analogie della vita quotidiana.",
    normale: "Spiega in modo chiaro e professionale, con un esempio pratico.",
    approfondito: "Vai in profondità, includi riferimenti normativi e giurisprudenziali se pertinenti.",
  };

  const prompt = `Sei un tutor universitario esperto e paziente. Spiega questo concetto allo studente.

Concetto: ${concept}

Contesto del corso: ${context.slice(0, 3000)}

Livello: ${levelInstructions[level] || levelInstructions.normale}

REGOLE:
- Sii conversazionale, non accademico
- Usa un esempio pratico concreto
- Alla fine, fai UNA domanda allo studente per verificare che abbia capito
- Max 300 parole`;

  return await askClaude(prompt);
}

export async function evaluateArticulationAI(
  concept: string,
  expectedExplanation: string,
  userResponse: string
): Promise<{completeness: number, accuracy: number, terminology: number, feedback: string}> {
  const prompt = `Sei un esaminatore esperto. Valuta la spiegazione dello studente.

CONCETTO: ${concept}

SPIEGAZIONE DI RIFERIMENTO:
${expectedExplanation.slice(0, 2000)}

RISPOSTA DELLO STUDENTE:
${userResponse}

Valuta su 3 assi (0-100 ciascuno):
1. completeness: ha coperto i punti chiave?
2. accuracy: ha detto cose corrette?
3. terminology: ha usato i termini tecnici giusti?

Poi scrivi un feedback costruttivo (max 100 parole): cosa ha fatto bene, cosa ha saltato, suggerimento per migliorare.

Rispondi SOLO con JSON:
{"completeness": N, "accuracy": N, "terminology": N, "feedback": "..."}`;

  const text = await askClaude(prompt);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { completeness: 0, accuracy: 0, terminology: 0, feedback: "Errore nella valutazione" };
  } catch {
    return { completeness: 0, accuracy: 0, terminology: 0, feedback: "Errore nella valutazione" };
  }
}

export async function generateExamQuestionsAI(conceptTitles: string[], count: number): Promise<any[]> {
  const prompt = `Sei un professore che prepara un esame orale. Genera ${count} domande basate su questi concetti:

${conceptTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Per ogni domanda fornisci:
- "question": la domanda (diretta, come in un esame orale)
- "concept": il concetto di riferimento
- "expected_points": array di 3-5 punti chiave che la risposta dovrebbe contenere
- "difficulty": "facile" | "media" | "difficile"

Rispondi SOLO con un JSON array.`;

  const text = await askClaude(prompt);
  return parseJsonArray(text);
}

export async function correctTranscriptionAI(rawTranscript: string): Promise<string> {
  const prompt = `Sei un correttore di trascrizioni professionista italiano. Correggi la seguente trascrizione automatica.

REGOLE TASSATIVE:
- Il testo corretto DEVE avere la STESSA lunghezza (o maggiore) dell'originale
- Correggi errori di riconoscimento vocale (parole sbagliate, omofoni)
- Aggiungi punteggiatura corretta (punti, virgole, punto e virgola)
- Dividi in paragrafi logici (ogni cambio di argomento = nuovo paragrafo)
- Correggi maiuscole/minuscole (nomi propri, inizio frase)
- NON cambiare il contenuto: mantieni ESATTAMENTE il significato originale
- NON aggiungere testo che non c'è nella trascrizione
- NON rimuovere contenuto, solo correggere la forma
- NON riassumere, NON sintetizzare, NON abbreviare — OGNI frase deve restare
- Rispondi SOLO con il testo corretto, nessun commento

TRASCRIZIONE GREZZA (${rawTranscript.length} caratteri — il risultato deve avere almeno lo stesso numero di caratteri):
${rawTranscript}`;

  return askLLM(prompt, { maxTokens: 4096 });
}

export async function tutorChatAI(
  userMessage: string,
  chatHistory: { role: "user" | "assistant"; content: string }[] = [],
  pageContext?: string
): Promise<string> {
  const historyText = chatHistory
    .slice(-10)
    .map(m => `${m.role === "user" ? "UTENTE" : "TUTOR"}: ${m.content}`)
    .join("\n\n");

  const contextBlock = pageContext
    ? `\nCONTESTO ATTUALE DELL'APP:\n${pageContext}\n`
    : '';

  // Search library for relevant references based on user message
  const libraryContext = getLibraryContext(userMessage, 3000);

  const prompt = `Sei il Tutor AI personale dell'Avv. Francesco Iaccarino, studio legale a Napoli.
Rispondi in italiano. Sei un assistente brillante, preciso e proattivo.
Aiuti l'utente passo dopo passo in qualsiasi attivita': studio, organizzazione, scrittura, ragionamento.
Sii conciso ma completo. Se l'utente chiede qualcosa di specifico, dai risposte concrete e azionabili.${libraryContext ? "\nQuando pertinente, cita i riferimenti dalla biblioteca giuridica dello studio." : ""}
${contextBlock}${libraryContext}
${historyText ? `Conversazione precedente:\n${historyText}\n\n` : ''}UTENTE: ${userMessage}

TUTOR:`;

  return await askClaude(prompt);
}

// --- Lesson Generation (legacy — kept for backward compat) ---

export async function generateLessonAI(
  courseTitle: string,
  content: string,
  mode: "semplice" | "tecnico" = "tecnico",
  instructions?: string,
  onProgress?: (progress: { chapter: number; total: number; title: string; phase: string }) => void,
  signal?: AbortSignal
): Promise<{ sections: { title: string; content: string }[] }> {
  return generateManualAI(courseTitle, content, instructions, onProgress, signal);
}

// --- Manual Generation (FAST: single API call) ---

export async function generateManualAI(
  courseTitle: string,
  content: string,
  instructions?: string,
  onProgress?: (progress: { chapter: number; total: number; title: string; phase: string }) => void,
  signal?: AbortSignal
): Promise<{ sections: { title: string; content: string }[] }> {

  // Timeout: 3 minuti max (Cerebras e velocissimo, multi-call completera in ~30-60s)
  const timeoutSignal = AbortSignal.timeout(180_000);
  signal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const startTime = Date.now();
  const materialSlice = content.slice(0, 50000);
  const instructionBlock = instructions
    ? `\nISTRUZIONI SPECIFICHE DELL'UTENTE (PRIORITA MASSIMA): ${instructions}\n`
    : "";

  const MODEL = "qwen-3-235b-a22b-instruct-2507";

  // === STEP 1: Genera indice capitoli ===
  onProgress?.({ chapter: 0, total: 0, title: "Generazione indice capitoli...", phase: "outline" });
  console.log(`[MANUAL] Step 1: outline for "${courseTitle}"...`);

  const outlinePrompt = `Sei un professore universitario di diritto. Genera l'INDICE di un manuale didattico basato sul materiale.
${instructionBlock}
TITOLO: ${courseTitle}

MATERIALE (estratto):
${materialSlice.slice(0, 15000)}

Genera un indice con 8 capitoli. Ogni capitolo ha un titolo e 3-4 sottosezioni.
L'ultimo capitolo DEVE essere "Esempi pratici e casi concreti".

Rispondi SOLO con JSON valido:
{"chapters": [{"title": "Titolo capitolo", "subtopics": ["Sottosezione 1", "Sottosezione 2"]}]}`;

  const outlineText = await askLLM(outlinePrompt, { maxTokens: 1024, signal, model: MODEL });

  let chapters: { title: string; subtopics: string[] }[] = [];
  try {
    const match = outlineText.match(/\{[\s\S]*\}/);
    if (match) chapters = JSON.parse(match[0]).chapters || [];
  } catch { /* fallback below */ }

  if (chapters.length < 3) {
    chapters = Array.from({ length: 8 }, (_, i) => ({
      title: `Capitolo ${i + 1}`,
      subtopics: ["Principi generali", "Fondamenti normativi", "Analisi e implicazioni", "Profili applicativi"],
    }));
  }

  // Limita a 8 capitoli max
  if (chapters.length > 10) chapters = chapters.slice(0, 10);

  console.log(`[MANUAL] Outline: ${chapters.length} chapters. Generating one by one...`);

  // === STEP 2: Genera ogni capitolo UNO ALLA VOLTA (Cerebras e cosi veloce che non serve parallelizzare) ===
  const chapterSize = Math.ceil(materialSlice.length / chapters.length);
  const sections: { title: string; content: string }[] = [];

  for (let i = 0; i < chapters.length; i++) {
    signal?.throwIfAborted();
    const ch = chapters[i];

    // Delay tra chiamate per evitare 429 rate limit (Cerebras free tier ~30 RPM)
    if (i > 0) await new Promise(r => setTimeout(r, 2500));

    onProgress?.({ chapter: i + 1, total: chapters.length, title: ch.title, phase: "chapter" });

    const start = Math.max(0, i * chapterSize - 1000);
    const end = Math.min(materialSlice.length, (i + 1) * chapterSize + 1000);
    const chapterMaterial = materialSlice.slice(start, end);
    const subtopicList = ch.subtopics.map((s, j) => `${i + 1}.${j + 1}. ${s}`).join("\n");

    const prompt = `Sei un professore universitario esperto. Scrivi il CAPITOLO ${i + 1} COMPLETO di un manuale didattico.
${instructionBlock}
MANUALE: ${courseTitle}
CAPITOLO ${i + 1}: ${ch.title}

SOTTOSEZIONI DA SCRIVERE:
${subtopicList}

MATERIALE DI RIFERIMENTO:
${chapterMaterial}

REGOLE:
1. Scrivi TUTTE le sottosezioni, con titolo in **grassetto** numerato
2. ALMENO 600-800 parole per il capitolo intero
3. Cita articoli di legge, commi, riferimenti normativi DAL MATERIALE
4. Spiega come un professore: concetto → norma → ratio → applicazione pratica
5. NON inventare — usa SOLO il materiale fornito
6. Italiano giuridico preciso ma COMPRENSIBILE
7. Niente introduzioni generiche — vai DRITTO al contenuto
${i === chapters.length - 1 ? "8. Questo e l'ULTIMO capitolo: scrivi 4-5 ESEMPI PRATICI DETTAGLIATI con soluzione ragionata" : ""}

SCRIVI ORA IL CAPITOLO ${i + 1} COMPLETO:`;

    try {
      const text = await askLLM(prompt, { maxTokens: 4096, signal, model: MODEL });
      const wordCount = text.split(/\s+/).length;
      console.log(`[MANUAL] Ch ${i + 1}/${chapters.length} "${ch.title}" done: ~${wordCount} words (${((Date.now() - startTime) / 1000).toFixed(0)}s)`);
      sections.push({
        title: `Capitolo ${i + 1} — ${ch.title}`,
        content: text.trim(),
      });
    } catch (err: any) {
      if (signal?.aborted) throw err;
      console.error(`[MANUAL] Ch ${i + 1} failed: ${err.message}`);
      // Continua con gli altri capitoli
    }
  }

  const totalWords = sections.reduce((sum, s) => sum + s.content.split(/\s+/).length, 0);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`[MANUAL] Complete! ${sections.length} chapters, ${totalWords} words in ${elapsed}s`);

  onProgress?.({ chapter: sections.length, total: sections.length, title: "Completato!", phase: "done" });

  return { sections };
}

// --- Expand a single chapter with deeper content ---

export async function expandChapterAI(
  courseTitle: string,
  chapterTitle: string,
  existingContent: string,
  fullMaterial: string,
  signal?: AbortSignal
): Promise<string> {
  const prompt = `Sei un professore universitario esperto. Espandi e approfondisci questo capitolo.

MANUALE: ${courseTitle}
CAPITOLO: ${chapterTitle}

CONTENUTO ATTUALE (da espandere e approfondire):
${existingContent}

MATERIALE DI RIFERIMENTO:
${fullMaterial.slice(0, 10000)}

COMPITO: Riscrivi il capitolo in modo MOLTO piu approfondito e dettagliato.
- Almeno 1200-1800 parole
- Aggiungi sottosezioni numerate con **titoli in grassetto**
- Analisi critica, riferimenti normativi dettagliati
- Esempi pratici e casistica
- NON inventare — usa SOLO il materiale fornito
- Italiano forense preciso

CAPITOLO ESPANSO:`;

  return await askLLM(prompt, {
    maxTokens: 8192,
    signal: signal || AbortSignal.timeout(90_000),
    model: "qwen-3-235b-a22b-instruct-2507",
  });
}

// Helper: parse JSON array from AI response
function parseJsonArray(text: string): any[] {
  try {
    // Try direct parse first (cleanest case)
    const trimmed = text.trim();
    if (trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
    // Extract array from surrounding text/markdown
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    // Try removing markdown code fences
    const fenced = trimmed.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    if (fenced.startsWith("[")) {
      return JSON.parse(fenced);
    }
    console.error("[parseJsonArray] No JSON array found in response:", trimmed.slice(0, 200));
    return [];
  } catch (err) {
    console.error("[parseJsonArray] JSON parse error:", err, "— response:", text.slice(0, 300));
    return [];
  }
}

// --- OCR via Tesseract (locale, gratuito) ---

import { execSync } from "child_process";

/**
 * OCR locale con Tesseract. Gratuito e offline.
 * Richiede: choco install tesseract (o download da GitHub)
 */
export async function ocrWithVision(imagePath: string): Promise<string> {
  try {
    // Prova Tesseract (disponibile su Windows via choco install tesseract)
    const result = execSync(
      `tesseract "${imagePath}" stdout -l ita+eng --psm 1`,
      { timeout: 60000, encoding: "utf-8", maxBuffer: 4 * 1024 * 1024 }
    );
    if (result.trim()) return result.trim();
  } catch {
    console.error("[OCR] Tesseract non disponibile o errore. Installa con: choco install tesseract");
  }

  return "[NESSUN TESTO RILEVATO — installa Tesseract per OCR locale]";
}

/**
 * Preprocesses an image for better OCR results using sharp.
 * Converts to grayscale, increases contrast, and normalizes.
 * Returns the path to the preprocessed image.
 */
export async function preprocessImageForOCR(inputPath: string): Promise<string> {
  const sharp = (await import("sharp")).default;
  const outputPath = inputPath.replace(/(\.[^.]+)$/, "_ocr_preprocessed.png");

  await sharp(inputPath)
    .grayscale()                    // Convert to grayscale
    .normalize()                    // Auto-level contrast
    .sharpen({ sigma: 1.5 })       // Sharpen text edges
    .modulate({ brightness: 1.1 }) // Slightly brighten
    .png()                          // Output as PNG (lossless)
    .toFile(outputPath);

  return outputPath;
}

/**
 * Full OCR pipeline: preprocess image then extract text with Claude Vision.
 * Best for scanned documents and handwritten text.
 */
export async function ocrFullPipeline(imagePath: string): Promise<{ text: string; preprocessedPath: string }> {
  // Step 1: Preprocess
  const preprocessedPath = await preprocessImageForOCR(imagePath);

  // Step 2: OCR with Claude Vision on preprocessed image
  const text = await ocrWithVision(preprocessedPath);

  return { text, preprocessedPath };
}

/**
 * OCR da PDF scansionato. Usa pdftotext (poppler) o Tesseract come fallback.
 */
export async function ocrPdfWithVision(pdfPath: string): Promise<string> {
  // Tentativo 1: pdftotext (poppler-utils) — veloce per PDF con testo embedded
  try {
    const result = execSync(
      `pdftotext -layout "${pdfPath}" -`,
      { timeout: 60000, encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.trim().length > 50) return result.trim();
  } catch {}

  // Tentativo 2: pandoc
  try {
    const result = execSync(
      `pandoc "${pdfPath}" -t plain`,
      { timeout: 60000, encoding: "utf-8", maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.trim().length > 50) return result.trim();
  } catch {}

  return "[NESSUN TESTO ESTRATTO — PDF probabilmente scansionato. Installa Tesseract e poppler per OCR.]";
}

// --- Library Integration ---

/**
 * Search the legal reference library for relevant content.
 * Returns matching chunks from library_books/library_chunks.
 */
export function searchLibrary(query: string, limit: number = 10): { book_title: string; category: string; heading: string | null; content: string }[] {
  if (!query || query.trim().length < 2) return [];

  const words = query.trim().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return [];

  const conditions = words.map(() => "(lc.content LIKE ? OR lc.heading LIKE ?)");
  const params: any[] = [];
  for (const word of words) {
    const like = `%${word}%`;
    params.push(like, like);
  }
  params.push(limit);

  try {
    const results = db.prepare(
      `SELECT lc.content, lc.heading, lb.title as book_title, lb.category
       FROM library_chunks lc
       JOIN library_books lb ON lb.id = lc.book_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY lb.title, lc.chunk_index
       LIMIT ?`
    ).all(...params) as { book_title: string; category: string; heading: string | null; content: string }[];
    return results;
  } catch {
    return [];
  }
}

/**
 * Build a context string from library search results, suitable for AI prompts.
 */
export function getLibraryContext(courseTitle: string, maxChars: number = 4000): string {
  // Extract key terms from the course title for searching
  const searchTerms = courseTitle
    .replace(/[^\w\sàèéìòùÀÈÉÌÒÙ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);

  if (searchTerms.length === 0) return "";

  // Search with the full title first
  let results = searchLibrary(courseTitle, 5);

  // If no results, try individual key terms
  if (results.length === 0) {
    for (const term of searchTerms.slice(0, 3)) {
      const partial = searchLibrary(term, 3);
      results.push(...partial);
      if (results.length >= 5) break;
    }
  }

  if (results.length === 0) return "";

  // Build context string within char limit
  let context = "\n\nRIFERIMENTI DALLA BIBLIOTECA GIURIDICA:\n";
  let charCount = context.length;

  for (const r of results) {
    const entry = `\n[${r.book_title}${r.heading ? ` — ${r.heading}` : ""}]\n${r.content}\n`;
    if (charCount + entry.length > maxChars) break;
    context += entry;
    charCount += entry.length;
  }

  return context;
}
