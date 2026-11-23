export interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
}

export function SearchBar({ value, onChange, onClear }: SearchBarProps) {
  return (
    <div className="relative flex-1 max-w-lg">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-sage">
        🔍
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search notes..."
        aria-label="Search notes"
        className="w-full pl-9 pr-9 py-2 bg-cream border border-sand rounded-lg text-sm text-forest placeholder-sage focus:outline-none focus:ring-2 focus:ring-sand focus:border-transparent shadow-sm"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-sage hover:text-forest font-bold"
        >
          &times;
        </button>
      )}
    </div>
  );
}