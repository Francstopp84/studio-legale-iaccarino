# Braynr Tutor — Piano di Implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trasformare Braynr da toolkit scollegato a tutor personale con funnel a 6 fasi (Acquisisci → Comprendi → Articola → Consolida → Simula → Padroneggia).

**Architecture:** Redesign completo del frontend (nuova palette "biblioteca antica", navigazione a funnel, pagine per ogni fase). Backend: estensione schema SQLite con tabelle courses/concepts/articulations/simulations. AI: Claude CLI per tutoring interattivo, valutazione Feynman, simulazione esame. Trascrizione: faster-whisper già funzionante, da integrare nel funnel.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, SQLite (better-sqlite3), Claude CLI, faster-whisper, Web Speech API, Google Fonts (Playfair Display + Inter)

**Design doc:** `docs/plans/2026-03-10-braynr-tutor-redesign.md`

---

## Milestone 1: Design System & Layout (Foundation)

Tutto il resto si costruisce sopra questa base. Nuova palette, font, navigazione a funnel.

### Task 1.1: Nuova palette e tipografia

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Aggiornare globals.css con la nuova palette**

Sostituire tutte le CSS variables con:

```css
:root {
  /* Pergamena scura */
  --bg-primary:      #1a1814;
  --bg-secondary:    #211e18;
  --bg-card:         #272320;
  --bg-hover:        #302b26;

  /* Testo crema */
  --text-primary:    #e8e0d0;
  --text-secondary:  #9a8e7a;

  /* Oro antico + Cuoio */
  --accent:          #d4a853;
  --accent-hover:    #e0bb6e;
  --accent-glow:     rgba(212, 168, 83, 0.15);

  /* Semantici */
  --success:         #6b8f71;
  --warning:         #d4a853;
  --danger:          #c45c4a;

  /* Bordi */
  --border:          #3a3428;
  --border-hover:    #4d4538;

  /* Fasi del funnel */
  --phase-acquire:   #5b8fb9;
  --phase-understand:#d4a853;
  --phase-articulate:#c47d5b;
  --phase-consolidate:#6b8f71;
  --phase-simulate:  #9b6b9e;
  --phase-master:    #d4a853;
}
```

Aggiungere font import:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
```

Aggiornare le classi `.card` con nuova estetica (bordo sottile, hover oro, texture sottile).

**Step 2: Aggiornare layout.tsx**

- Cambiare font da system-ui a Inter + Playfair Display
- Rimuovere import Sidebar esistente
- Nuovo layout: header compatto in alto + navigazione funnel laterale + area contenuto
- Aggiungere `<link>` per Google Fonts nel `<head>`

**Step 3: Verificare che la pagina carichi con il nuovo tema**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: 200

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: new design system — biblioteca antica palette, Playfair + Inter fonts"
```

---

### Task 1.2: Navigazione Funnel (sostituisce Sidebar)

**Files:**
- Create: `src/components/FunnelNav.tsx`
- Delete: `src/components/Sidebar.tsx` (dopo la sostituzione)
- Modify: `src/app/layout.tsx`

**Step 1: Creare FunnelNav.tsx**

Componente navigazione verticale con le 6 fasi rappresentate come tappe di un viaggio:

```
┌─────────────────┐
│  BRAYNR          │
│  Il tuo tutor    │
├─────────────────┤
│ ① Acquisisci    │  ← icona libro aperto
│ ② Comprendi     │  ← icona lampadina
│ ③ Articola      │  ← icona microfono
│ ④ Consolida     │  ← icona ingranaggi
│ ⑤ Simula        │  ← icona bilancia
│ ⑥ Padroneggia   │  ← icona corona
├─────────────────┤
│ Sessione rapida │  ← link /daily
│ Avv. Iaccarino  │
└─────────────────┘
```

Ogni fase:
- Mostra icona + nome
- Fase attiva: evidenziata con accento oro, bordo sinistro luminoso
- Fasi completate: spunta dorata
- Fasi non ancora raggiunte: attenuate ma cliccabili
- Sotto ogni fase attiva: sotto-navigazione contestuale (es. per un corso specifico)

