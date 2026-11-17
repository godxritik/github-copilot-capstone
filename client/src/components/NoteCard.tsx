import { useEffect, useRef, useState } from 'react';
import type { Note, ChecklistItem } from '../api/notesApi.js';
import { notesApi } from '../api/notesApi.js';
import { PALETTE, PALETTE_COLORS, type PaletteColor } from '../lib/palette.js';
import { formatLocalTime } from '../lib/time.js';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { useDrafts } from '../hooks/useDrafts.js';
import { ChecklistEditor } from './ChecklistEditor.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { TOAST_MESSAGES } from './Toast.js';

export interface NoteCardProps {
  note: Note;
  onUpdate: (updated: Note) => void;
  onDelete: (id: string) => void;
  onOpenNote?: (id: string) => void;
  showToast: (msg: string, actionText?: string, onAction?: () => void) => void;
}

export function NoteCard({
  note,
  onUpdate,
  onDelete,
  onOpenNote,
  showToast,
}: NoteCardProps) {
  const { getDraft } = useDrafts();
  // Restores an unsaved, non-rejected local draft so the edits stay visible until reconciliation completes
  const [restoredDraft] = useState(() => {
    const draft = getDraft(note.id);
    return draft && !draft.rejected ? draft : null;
  });
  const initialTitle = restoredDraft?.title ?? note.title;
  const initialBody = restoredDraft?.body ?? note.body;

  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Local edits not yet confirmed by the server; while set, server refreshes do not overwrite the text
  const dirtyRef = useRef(restoredDraft !== null);
  const latestTextRef = useRef({ title: initialTitle, body: initialBody });

  useEffect(() => {
    if (dirtyRef.current) {
      const latest = latestTextRef.current;
      if (note.title !== latest.title || note.body !== latest.body) return;
      dirtyRef.current = false;
    }
    latestTextRef.current = { title: note.title, body: note.body };
    setTitle(note.title);
    setBody(note.body);
  }, [note.updatedAt, note.title, note.body]);

  const isArchived = note.isArchived;
  const palette = PALETTE[note.color as PaletteColor] || PALETTE.white;

  const { scheduleAutoSave, triggerBlurSave } = useAutoSave({
    noteId: note.id,
    onSaveSuccess: (saved) => {
      onUpdate(saved);
      const latest = latestTextRef.current;
      if (saved.title === latest.title && saved.body === latest.body) {
        dirtyRef.current = false;
      }
    },
    onNoteNotFound: () => {
      showToast(TOAST_MESSAGES.NOTE_REMOVED);
      onDelete(note.id);
    },
    onSaveRejected: (_id, message) => {
      showToast(message || TOAST_MESSAGES.REJECTED_SAVE);
    },
    onSaveFailed: (msg) => {
      showToast(msg);
    },
  });

  const handleTitleChange = (newTitle: string) => {
    if (isArchived) return;
    dirtyRef.current = true;
    latestTextRef.current = { title: newTitle, body };
    setTitle(newTitle);
    scheduleAutoSave({ title: newTitle, body });
  };

  const handleBodyChange = (newBody: string) => {
    if (isArchived) return;
    dirtyRef.current = true;
    latestTextRef.current = { title, body: newBody };
    setBody(newBody);
    scheduleAutoSave({ title, body: newBody });
  };

  const handleChecklistChange = (items: ChecklistItem[]) => {
    if (isArchived) return;
    triggerBlurSave({ checklistItems: items });
  };

  const handleChecklistTruncated = () => {
    showToast(TOAST_MESSAGES.CHECKLIST_TRUNCATED);
  };

  // Non-text action helper with immediate UI feedback and revert on failure (P-01)
  const executeNonTextAction = async (
    updates: Parameters<typeof notesApi.updateNote>[1],
    revertFn: () => void
  ) => {
    try {
      const updated = await notesApi.updateNote(note.id, updates);
      onUpdate(updated);
    } catch {
      revertFn();
      showToast(TOAST_MESSAGES.SAVE_FAILED);
    }
  };

  const handleTogglePin = () => {
    if (isArchived) return;
    const nextPin = !note.isPinned;
    // Optimistic
    onUpdate({ ...note, isPinned: nextPin });
    executeNonTextAction({ isPinned: nextPin }, () => {
      onUpdate({ ...note, isPinned: note.isPinned }); // revert
    });
  };

  const handleChangeColor = (newColor: PaletteColor) => {
    if (isArchived) return;
    const prevColor = note.color;
    setShowColorPicker(false);
    onUpdate({ ...note, color: newColor });
    executeNonTextAction({ color: newColor }, () => {
      onUpdate({ ...note, color: prevColor }); // revert
    });
  };

  const handleToggleArchive = () => {
    const nextArchived = !note.isArchived;
    const prevArchived = note.isArchived;
    const prevPinned = note.isPinned;

    // Optimistic update: archiving also unpins
    onUpdate({
      ...note,
      isArchived: nextArchived,
      isPinned: nextArchived ? false : note.isPinned,
    });

    executeNonTextAction({ isArchived: nextArchived }, () => {
      onUpdate({ ...note, isArchived: prevArchived, isPinned: prevPinned }); // revert
    });
  };

  const handleDeleteConfirm = async () => {
    setIsDeleteDialogOpen(false);
    try {
      await notesApi.deleteNote(note.id);
      onDelete(note.id);
    } catch {
      showToast(TOAST_MESSAGES.SAVE_FAILED);
    }
  };

  const handleOverflow = async (itemText: string) => {
    const newNoteId = crypto.randomUUID();
    try {
      const res = await notesApi.createOverflow(note.id, {
        id: newNoteId,
        text: itemText,
        isChecked: false,
      });
      onUpdate(res.original);
      onOpenNote?.(res.note.id);
    } catch (err: unknown) {
      showToast(TOAST_MESSAGES.SAVE_FAILED);
    }
  };

  return (
    <div
      className={`rounded-lg p-4 border shadow-sm transition-shadow hover:shadow-md relative ${palette.bgClass} ${palette.borderClass}`}
      data-testid={`note-card-${note.id}`}
    >
      {/* Overflow chain back-link (F-13) */}
      {note.continuedFromId && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => onOpenNote?.(note.continuedFromId!)}
            className="text-xs text-blue-700 hover:text-blue-900 underline flex items-center gap-1 font-medium"
            aria-label="Open original note"
          >
            &larr; Continued from previous note
          </button>
        </div>
      )}

      {/* Pin button */}
      {!isArchived && (
        <button
          type="button"
          onClick={handleTogglePin}
          aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 p-1"
        >
          {note.isPinned ? '📌' : '📍'}
        </button>
      )}

      {/* Inline title */}
      {isArchived ? (
        <h3 className="text-base font-semibold text-gray-900 mb-1 pr-6 break-words">
          {note.title || 'Untitled'}
        </h3>
      ) : (
        <input
          type="text"
          value={title}
          disabled={isArchived}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={() => triggerBlurSave({ title, body })}
          placeholder="Title"
          aria-label="Note title"
          className="w-full text-base font-semibold bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none mb-1 pr-6"
        />
      )}

      {/* Inline body */}
      {isArchived ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words min-h-[1.5rem]">
          {note.body}
        </p>
      ) : (
        <textarea
          value={body}
          disabled={isArchived}
          onChange={(e) => handleBodyChange(e.target.value)}
          onBlur={() => triggerBlurSave({ title, body })}
          placeholder="Take a note..."
          aria-label="Note body"
          rows={Math.max(2, body.split('\n').length)}
          className="w-full text-sm bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none resize-none"
        />
      )}

      {/* Checklist Editor */}
      <ChecklistEditor
        items={note.checklistItems}
        color={note.color as PaletteColor}
        readOnly={isArchived}
        continuedInId={note.continuedInId}
        onChange={handleChecklistChange}
        onTruncated={handleChecklistTruncated}
        onOverflow={handleOverflow}
        onOpenContinuation={onOpenNote}
      />

      {/* Footer: timestamp and action buttons */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-black/5 text-xs text-gray-500">
        <span>{formatLocalTime(note.updatedAt)}</span>

        <div className="flex items-center gap-1 relative">
          {/* Color Picker Toggle */}
          {!isArchived && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker((prev) => !prev)}
                aria-label="Change note color"
                className="p-1 hover:bg-black/5 rounded text-gray-600"
              >
                🎨
              </button>

              {showColorPicker && (
                <div
                  className="absolute bottom-full mb-1 right-0 bg-white p-2 rounded-lg shadow-lg border border-gray-200 flex gap-1 z-30"
                  role="group"
                  aria-label="Color options"
                >
                  {PALETTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleChangeColor(c)}
                      aria-label={`Color ${PALETTE[c].name}`}
                      className={`w-6 h-6 rounded-full border border-gray-300 ${PALETTE[c].bgClass} hover:scale-110 transition-transform`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Archive / Unarchive */}
          <button
            type="button"
            onClick={handleToggleArchive}
            aria-label={isArchived ? 'Unarchive note' : 'Archive note'}
            className="p-1 hover:bg-black/5 rounded text-gray-600"
          >
            {isArchived ? '📥' : '📦'}
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            aria-label="Delete note"
            className="p-1 hover:bg-black/5 rounded text-gray-600 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete note?"
        message="This note will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
}