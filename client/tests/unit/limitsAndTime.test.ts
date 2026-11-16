import { describe, it, expect } from 'vitest';
import { LIMITS, countCodePoints, truncateChecklistItemText } from '../../src/lib/limits.js';
import { formatLocalTime } from '../../src/lib/time.js';

describe('Shared Limits and Time Utilities (F-03)', () => {
  it('defines correct limits according to Architecture Section 8', () => {
    expect(LIMITS.TITLE_MAX_CODE_POINTS).toBe(200);
    expect(LIMITS.BODY_MAX_CODE_POINTS).toBe(10000);
    expect(LIMITS.CHECKLIST_ITEM_MAX_CODE_POINTS).toBe(80);
    expect(LIMITS.MAX_CHECKLIST_ITEMS).toBe(50);
  });

  it('accurately counts Unicode code points with emojis', () => {
    expect(countCodePoints('hello')).toBe(5);
    expect(countCodePoints('🔥')).toBe(1);
    expect(countCodePoints('Task 📝 with emoji 🔥')).toBe(19);
  });

  it('truncates checklist text over 80 code points accurately (FR-11)', () => {
    const text80 = 'x'.repeat(80);
    const text85 = 'x'.repeat(85);

    expect(truncateChecklistItemText(text80)).toEqual({ text: text80, wasTruncated: false });
    expect(truncateChecklistItemText(text85)).toEqual({ text: text80, wasTruncated: true });
  });

  it('formats UTC ISO timestamp into local time string', () => {
    const iso = '2026-11-16T10:00:00.000Z';
    const formatted = formatLocalTime(iso);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatLocalTime('invalid-date')).toBe('');
  });
});