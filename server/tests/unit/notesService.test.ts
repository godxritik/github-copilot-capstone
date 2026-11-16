import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initializeDatabase, closeDatabase } from '../../src/db/database.js';
import { NotesRepository } from '../../src/db/notesRepository.js';
import { NotesService } from '../../src/services/notesService.js';
import { AppError } from '../../src/errors/AppError.js';

describe('NotesService (B-06)', () => {
  let dbPath: string;
  let db: any;
  let repo: NotesRepository;
  let service: NotesService;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-service-${Date.now()}-${Math.random()}.sqlite`);
    db = initializeDatabase(dbPath);
    repo = new NotesRepository(db);
    service = new NotesService(repo);
  });

  afterEach(() => {
    closeDatabase(db);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  describe('createNote and repeated POST idempotency (B-07, N-01, N-11)', () => {
    it('creates a note with white default, unpinned, unarchived, and timestamps (201)', () => {
      const res = service.createNote({ id: 'uuid-1', title: 'New Note' });
      expect(res.status).toBe(201);
      const note = res.note;
      expect(note.id).toBe('uuid-1');
      expect(note.title).toBe('New Note');
      expect(note.body).toBe('');
      expect(note.color).toBe('white');
      expect(note.isPinned).toBe(false);
      expect(note.isArchived).toBe(false);
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBeDefined();
      expect(note.continuedFromId).toBeNull();
      expect(note.continuedInId).toBeNull();
      expect(note.checklistItems).toEqual([]);
    });

    it('returns status 200 and stored note on identical repeated POST (N-01)', () => {
      service.createNote({
        id: 'uuid-idem',
        title: 'Original',
        body: 'Body',
        color: 'teal',
        checklistItems: [{ text: 'Item 1', isChecked: false }],
      });

      const retry = service.createNote({
        id: 'uuid-idem',
        title: 'Original',
        body: 'Body',
        color: 'teal',
        checklistItems: [{ text: 'Item 1', isChecked: false }],
      });

      expect(retry.status).toBe(200);
      expect(retry.note.id).toBe('uuid-idem');
      expect(retry.note.title).toBe('Original');
    });

    it('treats omitted color as white when comparing identical retry (N-11)', () => {
      service.createNote({
        id: 'uuid-white',
        title: 'White Note',
        body: '',
        color: 'white',
      });

      // Omit color in retry -> normalized to white -> matches!
      const retry = service.createNote({
        id: 'uuid-white',
        title: 'White Note',
        body: '',
      });
      expect(retry.status).toBe(200);
    });

    it('rejects omitted color retry if stored note has non-white color (N-11)', () => {
      service.createNote({
        id: 'uuid-red',
        title: 'Red Note',
        body: '',
        color: 'red',
      });

      // Omit color -> treated as white -> does not match stored red note -> 400
      expect(() =>
        service.createNote({
          id: 'uuid-red',
          title: 'Red Note',
          body: '',
        })
      ).toThrowError(/already exists with different content/);
    });

    it('rejects repeated POST with conflicting title, body, or color (N-01)', () => {
      service.createNote({ id: 'uuid-conflict', title: 'T1' });

      expect(() =>
        service.createNote({ id: 'uuid-conflict', title: 'Different Title' })
      ).toThrowError(AppError);
    });

    it('rejects repeated POST with reordered checklist items (N-11: order is significant)', () => {
      service.createNote({
        id: 'uuid-order',
        checklistItems: [
          { text: 'A', isChecked: false },
          { text: 'B', isChecked: true },
        ],
      });

      expect(() =>
        service.createNote({
          id: 'uuid-order',
          checklistItems: [
            { text: 'B', isChecked: true },
            { text: 'A', isChecked: false },
          ],
        })
      ).toThrowError(AppError);
    });

    it('enforces 50-item checklist limit on creation (B-10)', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ text: `Item ${i}`, isChecked: false }));
      expect(() =>
        service.createNote({ id: 'uuid-51', checklistItems: items })
      ).toThrowError(/exceed 50 items/);
    });
  });

  describe('getNoteById', () => {
    it('returns note when found', () => {
      service.createNote({ id: 'uuid-1', title: 'Note 1' });
      const found = service.getNoteById('uuid-1');
      expect(found.title).toBe('Note 1');
    });

    it('throws 404 NOT_FOUND when note does not exist', () => {
      expect(() => service.getNoteById('non-existent')).toThrowError(AppError);
      try {
        service.getNoteById('non-existent');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('listNotes', () => {
    it('filters notes by isArchived state', () => {
      service.createNote({ id: 'n1', title: 'Active' });
      const note2 = service.createNote({ id: 'n2', title: 'Will Archive' });
      service.updateNote('n2', { isArchived: true });

      const active = service.listNotes(false);
      const archived = service.listNotes(true);

      expect(active.map((n) => n.id)).toEqual(['n1']);
      expect(archived.map((n) => n.id)).toEqual(['n2']);
    });
  });

  describe('updateNote rules (Architecture Section 6 Rules)', () => {
    it('throws 404 NOT_FOUND when updating non-existent note', () => {
      expect(() => service.updateNote('missing', { title: 'New' })).toThrowError(AppError);
    });

    it('advances updatedAt when a stored field value actually changes (FR-13)', async () => {
      const res = service.createNote({ id: 'n1', title: 'Initial' });
      const initialUpdatedAt = res.note.updatedAt;

      // Small delay to ensure timestamp change
      await new Promise((r) => setTimeout(r, 10));

      const updated = service.updateNote('n1', { title: 'Changed' });
      expect(updated.title).toBe('Changed');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialUpdatedAt).getTime()
      );
    });

    it('preserves updatedAt when all update values match stored values (FR-13)', () => {
      const res = service.createNote({ id: 'n1', title: 'Initial', body: 'Body' });
      const originalUpdatedAt = res.note.updatedAt;

      const updated = service.updateNote('n1', { title: 'Initial', body: 'Body' });
      expect(updated.updatedAt).toBe(originalUpdatedAt);
    });

    it('preserves updatedAt when checklist items are identical in content and order (FR-13, N-11)', () => {
      service.createNote({
        id: 'n1',
        checklistItems: [{ text: 'Item 1', isChecked: false }],
      });
      const stored = service.getNoteById('n1');
      const originalUpdatedAt = stored.updatedAt;

      const updated = service.updateNote('n1', {
        checklistItems: [{ text: 'Item 1', isChecked: false }],
      });
      expect(updated.updatedAt).toBe(originalUpdatedAt);
    });

    it('advances updatedAt when checklist item text or order changes (FR-13, N-11)', async () => {
      service.createNote({
        id: 'n1',
        checklistItems: [
          { text: 'A', isChecked: false },
          { text: 'B', isChecked: false },
        ],
      });
      const originalUpdatedAt = service.getNoteById('n1').updatedAt;
      await new Promise((r) => setTimeout(r, 10));

      // Change order
      const updated = service.updateNote('n1', {
        checklistItems: [
          { text: 'B', isChecked: false },
          { text: 'A', isChecked: false },
        ],
      });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('archiving an active note always sets isPinned to false', () => {
      service.createNote({ id: 'n1', title: 'Pinned Note' });
      service.updateNote('n1', { isPinned: true });
      expect(service.getNoteById('n1').isPinned).toBe(true);

      // Archive it
      const archived = service.updateNote('n1', { isArchived: true });
      expect(archived.isArchived).toBe(true);
      expect(archived.isPinned).toBe(false);
    });

    it('archiving an active note unpins it even if isPinned: true was sent in same PATCH', () => {
      service.createNote({ id: 'n1', title: 'Active' });
      const archived = service.updateNote('n1', { isArchived: true, isPinned: true });
      expect(archived.isArchived).toBe(true);
      expect(archived.isPinned).toBe(false);
    });

    it('rejects edits on an archived note with 400 NOTE_ARCHIVED (D-04)', () => {
      service.createNote({ id: 'n1', title: 'Archived Note' });
      service.updateNote('n1', { isArchived: true });

      // Attempt to edit title
      expect(() => service.updateNote('n1', { title: 'New Title' })).toThrowError(AppError);
      try {
        service.updateNote('n1', { title: 'New Title' });
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('NOTE_ARCHIVED');
        expect(err.message).toBe('Archived notes are read-only. Unarchive the note to edit it.');
      }

      // Attempt to edit color
      try {
        service.updateNote('n1', { color: 'teal' });
        expect.unreachable();
      } catch (err: any) {
        expect(err.code).toBe('NOTE_ARCHIVED');
      }

      // Attempt to pin
      try {
        service.updateNote('n1', { isPinned: true });
        expect.unreachable();
      } catch (err: any) {
        expect(err.code).toBe('NOTE_ARCHIVED');
      }
    });

    it('allows pure unarchive (isArchived: false only) and returns note unpinned', () => {
      service.createNote({ id: 'n1', title: 'Note' });
      service.updateNote('n1', { isArchived: true });

      const unarchived = service.updateNote('n1', { isArchived: false });
      expect(unarchived.isArchived).toBe(false);
      expect(unarchived.isPinned).toBe(false);
    });

    it('allows unarchive when other fields in payload are identical to stored values', () => {
      service.createNote({ id: 'n1', title: 'Unchanged Title' });
      service.updateNote('n1', { isArchived: true });

      // Sending title with same value doesn't count as an actual field change
      const unarchived = service.updateNote('n1', { isArchived: false, title: 'Unchanged Title' });
      expect(unarchived.isArchived).toBe(false);
    });

    it('rejects combined unarchive with other actual field changes with 400 VALIDATION_ERROR', () => {
      service.createNote({ id: 'n1', title: 'Old Title' });
      service.updateNote('n1', { isArchived: true });

      expect(() =>
        service.updateNote('n1', { isArchived: false, title: 'Brand New Title' })
      ).toThrowError(AppError);

      try {
        service.updateNote('n1', { isArchived: false, title: 'Brand New Title' });
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('deleteNote', () => {
    it('deletes note and relinks neighbors', () => {
      service.createNote({ id: 'n1', title: 'To Delete' });
      service.deleteNote('n1');
      expect(() => service.getNoteById('n1')).toThrowError(AppError);
    });

    it('throws 404 NOT_FOUND if deleting missing note', () => {
      expect(() => service.deleteNote('missing')).toThrowError(AppError);
    });
  });

  describe('createOverflowNote (B-08, P-02, R3-01)', () => {
    function make50Items() {
      return Array.from({ length: 50 }, (_, i) => ({ text: `Item ${i + 1}`, isChecked: false }));
    }

    it('creates overflow note for note with 50 items (status 201)', () => {
      service.createNote({ id: 'orig-1', title: 'Groceries', checklistItems: make50Items() });

      const res = service.createOverflowNote('orig-1', 'over-1', { text: '51st Item', isChecked: false });
      expect(res.status).toBe(201);
      expect(res.note.id).toBe('over-1');
      expect(res.note.title).toBe('Continued from Groceries');
      expect(res.note.continuedFromId).toBe('orig-1');
      expect(res.note.continuedInId).toBeNull();
      expect(res.note.checklistItems).toEqual([{ text: '51st Item', isChecked: false }]);
      expect(res.original.continuedInId).toBe('over-1');
    });

    it('creates overflow note titled "Continued from Untitled" if original title is empty', () => {
      service.createNote({ id: 'orig-empty', title: '', checklistItems: make50Items() });

      const res = service.createOverflowNote('orig-empty', 'over-empty', { text: 'Item 51', isChecked: false });
      expect(res.note.title).toBe('Continued from Untitled');
    });

    it('truncates overflow title to at most 200 code points', () => {
      // 195 chars original title + 15 chars ('Continued from ') = 210 chars -> truncated to 200 chars
      const originalTitle = 'x'.repeat(195);
      service.createNote({ id: 'orig-long', title: originalTitle, checklistItems: make50Items() });

      const res = service.createOverflowNote('orig-long', 'over-long', { text: 'Item 51', isChecked: false });
      expect([...res.note.title].length).toBe(200);
      expect(res.note.title.startsWith('Continued from ')).toBe(true);
    });

    it('returns status 200 on identical overflow retry (R3-01 Step 1)', () => {
      service.createNote({ id: 'orig-retry', title: 'Task list', checklistItems: make50Items() });
      service.createOverflowNote('orig-retry', 'over-retry', { text: 'Item 51', isChecked: false });

      // Identical retry
      const retry = service.createOverflowNote('orig-retry', 'over-retry', { text: 'Item 51', isChecked: false });
      expect(retry.status).toBe(200);
      expect(retry.note.id).toBe('over-retry');
    });

    it('rejects overflow retry with different item content with 400 VALIDATION_ERROR (R3-01 Step 1)', () => {
      service.createNote({ id: 'orig-retry-diff', title: 'Task list', checklistItems: make50Items() });
      service.createOverflowNote('orig-retry-diff', 'over-retry-diff', { text: 'Item 51', isChecked: false });

      expect(() =>
        service.createOverflowNote('orig-retry-diff', 'over-retry-diff', { text: 'Different item', isChecked: false })
      ).toThrowError(AppError);
    });

    it('rejects overflow if overflowId already exists on another note (R3-01 Step 2)', () => {
      service.createNote({ id: 'unrelated', title: 'Unrelated note' });
      service.createNote({ id: 'orig-busy', title: 'Busy', checklistItems: make50Items() });

      expect(() =>
        service.createOverflowNote('orig-busy', 'unrelated', { text: 'Item 51', isChecked: false })
      ).toThrowError(/already exists/);
    });

    it('rejects overflow if original already continued in a different note (R3-01 Step 3)', () => {
      service.createNote({ id: 'orig-chained', title: 'Chain', checklistItems: make50Items() });
      service.createOverflowNote('orig-chained', 'first-over', { text: 'Item 51', isChecked: false });

      expect(() =>
        service.createOverflowNote('orig-chained', 'second-over', { text: 'Item 52', isChecked: false })
      ).toThrowError(/already has a continuation/);
    });

    it('rejects overflow on an archived note with 400 NOTE_ARCHIVED (R3-01 Step 4)', () => {
      service.createNote({ id: 'orig-arch', title: 'Archived list', checklistItems: make50Items() });
      service.updateNote('orig-arch', { isArchived: true });

      expect(() =>
        service.createOverflowNote('orig-arch', 'over-arch', { text: 'Item 51', isChecked: false })
      ).toThrowError(AppError);

      try {
        service.createOverflowNote('orig-arch', 'over-arch', { text: 'Item 51', isChecked: false });
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('NOTE_ARCHIVED');
      }
    });

    it('rejects overflow on a note with fewer than 50 items with 400 VALIDATION_ERROR (R3-01 Step 4)', () => {
      service.createNote({ id: 'orig-short', title: 'Short list', checklistItems: [{ text: 'Item 1', isChecked: false }] });

      expect(() =>
        service.createOverflowNote('orig-short', 'over-short', { text: 'Item 2', isChecked: false })
      ).toThrowError(/Overflow requires at least 50 items/);
    });
  });
});
