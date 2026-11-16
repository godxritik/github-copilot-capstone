import type { Note } from '../api/notesApi.js';
import { NoteCard } from './NoteCard.js';
import { EmptyState } from './EmptyState.js';

export interface NoteListProps {
  notes: Note[];
  activeTab: 'active' | 'archived';
  isFiltered: boolean;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onOpenNote?: (id: string) => void;
  onClearFilters: () => void;
  showToast: (msg: string) => void;
}

export function NoteList({
  notes,
  activeTab,
  isFiltered,
  onUpdateNote,
  onDeleteNote,
  onOpenNote,
  onClearFilters,
  showToast,
}: NoteListProps) {
  if (notes.length === 0) {
    return (
      <EmptyState
        isFiltered={isFiltered}
        activeTab={activeTab}
        onClearFilters={onClearFilters}
      />
    );
  }

  const pinnedNotes = activeTab === 'active' ? notes.filter((n) => n.isPinned) : [];
  const otherNotes = activeTab === 'active' ? notes.filter((n) => !n.isPinned) : notes;

  return (
    <div className="space-y-8">
      {pinnedNotes.length > 0 && (
        <section aria-labelledby="pinned-heading">
          <h2 id="pinned-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pinned
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={onUpdateNote}
                onDelete={onDeleteNote}
                onOpenNote={onOpenNote}
                showToast={showToast}
              />
            ))}
          </div>
        </section>
      )}

      {otherNotes.length > 0 && (
        <section aria-labelledby={pinnedNotes.length > 0 ? 'others-heading' : undefined}>
          {pinnedNotes.length > 0 && (
            <h2 id="others-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Others
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={onUpdateNote}
                onDelete={onDeleteNote}
                onOpenNote={onOpenNote}
                showToast={showToast}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}