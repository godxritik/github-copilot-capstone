import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notesApi, ApiError } from '../../src/api/notesApi.js';

describe('API Client (F-04)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists notes successfully', async () => {
    const mockNotes = [{ id: '1', title: 'Note 1' }];
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockNotes), { status: 200 }));

    const result = await notesApi.listNotes(false);
    expect(result).toEqual(mockNotes);
    expect(fetch).toHaveBeenCalledWith('/api/notes?archived=false', expect.any(Object));
  });

  it('deletes note successfully on 204 No Content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await notesApi.deleteNote('note-1');
    expect(result).toBeUndefined();
  });

  it('parses 400 VALIDATION_ERROR', async () => {
    const errorBody = { error: { code: 'VALIDATION_ERROR', message: 'Title too long' } };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 400 })
    );

    try {
      await notesApi.createNote({ id: '1', title: 'Bad' });
      expect.unreachable();
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Title too long');
      expect(err.isValidationError).toBe(true);
    }
  });

  it('parses 400 NOTE_ARCHIVED', async () => {
    const errorBody = {
      error: { code: 'NOTE_ARCHIVED', message: 'Archived notes are read-only. Unarchive the note to edit it.' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 400 })
    );

    try {
      await notesApi.updateNote('archived-id', { title: 'Edit' });
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.code).toBe('NOTE_ARCHIVED');
      expect(err.isNoteArchived).toBe(true);
    }
  });

  it('parses 404 NOT_FOUND', async () => {
    const errorBody = { error: { code: 'NOT_FOUND', message: 'Note not found' } };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 404 })
    );

    try {
      await notesApi.getNote('missing-id');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.isNotFound).toBe(true);
    }
  });

  it('parses 500 INTERNAL_ERROR', async () => {
    const errorBody = { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), { status: 500 })
    );

    try {
      await notesApi.listNotes(false);
    } catch (err: any) {
      expect(err.status).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isServerError).toBe(true);
    }
  });

  it('handles network failure as status 0 NETWORK_ERROR', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'));

    try {
      await notesApi.listNotes(false);
    } catch (err: any) {
      expect(err.status).toBe(0);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.isNetworkError).toBe(true);
    }
  });
});