**Step 2: Sostituire Sidebar in layout.tsx**

Importare FunnelNav al posto di Sidebar. Stesso layout a due colonne ma con la nuova navigazione.

**Step 3: Verificare navigazione funziona**

Controllare che tutti i link esistenti continuino a funzionare (redirect temporanei per le vecchie route).

**Step 4: Commit**

```bash
git add src/components/FunnelNav.tsx src/app/layout.tsx
git rm src/components/Sidebar.tsx
git commit -m "feat: funnel navigation replaces sidebar — 6-phase journey"
```

---

### Task 1.3: Componenti UI Base

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/ProgressRing.tsx`
- Create: `src/components/ui/PhaseHeader.tsx`

**Step 1: Creare componenti riutilizzabili**

- **Card**: wrapper con stile "carta invecchiata", varianti (default, highlighted, phase-colored)
- **Button**: primary (oro), secondary (bordo), danger. Hover con glow dorato
- **ProgressRing**: cerchio SVG animato per mostrare % padronanza
- **PhaseHeader**: intestazione di ogni fase con icona, titolo, descrizione, barra progresso

**Step 2: Commit**

```bash
git add src/components/ui/
git commit -m "feat: base UI components — Card, Button, ProgressRing, PhaseHeader"
```

---

## Milestone 2: Database & API (Backend)

### Task 2.1: Estendere schema database

**Files:**
- Modify: `src/lib/db.ts`

**Step 1: Aggiungere nuove tabelle**

Aggiungere al blocco `db.exec()` in db.ts:

```sql
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  total_concepts INTEGER DEFAULT 0,
  mastered_concepts INTEGER DEFAULT 0,
  current_phase INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_documents (
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  PRIMARY KEY (course_id, document_id)
);

CREATE TABLE IF NOT EXISTS concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  title TEXT NOT NULL,
  explanation TEXT,
  keywords TEXT,
  order_index INTEGER DEFAULT 0,
  bloom_level INTEGER DEFAULT 1,
  mastery_score REAL DEFAULT 0,
  times_studied INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  last_studied DATETIME,
  next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
  user_response TEXT NOT NULL,
  completeness_score REAL DEFAULT 0,
  accuracy_score REAL DEFAULT 0,
  terminology_score REAL DEFAULT 0,
  ai_feedback TEXT,
  passed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'exam',
  structure TEXT,
  user_transcript TEXT,
  coverage_map TEXT,
  ai_feedback TEXT,
  score REAL DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  concepts_studied INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  articulations_done INTEGER DEFAULT 0,
  simulations_done INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0
);
```

**Step 2: Verificare che il DB si inizializzi senza errori**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/documents`
Expected: 200 (il DB si inizializza al primo accesso)

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: extend database schema — courses, concepts, articulations, simulations, daily_progress"
```

---

### Task 2.2: API Courses

**Files:**
- Create: `src/app/api/courses/route.ts`
- Create: `src/app/api/courses/[id]/route.ts`
- Create: `src/app/api/courses/[id]/concepts/route.ts`

**Step 1: CRUD corsi**

`/api/courses`:
- GET: lista tutti i corsi con conteggi (total_concepts, mastered, current_phase, documenti collegati)
- POST: crea corso (title, description, document_ids[])

`/api/courses/[id]`:
- GET: dettaglio corso con documenti e concetti
- PATCH: aggiorna corso (title, description, current_phase)
- DELETE: elimina corso (cascade)

`/api/courses/[id]/concepts`:
- GET: lista concetti del corso ordinati per order_index
- POST: genera concetti dal materiale del corso via AI (chiama Claude per estrarre concetti)
- PATCH: aggiorna singolo concetto (mastery_score, bloom_level, next_review)

**Step 2: Commit**

```bash
git add src/app/api/courses/
git commit -m "feat: courses API — CRUD courses and concepts"
```

---

### Task 2.3: API Articulations & Simulations

**Files:**
- Create: `src/app/api/articulations/route.ts`
- Create: `src/app/api/simulations/route.ts`
- Create: `src/app/api/daily/route.ts`

**Step 1: API Articulations**

`/api/articulations`:
- POST: salva risposta utente + chiede valutazione AI
  - Input: concept_id, user_response
  - Chiama Claude per valutare completeness/accuracy/terminology (0-100 ciascuno)
  - Salva in DB, aggiorna mastery_score del concetto
  - Ritorna feedback AI

**Step 2: API Simulations**

`/api/simulations`:
- GET: lista simulazioni (filtro ?course_id, ?type)
- POST: avvia simulazione
  - Input: course_id, type ('exam'|'arringa')
  - Per 'exam': genera N domande dai concetti del corso
  - Per 'arringa': genera struttura albero dell'arringa
  - Ritorna struttura simulazione
- PATCH: salva risultato (user_transcript, coverage_map, score)

**Step 3: API Daily**

`/api/daily`:
- GET: ritorna cosa fare oggi (flashcard scadute, concetti deboli, suggerimento sessione)
- POST: logga progresso giornaliero

**Step 4: Commit**

```bash
git add src/app/api/articulations/ src/app/api/simulations/ src/app/api/daily/
git commit -m "feat: articulations, simulations, daily progress APIs"
```

---

### Task 2.4: Estendere AI lib per tutoring

**Files:**
- Modify: `src/lib/ai.ts`

**Step 1: Aggiungere funzioni AI per le nuove fasi**

```typescript
// Fase 2: Estrai concetti dal materiale
export async function extractConceptsAI(content: string): Promise<Concept[]>

