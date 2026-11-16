import type { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Handle SyntaxError from express.json() body parsing
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status: unknown }).status === 400 &&
    'body' in err
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload',
      },
    });
    return;
  }

  // Handle entity.too.large (payload limit 100 KB)
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: unknown }).type === 'entity.too.large'
  ) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'JSON payload exceeds 100 KB limit',
      },
    });
    return;
  }

  // Log unexpected errors on server only (Architecture Section 9)
  console.error('Unhandled server error:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
