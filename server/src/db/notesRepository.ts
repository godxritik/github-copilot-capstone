import type Database from 'better-sqlite3';

export interface ChecklistItemRow {
  text: string;
  is_checked: number;
}

export interface ChecklistItem {
  text: string;
  isChecked: boolean;
}

export interface NoteRow {
  id: string;
  title: string;
  body: string;
  color: string;
  is_pinned: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  continued_from_id: string | null;
  continued_in_id: string | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  color: string;
  checklistItems: ChecklistItem[];
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  continuedFromId: string | null;
  continuedInId: string | null;
}

export interface NoteInput {
  id: string;
  title: string;
  body: string;
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  continuedFromId: string | null;
  continuedInId: string | null;
  checklistItems: ChecklistItem[];
}

function rowToNote(row: NoteRow, items: ChecklistItemRow[]): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color,
    checklistItems: items.map((i) => ({ text: i.text, isChecked: i.is_checked === 1 })),
    isPinned: row.is_pinned === 1,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    continuedFromId: row.continued_from_id,
    continuedInId: row.continued_in_id,
  };
}

/**
 * Repository for note persistence. All queries use prepared statements with
 * bound parameters. Business rules (archive, overflow, updatedAt) live in the
 * service layer, not here.
 */
export class NotesRepository {
  constructor(private db: Database.Database) {}

  /** Insert a new note and its checklist items in one transaction. */
  insertNote(note: NoteInput): Note {
    const insertNoteStmt = this.db.prepare(`
      INSERT INTO notes (
        id, title, body, color, is_pinned, is_archived,
        created_at, updated_at, continued_from_id, continued_in_id
      ) VALUES (@id, @title, @body, @color, @isPinned, @isArchived,
        @createdAt, @updatedAt, @continuedFromId, @continuedInId)
    `);
    const insertItemStmt = this.db.prepare(`
      INSERT INTO checklist_items (note_id, position, text, is_checked)
      VALUES (?, ?, ?, ?)
    `);

    const tx = this.db.transaction((n: NoteInput) => {
      insertNoteStmt.run({
        id: n.id,
        title: n.title,
        body: n.body,
        color: n.color,
        isPinned: n.isPinned ? 1 : 0,
        isArchived: n.isArchived ? 1 : 0,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        continuedFromId: n.continuedFromId,
        continuedInId: n.continuedInId,
      });
      n.checklistItems.forEach((item, index) => {
        insertItemStmt.run(n.id, index, item.text, item.isChecked ? 1 : 0);
      });
    });
    tx(note);

    return this.findById(note.id)!;
  }

  /** Find one note by id, including its checklist items. Returns null if not found. */
  findById(id: string): Note | null {
    const row = this.db
      .prepare('SELECT * FROM notes WHERE id = ?')
      .get(id) as NoteRow | undefined;
    if (!row) return null;
    const items = this.db
      .prepare('SELECT text, is_checked FROM checklist_items WHERE note_id = ? ORDER BY position')
      .all(id) as ChecklistItemRow[];
    return rowToNote(row, items);
  }

  /**
   * List notes in one view (active or archived), ordered pinned first then by
   * updatedAt descending then id. Checklist items for all returned notes are
   * loaded in one additional query to avoid N+1 queries.
   */
  listByArchived(isArchived: boolean): Note[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM notes WHERE is_archived = ?
         ORDER BY is_pinned DESC, updated_at DESC, id`
      )
      .all(isArchived ? 1 : 0) as NoteRow[];

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(', ');
    const allItems = this.db
      .prepare(
        `SELECT note_id, text, is_checked FROM checklist_items
         WHERE note_id IN (${placeholders}) ORDER BY note_id, position`
      )
      .all(...ids) as (ChecklistItemRow & { note_id: string })[];

    const itemsByNote = new Map<string, ChecklistItemRow[]>();
    for (const item of allItems) {
      const list = itemsByNote.get(item.note_id) ?? [];
      list.push(item);
      itemsByNote.set(item.note_id, list);
    }

    return rows.map((row) => rowToNote(row, itemsByNote.get(row.id) ?? []));
  }

  /**
   * Partially update a note's scalar fields. Pass only the fields that
   * should change; checklist items are replaced separately with
   * replaceChecklistItems. Does not implement business rules (e.g. archive
   * side effects); the service layer decides what to pass here.
   */
  updateFields(id: string, fields: Partial<Omit<NoteInput, 'id' | 'checklistItems'>>): void {
    const columnMap: Record<string, string> = {
      title: 'title',
      body: 'body',
      color: 'color',
      isPinned: 'is_pinned',
      isArchived: 'is_archived',
      updatedAt: 'updated_at',
      continuedFromId: 'continued_from_id',
      continuedInId: 'continued_in_id',
    };

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const column = columnMap[key];
      if (!column) continue;
      sets.push(`${column} = ?`);
      if (key === 'isPinned' || key === 'isArchived') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
    if (sets.length === 0) return;

    values.push(id);
    this.db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  /** Replace all checklist items for a note with the given ordered list. */
  replaceChecklistItems(noteId: string, items: ChecklistItem[]): void {
    const deleteStmt = this.db.prepare('DELETE FROM checklist_items WHERE note_id = ?');
    const insertStmt = this.db.prepare(
      'INSERT INTO checklist_items (note_id, position, text, is_checked) VALUES (?, ?, ?, ?)'
    );
    const tx = this.db.transaction((id: string, list: ChecklistItem[]) => {
      deleteStmt.run(id);
      list.forEach((item, index) => {
        insertStmt.run(id, index, item.text, item.isChecked ? 1 : 0);
      });
    });
    tx(noteId, items);
  }

  /** Delete a note permanently. Checklist items cascade via the foreign key. */
  deleteById(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  /**
   * Relinks neighbors when a note is being deleted (Architecture §6 Rules N-08, Option 1).
   * Relinking changes only link fields, preserving neighbors' updatedAt (D-05).
   */
  relinkNeighbors(continuedFromId: string | null, continuedInId: string | null): void {
    if (continuedFromId && continuedInId) {
      // Middle note: bridge previous and next
      this.db
        .prepare('UPDATE notes SET continued_in_id = ? WHERE id = ?')
        .run(continuedInId, continuedFromId);
      this.db
        .prepare('UPDATE notes SET continued_from_id = ? WHERE id = ?')
        .run(continuedFromId, continuedInId);
    } else if (!continuedFromId && continuedInId) {
      // Head note: clear next note's continuedFromId
      this.db
        .prepare('UPDATE notes SET continued_from_id = NULL WHERE id = ?')
        .run(continuedInId);
    } else if (continuedFromId && !continuedInId) {
      // Tail note: clear previous note's continuedInId
      this.db
        .prepare('UPDATE notes SET continued_in_id = NULL WHERE id = ?')
        .run(continuedFromId);
    }
  }

  /**
   * Delete a note and relink its overflow neighbours in one transaction (Architecture §6 Rules).
   * Returns true if note existed and was deleted, false otherwise.
   */
  deleteWithRelinking(id: string): boolean {
    return this.runInTransaction(() => {
      const note = this.db
        .prepare('SELECT continued_from_id, continued_in_id FROM notes WHERE id = ?')
        .get(id) as { continued_from_id: string | null; continued_in_id: string | null } | undefined;

      if (!note) return false;

      this.relinkNeighbors(note.continued_from_id, note.continued_in_id);
      this.deleteById(id);
      return true;
    });
  }

  /** Run an arbitrary function inside a single database transaction. */
  runInTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
