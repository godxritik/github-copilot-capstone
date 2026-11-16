import { useRef, useEffect, useCallback } from 'react';
import { notesApi, ApiError, type Note, type UpdateNotePayload } from '../api/notesApi.js';
import { useDrafts } from './useDrafts.js';
import { TOAST_MESSAGES } from '../components/Toast.js';

export interface UseAutoSaveOptions {
  noteId: string;
  onSaveSuccess?: (savedNote: Note) => void;
  onNoteNotFound?: (noteId: string) => void;
  onSaveRejected?: (noteId: string, message: string) => void;
  onSaveFailed?: (message: string) => void;
}

export function useAutoSave({
  noteId,
  onSaveSuccess,
  onNoteNotFound,
  onSaveRejected,
  onSaveFailed,
}: UseAutoSaveOptions) {
  const { saveDraft, clearDraft, markDraftRejected, getDraft } = useDrafts();

  const inFlightRef = useRef(false);
  const queuedPayloadRef = useRef<UpdateNotePayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSave = useCallback(
    async (payload: UpdateNotePayload) => {
      if (inFlightRef.current) {
        queuedPayloadRef.current = payload;
        return;
      }

      inFlightRef.current = true;
      queuedPayloadRef.current = null;

      try {
        const updated = await notesApi.updateNote(noteId, payload);
        clearDraft(noteId);
        onSaveSuccess?.(updated);
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.isNotFound) {
            clearDraft(noteId);
            onNoteNotFound?.(noteId);
          } else if (err.isValidationError || err.isNoteArchived) {
            markDraftRejected(noteId, err.message);
            onSaveRejected?.(noteId, err.message);
          } else {
            // 5xx or server error: keep draft, show save-failed message
            onSaveFailed?.(TOAST_MESSAGES.SAVE_FAILED);
          }
        } else {
          // Network failure: keep draft, show save-failed message
          onSaveFailed?.(TOAST_MESSAGES.SAVE_FAILED);
        }
      } finally {
        inFlightRef.current = false;

        // If another update was queued while this one was in flight, process latest state next
        if (queuedPayloadRef.current) {
          const nextPayload = queuedPayloadRef.current;
          queuedPayloadRef.current = null;
          executeSave(nextPayload);
        }
      }
    },
    [noteId, clearDraft, markDraftRejected, onSaveSuccess, onNoteNotFound, onSaveRejected, onSaveFailed]
  );

  const scheduleAutoSave = useCallback(
    (payload: UpdateNotePayload) => {
      saveDraft({ noteId, ...payload });

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        executeSave(payload);
      }, 2000); // 2 second pause in typing (FR-04)
    },
    [noteId, saveDraft, executeSave]
  );

  const triggerBlurSave = useCallback(
    (payload: UpdateNotePayload) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      saveDraft({ noteId, ...payload });
      executeSave(payload);
    },
    [noteId, saveDraft, executeSave]
  );

  const executeSaveRef = useRef(executeSave);
  executeSaveRef.current = executeSave;
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;

  // Listen for online event to retry non-rejected draft
  useEffect(() => {
    const handleOnline = () => {
      const draft = getDraftRef.current(noteId);
      if (draft && !draft.rejected) {
        const payload: UpdateNotePayload = {
          title: draft.title,
          body: draft.body,
          color: draft.color,
          checklistItems: draft.checklistItems,
        };
        executeSaveRef.current(payload);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    scheduleAutoSave,
    triggerBlurSave,
  };
}