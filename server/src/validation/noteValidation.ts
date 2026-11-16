import { AppError } from '../errors/AppError.js';
import { isValidColor, PaletteColor } from '../constants/palette.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function countCodePoints(str: string): number {
  return [...str].length;
}

export function isValidUuid(str: unknown): str is string {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

export function validateNoteId(id: unknown): string {
  if (!isValidUuid(id)) {
    throw AppError.validationError('Invalid note ID: must be a valid UUID');
  }
  return id;
}

export function validateArchivedQuery(archived: unknown): boolean {
  if (archived !== 'true' && archived !== 'false') {
    throw AppError.validationError('The "archived" query parameter is required and must be "true" or "false"');
  }
  return archived === 'true';
}

export interface ChecklistItemDTO {
  text: string;
  isChecked: boolean;
}

export interface CreateNoteDTO {
  id: string;
  title: string;
  body: string;
  color: PaletteColor;
  checklistItems: ChecklistItemDTO[];
}

export interface UpdateNoteDTO {
  title?: string;
  body?: string;
  color?: PaletteColor;
  isPinned?: boolean;
  isArchived?: boolean;
  checklistItems?: ChecklistItemDTO[];
}

export interface OverflowInputDTO {
  id: string;
  text: string;
  isChecked: boolean;
}

function validateChecklistItem(item: unknown, index: number): ChecklistItemDTO {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw AppError.validationError(`Checklist item at index ${index} must be an object`);
  }

  const obj = item as Record<string, unknown>;
  const allowedKeys = new Set(['text', 'isChecked']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw AppError.validationError(`Unknown field "${key}" in checklist item at index ${index}`);
    }
  }

  if (typeof obj.text !== 'string') {
    throw AppError.validationError(`Checklist item at index ${index} must have a string "text" property`);
  }

  if (countCodePoints(obj.text) > 80) {
    throw AppError.validationError(`Checklist item text at index ${index} exceeds 80 characters`);
  }

  if (typeof obj.isChecked !== 'boolean') {
    throw AppError.validationError(`Checklist item at index ${index} must have a boolean "isChecked" property`);
  }

  return {
    text: obj.text,
    isChecked: obj.isChecked,
  };
}

export function validateCreateNoteInput(body: unknown): CreateNoteDTO {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw AppError.validationError('Request body must be a JSON object');
  }

  const obj = body as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'title', 'body', 'color', 'checklistItems']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw AppError.validationError(`Unknown field: "${key}" is not accepted on note creation`);
    }
  }

  if (!obj.id || !isValidUuid(obj.id)) {
    throw AppError.validationError('A valid UUID "id" is required to create a note');
  }

  let title = '';
  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string') {
      throw AppError.validationError('Title must be a string');
    }
    if (countCodePoints(obj.title) > 200) {
      throw AppError.validationError('Title cannot exceed 200 characters');
    }
    title = obj.title;
  }

  let noteBody = '';
  if (obj.body !== undefined) {
    if (typeof obj.body !== 'string') {
      throw AppError.validationError('Body must be a string');
    }
    if (countCodePoints(obj.body) > 10000) {
      throw AppError.validationError('Body cannot exceed 10000 characters');
    }
    noteBody = obj.body;
  }

  let color: PaletteColor = 'white';
  if (obj.color !== undefined) {
    if (!isValidColor(obj.color)) {
      throw AppError.validationError(`Invalid color "${obj.color}". Must be one of the preset palette colors`);
    }
    color = obj.color;
  }

  const checklistItems: ChecklistItemDTO[] = [];
  if (obj.checklistItems !== undefined) {
    if (!Array.isArray(obj.checklistItems)) {
      throw AppError.validationError('checklistItems must be an array');
    }
    if (obj.checklistItems.length > 50) {
      throw AppError.validationError('A note cannot hold more than 50 checklist items');
    }
    for (let i = 0; i < obj.checklistItems.length; i++) {
      checklistItems.push(validateChecklistItem(obj.checklistItems[i], i));
    }
  }

  return {
    id: obj.id,
    title,
    body: noteBody,
    color,
    checklistItems,
  };
}

export function validateUpdateNoteInput(body: unknown): UpdateNoteDTO {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw AppError.validationError('Request body must be a JSON object');
  }

  const obj = body as Record<string, unknown>;
  const allowedKeys = new Set(['title', 'body', 'color', 'isPinned', 'isArchived', 'checklistItems']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw AppError.validationError(`Unknown field: "${key}" is not accepted on note update`);
    }
  }

  const result: UpdateNoteDTO = {};

  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string') {
      throw AppError.validationError('Title must be a string');
    }
    if (countCodePoints(obj.title) > 200) {
      throw AppError.validationError('Title cannot exceed 200 characters');
    }
    result.title = obj.title;
  }

  if (obj.body !== undefined) {
    if (typeof obj.body !== 'string') {
      throw AppError.validationError('Body must be a string');
    }
    if (countCodePoints(obj.body) > 10000) {
      throw AppError.validationError('Body cannot exceed 10000 characters');
    }
    result.body = obj.body;
  }

  if (obj.color !== undefined) {
    if (!isValidColor(obj.color)) {
      throw AppError.validationError(`Invalid color "${obj.color}". Must be one of the preset palette colors`);
    }
    result.color = obj.color;
  }

  if (obj.isPinned !== undefined) {
    if (typeof obj.isPinned !== 'boolean') {
      throw AppError.validationError('isPinned must be a boolean');
    }
    result.isPinned = obj.isPinned;
  }

  if (obj.isArchived !== undefined) {
    if (typeof obj.isArchived !== 'boolean') {
      throw AppError.validationError('isArchived must be a boolean');
    }
    result.isArchived = obj.isArchived;
  }

  if (obj.checklistItems !== undefined) {
    if (!Array.isArray(obj.checklistItems)) {
      throw AppError.validationError('checklistItems must be an array');
    }
    if (obj.checklistItems.length > 50) {
      throw AppError.validationError('A note cannot hold more than 50 checklist items');
    }
    result.checklistItems = obj.checklistItems.map((item, idx) => validateChecklistItem(item, idx));
  }

  return result;
}

export function validateOverflowInput(body: unknown): OverflowInputDTO {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw AppError.validationError('Request body must be a JSON object');
  }

  const obj = body as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'text', 'isChecked']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw AppError.validationError(`Unknown field: "${key}" is not accepted on overflow creation`);
    }
  }

  if (!obj.id || !isValidUuid(obj.id)) {
    throw AppError.validationError('A valid UUID "id" is required for overflow note');
  }

  if (typeof obj.text !== 'string') {
    throw AppError.validationError('"text" must be a string');
  }

  if (countCodePoints(obj.text) > 80) {
    throw AppError.validationError('"text" cannot exceed 80 characters');
  }

  if (typeof obj.isChecked !== 'boolean') {
    throw AppError.validationError('"isChecked" must be a boolean');
  }

  return {
    id: obj.id,
    text: obj.text,
    isChecked: obj.isChecked,
  };
}