// Fase 2: Spiega un concetto in modo interattivo
export async function explainConceptAI(concept: string, context: string, level: string): Promise<string>

// Fase 3: Valuta risposta Feynman dell'utente
export async function evaluateArticulationAI(
  concept: string,
  expectedPoints: string,
  userResponse: string
): Promise<{completeness: number, accuracy: number, terminology: number, feedback: string}>

// Fase 5: Genera domande esame
export async function generateExamQuestionsAI(concepts: string[], count: number): Promise<ExamQuestion[]>

// Fase 5: Genera struttura arringa
export async function generateArringaTreeAI(topic: string, arguments: string): Promise<ArringaTree>

// Fase 5: Valuta esposizione orale
export async function evaluateOralResponseAI(
  question: string,
  expectedAnswer: string,
  userResponse: string
): Promise<{score: number, feedback: string, missed: string[]}>

// Dashboard: Genera suggerimento sessione giornaliera
export async function generateDailySuggestionAI(
  weakConcepts: string[],
  streakDays: number
): Promise<string>
```

**Step 2: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: AI functions for tutoring — explain, evaluate, exam generation"
```

---

## Milestone 3: Fase 1 — ACQUISISCI

### Task 3.1: Pagina Acquisisci

**Files:**
- Create: `src/app/acquire/page.tsx`
- Modify: `src/app/transcribe/page.tsx` (integrazione nel funnel)

**Step 1: Creare pagina /acquire**

Interfaccia unificata per caricare qualsiasi materiale:

