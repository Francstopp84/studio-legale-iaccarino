import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

async function askLLMLocal(prompt: string): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
  const model = process.env.LLM_MODEL_REASONING || process.env.LLM_MODEL_DEFAULT || "llama-3.3-70b-versatile";
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

// POST /api/courses/[id]/deep-research
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);

  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as any;
  if (!course) {
    return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
  }

  // Get linked documents content
  const docs = db.prepare(`
    SELECT d.id, d.title, d.content FROM documents d
    JOIN course_documents cd ON d.id = cd.document_id
    WHERE cd.course_id = ?
    ORDER BY cd.order_index
  `).all(courseId) as any[];

  if (docs.length === 0) {
    return NextResponse.json({ error: "Nessun documento nel corso" }, { status: 400 });
  }

  const materialSummary = docs.map(d => d.content?.slice(0, 3000) || "").join("\n---\n");

  // Abort signal from client disconnect
  const abortController = new AbortController();
  const signal = abortController.signal;

  // Abort on client disconnect
  req.signal.addEventListener("abort", () => {
    console.log(`[DEEP-RESEARCH] Client disconnected, aborting...`);
    abortController.abort();
  });

  try {
    // STEP 1: AI analizza il materiale e identifica argomenti da approfondire
    console.log(`[DEEP-RESEARCH] Analyzing course ${courseId}: "${course.title}"`);

    const analysisPrompt = `Sei un ricercatore giuridico italiano esperto. Analizza il seguente materiale didattico e identifica TUTTI gli argomenti collegati che meritano un approfondimento.

TITOLO CORSO: ${course.title}

MATERIALE (estratto):
${materialSummary.slice(0, 12000)}

COMPITO: Per ogni argomento del materiale, identifica:
1. Argomenti correlati non trattati ma fondamentali per una comprensione completa
2. Riferimenti normativi da approfondire (articoli di legge, commi, regolamenti)
3. Orientamenti giurisprudenziali rilevanti (Cassazione, Corte Costituzionale, CEDU)
4. Questioni dottrinali aperte o dibattute
5. Profili pratici e applicativi

Per OGNI argomento identificato, genera:
- Un titolo chiaro
- Query di ricerca per One Legale (database giuridico italiano)
- Query di ricerca web generale

Rispondi SOLO con JSON valido nel seguente formato:
{
  "topics": [
    {
      "title": "Titolo argomento correlato",
      "relevance": "Perché è collegato al materiale",
      "one_legale_queries": ["query 1 per One Legale", "query 2"],
      "web_queries": ["query 1 per ricerca web", "query 2"]
    }
  ]
}

Identifica ALMENO 8-12 argomenti.`;

    const analysisText = await askLLMLocal(analysisPrompt);
    let topics: any[] = [];
    try {
      const match = analysisText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        topics = parsed.topics || [];
      }
    } catch { /* fallback */ }

    if (topics.length === 0) {
      return NextResponse.json({ error: "Impossibile identificare argomenti correlati" }, { status: 500 });
    }

    console.log(`[DEEP-RESEARCH] Found ${topics.length} topics to research`);

    // STEP 2: Per ogni topic, genera un approfondimento completo via AI (in parallelo)
    const researchPromises = topics.slice(0, 8).map((topic, i) =>
      askLLMLocal(`Sei un giurista italiano esperto. Scrivi un APPROFONDIMENTO COMPLETO su:

ARGOMENTO: ${topic.title}
CONTESTO: Collegato al corso "${course.title}" — ${topic.relevance}

REGOLE:
- Scrivi un testo di almeno 1500-2500 parole
- Linguaggio giuridico forense preciso
- Cita articoli di legge specifici con numeri e commi
- Menziona orientamenti giurisprudenziali con riferimenti (Cass. Sez. ..., n. .../anno)
- Includi profili pratici e applicativi
- Struttura con titoli e sottosezioni
- NON inventare numeri di sentenze — usa formule come "secondo consolidata giurisprudenza di legittimità"
- Scrivi in italiano

Scrivi ORA l'approfondimento:`)
        .then(text => {
          console.log(`[DEEP-RESEARCH] Topic ${i + 1} "${topic.title}" done (${text.length} chars)`);
          return { topic, content: text.trim(), success: true };
        })
        .catch(err => {
          console.error(`[DEEP-RESEARCH] Topic ${i + 1} failed: ${err.message}`);
          return { topic, content: "", success: false };
        })
    );

    const results = await Promise.all(researchPromises);
    const successful = results.filter(r => r.success && r.content.length > 500);

    console.log(`[DEEP-RESEARCH] ${successful.length}/${results.length} topics researched successfully`);

    // STEP 3: Salva ogni approfondimento come documento e collegalo al corso
    const insertDoc = db.prepare(
      "INSERT INTO documents (title, content, file_type) VALUES (?, ?, 'deep-research')"
    );
    const linkDoc = db.prepare(
      "INSERT OR IGNORE INTO course_documents (course_id, document_id, order_index) VALUES (?, ?, ?)"
    );

    const existingMax = (db.prepare(
      "SELECT MAX(order_index) as m FROM course_documents WHERE course_id = ?"
    ).get(courseId) as any)?.m || 0;

    let docsAdded = 0;
    for (const result of successful) {
      const title = `[Deep Research] ${result.topic.title}`;
      const r = insertDoc.run(title, result.content);
      linkDoc.run(courseId, r.lastInsertRowid, existingMax + docsAdded + 1);
      docsAdded++;
    }

    // STEP 4: Genera report con query One Legale
    const oneLegaleReport = topics.map(t =>
      `### ${t.title}\n**Rilevanza:** ${t.relevance}\n**Query One Legale:**\n${t.one_legale_queries.map((q: string) => `- ${q}`).join("\n")}`
    ).join("\n\n");

    // Salva il report One Legale come documento speciale
    if (oneLegaleReport) {
      const reportTitle = `[One Legale] Ricerche da effettuare — ${course.title}`;
      const reportContent = `# RICERCHE ONE LEGALE — ${course.title}\n\nQueste sono le query da eseguire su One Legale per completare la ricerca giurisprudenziale.\nAccedi a One Legale e cerca ciascuna query per trovare sentenze e dottrina rilevante.\n\n${oneLegaleReport}`;
      const r = insertDoc.run(reportTitle, reportContent);
      linkDoc.run(courseId, r.lastInsertRowid, existingMax + docsAdded + 1);
      docsAdded++;
    }

    // STEP 5: Invalida cache lezione per rigenerazione con nuovo materiale
    db.prepare("UPDATE courses SET lesson_simple = NULL, lesson_tecnico = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(courseId);

    // Fire-and-forget: rigenera lezione con il nuovo materiale
    const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
    fetch(`${baseUrl}/api/courses/${courseId}/lesson`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "tecnico" }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      topicsFound: topics.length,
      topicsResearched: successful.length,
      documentsAdded: docsAdded,
      topics: topics.map(t => ({
        title: t.title,
        relevance: t.relevance,
        oneLegaleQueries: t.one_legale_queries,
      })),
    });

  } catch (err: any) {
    if (err.message === "Aborted" || signal.aborted) {
      console.log(`[DEEP-RESEARCH] Aborted by user`);
      return NextResponse.json({ error: "Ricerca interrotta" }, { status: 499 });
    }
    console.error(`[DEEP-RESEARCH] Failed:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
