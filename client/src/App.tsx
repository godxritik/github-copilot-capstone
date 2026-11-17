import { useState, useEffect, useRef } from 'react';
import { useNotes } from './hooks/useNotes.js';
import { useDrafts } from './hooks/useDrafts.js';
import { reconcileDraftOnLoad, applyDraftToServer } from './lib/reconciliation.js';
import { SearchBar } from './components/SearchBar.js';
import { ColorFilter } from './components/ColorFilter.js';
import { NoteCreator } from './components/NoteCreator.js';
import { NoteList } from './components/NoteList.js';
import { Toast } from './components/Toast.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    activeNotes,
    archivedNotes,
    hasLoaded,
    filteredNotes,
    searchQuery,
    setSearchQuery,
    selectedColors,
    toggleColorFilter,
    setSelectedColors,
    clearFilters,
    updateNoteLocally,
    removeNoteLocally,
    refreshNotes,
  } = useNotes();

  const { getDraft, discardDraft, pruneNoteDrafts } = useDrafts();

  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastAction, setToastAction] = useState<{ text: string; onAction: () => void } | undefined>(undefined);

  // Queue of conflicting drafts awaiting a user decision (P-07), shown one at a time
  const [reconcileQueue, setReconcileQueue] = useState<{ noteId: string; draftTitle?: string }[]>([]);

  const showToast = (message: string, actionText?: string, onAction?: () => void) => {
    setToastMessage(message);
    if (actionText && onAction) {
      setToastAction({ text: actionText, onAction });
    } else {
      setToastAction(undefined);
    }
  };

  // Prune drafts whose notes no longer exist; runs only after a successful fetch
  useEffect(() => {
    if (!hasLoaded) return;
    pruneNoteDrafts(new Set([...activeNotes, ...archivedNotes].map((n) => n.id)));
  }, [hasLoaded, activeNotes, archivedNotes, pruneNoteDrafts]);

  // Reconcile drafts once per page load; later list changes must not re-run it
  const reconciledRef = useRef(false);
  useEffect(() => {
    const runReconciliation = async () => {
      let applied = false;
      for (const note of activeNotes) {
        const draft = getDraft(note.id);
        if (!draft) continue;
        const action = await reconcileDraftOnLoad(draft, note);
        if (action.type === 'APPLY_AND_SAVE') {
          try {
            await applyDraftToServer(draft);
            discardDraft(note.id);
            applied = true;
          } catch {
            // Keep the draft so it can be applied on a later load
          }
        } else if (action.type === 'CONFIRM_WITH_USER') {
          setReconcileQueue((q) =>
            q.some((item) => item.noteId === note.id)
              ? q
              : [...q, { noteId: note.id, draftTitle: draft.title }]
          );
        } else if (action.type === 'DISCARD_REMOVED_404') {
          discardDraft(note.id);
        }
      }
      if (applied) refreshNotes();
    };

    if (!hasLoaded || reconciledRef.current) return;
    reconciledRef.current = true;
    runReconciliation();
  }, [hasLoaded, activeNotes]);

  const isFiltered = searchQuery.trim().length > 0 || selectedColors.length > 0;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-yellow-500 text-2xl">📝</span> Keep Notes
            </h1>

            {/* Navigation Tabs */}
            <nav className="flex rounded-lg bg-gray-100 p-1" aria-label="Views">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('archived')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Archive
              </button>
            </nav>
          </div>

          {/* SearchBar */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
          />
        </div>

        {/* Color Filters */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-gray-100">
          <ColorFilter
            selectedColors={selectedColors}
            onToggleColor={toggleColorFilter}
            onClearColors={() => setSelectedColors([])}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Note Creator only visible on Active Notes tab */}
        {activeTab === 'active' && (
          <NoteCreator
            onNoteCreated={(newNote) => {
              updateNoteLocally(newNote);
            }}
            showToast={showToast}
          />
        )}

        {/* Notes Grid List */}
        <NoteList
          notes={filteredNotes}
          activeTab={activeTab}
          isFiltered={isFiltered}
          onUpdateNote={updateNoteLocally}
          onDeleteNote={removeNoteLocally}
          onOpenNote={(id) => {
            // Scroll to note card if present
            const el = document.querySelector(`[data-testid="note-card-${id}"]`);
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onClearFilters={clearFilters}
          showToast={showToast}
        />
      </main>

      {/* Global Toast */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage('')}
          actionText={toastAction?.text}
          onAction={() => {
            toastAction?.onAction();
            setToastMessage('');
          }}
        />
      )}

      {/* Reconciliation Dialog (P-07) */}
      <ConfirmDialog
        isOpen={reconcileQueue.length > 0}
        title="Server version is newer"
        message={`A newer version of note "${reconcileQueue[0]?.draftTitle || ''}" was saved from another session. Apply your unsaved local draft anyway?`}
        confirmLabel="Apply Draft"
        cancelLabel="Keep Server Copy"
        onConfirm={async () => {
          const current = reconcileQueue[0];
          setReconcileQueue((q) => q.slice(1));
          if (!current) return;
          const draft = getDraft(current.noteId);
          if (!draft) return;
          try {
            await applyDraftToServer(draft);
            discardDraft(current.noteId);
            refreshNotes();
            showToast('Local draft applied.');
          } catch {
            showToast('Could not apply draft. Your local draft was kept.');
          }
        }}
        onCancel={() => {
          const current = reconcileQueue[0];
          setReconcileQueue((q) => q.slice(1));
          if (current) discardDraft(current.noteId);
          refreshNotes();
        }}
      />
    </div>
  );
}