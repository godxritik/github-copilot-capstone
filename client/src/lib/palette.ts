export interface PaletteItem {
  id: string;
  name: string;
  bgClass: string;
  bgHex: string;
  mutedTextClass: string;
  mutedTextHex: string;
  borderClass: string;
}

export const PALETTE_COLORS = [
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];

export const PALETTE: Record<PaletteColor, PaletteItem> = {
  white: {
    id: 'white',
    name: 'White',
    bgClass: 'bg-white',
    bgHex: '#ffffff',
    mutedTextClass: 'text-gray-600 line-through',
    mutedTextHex: '#525252',
    borderClass: 'border-gray-200',
  },
  red: {
    id: 'red',
    name: 'Red',
    bgClass: 'bg-red-100',
    bgHex: '#fee2e2',
    mutedTextClass: 'text-red-900 line-through',
    mutedTextHex: '#7f1d1d',
    borderClass: 'border-red-200',
  },
  orange: {
    id: 'orange',
    name: 'Orange',
    bgClass: 'bg-orange-100',
    bgHex: '#ffedd5',
    mutedTextClass: 'text-orange-950 line-through',
    mutedTextHex: '#431407',
    borderClass: 'border-orange-200',
  },
  yellow: {
    id: 'yellow',
    name: 'Yellow',
    bgClass: 'bg-yellow-100',
    bgHex: '#fef9c3',
    mutedTextClass: 'text-yellow-950 line-through',
    mutedTextHex: '#422006',
    borderClass: 'border-yellow-200',
  },
  green: {
    id: 'green',
    name: 'Green',
    bgClass: 'bg-green-100',
    bgHex: '#dcfce7',
    mutedTextClass: 'text-green-950 line-through',
    mutedTextHex: '#052e16',
    borderClass: 'border-green-200',
  },
  teal: {
    id: 'teal',
    name: 'Teal',
    bgClass: 'bg-teal-100',
    bgHex: '#ccfbf1',
    mutedTextClass: 'text-teal-950 line-through',
    mutedTextHex: '#042f2c',
    borderClass: 'border-teal-200',
  },
  blue: {
    id: 'blue',
    name: 'Blue',
    bgClass: 'bg-sky-100',
    bgHex: '#e0f2fe',
    mutedTextClass: 'text-sky-950 line-through',
    mutedTextHex: '#082f49',
    borderClass: 'border-sky-200',
  },
  purple: {
    id: 'purple',
    name: 'Purple',
    bgClass: 'bg-purple-100',
    bgHex: '#f3e8ff',
    mutedTextClass: 'text-purple-950 line-through',
    mutedTextHex: '#3b0764',
    borderClass: 'border-purple-200',
  },
};

export function isValidPaletteColor(color: unknown): color is PaletteColor {
  return typeof color === 'string' && (PALETTE_COLORS as readonly string[]).includes(color);
}