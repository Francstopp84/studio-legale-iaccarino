import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

const TTS_DIR = path.join(process.cwd(), "public", "tts");

// Giuseppe Multilingue — voce più naturale e coinvolgente
const VOICE_A = "it-IT-GiuseppeMultilingualNeural"; // Professor
const VOICE_B = "it-IT-IsabellaNeural"; // Collega (voce femminile per distinguere)

interface DialogueLine {
  speaker: "A" | "B";
  text: string;
}

interface DialogueSegment {
  speaker: "A" | "B";
  text: string;
  audioUrl: string;
  duration: number;
}

// Generate a dialogue script from lesson content using Claude
async function generateDialogueScript(title: string, content: string): Promise<DialogueLine[]> {
  const prompt = `COMPITO: Trasforma ESATTAMENTE questo testo in un dialogo tra due persone. NON inventare NULLA. Ogni informazione del dialogo DEVE venire dal testo sotto.

SPEAKER A = "Prof. Ferretti" — unico speaker, professore che spiega tutto.

REGOLE TASSATIVE:
- USA SOLO speaker "A". Non esiste speaker B.
- SEGUI L'ORDINE ESATTO del testo: primo paragrafo → prime battute, ecc.
- NON inventare informazioni, NON aggiungere concetti che non sono nel testo
- Se il testo parla di diritto PENALE, il dialogo DEVE parlare di diritto PENALE. MAI cambiare materia.
- TUTTO in italiano. MAI parole inglesi o francesi.
- 10-20 battute, 2-4 frasi ciascuna, tono da lezione universitaria appassionata
- Parla direttamente allo studente: "Ora, fate attenzione...", "Questo è fondamentale..."

FORMATO (SOLO JSON, nient'altro):
[{"speaker":"A","text":"..."},{"speaker":"A","text":"..."},...]

TESTO DA CONVERTIRE:
${content.slice(0, 8000)}`;

  try {
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
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`LLM errore: ${res.status}`);
    const data = await res.json();
    const stdout = data.choices?.[0]?.message?.content || "";

    const match = stdout.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as DialogueLine[];
      if (Array.isArray(parsed) && parsed.length > 5) {
        return parsed;
      }
    }
  } catch (e: any) {
    console.error("[DIALOGUE] LLM error:", e.message);
  }

  return fallbackDialogue(title, content);
}

// Simple fallback: split content into alternating lines
function fallbackDialogue(title: string, content: string): DialogueLine[] {
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const lines: DialogueLine[] = [
    { speaker: "A", text: `Oggi parliamo di ${title}. Un argomento fondamentale.` },
    { speaker: "B", text: "Sono molto curioso, spiegami tutto dall'inizio." },
  ];
  let speaker: "A" | "B" = "A";
  let batch = "";
  for (const s of sentences) {
    batch += s.trim() + " ";
    if (batch.length > 150) {
      lines.push({ speaker, text: batch.trim() });
      speaker = speaker === "A" ? "B" : "A";
      batch = "";
    }
  }
  if (batch.trim()) lines.push({ speaker, text: batch.trim() });
  return lines;
}

