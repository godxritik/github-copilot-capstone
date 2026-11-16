import Database from 'better-sqlite3';
import path from 'path';

/**
 * Initialize SQLite database connection and create schema if it does not exist.
 * Enables foreign_keys pragma on every connection.
 */
export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable foreign keys for all connections
  db.pragma('foreign_keys = ON');

  // Create schema if it does not exist
  createSchema(db);

  return db;
}

/**
 * Create the notes and checklist_items tables if they do not exist.
 * Matches the schema in architecture.md Section 7.
 */
function createSchema(db: Database.Database): void {
  // Create notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
      body             TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 10000),
      color            TEXT NOT NULL DEFAULT 'white',
      is_pinned        INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
      is_archived      INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      continued_from_id TEXT NULL REFERENCES notes(id) ON DELETE SET NULL,
      continued_in_id   TEXT NULL REFERENCES notes(id) ON DELETE SET NULL
    );
  `);

  // Create checklist_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      text        TEXT NOT NULL DEFAULT '' CHECK (length(text) <= 80),
      is_checked  INTEGER NOT NULL DEFAULT 0 CHECK (is_checked IN (0, 1)),
      UNIQUE (note_id, position)
    );
  `);

  // Create index for efficient list queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_view 
    ON notes (is_archived, is_pinned DESC, updated_at DESC, id);
  `);
}

/**
 * Close the database connection.
 */
export function closeDatabase(db: Database.Database): void {
  db.close();
}