Layout:
```
┌──────────────────────────────────────────────┐
│  PhaseHeader: "① Acquisisci"                 │
│  "Carica il tuo materiale di studio"         │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ Audio/   │ │ Documenti│ │ Appunti  │     │
│  │ Video    │ │ PDF/DOCX │ │ Testo    │     │
│  │  🎙️      │ │  📄      │ │  ✏️      │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                              │
│  ┌─ File caricati ─────────────────────────┐ │
│  │ ▶ Lezione 1.m4a      92MB  ✓ trascritto│ │
│  │ ▶ Dispensa.pdf       2MB   ✓ estratto  │ │
│  │ ▶ Appunti miei       --    ✓ salvato   │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─ Crea Corso ───────────────────────────┐  │
│  │ Nome: [Diritto Penale - Parte Speciale]│  │
│  │ Materiale selezionato: 3 file          │  │
│  │                                        │  │
│  │ [  ANALIZZA E CREA PERCORSO  ]  ← oro │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ Analisi AI ───────────────────────────┐  │
│  │ "Ho trovato 24 concetti chiave in 3    │  │
│  │  documenti. Il percorso stimato è di   │  │
│  │  ~4 ore di studio. Ecco la struttura   │  │
│  │  che ti propongo:"                     │  │
│  │                                        │  │
│  │  1. Introduzione alla parte speciale   │  │
│  │  2. Reati contro la persona            │  │
│  │  3. Reati contro il patrimonio         │  │
│  │  ...                                   │  │
│  │                                        │  │
│  │  [MODIFICA PERCORSO] [INIZIA A STUDIARE]│ │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Funzionalità:
- 3 modalità di input (audio/video, documenti, testo libero)
- Per audio/video: integra il sistema di trascrizione esistente (metodo selezionabile)
- Per PDF/DOCX: usa mammoth (già installato) per estrazione
- Lista file caricati con stato (in upload, in trascrizione, pronto)
- Form "Crea Corso": nome + selezione file → chiama AI per estrarre concetti
- Preview dell'analisi AI con percorso proposto (modificabile dall'utente)
- Pulsante "Inizia a studiare" → crea corso in DB, redirect a /course/[id]/learn

**Step 2: Commit**

```bash
git add src/app/acquire/page.tsx
git commit -m "feat: Phase 1 Acquire page — unified material upload with course creation"
```

---

## Milestone 4: Fase 2 — COMPRENDI

### Task 4.1: Pagina Tutor Interattivo

**Files:**
- Create: `src/app/course/[id]/learn/page.tsx`
- Create: `src/app/course/[id]/layout.tsx`

**Step 1: Layout corso**

`/course/[id]/layout.tsx` — wrapper per tutte le sotto-pagine di un corso:
- Header con nome corso e barra progresso globale
- Sotto-navigazione orizzontale con le 6 fasi (evidenzia fase attiva)
- Area contenuto sotto

**Step 2: Pagina Learn**

`/course/[id]/learn/page.tsx` — il cuore del tutor:

Layout:
```
┌────────────────────────────────────────────────┐
│ Diritto Penale          [████████░░] 75%       │
│ Comprendi  Articola  Consolida  Simula  Master │
├──────────┬─────────────────────────────────────┤
│ Indice   │                                     │
│          │  Concetto 3/24:                     │
│ ✓ 1.     │  "Il dolo eventuale"               │
│ ✓ 2.     │                                     │
│ ▶ 3.     │  Il dolo eventuale si configura     │
│   4.     │  quando l'agente, pur non volendo   │
│   5.     │  direttamente il risultato...       │
│   ...    │                                     │
│          │  📎 Esempio pratico:                │
│          │  Nel caso Thyssen, la Cassazione...  │
│          │                                     │
│          │  ─────────────────────              │
│          │  💬 Hai capito? Fammi una domanda   │
│          │  o dimmi di andare avanti.           │
│          │                                     │
│          │  [input messaggio utente        ]    │
│          │                                     │
│          │  [← Precedente] [Ho capito →]       │
│          │  [Rispiegami diversamente]           │
└──────────┴─────────────────────────────────────┘
```

Funzionalità:
- Sidebar sinistra: indice concetti con stato (completato/attivo/non iniziato)
- Area centrale: spiegazione AI del concetto corrente
- La spiegazione viene generata da Claude al primo accesso al concetto
- Input chat per domande: l'utente può chiedere chiarimenti
- 3 azioni: "Ho capito" (avanza), "Rispiegami" (Claude riformula), "Precedente" (torna)
- Quando tutti i concetti sono compresi → suggerisce Fase 3

**Step 3: Commit**

```bash
git add src/app/course/
git commit -m "feat: Phase 2 Learn page — interactive AI tutor with concept-by-concept progression"
```

---

## Milestone 5: Fase 3 — ARTICOLA

### Task 5.1: Pagina Feynman

**Files:**
- Create: `src/app/course/[id]/speak/page.tsx`
- Create: `src/components/VoiceRecorder.tsx`

**Step 1: Componente VoiceRecorder**

Usa Web Speech API (SpeechRecognition) per:
- Registrare voce utente in tempo reale
- Mostrare trascrizione live mentre parla
- Pulsante start/stop con animazione microfono
- Fallback a textarea per input scritto

```typescript
// Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'it-IT';
recognition.continuous = true;
recognition.interimResults = true;
```

**Step 2: Pagina Speak**

Layout:
```
┌──────────────────────────────────────────────┐
│  PhaseHeader: "③ Articola — Metodo Feynman"  │
├──────────────────────────────────────────────┤
│                                              │
│  Concetto: "Il dolo eventuale"               │
│  ┌────────────────────────────────────────┐  │
│  │ Spiegami questo concetto come se       │  │
│  │ fossi un collega che non sa nulla.     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ La tua spiegazione ──────────────────┐  │
│  │                                        │  │
│  │  [🎙️ Parla] oppure scrivi sotto       │  │
│  │                                        │  │
│  │  "Il dolo eventuale è quando..."       │  │
│  │  (trascrizione in tempo reale)         │  │
│  │                                        │  │
│  │  [INVIA SPIEGAZIONE]                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ Valutazione ─────────────────────────┐  │
│  │ Completezza:  [████████░░] 80%        │  │
│  │ Accuratezza:  [██████████] 100%       │  │
│  │ Terminologia: [██████░░░░] 60%        │  │
│  │                                        │  │
│  │ "Ottimo! Hai colto il punto sulla     │  │
│  │  previsione del risultato. Però hai    │  │
│  │  saltato la differenza con la colpa    │  │
│  │  cosciente — è fondamentale perché..." │  │
│  │                                        │  │
│  │  [RIPROVA] [AVANTI →]                 │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

