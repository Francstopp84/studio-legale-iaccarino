# Braynr Studio — Redesign: Da Toolkit a Tutor Personale

**Data**: 10 marzo 2026
**Autore**: Design collaborativo Avv. Iaccarino + Claude
**Stato**: Approvato

---

## Problema

L'app attuale è una raccolta di strumenti scollegati (flashcard, quiz, note, trascrizione).
L'utente non ha una guida. Non sa cosa fare dopo aver caricato il materiale.
L'obiettivo è trasformare Braynr in un **tutor personale** che guida l'utente
dall'acquisizione del materiale alla padronanza completa della materia.

## Utente Target

Avvocato 42 anni. Deve preparare arringhe, esami (avvocato d'ufficio, abilitazione Cassazione).
Problema specifico: difficoltà di recupero sotto pressione, perdita del filo durante
esposizioni orali, calo di fiducia nelle proprie capacità mnemoniche.

## Principi Didattici

1. **Metodo Feynman** — se non sai spiegarlo semplicemente, non l'hai capito
2. **Ripetizione spaziata (SM-2)** — integrata nel percorso, non isolata
3. **Tassonomia di Bloom** — 4 livelli: ricordare, capire, applicare, analizzare
4. **Ancoraggio strutturale** — strutture ad albero per esposizioni orali
5. **Active Recall sotto pressione** — simulazioni che replicano lo stress reale
6. **Overlearning** — praticare oltre il punto di primo richiamo

## Il Funnel: 6 Fasi

```
FASE 1: ACQUISISCI     → Carica qualsiasi materiale
FASE 2: COMPRENDI      → Il tutor spiega, dialogo interattivo
FASE 3: ARTICOLA       → L'utente rispieghi a voce, l'AI valuta
FASE 4: CONSOLIDA      → Flashcard, quiz, mappe con ripetizione spaziata
FASE 5: SIMULA         → Interrogazione/arringa simulata sotto pressione
FASE 6: PADRONEGGIA    → Dashboard, ripasso quotidiano, tracking progressi
```

---

## FASE 1: ACQUISISCI

### Input supportati
- Audio/video (mp3, m4a, wav, mp4, mkv, avi, webm) → trascrizione con faster-whisper
- PDF, DOCX → estrazione testo
- Testo libero / appunti manuali
- URL di risorse online (futuro)

### Funzionalità
- Upload multiplo con drag & drop
- Scelta metodo trascrizione (veloce/bilanciato/qualità)
- Trascrizione in background con progresso in tempo reale
- Raggruppamento automatico in "Corsi" (cartelle logiche)
- Il sistema analizza il materiale e genera:
  - Indice degli argomenti trattati
  - Mappa dei concetti chiave
  - Stima del tempo di studio necessario
- Al completamento → transizione automatica a Fase 2

### UX
- Dopo il caricamento, l'AI dice: "Ho analizzato il tuo materiale. Ecco cosa contiene
  e il percorso che ti propongo. Vuoi modificarlo?"
- L'utente può riordinare, rinominare, escludere argomenti

---

## FASE 2: COMPRENDI

### Funzionalità
- L'AI presenta ogni concetto come una **lezione interattiva**
- Formato conversazionale, non muro di testo
- Ogni concetto viene spiegato con:
  - Spiegazione chiara e semplice
  - Esempio pratico (preferibilmente giuridico)
  - Collegamento con concetti già appresi
- Dopo ogni spiegazione, domanda di verifica:
  "Hai capito? Vuoi che te lo rispieghi in modo diverso?"
- Se l'utente non capisce → l'AI riformula con analogie diverse
- Progressione: concetti ordinati dal semplice al complesso
- Indicatore visivo di avanzamento nella lezione

### UX
- Interfaccia tipo chat/tutor, non pagina statica
- Sidebar con indice della lezione, concetti spuntati man mano
- Possibilità di fare domande in qualsiasi momento
- "Spiega come se avessi 10 anni" / "Vai più in profondità" toggle

---

## FASE 3: ARTICOLA (Metodo Feynman)

### Funzionalità
- L'AI presenta un concetto e dice: "Ora spiegamelo tu con parole tue"
- L'utente può:
  - Scrivere la spiegazione (textarea)
  - Registrare a voce (Web Speech API → trascrizione in tempo reale)
- L'AI valuta la risposta su 3 assi:
  - **Completezza**: ha coperto i punti chiave?
  - **Accuratezza**: ha detto cose corrette?
  - **Terminologia**: ha usato i termini tecnici giusti?
- Feedback costruttivo: "Ottimo, hai colto il punto X. Ma hai saltato Y — è importante perché..."
- Se l'utente non riesce → rimandato a Fase 2 per quel concetto specifico

### UX
- Interfaccia pulita: concetto in alto, area di risposta al centro
- Barra dei 3 assi di valutazione visibile dopo la risposta
- Animazione di "successo" quando il concetto è padroneggiato

---

## FASE 4: CONSOLIDA

### Funzionalità
- Generazione automatica dal materiale studiato:
  - **Flashcard** con ripetizione spaziata SM-2
  - **Quiz** a risposta multipla con spiegazione degli errori
  - **Mappe concettuali** interattive (nodi collegati, navigabili)
- Focus su ciò che l'utente ha sbagliato in Fase 3
- Sessioni di ripasso calibrate: il sistema decide cosa ripassare oggi
- Statistiche per concetto: quante volte sbagliato, trend di miglioramento

### UX
- Card-based: ogni sessione è una "missione" con obiettivo chiaro
- Gamification leggera: streak di giorni, percentuale padronanza
- "Oggi hai 12 flashcard da ripassare e 1 concetto debole da rinforzare"

---

## FASE 5: SIMULA

### Modalità Interrogazione
- L'AI estrae domande dal materiale
- Le pone una alla volta, oralmente (text-to-speech opzionale)
- Timer visibile (pressione temporale configurabile)
- L'utente risponde a voce o per iscritto
- Feedback immediato dopo ogni risposta

### Modalità Arringa
- L'utente carica/prepara la struttura della sua arringa
- Il sistema genera un **Albero dell'Arringa**:
  ```
  TESI CENTRALE
  ├── Pilastro 1 (parola-chiave àncora)
  │   ├── Argomento
  │   ├── Giurisprudenza
  │   └── Conclusione parziale
  ├── Pilastro 2 (parola-chiave àncora)
  └── Pilastro 3 (parola-chiave àncora)
  ```
- L'utente espone l'arringa. L'AI:
  - Trascrive in tempo reale
  - Interrompe con domande del "Giudice" (configurabile)
  - Segna cosa ha coperto e cosa ha saltato
- Report finale: mappa di copertura, punti deboli, suggerimenti

### UX
- Interfaccia immersiva, schermo scuro, focus totale
- Albero dell'arringa visibile come reference (può essere nascosto)
- Replay della propria esposizione con annotazioni AI

---

## FASE 6: PADRONEGGIA

### Dashboard
- **Stato globale**: percentuale padronanza per materia/corso
- **Oggi**: cosa ripassare, concetti deboli, sessione suggerita
- **Trend**: grafico di miglioramento nel tempo
- **Calendario**: streak di studio, prossime scadenze esami
- **Concetti critici**: i 5 concetti più deboli con link diretto allo studio

### Ripasso Quotidiano
- Notifica/prompt all'apertura: "Buongiorno Avvocato. Oggi hai 3 concetti da
  rinforzare e 8 flashcard in scadenza. Tempo stimato: 15 minuti."
- Sessione guidata che mixa flashcard + articolazione + mini-quiz
- Adattiva: se sbagli, il sistema intensifica quel concetto

---

## Design Estetico

### Filosofia visiva
- **Potenza del sapere e dei libri**: colori profondi, tipografia elegante
- Ispirazione: biblioteca antica incontra tecnologia moderna
- Palette: fondi scuri caldi (non freddi), accenti ambra/oro, testo crema
- Font: serif per i titoli (sapienza), sans-serif per il corpo (modernità)
- Icone: linee sottili, stile incisione/acquaforte
- Animazioni: fluide, mai appariscenti. Transizioni come pagine che si girano
- Card con texture sottile tipo carta invecchiata
- Ogni fase ha un'icona/simbolo distintivo ispirato a simboli classici

### Palette colori
- Background: #1a1814 (pergamena scura)
- Card: #242019 (carta invecchiata)
- Accento primario: #d4a853 (oro antico)
- Accento secondario: #8b7355 (cuoio)
- Testo primario: #e8e0d0 (crema)
- Testo secondario: #9a8e7a (sabbia)
- Successo: #6b8f71 (verde salvia)
- Errore: #c45c4a (rosso mattone)
- Bordi: #3a3428 (bronzo scuro)

### Tipografia
- Titoli: Playfair Display (serif, classico, autorevole)
- Corpo: Inter (sans-serif, leggibile, moderno)
- Monospace (codice/dati): JetBrains Mono

### Navigazione
- Sidebar sostituita da un **percorso visivo verticale** (funnel)
- Le 6 fasi sono rappresentate come tappe di un viaggio
- La fase attiva è evidenziata, le precedenti hanno spunta
- Le successive sono visibili ma attenuate (si sbloccano)
- Click su fase precedente per tornare indietro

---

## Stack Tecnico

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Database**: SQLite (better-sqlite3) — già in uso
- **AI**: Claude CLI (già integrato) per spiegazioni, valutazioni, generazione
- **Trascrizione**: faster-whisper con GPU (già funzionante)
- **Voce utente**: Web Speech API (browser-native, zero dipendenze)
- **Font**: Google Fonts (Playfair Display + Inter)

## Struttura Database (aggiunte)

```sql
-- Corsi/materie
CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Concetti estratti dal materiale
CREATE TABLE concepts (
  id INTEGER PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id),
  document_id INTEGER REFERENCES documents(id),
  title TEXT NOT NULL,
  explanation TEXT,
  keywords TEXT, -- JSON array
  order_index INTEGER,
  bloom_level INTEGER DEFAULT 1, -- 1=ricorda 2=capisce 3=applica 4=analizza
  mastery_score REAL DEFAULT 0, -- 0-100
  last_studied DATETIME,
  next_review DATETIME
);

-- Sessioni di articolazione (Fase 3)
CREATE TABLE articulations (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER REFERENCES concepts(id),
  user_response TEXT,
  completeness_score REAL,
  accuracy_score REAL,
  terminology_score REAL,
  ai_feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Simulazioni (Fase 5)
CREATE TABLE simulations (
  id INTEGER PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id),
  type TEXT NOT NULL, -- 'exam' | 'arringa'
  structure TEXT, -- JSON albero arringa
  transcript TEXT,
  coverage_map TEXT, -- JSON: cosa coperto/saltato
  ai_feedback TEXT,
  score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Progressi giornalieri
CREATE TABLE daily_progress (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  concepts_studied INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  articulations_done INTEGER DEFAULT 0,
  simulations_done INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0
);
```

## Pagine / Route

```
/                    → Dashboard (Fase 6: Padroneggia)
/acquire             → Fase 1: Carica materiale + trascrizione
/course/[id]         → Vista corso con percorso delle 6 fasi
/course/[id]/learn   → Fase 2: Comprendi (tutor interattivo)
/course/[id]/speak   → Fase 3: Articola (Feynman)
/course/[id]/review  → Fase 4: Consolida (flashcard/quiz/mappe)
/course/[id]/simulate → Fase 5: Simula (esame/arringa)
/daily               → Sessione di ripasso quotidiano
```
