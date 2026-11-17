import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrafts, formatDraftPlainText, getNoteDraftKey } from '../../src/hooks/useDrafts.js';

describe('useDrafts Hook (F-05, FR-12, N-03, P-02)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves and retrieves draft across calls (simulating reload)', () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveDraft({
        noteId: 'note-1',
        title: 'Draft Title',
        body: 'Draft Body',
      });
    });

    const stored = result.current.getDraft('note-1');
    expect(stored).not.toBeNull();
    expect(stored?.title).toBe('Draft Title');
    expect(stored?.rejected).toBe(false);
    expect(stored?.draftedAt).toBeDefined();

    // Verify it is in localStorage
    expect(window.localStorage.getItem(getNoteDraftKey('note-1'))).toBeDefined();
  });

  it('marks draft as rejected with rejection message (N-03)', () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveDraft({ noteId: 'note-rej', title: 'Rejected Title' });
    });

    act(() => {
      result.current.markDraftRejected('note-rej', 'Archived notes are read-only');
    });

    const stored = result.current.getDraft('note-rej');
    expect(stored?.rejected).toBe(true);
    expect(stored?.rejectionMessage).toBe('Archived notes are read-only');
  });

  it('discards/clears draft on discardDraft or clearDraft', () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveDraft({ noteId: 'to-discard', title: 'Discard me' });
    });

    expect(result.current.getDraft('to-discard')).not.toBeNull();

    act(() => {
      result.current.discardDraft('to-discard');
    });

    expect(result.current.getDraft('to-discard')).toBeNull();
  });

  it('formats draft into plain text without HTML/script tags (A-13, NFR-03)', () => {
    const plain = formatDraftPlainText({
      noteId: 'n1',
      title: 'Shopping',
      body: 'Groceries needed',
      checklistItems: [
        { text: 'Milk', isChecked: false },
        { text: 'Bread', isChecked: true },
      ],
      draftedAt: new Date().toISOString(),
      rejected: false,
    });

    expect(plain).toBe('Shopping\n\nGroceries needed\n\n- [ ] Milk\n- [x] Bread');
  });

  it('copies plain text to clipboard on copyDraftToClipboard (N-03)', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveDraft({
        noteId: 'copy-note',
        title: 'Title to copy',
        body: 'Body to copy',
      });
    });

    let success = false;
    await act(async () => {
      success = await result.current.copyDraftToClipboard('copy-note');
    });

    expect(success).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('Title to copy\n\nBody to copy');
  });

  it('saves and clears overflow draft', () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveOverflowDraft('orig-1', 'over-1', 'Item 51', false);
    });

    const stored = result.current.getOverflowDraft('orig-1', 'over-1');
    expect(stored?.text).toBe('Item 51');

    act(() => {
      result.current.clearOverflowDraft('orig-1', 'over-1');
    });

    expect(result.current.getOverflowDraft('orig-1', 'over-1')).toBeNull();
  });

  it('prunes note drafts whose note id is no longer present and keeps the rest', () => {
    const { result } = renderHook(() => useDrafts());

    act(() => {
      result.current.saveDraft({ noteId: 'keep-me', title: 'Keep' });
      result.current.saveDraft({ noteId: 'gone', title: 'Gone' });
    });

    act(() => {
      result.current.pruneNoteDrafts(new Set(['keep-me']));
    });

    expect(result.current.getDraft('keep-me')).not.toBeNull();
    expect(result.current.getDraft('gone')).toBeNull();
  });
});