import { NotesRepository, type Note, type NoteInput, type ChecklistItem } from '../db/notesRepository.js';
import { AppError } from '../errors/AppError.js';

export interface CreateNoteServiceInput {
  id: string;
  title?: string;
  body?: string;
  color?: string;
  checklistItems?: ChecklistItem[];
}

export interface UpdateNoteServiceInput {
  title?: string;
  body?: string;
  color?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  checklistItems?: ChecklistItem[];
}

export interface CreateNoteResult {
  status: 201 | 200;
  note: Note;
}

export interface OverflowResult {
  status: 201 | 200;
  note: Note;
  original: Note;
}

/**
 * Business logic for notes: archive/unarchive, overflow, delete with relinking,
 * repeated POST idempotency, and updatedAt semantics. All operations are transactional.
 */
export class NotesService {
  constructor(private repo: NotesRepository) {}

  /**
   * Create a new note or handle repeated POST idempotency (N-01, N-11).
   * - If id does not exist: creates note with status 201.
   * - If id exists and content matches (title, body, normalized color, ordered checklist): returns status 200 and stored note.
   * - If id exists and content differs: throws 400 VALIDATION_ERROR without modifying stored note.
   */
  createNote(input: CreateNoteServiceInput): CreateNoteResult {
    const stored = this.repo.findById(input.id);
    if (stored) {
      const inputTitle = input.title ?? '';
      const inputBody = input.body ?? '';
      const inputColor = input.color ?? 'white';
      const inputItems = input.checklistItems ?? [];

      const titleMatches = stored.title === inputTitle;
      const bodyMatches = stored.body === inputBody;
      const colorMatches = stored.color === inputColor;

      const itemsMatch =
        stored.checklistItems.length === inputItems.length &&
        stored.checklistItems.every(
          (item, idx) =>
            item.text === inputItems[idx].text &&
            item.isChecked === inputItems[idx].isChecked
        );

      if (titleMatches && bodyMatches && colorMatches && itemsMatch) {
        return { status: 200, note: stored };
      } else {
        throw AppError.validationError('Note with this ID already exists with different content');
      }
    }

    if (input.checklistItems && input.checklistItems.length > 50) {
      throw AppError.validationError('Checklist cannot exceed 50 items');
    }

    const now = new Date().toISOString();
    const note = this.repo.insertNote({
      id: input.id,
      title: input.title ?? '',
      body: input.body ?? '',
      color: input.color ?? 'white',
      isPinned: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      continuedFromId: null,
      continuedInId: null,
      checklistItems: input.checklistItems ?? [],
    });

    return { status: 201, note };
  }

  /**
   * Read one note by ID. Throws 404 NOT_FOUND if note does not exist.
   */
  getNoteById(id: string): Note {
    const note = this.repo.findById(id);
    if (!note) {
      throw AppError.notFound('Note not found');
    }
    return note;
  }

  /**
   * List notes in one view (active or archived).
   */
  listNotes(isArchived: boolean): Note[] {
    return this.repo.listByArchived(isArchived);
  }

  /**
   * Partially update a note's fields according to Architecture §6 Rules.
   */
  updateNote(noteId: string, updates: UpdateNoteServiceInput): Note {
    const stored = this.repo.findById(noteId);
    if (!stored) {
      throw AppError.notFound('Note not found');
    }

    if (updates.checklistItems !== undefined && updates.checklistItems.length > 50) {
      throw AppError.validationError('Checklist cannot exceed 50 items');
    }

    const titleChanged = updates.title !== undefined && updates.title !== stored.title;
    const bodyChanged = updates.body !== undefined && updates.body !== stored.body;
    const colorChanged = updates.color !== undefined && updates.color !== stored.color;
    const isPinnedChanged = updates.isPinned !== undefined && updates.isPinned !== stored.isPinned;

    let checklistChanged = false;
    if (updates.checklistItems !== undefined) {
      if (updates.checklistItems.length !== stored.checklistItems.length) {
        checklistChanged = true;
      } else {
        checklistChanged = updates.checklistItems.some(
          (item, i) =>
            item.text !== stored.checklistItems[i].text ||
            item.isChecked !== stored.checklistItems[i].isChecked
        );
      }
    }

    const otherFieldsChanged =
      titleChanged || bodyChanged || colorChanged || isPinnedChanged || checklistChanged;

    const fieldsToUpdate: Partial<Omit<NoteInput, 'id' | 'checklistItems'>> = {};
    let hasAnyChange = false;

    if (stored.isArchived) {
      if (updates.isArchived !== false) {
        throw AppError.noteArchived();
      }

      if (otherFieldsChanged) {
        throw AppError.validationError('Cannot combine unarchiving with other field changes');
      }

      fieldsToUpdate.isArchived = false;
      fieldsToUpdate.isPinned = false;
      hasAnyChange = true;
    } else {
      if (updates.isArchived === true) {
        fieldsToUpdate.isArchived = true;
        fieldsToUpdate.isPinned = false;
        hasAnyChange = true;
      } else if (isPinnedChanged) {
        fieldsToUpdate.isPinned = updates.isPinned!;
        hasAnyChange = true;
      }

      if (titleChanged) {
        fieldsToUpdate.title = updates.title!;
        hasAnyChange = true;
      }
      if (bodyChanged) {
        fieldsToUpdate.body = updates.body!;
        hasAnyChange = true;
      }
      if (colorChanged) {
        fieldsToUpdate.color = updates.color!;
        hasAnyChange = true;
      }
      if (checklistChanged) {
        hasAnyChange = true;
      }
    }

    if (hasAnyChange) {
      fieldsToUpdate.updatedAt = new Date().toISOString();
    }

    return this.repo.runInTransaction(() => {
      if (Object.keys(fieldsToUpdate).length > 0) {
        this.repo.updateFields(noteId, fieldsToUpdate);
      }
      if (checklistChanged && updates.checklistItems !== undefined) {
        this.repo.replaceChecklistItems(noteId, updates.checklistItems);
      }
      return this.repo.findById(noteId)!;
    });
  }

