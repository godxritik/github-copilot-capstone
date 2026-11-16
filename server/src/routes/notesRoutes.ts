import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { NotesService } from '../services/notesService.js';
import {
  validateArchivedQuery,
  validateNoteId,
  validateCreateNoteInput,
  validateUpdateNoteInput,
  validateOverflowInput,
} from '../validation/noteValidation.js';

export function createNotesRouter(service: NotesService): Router {
  const router = Router();

  // GET /notes?archived=true|false
  router.get('/notes', (req: Request, res: Response, next: NextFunction) => {
    try {
      const isArchived = validateArchivedQuery(req.query.archived);
      const notes = service.listNotes(isArchived);
      res.status(200).json(notes);
    } catch (err) {
      next(err);
    }
  });

  // GET /notes/:id
  router.get('/notes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = validateNoteId(req.params.id);
      const note = service.getNoteById(id);
      res.status(200).json(note);
    } catch (err) {
      next(err);
    }
  });

  // POST /notes
  router.post('/notes', (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = validateCreateNoteInput(req.body);
      const result = service.createNote(dto);
      res.status(result.status).json(result.note);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /notes/:id
  router.patch('/notes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = validateNoteId(req.params.id);
      const dto = validateUpdateNoteInput(req.body);
      const note = service.updateNote(id, dto);
      res.status(200).json(note);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /notes/:id
  router.delete('/notes/:id', (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = validateNoteId(req.params.id);
      service.deleteNote(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /notes/:id/overflow
  router.post('/notes/:id/overflow', (req: Request, res: Response, next: NextFunction) => {
    try {
      const originalId = validateNoteId(req.params.id);
      const dto = validateOverflowInput(req.body);
      const result = service.createOverflowNote(originalId, dto.id, {
        text: dto.text,
        isChecked: dto.isChecked,
      });
      res.status(result.status).json({
        note: result.note,
        original: result.original,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
