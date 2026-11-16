import { notesApi, ApiError, type Note } from '../api/notesApi.js';
import type { NoteDraft } from '../hooks/useDrafts.js';

export type ReconciliationAction =
  | { type: 'APPLY_AND_SAVE'; draft: NoteDraft }
  | { type: 'CONFIRM_WITH_USER'; draft: NoteDraft; serverNote: Note }
  | { type: 'DISCARD_REMOVED_404'; draft: NoteDraft }
  | { type: 'NONE' };

export async function reconcileDraftOnLoad(
  draft: NoteDraft,
  serverNote?: Note | null
): Promise<ReconciliationAction> {
  // Rejected draft (R3-02): check if note was removed (404) and discard
  if (draft.rejected) {
    try {
      await notesApi.getNote(draft.noteId);
      return { type: 'NONE' };
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isNotFound) {
        return { type: 'DISCARD_REMOVED_404', draft };
      }
      return { type: 'NONE' };
    }
  }

  // Non-rejected draft: if server note does not exist, apply
  if (!serverNote) {
    return { type: 'APPLY_AND_SAVE', draft };
  }

  const serverTime = new Date(serverNote.updatedAt).getTime();
  const draftTime = new Date(draft.draftedAt).getTime();

  // If server copy is newer than local draft, prompt user confirmation before overwriting (P-07)
  if (serverTime > draftTime) {
    return { type: 'CONFIRM_WITH_USER', draft, serverNote };
  }

  // Otherwise apply and save
  return { type: 'APPLY_AND_SAVE', draft };
}