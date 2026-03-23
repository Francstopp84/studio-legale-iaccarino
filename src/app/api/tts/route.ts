import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

const TTS_DIR = path.join(process.cwd(), "public", "tts");
const VOICE = "it-IT-GiuseppeMultilingualNeural"; // Voce maschile naturale, modello recente

// POST /api/tts — Generate TTS audio + subtitles for a text
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body.text as string;
  const rate = body.rate || "+0%"; // e.g. "+10%", "-5%"

  if (!text || text.trim().length === 0) {
    return NextResponse.json({ error: "Nessun testo fornito" }, { status: 400 });
  }

  // Create hash-based filename for caching
  const hash = crypto.createHash("md5").update(text + rate).digest("hex").slice(0, 12);
  const mp3Path = path.join(TTS_DIR, `${hash}.mp3`);
  const vttPath = path.join(TTS_DIR, `${hash}.vtt`);

  // Return cached if exists
  if (fs.existsSync(mp3Path) && fs.existsSync(vttPath)) {
    const vttContent = fs.readFileSync(vttPath, "utf-8");
    const cues = parseVTT(vttContent);
    return NextResponse.json({
      audioUrl: `/tts/${hash}.mp3`,
      subtitles: cues,
      cached: true,
    });
  }

  // Ensure directory exists
  fs.mkdirSync(TTS_DIR, { recursive: true });

  // Clean text for TTS: remove ALL symbols/formatting that would be read aloud
  let cleanText = text
    .replace(/\*+/g, "")                        // bold/italic markdown
    .replace(/^#{1,6}\s*/gm, "")                // heading markers
    .replace(/_{2,}/g, "")                       // underscores
    .replace(/`+/g, "")                          // code backticks
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")     // markdown links
    .replace(/[<>{}[\]|\\~^]/g, "")              // special chars
    .replace(/^---+$/gm, "")                     // horizontal rules
    .replace(/^\d+\.\d+[\.\s]*/gm, "")          // section numbers like "1.1 " or "1.1."
    .replace(/^Capitolo \d+\s*[—–-]?\s*/gim, "") // "Capitolo 1 —"
    .replace(/\b(art\.|Art\.|comma|co\.)\s*/g, "$1 ") // keep article refs clean
    .replace(/\.{2,}/g, ".")                     // collapse multiple dots
    .replace(/\n{2,}/g, "\n")                    // collapse blank lines
    .replace(/\s{2,}/g, " ")                     // collapse whitespace
    .trim();

  // Write text to temp file
  const tmpTextPath = path.join(TTS_DIR, `${hash}.txt`);
  fs.writeFileSync(tmpTextPath, cleanText, "utf-8");

  try {
    // Faster rate (+12%) and slightly higher pitch for energetic, engaging professor voice
    execSync(
      `edge-tts --voice "${VOICE}" --rate="+12%" --pitch="+1Hz" --file "${tmpTextPath}" --write-media "${mp3Path}" --write-subtitles "${vttPath}"`,
      { timeout: 120000, encoding: "utf-8" }
    );

    // Clean up temp text file
    try { fs.unlinkSync(tmpTextPath); } catch { /* ignore */ }

    if (!fs.existsSync(mp3Path)) {
      return NextResponse.json({ error: "Generazione audio fallita" }, { status: 500 });
    }

    const vttContent = fs.existsSync(vttPath) ? fs.readFileSync(vttPath, "utf-8") : "";
    const cues = parseVTT(vttContent);

    return NextResponse.json({
      audioUrl: `/tts/${hash}.mp3`,
      subtitles: cues,
      cached: false,
    });
  } catch (err: any) {
    // Clean up temp file on error
    try { fs.unlinkSync(tmpTextPath); } catch { /* ignore */ }
    console.error("TTS error:", err.message);
    return NextResponse.json({ error: `TTS fallito: ${err.message}` }, { status: 500 });
  }
}

// Parse VTT subtitles into structured cues
function parseVTT(vtt: string): { start: number; end: number; text: string }[] {
  if (!vtt) return [];
  const cues: { start: number; end: number; text: string }[] = [];

  // Normalize line endings (Windows \r\n → \n) then split on blank lines
  const normalized = vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    // Find the timestamp line (contains -->)
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) continue;

    // Handle both VTT dots (00:00:01.234) and SRT commas (00:00:01,234)
    const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
    if (!match) continue;

    const start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + (parseInt(match[4]) / 1000);
    const end = parseInt(match[5]) * 3600 + parseInt(match[6]) * 60 + parseInt(match[7]) + (parseInt(match[8]) / 1000);

    // Text is everything after the timestamp line, cleaned
    const timeIdx = lines.indexOf(timeLine);
    let text = lines.slice(timeIdx + 1).join(" ").trim();

    // Remove any stray cue numbers, timestamps, or formatting artifacts
    text = text
      .replace(/^\d+\s*$/, "")                           // standalone cue numbers
      .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}/g, "")       // leftover timestamps
      .replace(/-->/g, "")                                // leftover arrows
      .replace(/\s{2,}/g, " ")                            // collapse whitespace
      .trim();

    if (text && text.length > 1) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}
