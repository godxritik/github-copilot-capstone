export interface EmptyStateProps {
  isFiltered: boolean;
  activeTab: 'active' | 'archived';
  onClearFilters: () => void;
}

export function EmptyState({ isFiltered, activeTab, onClearFilters }: EmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-gray-500 text-base mb-3">No notes match your search or filter.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-medium text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-md border border-yellow-200 transition-colors"
        >
          Clear search and filters
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      <p className="text-gray-500 text-lg">
        {activeTab === 'active' ? 'No notes yet. Add one above!' : 'No archived notes.'}
      </p>
    </div>
  );
}