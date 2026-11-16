import express from 'express';
import type { Application, Request, Response, NextFunction } from 'express';
import type Database from 'better-sqlite3';
import { createNotesRouter } from './routes/notesRoutes.js';
import { NotesService } from './services/notesService.js';
import { NotesRepository } from './db/notesRepository.js';
import { errorHandler } from './errors/errorHandler.js';
import { AppError } from './errors/AppError.js';

export interface AppOptions {
  clientUrl: string;
  db: Database.Database;
}

export function createApp(options: AppOptions): Application {
  const app = express();

  // JSON body parser with 100 KB limit (Architecture Section 9)
  app.use(express.json({ limit: '100kb' }));

  // Security headers middleware (Architecture Section 9)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
  });

  // CORS middleware allowing only CLIENT_URL (Architecture Section 9, N-07)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && origin === options.clientUrl) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  // Register notes router under /api
  const repo = new NotesRepository(options.db);
  const service = new NotesService(repo);
  app.use('/api', createNotesRouter(service));

  // Catch unhandled routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    next(AppError.notFound(`Cannot ${req.method} ${req.path}`));
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
