export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static validationError(message: string): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message);
  }

  static noteArchived(message = 'Archived notes are read-only. Unarchive the note to edit it.'): AppError {
    return new AppError(400, 'NOTE_ARCHIVED', message);
  }

  static notFound(message = 'Note not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static internalError(message = 'An unexpected error occurred'): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}
