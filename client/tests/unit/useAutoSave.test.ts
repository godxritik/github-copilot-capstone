import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../../src/hooks/useAutoSave.js';
import { notesApi, ApiError } from '../../src/api/notesApi.js';
import { TOAST_MESSAGES } from '../../src/components/Toast.js';

describe('useAutoSave Hook (F-06, FR-04, FR-12, M-05, M-06, N-03)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers save after 2-second pause in typing', async () => {
    const updateSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValueOnce({
      id: 'n1',
      title: 'Debounced Title',
      body: '',
      color: 'white',
      checklistItems: [],
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      continuedFromId: null,
      continuedInId: null,
    });
    const onSaveSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAutoSave({ noteId: 'n1', onSaveSuccess })
    );

    act(() => {
      result.current.scheduleAutoSave({ title: 'Debounced Title' });
    });

    expect(updateSpy).not.toHaveBeenCalled();

    // Advance 1.9s -> still not called
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(updateSpy).not.toHaveBeenCalled();

    // Advance past 2s -> called!
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(updateSpy).toHaveBeenCalledWith('n1', { title: 'Debounced Title' });
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it('immediately triggers save on blur without waiting for 2 seconds', async () => {
    const updateSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValueOnce({
      id: 'n1',
      title: 'Blur Title',
      body: '',
      color: 'white',
      checklistItems: [],
      isPinned: false,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
      continuedFromId: null,
      continuedInId: null,
    });

    const { result } = renderHook(() => useAutoSave({ noteId: 'n1' }));

    await act(async () => {
      result.current.triggerBlurSave({ title: 'Blur Title' });
    });

    expect(updateSpy).toHaveBeenCalledWith('n1', { title: 'Blur Title' });
  });

  it('serializes requests: queues latest state if save is already in flight', async () => {
    let resolveFirst!: (val: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const updateSpy = vi
      .spyOn(notesApi, 'updateNote')
      .mockImplementationOnce(() => firstPromise as any)
      .mockResolvedValueOnce({
        id: 'n1',
        title: 'State 2',
        body: '',
        color: 'white',
        checklistItems: [],
        isPinned: false,
        isArchived: false,
        createdAt: '',
        updatedAt: '',
        continuedFromId: null,
        continuedInId: null,
      });

    const { result } = renderHook(() => useAutoSave({ noteId: 'n1' }));

    // Send first save
    act(() => {
      result.current.triggerBlurSave({ title: 'State 1' });
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // While first is in flight, send state 2
    act(() => {
      result.current.triggerBlurSave({ title: 'State 2' });
    });
    // Should NOT call updateNote yet because first is still in flight
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Resolve first save
    await act(async () => {
      resolveFirst({
        id: 'n1',
        title: 'State 1',
        body: '',
        color: 'white',
        checklistItems: [],
        isPinned: false,
        isArchived: false,
        createdAt: '',
        updatedAt: '',
        continuedFromId: null,
        continuedInId: null,
      });
    });

    // Now second save should have been executed with State 2
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenLastCalledWith('n1', { title: 'State 2' });
  });

  it('handles 400 error by marking draft rejected and notifying onSaveRejected', async () => {
    vi.spyOn(notesApi, 'updateNote').mockRejectedValueOnce(
      new ApiError(400, 'NOTE_ARCHIVED', 'Archived notes are read-only')
    );
    const onSaveRejected = vi.fn();

    const { result } = renderHook(() =>
      useAutoSave({ noteId: 'n1', onSaveRejected })
    );

    await act(async () => {
      result.current.triggerBlurSave({ title: 'Edit archived' });
    });

    expect(onSaveRejected).toHaveBeenCalledWith('n1', 'Archived notes are read-only');
  });

  it('handles 404 error by discarding draft and notifying onNoteNotFound', async () => {
    vi.spyOn(notesApi, 'updateNote').mockRejectedValueOnce(
      new ApiError(404, 'NOT_FOUND', 'Note not found')
    );
    const onNoteNotFound = vi.fn();

    const { result } = renderHook(() =>
      useAutoSave({ noteId: 'n-missing', onNoteNotFound })
    );

    await act(async () => {
      result.current.triggerBlurSave({ title: 'Deleted elsewhere' });
    });

    expect(onNoteNotFound).toHaveBeenCalledWith('n-missing');
  });

  it('handles 500 error by keeping draft in localStorage and showing save-failed message', async () => {
    vi.spyOn(notesApi, 'updateNote').mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Server error')
    );
    const onSaveFailed = vi.fn();

    const { result } = renderHook(() =>
      useAutoSave({ noteId: 'n1', onSaveFailed })
    );

    await act(async () => {
      result.current.triggerBlurSave({ title: 'Draft to keep' });
    });

    expect(onSaveFailed).toHaveBeenCalledWith(TOAST_MESSAGES.SAVE_FAILED);
  });
});