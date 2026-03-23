import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

const METHOD_CONFIG: Record<string, { model: string; beam: number; best: number; batchSize: number }> = {
  fast:     { model: "large-v3", beam: 1, best: 1, batchSize: 16 },
  balanced: { model: "large-v3", beam: 3, best: 1, batchSize: 12 },
  quality:  { model: "large-v3", beam: 5, best: 1, batchSize: 8 },
};

// POST: Start a transcription job (returns immediately with job ID)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const method = (formData.get("method") as string) || "quality";

    if (!file) {
      return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
    }

    // Save file to disk
    await mkdir(UPLOADS_DIR, { recursive: true });
    await mkdir(JOBS_DIR, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(UPLOADS_DIR, `${Date.now()}_${safeName}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Create job
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const jobFile = path.join(JOBS_DIR, `${jobId}.json`);
    const cfg = METHOD_CONFIG[method] || METHOD_CONFIG.quality;

    const job = {
      id: jobId,
      fileName: file.name,
      filePath,
      method,
      model: cfg.model,
      status: "transcribing",
      progress: 0,
      transcript: null,
      error: null,
      startedAt: new Date().toISOString(),
    };

    await writeFile(jobFile, JSON.stringify(job));

    // Launch transcription in background (detached process)
    const pythonScript = `
import sys, json, time, os, re

job_file = sys.argv[1]
audio_path = sys.argv[2]
model_name = sys.argv[3]
beam_size = int(sys.argv[4])
best_of = int(sys.argv[5])
batch_size = int(sys.argv[6]) if len(sys.argv) > 6 else 8

def update_job(data):
    with open(job_file, 'r', encoding='utf-8') as f:
        job = json.load(f)
    job.update(data)
    with open(job_file, 'w', encoding='utf-8') as f:
        json.dump(job, f, ensure_ascii=False)

def is_hallucination(text, prev_texts):
    text = text.strip()
    if not text:
        return True
    if len(prev_texts) >= 2 and all(t == text for t in prev_texts[-2:]):
        return True
    words = text.split()
    if len(words) >= 4:
        for w_len in range(1, min(6, len(words) // 3)):
            chunk = " ".join(words[:w_len])
            if text.count(chunk) >= 4:
                return True
    if re.search(r'(\\b\\w+\\b)(?:\\s+\\1){3,}', text):
        return True
    return False

try:
    update_job({"status": "loading_model", "progress": 5})

    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    import subprocess, shutil

    # Quick audio preprocessing: just convert to 16kHz mono (skip loudnorm — too slow)
    preprocessed_path = audio_path + ".prep.wav"
    ffmpeg_path = shutil.which("ffmpeg")
    use_preprocessed = False
    if ffmpeg_path:
        try:
            subprocess.run([
                ffmpeg_path, "-y", "-i", audio_path,
                "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                preprocessed_path
            ], capture_output=True, timeout=120)
            if os.path.exists(preprocessed_path) and os.path.getsize(preprocessed_path) > 1000:
                use_preprocessed = True
        except Exception:
            pass

    transcribe_path = preprocessed_path if use_preprocessed else audio_path

    # Get duration for progress
    audio = decode_audio(transcribe_path)
    total_duration = len(audio) / 16000
    del audio

    update_job({"status": "transcribing", "progress": 10, "duration_seconds": round(total_duration)})

    # Wait for VRAM to be available (previous transcription might still be cleaning up)
    import torch
    for _wait in range(30):
        mem_reserved = torch.cuda.memory_reserved(0)
        if mem_reserved < 512 * 1024 * 1024:  # less than 512MB reserved = free enough
            break
        torch.cuda.empty_cache()
        time.sleep(1)

    # Use int8_float16 for faster inference + less VRAM on RTX 4060
    model = WhisperModel(model_name, device="cuda", compute_type="int8_float16")

    # Try batched inference (much faster — processes multiple chunks in parallel)
    use_batched = False
    try:
        from faster_whisper import BatchedInferencePipeline
        batched_model = BatchedInferencePipeline(model=model)
        segments, info = batched_model.transcribe(
            transcribe_path,
            language="it",
            batch_size=batch_size,
            beam_size=beam_size,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
                threshold=0.4,
            ),
            no_speech_threshold=0.5,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-0.8,
            repetition_penalty=1.3,
            no_repeat_ngram_size=4,
        )
        use_batched = True
    except Exception:
        # Fallback to standard inference
        segments, info = model.transcribe(
            transcribe_path,
            language="it",
            beam_size=beam_size,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
                threshold=0.4,
            ),
            temperature=0.0,
            condition_on_previous_text=True,
            no_speech_threshold=0.5,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-0.8,
            repetition_penalty=1.3,
            no_repeat_ngram_size=4,
        )

    results = []
    prev_texts = []
    hallucination_count = 0
    last_update = 0

    for segment in segments:
        text = segment.text.strip()

        if is_hallucination(text, prev_texts):
            hallucination_count += 1
            if hallucination_count >= 5:
                break
            continue

        hallucination_count = 0
        prev_texts.append(text)
        if len(prev_texts) > 10:
            prev_texts.pop(0)

        results.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": text
        })

        now = time.time()
        if now - last_update > 3:
            pct = min(95, 10 + int((segment.end / total_duration) * 85))
            update_job({"progress": pct, "segments_done": len(results)})
            last_update = now

    full_text = " ".join(r["text"] for r in results)
    update_job({
        "status": "done",
        "progress": 100,
        "transcript": full_text,
        "segments_count": len(results),
        "batched": use_batched,
        "finishedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })

    # FREE VRAM — delete model and clear CUDA cache
    del model
    if use_batched:
        del batched_model
    import torch
    torch.cuda.empty_cache()
    import gc
    gc.collect()

    # Cleanup temp files
    if use_preprocessed and os.path.exists(preprocessed_path):
        os.remove(preprocessed_path)

except Exception as e:
    update_job({"status": "error", "error": str(e), "progress": 0})
    # Free VRAM on error too
    try:
        import torch
        torch.cuda.empty_cache()
        import gc
        gc.collect()
    except:
        pass
    try:
        if os.path.exists(audio_path + ".prep.wav"):
            os.remove(audio_path + ".prep.wav")
    except:
        pass
`;

    const scriptPath = path.join(JOBS_DIR, `${jobId}.py`);
    await writeFile(scriptPath, pythonScript);

    const child = spawn("python", [
      scriptPath, jobFile, filePath, cfg.model, String(cfg.beam), String(cfg.best), String(cfg.batchSize),
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    // Safety timeout: kill process after 10 minutes to prevent VRAM leaks
    setTimeout(() => {
      try { process.kill(child.pid!); } catch {}
    }, 600000);

    return NextResponse.json({ jobId, fileName: file.name });
  } catch (err: any) {
    console.error("Transcription start error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Poll job status
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId richiesto" }, { status: 400 });
  }

  const jobFile = path.join(JOBS_DIR, `${jobId}.json`);

  if (!fs.existsSync(jobFile)) {
    return NextResponse.json({ error: "Job non trovato" }, { status: 404 });
  }

  try {
    const data = await readFile(jobFile, "utf-8");
    const job = JSON.parse(data);

    // If done, save to documents table (only once)
    if (job.status === "done" && job.transcript && !job.saved) {
      const title = job.fileName.replace(/\.[^.]+$/, "");
      const ext = job.fileName.split(".").pop() || "audio";
      const stmt = db.prepare(
        "INSERT INTO documents (title, content, file_path, file_type) VALUES (?, ?, ?, ?)"
      );
      const result = stmt.run(`Trascrizione: ${title}`, job.transcript, job.filePath, ext);
      job.documentId = Number(result.lastInsertRowid);
      job.saved = true;
      await writeFile(jobFile, JSON.stringify(job, null, 2));
    }

    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Errore lettura job" }, { status: 500 });
  }
}
