import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileDraftOnLoad, applyDraftToServer, draftToUpdatePayload } from '../../src/lib/reconciliation.js';
import { notesApi, ApiError, type Note } from '../../src/api/notesApi.js';
import type { NoteDraft } from '../../src/hooks/useDrafts.js';

describe('Apply Draft to server (P-07 Apply Draft)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const draft: NoteDraft = {
    noteId: 'n1',
    title: 'Draft Title',
    body: 'Draft Body',
    color: 'blue',
    isPinned: true,
    isArchived: false,
    checklistItems: [{ text: 'item', isChecked: false }],
    draftedAt: '2026-01-01T00:00:00.000Z',
    rejected: false,
  };

  it('saves draft content to the server and omits draft-only metadata', async () => {
    const updateSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue({} as Note);

    await applyDraftToServer(draft);

    expect(updateSpy).toHaveBeenCalledWith('n1', {
      title: 'Draft Title',
      body: 'Draft Body',
      color: 'blue',
      isPinned: true,
      isArchived: false,
      checklistItems: [{ text: 'item', isChecked: false }],
    });
    expect(draftToUpdatePayload(draft)).not.toHaveProperty('draftedAt');
  });

  it('rejects when the server save fails so the caller keeps the draft', async () => {
    vi.spyOn(notesApi, 'updateNote').mockRejectedValue(new ApiError(500, 'API_ERROR', 'boom'));

    await expect(applyDraftToServer(draft)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('Load Reconciliation (F-07, FR-12, P-07, R3-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseServerNote: Note = {
    id: 'n1',
    title: 'Server Title',
    body: 'Server Body',
    color: 'white',
    checklistItems: [],
    isPinned: false,
    isArchived: false,
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T12:00:00.000Z',
    continuedFromId: null,
    continuedInId: null,
  };

  it('prompts user confirmation when server note is newer than local draft (P-07)', async () => {
    const draft: NoteDraft = {
      noteId: 'n1',
      title: 'Older Local Edit',
      draftedAt: '2026-11-16T11:00:00.000Z', // 11:00 is older than server's 12:00
      rejected: false,
    };

    const action = await reconcileDraftOnLoad(draft, baseServerNote);
    expect(action.type).toBe('CONFIRM_WITH_USER');
  });

  it('applies and saves when local draft is newer than server note', async () => {
    const draft: NoteDraft = {
      noteId: 'n1',
      title: 'Newer Local Edit',
      draftedAt: '2026-11-16T13:00:00.000Z', // 13:00 is newer than server's 12:00
      rejected: false,
    };

    const action = await reconcileDraftOnLoad(draft, baseServerNote);
    expect(action.type).toBe('APPLY_AND_SAVE');
  });

  it('applies and saves when there is no server note (offline creation)', async () => {
    const draft: NoteDraft = {
      noteId: 'n-offline',
      title: 'Created Offline',
      draftedAt: '2026-11-16T13:00:00.000Z',
      rejected: false,
    };

    const action = await reconcileDraftOnLoad(draft, null);
    expect(action.type).toBe('APPLY_AND_SAVE');
  });

  it('discards rejected draft if GET /api/notes/:id returns 404 (R3-02)', async () => {
    vi.spyOn(notesApi, 'getNote').mockRejectedValueOnce(
      new ApiError(404, 'NOT_FOUND', 'Note not found')
    );

    const draft: NoteDraft = {
      noteId: 'n-deleted',
      title: 'Rejected on deleted note',
      draftedAt: '2026-11-16T10:00:00.000Z',
      rejected: true,
      rejectionMessage: 'Failed save',
    };

    const action = await reconcileDraftOnLoad(draft, null);
    expect(action.type).toBe('DISCARD_REMOVED_404');
  });

  it('leaves rejected draft intact if note still exists on server', async () => {
    vi.spyOn(notesApi, 'getNote').mockResolvedValueOnce(baseServerNote);

    const draft: NoteDraft = {
      noteId: 'n1',
      title: 'Rejected edit',
      draftedAt: '2026-11-16T10:00:00.000Z',
      rejected: true,
    };

    const action = await reconcileDraftOnLoad(draft, null);
    expect(action.type).toBe('NONE');
  });
});