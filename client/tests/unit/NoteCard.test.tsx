import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteCard } from '../../src/components/NoteCard.js';
import { notesApi, type Note } from '../../src/api/notesApi.js';
import { TOAST_MESSAGES } from '../../src/components/Toast.js';

describe('NoteCard Component (F-11, F-13, FR-02, FR-04, FR-05, FR-06, FR-07, FR-10, P-01)', () => {
  const baseNote: Note = {
    id: 'note-1',
    title: 'Test Note Title',
    body: 'Test Note Body with <script>alert("xss")</script>',
    color: 'white',
    checklistItems: [],
    isPinned: false,
    isArchived: false,
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
    continuedFromId: null,
    continuedInId: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders note title and body as plain text without executing markup (NFR-03)', () => {
    render(
      <NoteCard
        note={baseNote}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        showToast={vi.fn()}
      />
    );

    const bodyTextarea = screen.getByLabelText('Note body') as HTMLTextAreaElement;
    expect(bodyTextarea.value).toContain('<script>alert("xss")</script>');
  });

  it('renders archived note as read-only with edit controls disabled (FR-10, D-04)', () => {
    const archivedNote: Note = { ...baseNote, isArchived: true, title: 'Archived Note' };
    render(
      <NoteCard
        note={archivedNote}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        showToast={vi.fn()}
      />
    );

    // Inputs should not be present; static text rendered instead
    expect(screen.queryByLabelText('Note title')).toBeNull();
    expect(screen.queryByLabelText('Note body')).toBeNull();
    expect(screen.getByText('Archived Note')).toBeDefined();
    // Pin button should not be present
    expect(screen.queryByLabelText('Pin note')).toBeNull();
  });

  it('reverts UI to last saved state and shows toast when non-text action fails (P-01)', async () => {
    vi.spyOn(notesApi, 'updateNote').mockRejectedValueOnce(new Error('Network error'));
    const onUpdate = vi.fn();
    const showToast = vi.fn();

    render(
      <NoteCard
        note={baseNote}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        showToast={showToast}
      />
    );

    const pinBtn = screen.getByLabelText('Pin note');
    fireEvent.click(pinBtn);

    // Optimistically updates pin to true
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isPinned: true }));

    // On failure, reverts pin back to false and triggers toast
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isPinned: false }));
      expect(showToast).toHaveBeenCalledWith(TOAST_MESSAGES.SAVE_FAILED);
    });
  });

  it('renders back-link when continuedFromId is set (F-13)', () => {
    const overflowNote: Note = { ...baseNote, continuedFromId: 'orig-id' };
    const onOpenNote = vi.fn();

    render(
      <NoteCard
        note={overflowNote}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onOpenNote={onOpenNote}
        showToast={vi.fn()}
      />
    );

    const backLink = screen.getByLabelText('Open original note');
    expect(backLink).toBeDefined();

    fireEvent.click(backLink);
    expect(onOpenNote).toHaveBeenCalledWith('orig-id');
  });

  it('opens ConfirmDialog on delete button click and calls onDelete on confirm', async () => {
    vi.spyOn(notesApi, 'deleteNote').mockResolvedValueOnce(undefined);
    const onDelete = vi.fn();

    render(
      <NoteCard
        note={baseNote}
        onUpdate={vi.fn()}
        onDelete={onDelete}
        showToast={vi.fn()}
      />
    );

    const deleteBtn = screen.getByLabelText('Delete note');
    fireEvent.click(deleteBtn);

    // ConfirmDialog opens
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('note-1');
    });
  });
});