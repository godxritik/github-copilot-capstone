import { NotesRepository, type Note, type NoteInput, type ChecklistItem } from '../db/notesRepository';

/**
 * Business logic for notes: archive/unarchive, overflow, delete with relinking,
 * and updatedAt semantics. All operations are transactional.
 */
export class NotesService {
  constructor(private repo: NotesRepository) {}

  /**
   * Create a new note with the given fields. Sets createdAt and updatedAt to now.
   * All scalar fields are validated before reaching here (by the route handler).
   */
  createNote(input: Omit<NoteInput, 'createdAt' | 'updatedAt'>): Note {
    const now = new Date().toISOString();
    return this.repo.insertNote({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Partially update a note's fields. Only fields that actually differ from the stored
   * value cause updatedAt to advance (FR-13). Archive and pin state are handled with
   * special rules. Returns the updated note.
   */
  updateNote(
    noteId: string,
    updates: Partial<Omit<NoteInput, 'id' | 'createdAt' | 'checklistItems'>> & {
      checklistItems?: ChecklistItem[];
    }
  ): Note {
    const stored = this.repo.findById(noteId);
    if (!stored) throw new Error(`Note not found: ${noteId}`);

    const fieldsToUpdate: Partial<Omit<NoteInput, 'id' | 'checklistItems'>> = {};
    let hasAnyChange = false;

    // Check archive state changes and apply archive rules
    if (updates.isArchived !== undefined && updates.isArchived !== stored.isArchived) {
      fieldsToUpdate.isArchived = updates.isArchived;
      hasAnyChange = true;

      // If archiving (isArchived: true), always clear pin state (FR-10, Section 6)
      if (updates.isArchived === true) {
        fieldsToUpdate.isPinned = false;
        hasAnyChange = true;
      }
      // If unarchiving (isArchived: false), always unpin (FR-10, Section 6)
      else if (updates.isArchived === false) {
        fieldsToUpdate.isPinned = false;
        hasAnyChange = true;
      }
    }

    // If isArchived is not being updated but isPinned is, apply archiving logic
    if (
      updates.isPinned !== undefined &&
      updates.isPinned !== stored.isPinned &&
      !('isArchived' in fieldsToUpdate)
    ) {
      fieldsToUpdate.isPinned = updates.isPinned;
      hasAnyChange = true;
    }

    // Handle other scalar fields
    const otherFields: (keyof Omit<
      Omit<NoteInput, 'id' | 'checklistItems'>,
      'isArchived' | 'isPinned'
    >)[] = ['title', 'body', 'color', 'continuedFromId', 'continuedInId'];

    for (const field of otherFields) {
      const key = field as keyof typeof updates;
      if (updates[key] !== undefined && updates[key] !== stored[key as keyof Note]) {
        (fieldsToUpdate as any)[key] = updates[key];
        hasAnyChange = true;
      }
    }

    // Handle checklist items separately
    if (updates.checklistItems !== undefined) {
      const storedItems = stored.checklistItems;
      const incomingItems = updates.checklistItems;

      // Compare checklist items by content and order (N-11: order is significant)
      const itemsEqual =
        storedItems.length === incomingItems.length &&
        storedItems.every(
          (item, i) =>
            item.text === incomingItems[i].text && item.isChecked === incomingItems[i].isChecked
        );

      if (!itemsEqual) {
        hasAnyChange = true;
      }
    }

    // Only advance updatedAt if there was an actual change (FR-13)
    if (hasAnyChange) {
      fieldsToUpdate.updatedAt = new Date().toISOString();
    }

    // Apply all changes in a transaction
    return this.repo.runInTransaction(() => {
      if (Object.keys(fieldsToUpdate).length > 0) {
        this.repo.updateFields(noteId, fieldsToUpdate);
      }
      if (updates.checklistItems !== undefined) {
        this.repo.replaceChecklistItems(noteId, updates.checklistItems);
      }
      return this.repo.findById(noteId)!;
    });
  }

  /**
   * Delete a note and relink its overflow neighbours in one transaction (N-08, Option 1).
   * If a note is in the middle of a chain (has both continuedFromId and continuedInId),
   * link the previous note to the next note. If it is the head (only continuedInId),
   * clear the next note's continuedFromId. If it is the tail (only continuedFromId),
   * clear the previous note's continuedInId. If standalone, no relinking.
   */
  deleteNote(noteId: string): void {
    return this.repo.runInTransaction(() => {
      const note = this.repo.findById(noteId);
      if (!note) throw new Error(`Note not found: ${noteId}`);

      const prev = note.continuedFromId;
      const next = note.continuedInId;

      // Middle note: relink previous to next
      if (prev && next) {
        this.repo.updateFields(prev, { continuedInId: next });
        this.repo.updateFields(next, { continuedFromId: prev });
      }
      // Head note: clear next's continuedFromId
      else if (!prev && next) {
        this.repo.updateFields(next, { continuedFromId: null });
      }
      // Tail note: clear prev's continuedInId
      else if (prev && !next) {
        this.repo.updateFields(prev, { continuedInId: null });
      }
      // Standalone: nothing to do

      // Delete the note (checklist items cascade via foreign key)
      this.repo.deleteById(noteId);
    });
  }

  /**
   * Create an overflow note from the 51st checklist item. Requires the note to have
   * exactly 50 items and not already have continuedInId set. Returns both the new
   * overflow note and the updated original note.
   */
  createOverflowNote(
    noteId: string,
    newItem: ChecklistItem
  ): { note: Note; original: Note } {
    const stored = this.repo.findById(noteId);
    if (!stored) throw new Error(`Note not found: ${noteId}`);

    // Validate preconditions
    if (stored.checklistItems.length !== 50) {
      throw new Error(`Overflow requires exactly 50 items, found ${stored.checklistItems.length}`);
    }
    if (stored.continuedInId) {
      throw new Error('Note already has a continuation; cannot overflow again');
    }
    if (stored.isArchived) {
      throw new Error('Cannot overflow an archived note');
    }

    // Create the overflow note with the new item
    const now = new Date().toISOString();
    const overflowTitle = stored.title ? `Continued from ${stored.title}` : 'Continued from Untitled';
    // Truncate overflow title to 200 characters max
    const truncatedTitle = overflowTitle.length > 200 ? overflowTitle.substring(0, 200) : overflowTitle;

    const overflowNote = this.repo.insertNote({
      id: crypto.randomUUID(), // Generate new UUID for the overflow note
      title: truncatedTitle,
      body: '',
      color: 'white',
      isPinned: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      continuedFromId: noteId,
      continuedInId: null,
      checklistItems: [newItem],
    });

    // Update the original note to link to the overflow note
    this.repo.updateFields(noteId, {
      continuedInId: overflowNote.id,
      // Do NOT update updatedAt because links are not user-edited content (D-05)
    });

    // Fetch the updated original
    const updatedOriginal = this.repo.findById(noteId)!;

    return { note: overflowNote, original: updatedOriginal };
  }
}
