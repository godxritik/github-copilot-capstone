import { useState, useEffect } from 'react';
import { useNotes } from './hooks/useNotes.js';
import { useDrafts } from './hooks/useDrafts.js';
import { reconcileDraftOnLoad } from './lib/reconciliation.js';
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

  const { getDraft, discardDraft } = useDrafts();

  // Toast state
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastAction, setToastAction] = useState<{ text: string; onAction: () => void } | undefined>(undefined);

  // Reconciliation modal state (P-07)
  const [reconcileDialog, setReconcileDialog] = useState<{
    isOpen: boolean;
    noteId: string;
    draftTitle?: string;
  }>({ isOpen: false, noteId: '' });

  const showToast = (message: string, actionText?: string, onAction?: () => void) => {
    setToastMessage(message);
    if (actionText && onAction) {
      setToastAction({ text: actionText, onAction });
    } else {
      setToastAction(undefined);
    }
  };

  // Reconcile drafts on load
  useEffect(() => {
    const runReconciliation = async () => {
      for (const note of activeNotes) {
        const draft = getDraft(note.id);
        if (draft) {
          const action = await reconcileDraftOnLoad(draft, note);
          if (action.type === 'CONFIRM_WITH_USER') {
            setReconcileDialog({
              isOpen: true,
              noteId: note.id,
              draftTitle: draft.title,
            });
          } else if (action.type === 'DISCARD_REMOVED_404') {
            discardDraft(note.id);
          }
        }
      }
    };

    if (activeNotes.length > 0) {
      runReconciliation();
    }
  }, [activeNotes.length]);

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
        isOpen={reconcileDialog.isOpen}
        title="Server version is newer"
        message={`A newer version of note "${reconcileDialog.draftTitle || ''}" was saved from another session. Apply your unsaved local draft anyway?`}
        confirmLabel="Apply Draft"
        cancelLabel="Keep Server Copy"
        onConfirm={() => {
          setReconcileDialog({ isOpen: false, noteId: '' });
          showToast('Local draft applied.');
        }}
        onCancel={() => {
          discardDraft(reconcileDialog.noteId);
          setReconcileDialog({ isOpen: false, noteId: '' });
          refreshNotes();
        }}
      />
    </div>
  );
}