import { PALETTE, PALETTE_COLORS, type PaletteColor } from '../lib/palette.js';

export interface ColorFilterProps {
  selectedColors: PaletteColor[];
  onToggleColor: (color: PaletteColor) => void;
  onClearColors: () => void;
}

export function ColorFilter({ selectedColors, onToggleColor, onClearColors }: ColorFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-2" role="group" aria-label="Color filters">
      <span className="text-xs font-medium text-white mr-1">Filter by color:</span>
      {PALETTE_COLORS.map((color) => {
        const isSelected = selectedColors.includes(color);
        return (
          <button
            key={color}
            type="button"
            onClick={() => onToggleColor(color)}
            aria-label={`Filter by ${PALETTE[color].name}`}
            aria-pressed={isSelected}
            className={`w-6 h-6 rounded-full border transition-all ${PALETTE[color].bgClass} ${
              isSelected ? 'ring-2 ring-white scale-110 border-white' : 'border-sand hover:scale-105'
            }`}
          />
        );
      })}
      {selectedColors.length > 0 && (
        <button
          type="button"
          onClick={onClearColors}
          aria-label="Clear color filter"
          className="text-xs text-white hover:text-sand underline ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}