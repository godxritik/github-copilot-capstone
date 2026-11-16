import { describe, it, expect } from 'vitest';
import { PALETTE, PALETTE_COLORS, isValidPaletteColor } from '../../src/lib/palette.js';
import { PALETTE as SERVER_PALETTE } from '../../../server/src/constants/palette.js';

function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Palette (F-02, T-01, FR-07, FR-11, NFR-05)', () => {
  it('exports exactly the 8 preset colors including white (A-01)', () => {
    expect(PALETTE_COLORS).toEqual([
      'white',
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'blue',
      'purple',
    ]);
    expect(Object.keys(PALETTE).length).toBe(8);
  });

  it('matches server palette list exactly (Architecture Section 10)', () => {
    expect([...PALETTE_COLORS]).toEqual([...SERVER_PALETTE]);
  });

  it('ensures every color has a checked-item muted text contrast >= 4.5:1 against its background (NFR-05, FR-11)', () => {
    for (const colorKey of PALETTE_COLORS) {
      const colorItem = PALETTE[colorKey];
      const contrast = getContrastRatio(colorItem.bgHex, colorItem.mutedTextHex);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('validates color strings correctly with isValidPaletteColor', () => {
    expect(isValidPaletteColor('white')).toBe(true);
    expect(isValidPaletteColor('teal')).toBe(true);
    expect(isValidPaletteColor('unknown')).toBe(false);
  });
});