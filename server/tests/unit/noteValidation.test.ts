import { describe, it, expect } from 'vitest';
import { PALETTE, isValidColor } from '../../src/constants/palette.js';
import {
  countCodePoints,
  isValidUuid,
  validateNoteId,
  validateArchivedQuery,
  validateCreateNoteInput,
  validateUpdateNoteInput,
  validateOverflowInput,
} from '../../src/validation/noteValidation.js';
import { AppError } from '../../src/errors/AppError.js';

describe('Validation and Server Palette (B-04)', () => {
  describe('Server Palette (Architecture Section 13, A-01)', () => {
    it('contains exactly the 8 preset colors', () => {
      expect(PALETTE).toEqual([
        'white',
        'red',
        'orange',
        'yellow',
        'green',
        'teal',
        'blue',
        'purple',
      ]);
      expect(PALETTE.length).toBe(8);
    });

    it('isValidColor correctly recognizes palette colors and rejects others', () => {
      expect(isValidColor('white')).toBe(true);
      expect(isValidColor('teal')).toBe(true);
      expect(isValidColor('purple')).toBe(true);
      expect(isValidColor('black')).toBe(false);
      expect(isValidColor('pink')).toBe(false);
      expect(isValidColor(123)).toBe(false);
      expect(isValidColor(null)).toBe(false);
    });
  });

  describe('countCodePoints utility', () => {
    it('correctly counts ASCII characters', () => {
      expect(countCodePoints('hello')).toBe(5);
      expect(countCodePoints('')).toBe(0);
    });

    it('correctly counts unicode characters and surrogate pair emojis as single code points', () => {
      // Emojis such as '🔥' are 2 UTF-16 code units (length === 2) but 1 Unicode code point
      expect('🔥'.length).toBe(2);
      expect(countCodePoints('🔥')).toBe(1);
      expect('Note 📝 with emoji 🔥'.length).toBe(21);
      expect(countCodePoints('Note 📝 with emoji 🔥')).toBe(19);
    });
  });

  describe('validateNoteId', () => {
    it('accepts valid UUIDs', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(validateNoteId(validUuid)).toBe(validUuid);
    });

    it('rejects invalid UUID formats with 400 VALIDATION_ERROR', () => {
      expect(() => validateNoteId('not-a-uuid')).toThrowError(AppError);
      expect(() => validateNoteId(123)).toThrowError(AppError);
    });
  });

  describe('validateArchivedQuery (N-10)', () => {
    it('accepts "true" and returns boolean true', () => {
      expect(validateArchivedQuery('true')).toBe(true);
    });

    it('accepts "false" and returns boolean false', () => {
      expect(validateArchivedQuery('false')).toBe(false);
    });

    it('rejects missing or arbitrary query values with 400 VALIDATION_ERROR', () => {
      expect(() => validateArchivedQuery(undefined)).toThrowError(AppError);
      expect(() => validateArchivedQuery('yes')).toThrowError(AppError);
      expect(() => validateArchivedQuery('1')).toThrowError(AppError);
    });
  });

  describe('validateCreateNoteInput (N-04)', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';

    it('accepts valid input and sets defaults for omitted title, body, color, and checklistItems', () => {
      const result = validateCreateNoteInput({ id: validId });
      expect(result).toEqual({
        id: validId,
        title: '',
        body: '',
        color: 'white',
        checklistItems: [],
      });
    });

    it('accepts full valid input with checklist items', () => {
      const result = validateCreateNoteInput({
        id: validId,
        title: 'My Title',
        body: 'My Body',
        color: 'teal',
        checklistItems: [{ text: 'Item 1', isChecked: false }],
      });
      expect(result.color).toBe('teal');
      expect(result.checklistItems).toEqual([{ text: 'Item 1', isChecked: false }]);
    });

    it('rejects unknown fields on POST with 400 VALIDATION_ERROR (N-04)', () => {
      expect(() =>
        validateCreateNoteInput({ id: validId, isPinned: true })
      ).toThrowError(AppError);

      expect(() =>
        validateCreateNoteInput({ id: validId, isArchived: false })
      ).toThrowError(AppError);

      expect(() =>
        validateCreateNoteInput({ id: validId, extraProperty: 'invalid' })
      ).toThrowError(AppError);
    });

    it('rejects title exceeding 200 code points', () => {
      const longTitle = 'a'.repeat(201);
      expect(() =>
        validateCreateNoteInput({ id: validId, title: longTitle })
      ).toThrowError(/exceed 200/);
    });

    it('rejects body exceeding 10000 code points', () => {
      const longBody = 'b'.repeat(10001);
      expect(() =>
        validateCreateNoteInput({ id: validId, body: longBody })
      ).toThrowError(/exceed 10000/);
    });

    it('rejects invalid color', () => {
      expect(() =>
        validateCreateNoteInput({ id: validId, color: 'neon-pink' })
      ).toThrowError(/Invalid color/);
    });

    it('rejects checklistItems exceeding 50 items', () => {
      const items = Array.from({ length: 51 }, (_, i) => ({ text: `Item ${i}`, isChecked: false }));
      expect(() =>
        validateCreateNoteInput({ id: validId, checklistItems: items })
      ).toThrowError(/cannot hold more than 50/);
    });

    it('rejects checklistItem with text exceeding 80 code points', () => {
      const items = [{ text: 'x'.repeat(81), isChecked: false }];
      expect(() =>
        validateCreateNoteInput({ id: validId, checklistItems: items })
      ).toThrowError(/exceeds 80/);
    });

    it('rejects checklistItem with unknown or malformed properties', () => {
      expect(() =>
        validateCreateNoteInput({
          id: validId,
          checklistItems: [{ text: 'Item', isChecked: false, id: 1 }],
        })
      ).toThrowError(/Unknown field/);
    });
  });

  describe('validateUpdateNoteInput', () => {
    it('accepts partial updates', () => {
      const res = validateUpdateNoteInput({ title: 'Updated Title', isPinned: true });
      expect(res).toEqual({ title: 'Updated Title', isPinned: true });
    });

    it('rejects unknown fields on PATCH with 400 VALIDATION_ERROR', () => {
      expect(() =>
        validateUpdateNoteInput({ id: '123e4567-e89b-12d3-a456-426614174000' })
      ).toThrowError(/Unknown field/);
    });

    it('validates types on fields when provided', () => {
      expect(() => validateUpdateNoteInput({ isPinned: 'true' })).toThrowError(/boolean/);
      expect(() => validateUpdateNoteInput({ isArchived: 1 })).toThrowError(/boolean/);
      expect(() => validateUpdateNoteInput({ color: 'invalid-color' })).toThrowError(/Invalid color/);
    });
  });

  describe('validateOverflowInput (P-02)', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';

    it('accepts valid overflow payload', () => {
      const res = validateOverflowInput({
        id: validId,
        text: '51st Item Text',
        isChecked: false,
      });
      expect(res).toEqual({
        id: validId,
        text: '51st Item Text',
        isChecked: false,
      });
    });

    it('rejects unknown fields on overflow', () => {
      expect(() =>
        validateOverflowInput({ id: validId, text: 'Item', isChecked: false, title: 'Extra' })
      ).toThrowError(/Unknown field/);
    });

    it('rejects overflow text exceeding 80 code points', () => {
      expect(() =>
        validateOverflowInput({ id: validId, text: 'c'.repeat(81), isChecked: false })
      ).toThrowError(/cannot exceed 80/);
    });

    it('rejects invalid UUID id', () => {
      expect(() =>
        validateOverflowInput({ id: 'invalid-id', text: 'Item', isChecked: false })
      ).toThrowError(/valid UUID/);
    });
  });
});