// Clean text for TTS: remove symbols that get read aloud
function cleanTextForTTS(text: string): string {
  return text
    .replace(/\*+/g, "")           // asterischi
    .replace(/#+ ?/g, "")          // markdown headers
    .replace(/_{2,}/g, "")         // underscore multipli
    .replace(/`+/g, "")            // backtick
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links
    .replace(/[<>{}[\]|\\~^]/g, "") // caratteri speciali
    .replace(/\s{2,}/g, " ")       // spazi multipli
    .trim();
}

// Transform text into SSML with natural prosody for a professor's reading
function textToSSML(text: string, voice: string): string {
  let clean = cleanTextForTTS(text);

  // Add pauses after periods, question marks, exclamation marks
  clean = clean.replace(/\.\s+/g, '.<break time="400ms"/> ');
  clean = clean.replace(/\?\s+/g, '?<break time="500ms"/> ');
  clean = clean.replace(/!\s+/g, '!<break time="400ms"/> ');
  // Add small pauses after colons and semicolons
  clean = clean.replace(/:\s+/g, ':<break time="300ms"/> ');
  clean = clean.replace(/;\s+/g, ';<break time="250ms"/> ');
  // Add pauses after commas (shorter)
  clean = clean.replace(/,\s+/g, ',<break time="150ms"/> ');

  // Emphasize legal article references (art. 606, comma 1, etc.)
  clean = clean.replace(/(art(?:icolo|\.)\s*\d+[^.]*?(?:c\.p\.p\.|c\.p\.|c\.c\.))/gi,
    '<emphasis level="moderate">$1</emphasis>');

  // Add breathing pause at start
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="it-IT">
  <voice name="${voice}">
    <prosody rate="-5%" pitch="-2st">
      <break time="300ms"/>
      ${clean}
      <break time="500ms"/>
    </prosody>
  </voice>
</speak>`;

  return ssml;
}

// Generate TTS audio for a single line using SSML for natural prosody
function generateLineAudio(text: string, voice: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ssmlPath = outputPath.replace(".mp3", ".ssml");
    const ssml = textToSSML(text, voice);
    fs.writeFileSync(ssmlPath, ssml, "utf-8");

    try {
      // Use SSML input instead of plain text for natural reading
      execSync(
        `edge-tts --voice "${voice}" --file "${ssmlPath}" --write-media "${outputPath}"`,
        { timeout: 30000, encoding: "utf-8" }
      );
      try { fs.unlinkSync(ssmlPath); } catch {}

      if (!fs.existsSync(outputPath)) {
        // Fallback: try without SSML
        const textPath = outputPath.replace(".mp3", ".txt");
        fs.writeFileSync(textPath, cleanTextForTTS(text), "utf-8");
        execSync(
          `edge-tts --voice "${voice}" --rate="+5%" --pitch="-2Hz" --file "${textPath}" --write-media "${outputPath}"`,
          { timeout: 30000, encoding: "utf-8" }
        );
        try { fs.unlinkSync(textPath); } catch {}
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error("Audio generation failed"));
        return;
      }

      const stats = fs.statSync(outputPath);
      const estimatedDuration = stats.size / 2000;
      resolve(estimatedDuration);
    } catch (e) {
      // Fallback senza SSML
      try { fs.unlinkSync(ssmlPath); } catch {}
      try {
        const textPath = outputPath.replace(".mp3", ".txt");
        fs.writeFileSync(textPath, cleanTextForTTS(text), "utf-8");
        execSync(
          `edge-tts --voice "${voice}" --rate="+5%" --pitch="-2Hz" --file "${textPath}" --write-media "${outputPath}"`,
          { timeout: 30000, encoding: "utf-8" }
        );
        try { fs.unlinkSync(textPath); } catch {}
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          resolve(stats.size / 2000);
        } else {
          reject(e);
        }
      } catch {
        reject(e);
      }
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = body.title as string;
  const content = body.content as string;
  const sectionIndex = body.sectionIndex ?? 0;

  if (!content) {
    return NextResponse.json({ error: "Contenuto mancante" }, { status: 400 });
  }

  // Check cache
  const hash = crypto.createHash("md5").update(title + content.slice(0, 500)).digest("hex").slice(0, 12);
  const cacheFile = path.join(TTS_DIR, `dialogue_${hash}.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      return NextResponse.json(cached);
    } catch { /* regenerate */ }
  }

  fs.mkdirSync(TTS_DIR, { recursive: true });

  // Step 1: Generate dialogue script via AI
  console.log(`[DIALOGUE] Generating script for: ${title}`);
  const script = await generateDialogueScript(title, content);
  console.log(`[DIALOGUE] Script: ${script.length} lines`);

  // Step 2: Generate audio for each line
  const segments: DialogueSegment[] = [];

  for (let i = 0; i < script.length; i++) {
    const line = script[i];
    const voice = line.speaker === "A" ? VOICE_A : VOICE_B;
    const audioPath = path.join(TTS_DIR, `${hash}_line_${i}.mp3`);
    const audioUrl = `/tts/${hash}_line_${i}.mp3`;

    try {
      // Skip if already generated
      let duration: number;
      if (fs.existsSync(audioPath)) {
        const stats = fs.statSync(audioPath);
        duration = stats.size / 2000;
      } else {
        duration = await generateLineAudio(line.text, voice, audioPath);
      }

      segments.push({
        speaker: line.speaker,
        text: line.text,
        audioUrl,
        duration,
      });
    } catch (e: any) {
      console.error(`[DIALOGUE] Failed line ${i}:`, e.message);
      // Add text-only segment
      segments.push({
        speaker: line.speaker,
        text: line.text,
        audioUrl: "",
        duration: 0,
      });
    }
  }

  const result = {
    title,
    segments,
    totalLines: segments.length,
    speakerA: "Prof. Ferretti",
    speakerB: "Dott.ssa Marini",
  };

  // Cache the result
  fs.writeFileSync(cacheFile, JSON.stringify(result), "utf-8");

  return NextResponse.json(result);
}