  /**
   * Delete a note and relink its overflow neighbours in one transaction (N-08, Option 1).
   */
  deleteNote(noteId: string): void {
    const deleted = this.repo.deleteWithRelinking(noteId);
    if (!deleted) {
      throw AppError.notFound('Note not found');
    }
  }

  /**
   * Create an overflow note from the 51st checklist item (P-02 / R3-01).
   * Follows R3-01 check order:
   * 1. If original.continuedInId === overflowId:
   *    If stored overflow item matches: return 200 with { note, original }.
   *    If content differs: return 400 VALIDATION_ERROR.
   * 2. If overflowId exists on another note: return 400 VALIDATION_ERROR.
   * 3. If original.continuedInId is set to a different ID: return 400 VALIDATION_ERROR.
   * 4. Otherwise verify original is not archived and has exactly 50 items, create overflow note with status 201.
   */
  createOverflowNote(
    originalNoteId: string,
    overflowId: string,
    newItem: ChecklistItem
  ): OverflowResult {
    const original = this.repo.findById(originalNoteId);
    if (!original) {
      throw AppError.notFound('Note not found');
    }

    // Step 1: Idempotency check for retry of the same continuation
    if (original.continuedInId === overflowId) {
      const storedOverflow = this.repo.findById(overflowId);
      if (
        storedOverflow &&
        storedOverflow.checklistItems.length === 1 &&
        storedOverflow.checklistItems[0].text === newItem.text &&
        storedOverflow.checklistItems[0].isChecked === newItem.isChecked
      ) {
        return { status: 200, note: storedOverflow, original };
      } else {
        throw AppError.validationError('Overflow note with this ID already exists with different content');
      }
    }

    // Step 2: Id exists on another note
    const existingWithId = this.repo.findById(overflowId);
    if (existingWithId) {
      throw AppError.validationError('Note with this ID already exists');
    }

    // Step 3: Original already has a different continuation
    if (original.continuedInId !== null) {
      throw AppError.validationError('Note already has a continuation; cannot overflow again');
    }

    // Step 4: Validate preconditions for initial overflow creation
    if (original.isArchived) {
      throw AppError.noteArchived();
    }

    if (original.checklistItems.length < 50) {
      throw AppError.validationError(
        `Overflow requires at least 50 items, found ${original.checklistItems.length}`
      );
    }

    return this.repo.runInTransaction(() => {
      const now = new Date().toISOString();
      const rawTitle = original.title ? `Continued from ${original.title}` : 'Continued from Untitled';
      const codePoints = [...rawTitle];
      const overflowTitle = codePoints.length > 200 ? codePoints.slice(0, 200).join('') : rawTitle;

      const overflowNote = this.repo.insertNote({
        id: overflowId,
        title: overflowTitle,
        body: '',
        color: 'white',
        isPinned: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        continuedFromId: originalNoteId,
        continuedInId: null,
        checklistItems: [newItem],
      });

      this.repo.updateFields(originalNoteId, {
        continuedInId: overflowId,
      });

      const updatedOriginal = this.repo.findById(originalNoteId)!;
      return { status: 201, note: overflowNote, original: updatedOriginal };
    });
  }
}
