import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase } from '../../src/db/database';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Database initialization', () => {
  let dbPath: string;
  let db: any;

  beforeEach(() => {
    // Create a temporary database file for testing
    dbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);
  });

  afterEach(() => {
    // Clean up the temporary database file
    if (db) {
      closeDatabase(db);
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('should create database and initialize schema', () => {
    db = initializeDatabase(dbPath);
    expect(db).toBeDefined();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('should create notes table with correct schema', () => {
    db = initializeDatabase(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .all();
    expect(tables.length).toBe(1);
  });

  it('should create checklist_items table with correct schema', () => {
    db = initializeDatabase(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='checklist_items'")
      .all();
    expect(tables.length).toBe(1);
  });

  it('should create idx_notes_view index', () => {
    db = initializeDatabase(dbPath);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_notes_view'")
      .all();
    expect(indexes.length).toBe(1);
  });

  it('should enable foreign_keys pragma', () => {
    db = initializeDatabase(dbPath);
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1); // 1 means ON
  });

  it('should enforce NOT NULL constraints on notes table', () => {
    db = initializeDatabase(dbPath);
    // Attempt to insert without required fields should fail
    const stmt = db.prepare('INSERT INTO notes (id) VALUES (?)');
    expect(() => stmt.run('test-id')).toThrow(); // missing created_at, updated_at
  });

  it('should enforce CHECK constraints on title length', () => {
    db = initializeDatabase(dbPath);
    const stmt = db.prepare(
      'INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const longTitle = 'a'.repeat(201); // exceeds 200 character limit
    expect(() =>
      stmt.run('test-id', longTitle, new Date().toISOString(), new Date().toISOString())
    ).toThrow();
  });

  it('should enforce CHECK constraints on body length', () => {
    db = initializeDatabase(dbPath);
    const stmt = db.prepare(
      'INSERT INTO notes (id, body, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const longBody = 'a'.repeat(10001); // exceeds 10000 character limit
    expect(() =>
      stmt.run('test-id', longBody, new Date().toISOString(), new Date().toISOString())
    ).toThrow();
  });

  it('should allow valid note insertion', () => {
    db = initializeDatabase(dbPath);
    const stmt = db.prepare(
      'INSERT INTO notes (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run('test-id', 'Test Note', 'Test body', new Date().toISOString(), new Date().toISOString());
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('test-id');
    expect(note).toBeDefined();
    expect(note.title).toBe('Test Note');
    expect(note.is_pinned).toBe(0);
    expect(note.is_archived).toBe(0);
  });

  it('should set default values for notes', () => {
    db = initializeDatabase(dbPath);
    const stmt = db.prepare(
      'INSERT INTO notes (id, created_at, updated_at) VALUES (?, ?, ?)'
    );
    stmt.run('test-id', new Date().toISOString(), new Date().toISOString());
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('test-id');
    expect(note.title).toBe('');
    expect(note.body).toBe('');
    expect(note.color).toBe('white');
    expect(note.is_pinned).toBe(0);
    expect(note.is_archived).toBe(0);
  });

  it('should enforce foreign key constraint on checklist_items', () => {
    db = initializeDatabase(dbPath);
    const stmt = db.prepare(
      'INSERT INTO checklist_items (note_id, position, text) VALUES (?, ?, ?)'
    );
    expect(() => stmt.run('nonexistent-note-id', 1, 'Test item')).toThrow(); // Foreign key violation
  });

  it('should cascade delete checklist items when note is deleted', () => {
    db = initializeDatabase(dbPath);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO notes (id, created_at, updated_at) VALUES (?, ?, ?)').run(
      'test-id',
      now,
      now
    );
    db.prepare('INSERT INTO checklist_items (note_id, position, text) VALUES (?, ?, ?)').run(
      'test-id',
      1,
      'Item 1'
    );

    // Delete the note
    db.prepare('DELETE FROM notes WHERE id = ?').run('test-id');

    // Verify checklist items are also deleted
    const items = db.prepare('SELECT * FROM checklist_items WHERE note_id = ?').all('test-id');
    expect(items.length).toBe(0);
  });

  it('should allow nullable overflow link fields', () => {
    db = initializeDatabase(dbPath);
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO notes (id, created_at, updated_at, continued_from_id, continued_in_id) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run('test-id', now, now, null, null);
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('test-id');
    expect(note.continued_from_id).toBeNull();
    expect(note.continued_in_id).toBeNull();
  });

  it('should idempotent on multiple calls', () => {
    db = initializeDatabase(dbPath);
    const tables1 = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();
    closeDatabase(db);

    // Re-initialize the same database
    db = initializeDatabase(dbPath);
    const tables2 = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();

    // Should have the same tables (not created twice)
    expect(tables2.count).toBe(tables1.count);
  });
});
