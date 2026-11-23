import { useState, useRef, useEffect } from 'react';
import type { Note, ChecklistItem } from '../api/notesApi.js';
import { notesApi } from '../api/notesApi.js';
import { PALETTE, PALETTE_COLORS, type PaletteColor } from '../lib/palette.js';
import { ChecklistEditor } from './ChecklistEditor.js';
import { TOAST_MESSAGES } from './Toast.js';

export interface NoteCreatorProps {
  onNoteCreated: (note: Note) => void;
  showToast: (msg: string) => void;
}

export function NoteCreator({ onNoteCreated, showToast }: NoteCreatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState<PaletteColor>('white');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const palette = PALETTE[color];

  const handleClose = async () => {
    if (!title.trim() && !body.trim() && checklistItems.length === 0) {
      setIsExpanded(false);
      return;
    }

    setIsSubmitting(true);
    const newId = crypto.randomUUID();

    try {
      const created = await notesApi.createNote({
        id: newId,
        title: title.trim(),
        body: body.trim(),
        color,
        checklistItems,
      });

      onNoteCreated(created);
      setTitle('');
      setBody('');
      setColor('white');
      setChecklistItems([]);
      setIsExpanded(false);
    } catch {
      showToast(TOAST_MESSAGES.SAVE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, title, body, color, checklistItems]);

  if (!isExpanded) {
    return (
      <div className="max-w-xl mx-auto mb-8">
        <div
          onClick={() => setIsExpanded(true)}
          className="bg-cream rounded-lg shadow-sm border border-sand p-3 px-4 flex items-center justify-between cursor-text hover:shadow transition-shadow"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(true);
            }
          }}
          aria-label="Create new note"
        >
          <span className="text-forest/70 text-sm font-medium">Take a note...</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
              setChecklistItems([{ text: '', isChecked: false }]);
            }}
            aria-label="New checklist"
            className="text-forest/70 hover:text-forest p-1"
          >
            ☑️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mb-8" ref={containerRef}>
      <div className={`rounded-lg shadow-md border p-4 transition-colors ${palette.bgClass} ${palette.borderClass}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="New note title"
          autoFocus
          className="w-full text-base font-semibold bg-transparent text-forest placeholder-sage focus:outline-none mb-2"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Take a note..."
          aria-label="New note body"
          rows={3}
          className="w-full text-sm bg-transparent text-forest placeholder-sage focus:outline-none resize-none mb-2"
        />

        {checklistItems.length > 0 && (
          <ChecklistEditor
            items={checklistItems}
            color={color}
            onChange={setChecklistItems}
            onTruncated={() => showToast(TOAST_MESSAGES.CHECKLIST_TRUNCATED)}
          />
        )}

        <div className="flex items-center justify-between pt-3 mt-2 border-t border-black/5">
          <div className="flex items-center gap-1 relative">
            <button
              type="button"
              onClick={() => setShowColorPicker((prev) => !prev)}
              aria-label="Note color"
              className="p-1 hover:bg-black/5 rounded text-forest"
            >
              🎨
            </button>

            {showColorPicker && (
              <div
                className="absolute bottom-full mb-1 left-0 bg-cream p-2 rounded-lg shadow-lg border border-sand flex gap-1 z-30"
                role="group"
                aria-label="Color options"
              >
                {PALETTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    aria-label={`Color ${PALETTE[c].name}`}
                    className={`w-6 h-6 rounded-full border border-sand ${PALETTE[c].bgClass} hover:scale-110 transition-transform`}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium text-forest bg-sand/40 hover:bg-sand/70 rounded-md transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}