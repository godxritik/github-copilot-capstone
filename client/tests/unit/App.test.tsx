import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App.js';
import { notesApi, type Note } from '../../src/api/notesApi.js';

describe('App Layout and View Navigation (F-16, F-17, FR-01, FR-03, FR-06, NFR-06, NFR-07)', () => {
  const mockActiveNote: Note = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Active Note Item',
    body: 'Active Body',
    color: 'white',
    checklistItems: [],
    isPinned: false,
    isArchived: false,
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
    continuedFromId: null,
    continuedInId: null,
  };

  const mockArchivedNote: Note = {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Archived Note Item',
    body: 'Archived Body',
    color: 'teal',
    checklistItems: [],
    isPinned: false,
    isArchived: true,
    createdAt: '2026-11-16T09:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
    continuedFromId: null,
    continuedInId: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(notesApi, 'listNotes').mockImplementation((archived: boolean) =>
      Promise.resolve(archived ? [mockArchivedNote] : [mockActiveNote])
    );
  });

  it('renders application header and tabs', async () => {
    render(<App />);

    expect(screen.getByText('Keep Notes')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Active Note Item')).toBeDefined();
    });
  });

  it('switches between Active and Archived tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Active Note Item')).toBeDefined();
    });

    // Switch to Archive tab
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      expect(screen.getByText('Archived Note Item')).toBeDefined();
      expect(screen.queryByDisplayValue('Active Note Item')).toBeNull();
    });

    // Note creator should NOT be visible on Archive tab
    expect(screen.queryByLabelText('Create new note')).toBeNull();
  });

  it('creates a new note with UUID and white default color (FR-01, P-06)', async () => {
    const createSpy = vi.spyOn(notesApi, 'createNote').mockResolvedValueOnce({
      id: '33333333-3333-3333-3333-333333333333',
      title: 'Created Title',
      body: 'Created Body',
      color: 'white',
      checklistItems: [],
      isPinned: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      continuedFromId: null,
      continuedInId: null,
    });

    render(<App />);

    // Expand creator
    const creatorBox = screen.getByLabelText('Create new note');
    fireEvent.click(creatorBox);

    const titleInput = screen.getByLabelText('New note title');
    const bodyInput = screen.getByLabelText('New note body');

    fireEvent.change(titleInput, { target: { value: 'Created Title' } });
    fireEvent.change(bodyInput, { target: { value: 'Created Body' } });

    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Created Title',
          body: 'Created Body',
          color: 'white',
        })
      );
    });
  });

  it('provides accessible labels for icon-only buttons (NFR-07)', async () => {
    render(<App />);

    expect(screen.getByLabelText('Search notes')).toBeDefined();
    expect(screen.getByLabelText('Create new note')).toBeDefined();
    expect(screen.getByLabelText('New checklist')).toBeDefined();
    expect(screen.getByLabelText('Color filters')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Active Note Item')).toBeDefined();
    });
  });

  it('auto-applies a local draft that is newer than the server copy on load (P-07)', async () => {
    localStorage.setItem(
      'keep_draft_' + mockActiveNote.id,
      JSON.stringify({
        noteId: mockActiveNote.id,
        title: 'Draft Title',
        body: 'Draft Body',
        draftedAt: '2026-11-16T11:00:00.000Z',
        rejected: false,
      })
    );
    const updateSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue({
      ...mockActiveNote,
      title: 'Draft Title',
      body: 'Draft Body',
    });

    render(<App />);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        mockActiveNote.id,
        expect.objectContaining({ title: 'Draft Title', body: 'Draft Body' })
      );
    });
    await waitFor(() => {
      expect(localStorage.getItem('keep_draft_' + mockActiveNote.id)).toBeNull();
    });
  });

  it('asks before overwriting a newer server copy and applies the draft on confirm (P-07)', async () => {
    localStorage.setItem(
      'keep_draft_' + mockActiveNote.id,
      JSON.stringify({
        noteId: mockActiveNote.id,
        title: 'Local Edit',
        body: 'Active Body',
        draftedAt: '2026-11-16T09:30:00.000Z',
        rejected: false,
      })
    );
    const updateSpy = vi.spyOn(notesApi, 'updateNote').mockResolvedValue({
      ...mockActiveNote,
      title: 'Local Edit',
    });

    render(<App />);

    const applyButton = await screen.findByRole('button', { name: 'Apply Draft' });
    expect(screen.getByText('Server version is newer')).toBeDefined();
    expect(updateSpy).not.toHaveBeenCalled();

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        mockActiveNote.id,
        expect.objectContaining({ title: 'Local Edit' })
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Apply Draft' })).toBeNull();
    });
  });

  it('prunes drafts whose notes are missing from the loaded lists', async () => {
    const orphanId = '99999999-9999-9999-9999-999999999999';
    localStorage.setItem(
      'keep_draft_' + orphanId,
      JSON.stringify({ noteId: orphanId, title: 'Orphan', draftedAt: '2026-11-16T11:00:00.000Z', rejected: false })
    );
    const updateSpy = vi.spyOn(notesApi, 'updateNote');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Active Note Item')).toBeDefined();
      expect(localStorage.getItem('keep_draft_' + orphanId)).toBeNull();
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});