Funzionalità:
- Mostra concetto da spiegare
- Input vocale (Web Speech API) o scritto (textarea)
- Invio a Claude per valutazione su 3 assi (0-100)
- Barre di progresso animate per i 3 punteggi
- Feedback AI testuale costruttivo
- Se punteggio medio >= 70: concetto superato, avanti
- Se < 70: suggerisce di ripassare (link a Fase 2) o riprovare
- Storico tentativi visibile

**Step 3: Commit**

```bash
git add src/app/course/[id]/speak/page.tsx src/components/VoiceRecorder.tsx
git commit -m "feat: Phase 3 Articulate — Feynman method with voice input and AI evaluation"
```

---

## Milestone 6: Fase 4 — CONSOLIDA

### Task 6.1: Pagina Review unificata

**Files:**
- Create: `src/app/course/[id]/review/page.tsx`

**Step 1: Pagina Review**

Unifica flashcard + quiz + mappe in un'unica esperienza guidata:

Layout:
```
┌──────────────────────────────────────────────┐
│  PhaseHeader: "④ Consolida"                  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐               │
│  │Flash │  │ Quiz │  │ Mappa│               │
│  │cards │  │      │  │      │               │
│  │ 12   │  │ 3    │  │ 1    │               │
│  │scad. │  │ da   │  │ da   │               │
│  │      │  │ fare │  │esplo.│               │
│  └──────┘  └──────┘  └──────┘               │
│                                              │
│  "Oggi hai 12 flashcard in scadenza e 3      │
│   quiz sui concetti che hai sbagliato ieri.  │
│   Tempo stimato: 15 minuti."                 │
│                                              │
│  [  INIZIA SESSIONE GUIDATA  ]               │
│                                              │
│  ┌─ Sessione in corso ──────────────────┐    │
│  │                                      │    │
│  │  (Flashcard / Quiz / Mappa si        │    │
│  │   alternano in base alle necessità)  │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

Funzionalità:
- Dashboard con conteggi (flashcard scadute, quiz disponibili, mappe)
- Suggerimento AI su cosa fare oggi
- Sessione guidata che mixa i tre strumenti in base alle necessità
- Flashcard: sistema SM-2 già esistente, nuova UI con tema biblioteca
- Quiz: generati dai concetti deboli (non random)
- Mappe: reactflow già integrato, nuovi stili
- Report fine sessione con statistiche

**Step 2: Commit**

```bash
git add src/app/course/[id]/review/page.tsx
git commit -m "feat: Phase 4 Consolidate — unified review with flashcards, quiz, mindmap"
```

---

## Milestone 7: Fase 5 — SIMULA

### Task 7.1: Pagina Simulazione

**Files:**
- Create: `src/app/course/[id]/simulate/page.tsx`
- Create: `src/components/ArringaTree.tsx`
- Create: `src/components/ExamSimulator.tsx`

**Step 1: Componente ExamSimulator**

Modalità interrogazione:
- Domande una alla volta, timer visibile (configurabile 30s/60s/120s/illimitato)
- Input vocale (VoiceRecorder) o scritto
- Feedback immediato dopo ogni risposta
- Report finale con punteggio e lacune

**Step 2: Componente ArringaTree**

Visualizzazione ad albero dell'arringa:
```
            TESI CENTRALE
           /      |       \
     Pilastro 1  Pilastro 2  Pilastro 3
     /    \       /    \       /    \
  Arg  Giur   Arg  Giur   Arg  Giur
