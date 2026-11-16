import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileDraftOnLoad } from '../../src/lib/reconciliation.js';
import { notesApi, ApiError, type Note } from '../../src/api/notesApi.js';
import type { NoteDraft } from '../../src/hooks/useDrafts.js';

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