export interface EmptyStateProps {
  isFiltered: boolean;
  activeTab: 'active' | 'archived';
  onClearFilters: () => void;
}

export function EmptyState({ isFiltered, activeTab, onClearFilters }: EmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-forest/70 text-base mb-3">No notes match your search or filter.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-medium text-forest hover:text-sage bg-sand/30 hover:bg-sand/50 px-4 py-2 rounded-md border border-sand transition-colors"
        >
          Clear search and filters
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      <p className="text-forest/70 text-lg">
        {activeTab === 'active' ? 'No notes yet. Add one above!' : 'No archived notes.'}
      </p>
    </div>
  );
}