```

- Nodi cliccabili con dettaglio
- Modalità "pratica": l'utente espone, i nodi si illuminano quando coperti
- Nodi non coperti restano scuri → feedback visivo immediato
- Interruzioni del "Giudice" (domande AI random durante l'esposizione)

**Step 3: Pagina Simulate**

Layout:
```
┌──────────────────────────────────────────────┐
│  PhaseHeader: "⑤ Simula"                    │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────┐  ┌────────────────┐      │
│  │  INTERROGAZIONE│  │    ARRINGA     │      │
│  │                │  │                │      │
│  │  Esame orale   │  │  Pratica la    │      │
│  │  simulato con  │  │  tua arringa   │      │
│  │  domande AI    │  │  davanti al    │      │
│  │                │  │  Giudice AI    │      │
│  │  [INIZIA]      │  │  [INIZIA]      │      │
│  └────────────────┘  └────────────────┘      │
│                                              │
│  Impostazioni:                               │
│  Timer: [30s] [60s] [120s] [∞]               │
│  Difficoltà: [Facile] [Media] [Esame reale]  │
│  Interruzioni Giudice: [Sì] [No]            │
│                                              │
│  ┌─ Simulazioni passate ────────────────┐    │
│  │ 📊 Esame 09/03 — 72% (debole: art.  │    │
│  │    640-ter)                           │    │
│  │ 📊 Arringa 08/03 — copertura 85%    │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**Step 4: Commit**

```bash
git add src/app/course/[id]/simulate/ src/components/ArringaTree.tsx src/components/ExamSimulator.tsx
git commit -m "feat: Phase 5 Simulate — exam and arringa simulation with AI judge"
```

---

## Milestone 8: Fase 6 — PADRONEGGIA (Dashboard)

### Task 8.1: Nuova Dashboard

**Files:**
- Rewrite: `src/app/page.tsx`
- Create: `src/app/daily/page.tsx`

**Step 1: Riscrivere Dashboard**

La home diventa il centro di comando:

