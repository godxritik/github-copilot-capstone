import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../src/errors/AppError.js';
import { errorHandler } from '../../src/errors/errorHandler.js';

describe('AppError and errorHandler (B-03)', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {};
    res = {
      headersSent: false,
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
    };
    next = vi.fn() as unknown as NextFunction;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('AppError class', () => {
    it('creates an AppError with custom statusCode, code, and message', () => {
      const err = new AppError(400, 'CUSTOM_CODE', 'Custom error message');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.message).toBe('Custom error message');
    });

    it('creates standard 400 VALIDATION_ERROR with static helper', () => {
      const err = AppError.validationError('Invalid note title');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Invalid note title');
    });

    it('creates standard 400 NOTE_ARCHIVED with static helper', () => {
      const err = AppError.noteArchived();
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('NOTE_ARCHIVED');
      expect(err.message).toBe('Archived notes are read-only. Unarchive the note to edit it.');
    });

    it('creates standard 404 NOT_FOUND with static helper', () => {
      const err = AppError.notFound('Note with specified ID does not exist');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Note with specified ID does not exist');
    });

    it('creates standard 500 INTERNAL_ERROR with static helper', () => {
      const err = AppError.internalError();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.message).toBe('An unexpected error occurred');
    });
  });

  describe('errorHandler middleware', () => {
    it('formats AppError into the Section 6 error JSON structure', () => {
      const appErr = AppError.validationError('Title exceeds 200 characters');
      errorHandler(appErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title exceeds 200 characters',
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('formats 404 NOT_FOUND AppError properly', () => {
      const appErr = AppError.notFound();
      errorHandler(appErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Note not found',
        },
      });
    });

    it('formats 400 NOTE_ARCHIVED AppError properly', () => {
      const appErr = AppError.noteArchived();
      errorHandler(appErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'NOTE_ARCHIVED',
          message: 'Archived notes are read-only. Unarchive the note to edit it.',
        },
      });
    });

    it('handles body-parser SyntaxError as 400 VALIDATION_ERROR', () => {
      const syntaxErr = new SyntaxError('Unexpected token in JSON');
      (syntaxErr as unknown as { status: number; body: string }).status = 400;
      (syntaxErr as unknown as { status: number; body: string }).body = '{invalid';

      errorHandler(syntaxErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Malformed JSON payload',
        },
      });
    });

    it('handles entity.too.large error as 400 VALIDATION_ERROR', () => {
      const payloadErr = { type: 'entity.too.large', message: 'request entity too large' };

      errorHandler(payloadErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'JSON payload exceeds 100 KB limit',
        },
      });
    });

    it('masks unexpected errors and returns 500 INTERNAL_ERROR without leaking internal stack', () => {
      const unexpectedErr = new Error('Database disk connection failed or SQL syntax error in /var/db/internal.sqlite');
      errorHandler(unexpectedErr, req as Request, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
      // Verifies internal details are NOT leaked to client response
      expect(jsonMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Database disk'),
          }),
        })
      );
    });

    it('delegates to next(err) if headers are already sent', () => {
      res.headersSent = true;
      const err = new Error('Post-header error');

      errorHandler(err, req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
