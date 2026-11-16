import { useState } from 'react';
import type { ChecklistItem } from '../api/notesApi.js';
import { truncateChecklistItemText } from '../lib/limits.js';
import { PALETTE, type PaletteColor } from '../lib/palette.js';

export interface ChecklistEditorProps {
  items: ChecklistItem[];
  color: PaletteColor;
  readOnly?: boolean;
  continuedInId?: string | null;
  onChange: (items: ChecklistItem[]) => void;
  onTruncated?: () => void;
  onOverflow?: (text: string) => void;
  onOpenContinuation?: (noteId: string) => void;
}

export function ChecklistEditor({
  items,
  color,
  readOnly = false,
  continuedInId,
  onChange,
  onTruncated,
  onOverflow,
  onOpenContinuation,
}: ChecklistEditorProps) {
  const [newItemText, setNewItemText] = useState('');
  const paletteItem = PALETTE[color] || PALETTE.white;

  const handleToggle = (index: number) => {
    if (readOnly) return;
    const next = items.map((item, i) => (i === index ? { ...item, isChecked: !item.isChecked } : item));
    onChange(next);
  };

  const handleTextChange = (index: number, newText: string) => {
    if (readOnly) return;
    const truncated = truncateChecklistItemText(newText);
    if (truncated.wasTruncated) {
      onTruncated?.();
    }
    const next = items.map((item, i) => (i === index ? { ...item, text: truncated.text } : item));
    onChange(next);
  };

  const handleRemove = (index: number) => {
    if (readOnly) return;
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (readOnly || !newItemText.trim()) return;

    if (items.length >= 50) {
      // 51st item triggers overflow (FR-11, P-02)
      const truncated = truncateChecklistItemText(newItemText.trim());
      if (truncated.wasTruncated) {
        onTruncated?.();
      }
      onOverflow?.(truncated.text);
      setNewItemText('');
      return;
    }

    const truncated = truncateChecklistItemText(newItemText.trim());
    if (truncated.wasTruncated) {
      onTruncated?.();
    }

    onChange([...items, { text: truncated.text, isChecked: false }]);
    setNewItemText('');
  };

  return (
    <div className="space-y-2 mt-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
          <input
            type="checkbox"
            checked={item.isChecked}
            disabled={readOnly}
            onChange={() => handleToggle(index)}
            aria-label={`Mark item "${item.text}" as ${item.isChecked ? 'unchecked' : 'checked'}`}
            className="rounded text-gray-700 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
          />
          {readOnly ? (
            <span
              className={`flex-1 text-sm ${item.isChecked ? paletteItem.mutedTextClass : 'text-gray-800'}`}
            >
              {item.text}
            </span>
          ) : (
            <input
              type="text"
              value={item.text}
              disabled={readOnly}
              onChange={(e) => handleTextChange(index, e.target.value)}
              aria-label={`Checklist item ${index + 1}`}
              className={`flex-1 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1 py-0.5 ${
                item.isChecked ? paletteItem.mutedTextClass : 'text-gray-800'
              }`}
            />
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={`Remove item "${item.text}"`}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1"
            >
              &times;
            </button>
          )}
        </div>
      ))}

      {/* Overflow Link or Add Item Control */}
      {continuedInId ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onOpenContinuation?.(continuedInId)}
            className="text-sm font-medium text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
          >
            Continue in new note &rarr;
          </button>
        </div>
      ) : (
        !readOnly && (
          <form onSubmit={handleAddItem} className="flex items-center gap-2 pt-1">
            <span className="text-gray-400 text-lg leading-none">+</span>
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder={items.length >= 50 ? 'Add 51st item (overflows to new note)...' : 'List item...'}
              aria-label="New checklist item"
              className="flex-1 bg-transparent text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1 py-1"
            />
            {newItemText && (
              <button
                type="submit"
                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-2 py-1 rounded"
              >
                Add
              </button>
            )}
          </form>
        )
      )}
    </div>
  );
}