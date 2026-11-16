export const PALETTE = [
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
] as const;

export type PaletteColor = (typeof PALETTE)[number];

export function isValidColor(color: unknown): color is PaletteColor {
  return typeof color === 'string' && (PALETTE as readonly string[]).includes(color);
}
