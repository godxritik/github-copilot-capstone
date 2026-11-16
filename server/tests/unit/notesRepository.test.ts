import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initializeDatabase, closeDatabase } from '../../src/db/database';
import { NotesRepository, type NoteInput } from '../../src/db/notesRepository';

function makeNoteInput(overrides: Partial<NoteInput> = {}): NoteInput {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'note-1',
    title: overrides.title ?? 'Title',
    body: overrides.body ?? 'Body',
    color: overrides.color ?? 'white',
    isPinned: overrides.isPinned ?? false,
    isArchived: overrides.isArchived ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    continuedFromId: overrides.continuedFromId ?? null,
    continuedInId: overrides.continuedInId ?? null,
    checklistItems: overrides.checklistItems ?? [],
  };
}

describe('NotesRepository', () => {
  let dbPath: string;
  let db: any;
  let repo: NotesRepository;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-repo-${Date.now()}-${Math.random()}.sqlite`);
    db = initializeDatabase(dbPath);
    repo = new NotesRepository(db);
  });

  afterEach(() => {
    closeDatabase(db);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('inserts a note and returns it with checklist items', () => {
    const input = makeNoteInput({
      checklistItems: [
        { text: 'Item 1', isChecked: false },
        { text: 'Item 2', isChecked: true },
      ],
    });
    const note = repo.insertNote(input);
    expect(note.id).toBe('note-1');
    expect(note.title).toBe('Title');
    expect(note.checklistItems).toEqual([
      { text: 'Item 1', isChecked: false },
      { text: 'Item 2', isChecked: true },
    ]);
  });

  it('findById returns null for a missing note', () => {
    expect(repo.findById('missing')).toBeNull();
  });

  it('findById returns the note with items in position order', () => {
    repo.insertNote(
      makeNoteInput({
        checklistItems: [
          { text: 'First', isChecked: false },
          { text: 'Second', isChecked: false },
        ],
      })
    );
    const note = repo.findById('note-1')!;
    expect(note.checklistItems.map((i) => i.text)).toEqual(['First', 'Second']);
  });

  it('listByArchived returns only notes matching the archived flag', () => {
    repo.insertNote(makeNoteInput({ id: 'active-1', isArchived: false }));
    repo.insertNote(makeNoteInput({ id: 'archived-1', isArchived: true }));

    const active = repo.listByArchived(false);
    const archived = repo.listByArchived(true);

    expect(active.map((n) => n.id)).toEqual(['active-1']);
    expect(archived.map((n) => n.id)).toEqual(['archived-1']);
  });

  it('listByArchived orders pinned first, then updatedAt descending, then id', () => {
    repo.insertNote(
      makeNoteInput({ id: 'b', isPinned: false, updatedAt: '2026-01-02T00:00:00.000Z' })
    );
    repo.insertNote(
      makeNoteInput({ id: 'a', isPinned: false, updatedAt: '2026-01-03T00:00:00.000Z' })
    );
    repo.insertNote(
      makeNoteInput({ id: 'pinned', isPinned: true, updatedAt: '2026-01-01T00:00:00.000Z' })
    );

    const result = repo.listByArchived(false);
    expect(result.map((n) => n.id)).toEqual(['pinned', 'a', 'b']);
  });

  it('listByArchived loads checklist items for multiple notes in one pass', () => {
    repo.insertNote(
      makeNoteInput({ id: 'n1', checklistItems: [{ text: 'x', isChecked: false }] })
    );
    repo.insertNote(
      makeNoteInput({ id: 'n2', checklistItems: [{ text: 'y', isChecked: true }] })
    );
    const result = repo.listByArchived(false);
    const n1 = result.find((n) => n.id === 'n1')!;
    const n2 = result.find((n) => n.id === 'n2')!;
    expect(n1.checklistItems).toEqual([{ text: 'x', isChecked: false }]);
    expect(n2.checklistItems).toEqual([{ text: 'y', isChecked: true }]);
  });

  it('listByArchived returns an empty array when there are no matching notes', () => {
    expect(repo.listByArchived(false)).toEqual([]);
  });

  it('updateFields updates only the given scalar fields', () => {
    repo.insertNote(makeNoteInput());
    repo.updateFields('note-1', { title: 'New title', updatedAt: '2026-02-01T00:00:00.000Z' });
    const note = repo.findById('note-1')!;
    expect(note.title).toBe('New title');
    expect(note.body).toBe('Body'); // unchanged
    expect(note.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('updateFields converts booleans to 0/1 correctly', () => {
    repo.insertNote(makeNoteInput({ isPinned: false, isArchived: false }));
    repo.updateFields('note-1', { isPinned: true, isArchived: true });
    const note = repo.findById('note-1')!;
    expect(note.isPinned).toBe(true);
    expect(note.isArchived).toBe(true);
  });

  it('updateFields does nothing when given an empty fields object', () => {
    repo.insertNote(makeNoteInput({ title: 'Original' }));
    repo.updateFields('note-1', {});
    const note = repo.findById('note-1')!;
    expect(note.title).toBe('Original');
  });

  it('updateFields can set continuedFromId and continuedInId', () => {
    repo.insertNote(makeNoteInput({ id: 'n1' }));
    repo.insertNote(makeNoteInput({ id: 'n2' }));
    repo.updateFields('n1', { continuedInId: 'n2' });
    repo.updateFields('n2', { continuedFromId: 'n1' });
    expect(repo.findById('n1')!.continuedInId).toBe('n2');
    expect(repo.findById('n2')!.continuedFromId).toBe('n1');
  });

  it('replaceChecklistItems replaces the full list and positions', () => {
    repo.insertNote(
      makeNoteInput({ checklistItems: [{ text: 'old', isChecked: false }] })
    );
    repo.replaceChecklistItems('note-1', [
      { text: 'new1', isChecked: true },
      { text: 'new2', isChecked: false },
    ]);
    const note = repo.findById('note-1')!;
    expect(note.checklistItems).toEqual([
      { text: 'new1', isChecked: true },
      { text: 'new2', isChecked: false },
    ]);
  });

  it('replaceChecklistItems can clear all items', () => {
    repo.insertNote(
      makeNoteInput({ checklistItems: [{ text: 'old', isChecked: false }] })
    );
    repo.replaceChecklistItems('note-1', []);
    expect(repo.findById('note-1')!.checklistItems).toEqual([]);
  });

  it('appendChecklistItem adds an item at the next position', () => {
    repo.insertNote(
      makeNoteInput({ checklistItems: [{ text: 'first', isChecked: false }] })
    );
    repo.appendChecklistItem('note-1', { text: 'second', isChecked: false });
    const note = repo.findById('note-1')!;
    expect(note.checklistItems.map((i) => i.text)).toEqual(['first', 'second']);
  });

  it('countChecklistItems returns the correct count', () => {
    repo.insertNote(
      makeNoteInput({
        checklistItems: [
          { text: '1', isChecked: false },
          { text: '2', isChecked: false },
          { text: '3', isChecked: false },
        ],
      })
    );
    expect(repo.countChecklistItems('note-1')).toBe(3);
  });

  it('countChecklistItems returns 0 for a note with no items', () => {
    repo.insertNote(makeNoteInput());
    expect(repo.countChecklistItems('note-1')).toBe(0);
  });

  it('deleteById removes the note', () => {
    repo.insertNote(makeNoteInput());
    repo.deleteById('note-1');
    expect(repo.findById('note-1')).toBeNull();
  });

  it('deleteById cascades to checklist items', () => {
    repo.insertNote(
      makeNoteInput({ checklistItems: [{ text: 'x', isChecked: false }] })
    );
    repo.deleteById('note-1');
    expect(repo.countChecklistItems('note-1')).toBe(0);
  });

  it('runInTransaction commits all changes together', () => {
    repo.insertNote(makeNoteInput({ id: 'n1' }));
    repo.runInTransaction(() => {
      repo.updateFields('n1', { title: 'Transactional' });
    });
    expect(repo.findById('n1')!.title).toBe('Transactional');
  });

  it('runInTransaction rolls back all changes if an error is thrown', () => {
    repo.insertNote(makeNoteInput({ id: 'n1', title: 'Original' }));
    expect(() => {
      repo.runInTransaction(() => {
        repo.updateFields('n1', { title: 'Should not persist' });
        throw new Error('boom');
      });
    }).toThrow('boom');
    expect(repo.findById('n1')!.title).toBe('Original');
  });

  describe('Neighbor relinking on delete (N-08, Option 1)', () => {
    it('relinks middle note deletion: bridges previous and next notes without altering their updatedAt', () => {
      const fixedTime = '2026-01-01T12:00:00.000Z';
      repo.insertNote(makeNoteInput({ id: 'head', updatedAt: fixedTime }));
      repo.insertNote(makeNoteInput({ id: 'mid', continuedFromId: 'head', updatedAt: fixedTime }));
      repo.insertNote(makeNoteInput({ id: 'tail', continuedFromId: 'mid', updatedAt: fixedTime }));

      repo.updateFields('head', { continuedInId: 'mid' });
      repo.updateFields('mid', { continuedInId: 'tail' });

      const deleted = repo.deleteWithRelinking('mid');
      expect(deleted).toBe(true);
      expect(repo.findById('mid')).toBeNull();

      const head = repo.findById('head')!;
      const tail = repo.findById('tail')!;

      expect(head.continuedInId).toBe('tail');
      expect(head.updatedAt).toBe(fixedTime); // D-05: updatedAt unchanged

      expect(tail.continuedFromId).toBe('head');
      expect(tail.updatedAt).toBe(fixedTime); // D-05: updatedAt unchanged
    });

    it('relinks head note deletion: clears next note continuedFromId', () => {
      const fixedTime = '2026-01-01T12:00:00.000Z';
      repo.insertNote(makeNoteInput({ id: 'head', updatedAt: fixedTime }));
      repo.insertNote(makeNoteInput({ id: 'tail', continuedFromId: 'head', updatedAt: fixedTime }));
      repo.updateFields('head', { continuedInId: 'tail' });

      repo.deleteWithRelinking('head');
      expect(repo.findById('head')).toBeNull();

      const tail = repo.findById('tail')!;
      expect(tail.continuedFromId).toBeNull();
      expect(tail.updatedAt).toBe(fixedTime);
    });

    it('relinks tail note deletion: clears previous note continuedInId', () => {
      const fixedTime = '2026-01-01T12:00:00.000Z';
      repo.insertNote(makeNoteInput({ id: 'head', updatedAt: fixedTime }));
      repo.insertNote(makeNoteInput({ id: 'tail', continuedFromId: 'head', updatedAt: fixedTime }));
      repo.updateFields('head', { continuedInId: 'tail' });

      repo.deleteWithRelinking('tail');
      expect(repo.findById('tail')).toBeNull();

      const head = repo.findById('head')!;
      expect(head.continuedInId).toBeNull();
      expect(head.updatedAt).toBe(fixedTime);
    });

    it('deleteWithRelinking returns false when note does not exist', () => {
      expect(repo.deleteWithRelinking('non-existent-id')).toBe(false);
    });
  });
});