Layout:
```
┌──────────────────────────────────────────────────┐
│  Buongiorno, Avvocato.                           │
│  Hai 3 concetti da rinforzare e 8 flashcard      │
│  in scadenza. Tempo stimato: 15 minuti.          │
│                                                  │
│  [  SESSIONE RAPIDA  ]                           │
├──────────────────────────────────────────────────┤
│  I tuoi corsi                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Dir.Pen. │ │ Proc.Pen.│ │ + Nuovo  │         │
│  │ ████░░   │ │ ██░░░░   │ │  corso   │         │
│  │ 75%      │ │ 30%      │ │          │         │
│  │ Fase 4   │ │ Fase 2   │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘         │
├──────────────────────────────────────────────────┤
│  ┌─ Concetti critici ─────┐ ┌─ Streak ────────┐ │
│  │ ⚠ Dolo eventuale  40% │ │ 🔥 7 giorni     │ │
│  │ ⚠ Art. 640-ter    35% │ │                  │ │
│  │ ⚠ Legittima difesa 50%│ │  L M M G V S D  │ │
│  │                        │ │  ✓ ✓ ✓ ✓ ✓ ✓ ▶ │ │
│  │ [Rafforza questi]      │ │                  │ │
│  └────────────────────────┘ └──────────────────┘ │
├──────────────────────────────────────────────────┤
│  ┌─ Progresso nel tempo ────────────────────┐    │
│  │  📈 Grafico con recharts                 │    │
│  │  (padronanza % per settimana)            │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

**Step 2: Pagina Daily**

`/daily` — sessione di ripasso quotidiano guidato:
- Mix automatico di flashcard scadute + concetti deboli + mini-quiz
- Progressione lineare: "3/12 completati"
- Al termine: aggiorna streak e statistiche

**Step 3: Commit**

```bash
git add src/app/page.tsx src/app/daily/page.tsx
git commit -m "feat: Phase 6 Master — dashboard with daily session, streaks, weak concepts"
```

---

## Milestone 9: Pulizia & Redirect

### Task 9.1: Redirect vecchie route e pulizia

**Files:**
- Modify: `src/app/documents/page.tsx` → redirect a /acquire
- Modify: `src/app/transcribe/page.tsx` → integrato in /acquire
- Modify: `src/app/flashcards/page.tsx` → redirect a /course/[id]/review
- Modify: `src/app/quiz/page.tsx` → redirect a /course/[id]/review
- Modify: `src/app/chat/page.tsx` → integrato in Fase 2 (learn)
- Modify: `src/app/notes/page.tsx` → integrato in Fase 2
- Modify: `src/app/mindmap/page.tsx` → integrato in Fase 4 (review)
- Modify: `src/app/analytics/page.tsx` → redirect a / (dashboard)

**Step 1: Aggiungere redirect o pagine ponte**

Per ogni vecchia route, redirect con `next/navigation`:
```typescript
import { redirect } from 'next/navigation';
export default function OldPage() { redirect('/acquire'); }
```

**Step 2: Commit**

```bash
git add src/app/
git commit -m "chore: redirect legacy routes to new funnel structure"
```

---

## Ordine di Esecuzione

```
Milestone 1 (Foundation)     ← PRIMO: senza questo niente funziona
  Task 1.1: Palette + Font
  Task 1.2: FunnelNav
  Task 1.3: UI Components

Milestone 2 (Backend)        ← Database + API prima delle pagine
  Task 2.1: Schema DB
  Task 2.2: API Courses
  Task 2.3: API Articulations/Simulations
  Task 2.4: AI lib

Milestone 3 (Fase 1)         ← Prima pagina utente
  Task 3.1: /acquire

Milestone 4 (Fase 2)         ← Il cuore del tutor
  Task 4.1: /course/[id]/learn

Milestone 5 (Fase 3)         ← Feynman
  Task 5.1: /course/[id]/speak

Milestone 6 (Fase 4)         ← Consolidamento
  Task 6.1: /course/[id]/review

Milestone 7 (Fase 5)         ← Simulazioni
  Task 7.1: /course/[id]/simulate

Milestone 8 (Fase 6)         ← Dashboard
  Task 8.1: Dashboard + Daily

Milestone 9 (Pulizia)        ← Ultimo
  Task 9.1: Redirect + cleanup
```

Ogni milestone è indipendente e committabile. L'app resta funzionante dopo ogni commit.
