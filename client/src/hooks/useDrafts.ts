import { useState, useCallback } from 'react';
import type { ChecklistItem } from '../api/notesApi.js';

export interface NoteDraft {
  noteId: string;
  title?: string;
  body?: string;
  color?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  checklistItems?: ChecklistItem[];
  draftedAt: string;
  rejected: boolean;
  rejectionMessage?: string;
}

export interface OverflowDraft {
  originalNoteId: string;
  overflowNoteId: string;
  text: string;
  isChecked: boolean;
  draftedAt: string;
  rejected: boolean;
  rejectionMessage?: string;
}

function getStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  };
}
const NOTE_DRAFT_PREFIX = 'keep_draft_';
const OVERFLOW_DRAFT_PREFIX = 'keep_overflow_';

export function getNoteDraftKey(noteId: string): string {
  return `${NOTE_DRAFT_PREFIX}${noteId}`;
}

export function getOverflowDraftKey(originalId: string, overflowId: string): string {
  return `${OVERFLOW_DRAFT_PREFIX}${originalId}_${overflowId}`;
}

export function formatDraftPlainText(draft: NoteDraft): string {
  const parts: string[] = [];
  if (draft.title) parts.push(draft.title);
  if (draft.body) parts.push(draft.body);
  if (draft.checklistItems && draft.checklistItems.length > 0) {
    const itemsText = draft.checklistItems
      .map((item) => `- [${item.isChecked ? 'x' : ' '}] ${item.text}`)
      .join('\n');
    parts.push(itemsText);
  }
  return parts.join('\n\n');
}

export function useDrafts() {
  const [draftsVersion, setDraftsVersion] = useState(0);

  const saveDraft = useCallback(
    (draft: Omit<NoteDraft, 'draftedAt' | 'rejected'>, rejected = false, rejectionMessage?: string): NoteDraft => {
      const fullDraft: NoteDraft = {
        ...draft,
        draftedAt: new Date().toISOString(),
        rejected,
        rejectionMessage,
      };
      getStorage().setItem(getNoteDraftKey(draft.noteId), JSON.stringify(fullDraft));
      setDraftsVersion((v) => v + 1);
      return fullDraft;
    },
    []
  );

  const getDraft = useCallback((noteId: string): NoteDraft | null => {
    const item = getStorage().getItem(getNoteDraftKey(noteId));
    if (!item) return null;
    try {
      return JSON.parse(item) as NoteDraft;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback((noteId: string): void => {
    getStorage().removeItem(getNoteDraftKey(noteId));
    setDraftsVersion((v) => v + 1);
  }, []);

  const markDraftRejected = useCallback((noteId: string, rejectionMessage?: string): void => {
    const item = getStorage().getItem(getNoteDraftKey(noteId));
    if (!item) return;
    try {
      const draft = JSON.parse(item) as NoteDraft;
      draft.rejected = true;
      if (rejectionMessage) draft.rejectionMessage = rejectionMessage;
      getStorage().setItem(getNoteDraftKey(noteId), JSON.stringify(draft));
      setDraftsVersion((v) => v + 1);
    } catch {
      // ignore
    }
  }, []);

  const copyDraftToClipboard = useCallback(async (noteId: string): Promise<boolean> => {
    const item = getStorage().getItem(getNoteDraftKey(noteId));
    if (!item) return false;
    try {
      const draft = JSON.parse(item) as NoteDraft;
      const plainText = formatDraftPlainText(draft);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(plainText);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const saveOverflowDraft = useCallback(
    (
      originalNoteId: string,
      overflowNoteId: string,
      text: string,
      isChecked: boolean,
      rejected = false,
      rejectionMessage?: string
    ): OverflowDraft => {
      const draft: OverflowDraft = {
        originalNoteId,
        overflowNoteId,
        text,
        isChecked,
        draftedAt: new Date().toISOString(),
        rejected,
        rejectionMessage,
      };
      getStorage().setItem(getOverflowDraftKey(originalNoteId, overflowNoteId), JSON.stringify(draft));
      setDraftsVersion((v) => v + 1);
      return draft;
    },
    []
  );

  const getOverflowDraft = useCallback(
    (originalNoteId: string, overflowNoteId: string): OverflowDraft | null => {
      const item = getStorage().getItem(getOverflowDraftKey(originalNoteId, overflowNoteId));
      if (!item) return null;
      try {
        return JSON.parse(item) as OverflowDraft;
      } catch {
        return null;
      }
    },
    [draftsVersion]
  );

  const clearOverflowDraft = useCallback((originalNoteId: string, overflowNoteId: string): void => {
    getStorage().removeItem(getOverflowDraftKey(originalNoteId, overflowNoteId));
    setDraftsVersion((v) => v + 1);
  }, []);

  const pruneNoteDrafts = useCallback((keepNoteIds: Set<string>): void => {
    const storage = getStorage();
    const staleKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(NOTE_DRAFT_PREFIX) && !keepNoteIds.has(key.slice(NOTE_DRAFT_PREFIX.length))) {
        staleKeys.push(key);
      }
    }
    if (staleKeys.length === 0) return;
    staleKeys.forEach((key) => storage.removeItem(key));
    setDraftsVersion((v) => v + 1);
  }, []);

  return {
    saveDraft,
    getDraft,
    pruneNoteDrafts,
    clearDraft,
    discardDraft: clearDraft,
    markDraftRejected,
    copyDraftToClipboard,
    saveOverflowDraft,
    getOverflowDraft,
    clearOverflowDraft,
  };
}