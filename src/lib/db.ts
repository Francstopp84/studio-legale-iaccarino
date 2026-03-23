import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// In produzione (Fly.io) usa /data (volume persistente), in dev usa data/ locale
const DB_PATH = process.env.NODE_ENV === 'production' && fs.existsSync('/data')
  ? '/data/studio.db'
  : path.join(process.cwd(), 'data', 'studio.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      file_path TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      deck TEXT DEFAULT 'Generale',
      easiness REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 0,
      repetitions INTEGER DEFAULT 0,
      next_review DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_review DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      questions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      document_id INTEGER REFERENCES documents(id),
      score REAL,
      cards_reviewed INTEGER DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'note',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#d4a853',
      parent_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS document_collections (
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, collection_id)
    );
    CREATE TABLE IF NOT EXISTS library_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT,
      category TEXT NOT NULL DEFAULT 'altro',
      total_pages INTEGER DEFAULT 0,
      total_chunks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS library_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      heading TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_library_chunks_book ON library_chunks(book_id);
    CREATE INDEX IF NOT EXISTS idx_library_chunks_content ON library_chunks(content);
  `);

  // Migrations: add columns if missing
  const safeAlter = (sql: string) => { try { _db!.exec(sql); } catch {} };
  safeAlter("ALTER TABLE courses ADD COLUMN instructions TEXT");
  safeAlter("ALTER TABLE courses ADD COLUMN lesson_simple TEXT");
  safeAlter("ALTER TABLE courses ADD COLUMN lesson_tecnico TEXT");
  safeAlter("ALTER TABLE courses ADD COLUMN parent_id INTEGER REFERENCES courses(id) ON DELETE CASCADE");

  return _db;
}

const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as any)[prop];
    if (typeof val === 'function') return val.bind(instance);
    return val;
  },
});

export default db;
