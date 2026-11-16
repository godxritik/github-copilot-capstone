import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initializeDatabase, closeDatabase } from '../../src/db/database.js';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

describe('API Integration Tests (B-11, B-12, B-13)', () => {
  let dbPath: string;
  let db: any;
  let app: Application;
  const clientUrl = 'http://localhost:5173';

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `api-test-${Date.now()}-${Math.random()}.sqlite`);
    db = initializeDatabase(dbPath);
    app = createApp({ clientUrl, db });
  });

  afterEach(() => {
    closeDatabase(db);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  describe('Middleware and Security Headers (B-12)', () => {
    it('sets nosniff and CSP security headers on responses', async () => {
      const res = await request(app).get('/api/notes?archived=false');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'");
    });

    it('sets CORS headers when Origin matches CLIENT_URL', async () => {
      const res = await request(app)
        .get('/api/notes?archived=false')
        .set('Origin', clientUrl);
      expect(res.headers['access-control-allow-origin']).toBe(clientUrl);
    });

    it('does not set Access-Control-Allow-Origin for foreign origins', async () => {
      const res = await request(app)
        .get('/api/notes?archived=false')
        .set('Origin', 'http://malicious.site');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight OPTIONS request with 204 and CORS headers', async () => {
      const res = await request(app)
        .options('/api/notes')
        .set('Origin', clientUrl);
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(clientUrl);
      expect(res.headers['access-control-allow-methods']).toContain('GET, POST, PATCH, DELETE, OPTIONS');
    });

    it('returns 400 VALIDATION_ERROR when request body exceeds 100 KB', async () => {
      const hugeBody = { id: '123e4567-e89b-12d3-a456-426614174000', title: 'a'.repeat(105 * 1024) };
      const res = await request(app).post('/api/notes').send(hugeBody);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Endpoint: GET /api/notes (N-10)', () => {
    it('requires archived query parameter', async () => {
      const res = await request(app).get('/api/notes');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('lists active notes when archived=false', async () => {
      const id1 = '11111111-1111-1111-1111-111111111111';
      await request(app).post('/api/notes').send({ id: id1, title: 'Active Note' });

      const res = await request(app).get('/api/notes?archived=false');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Active Note');
    });
  });

  describe('Endpoint: POST /api/notes (FR-01, N-01, N-04)', () => {
    const noteId = '22222222-2222-2222-2222-222222222222';

    it('creates a note and returns 201 with default color and unpinned', async () => {
      const res = await request(app).post('/api/notes').send({
        id: noteId,
        title: 'New Note',
        body: 'Note body',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(noteId);
      expect(res.body.color).toBe('white');
      expect(res.body.isPinned).toBe(false);
      expect(res.body.isArchived).toBe(false);
    });

    it('rejects unknown fields on POST with 400 VALIDATION_ERROR (N-04)', async () => {
      const res = await request(app).post('/api/notes').send({
        id: '33333333-3333-3333-3333-333333333333',
        title: 'T',
        isPinned: true, // not accepted on POST
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns status 200 on repeated POST with identical content (N-01)', async () => {
      const id = '44444444-4444-4444-4444-444444444444';
      await request(app).post('/api/notes').send({ id, title: 'Same' });

      const retryRes = await request(app).post('/api/notes').send({ id, title: 'Same' });
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.id).toBe(id);
    });

    it('returns status 400 VALIDATION_ERROR on repeated POST with conflicting content (N-01)', async () => {
      const id = '55555555-5555-5555-5555-555555555555';
      await request(app).post('/api/notes').send({ id, title: 'Initial' });

      const conflictRes = await request(app).post('/api/notes').send({ id, title: 'Conflicting' });
      expect(conflictRes.status).toBe(400);
      expect(conflictRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Endpoint: GET /api/notes/:id', () => {
    it('returns 200 for existing note', async () => {
      const id = '66666666-6666-6666-6666-666666666666';
      await request(app).post('/api/notes').send({ id, title: 'My Note' });

      const res = await request(app).get(`/api/notes/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('My Note');
    });

    it('returns 404 NOT_FOUND for non-existent note', async () => {
      const res = await request(app).get('/api/notes/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 VALIDATION_ERROR for non-UUID id', async () => {
      const res = await request(app).get('/api/notes/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Endpoint: PATCH /api/notes/:id (D-04, FR-10)', () => {
    const id = '77777777-7777-7777-7777-777777777777';

    beforeEach(async () => {
      await request(app).post('/api/notes').send({ id, title: 'Original' });
    });

    it('updates title and body successfully', async () => {
      const res = await request(app).patch(`/api/notes/${id}`).send({ title: 'Updated' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('archiving unpins note', async () => {
      await request(app).patch(`/api/notes/${id}`).send({ isPinned: true });
      const res = await request(app).patch(`/api/notes/${id}`).send({ isArchived: true });
      expect(res.body.isArchived).toBe(true);
      expect(res.body.isPinned).toBe(false);
    });

    it('rejects editing archived note with 400 NOTE_ARCHIVED (D-04)', async () => {
      await request(app).patch(`/api/notes/${id}`).send({ isArchived: true });

      const res = await request(app).patch(`/api/notes/${id}`).send({ title: 'Illegal Edit' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('NOTE_ARCHIVED');
    });

    it('allows pure unarchive (isArchived: false) and sets isPinned: false', async () => {
      await request(app).patch(`/api/notes/${id}`).send({ isArchived: true });

      const res = await request(app).patch(`/api/notes/${id}`).send({ isArchived: false });
      expect(res.status).toBe(200);
      expect(res.body.isArchived).toBe(false);
      expect(res.body.isPinned).toBe(false);
    });

    it('rejects mixed unarchive with other edits with 400 VALIDATION_ERROR', async () => {
      await request(app).patch(`/api/notes/${id}`).send({ isArchived: true });

      const res = await request(app).patch(`/api/notes/${id}`).send({ isArchived: false, title: 'New' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Endpoint: POST /api/notes/:id/overflow (P-02, R3-01)', () => {
    const origId = '88888888-8888-8888-8888-888888888888';
    const overId = '99999999-9999-9999-9999-999999999999';

    it('creates overflow note and returns 201 with note and original', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ text: `Item ${i + 1}`, isChecked: false }));
      await request(app).post('/api/notes').send({ id: origId, title: 'Big Note', checklistItems: items });

      const res = await request(app)
        .post(`/api/notes/${origId}/overflow`)
        .send({ id: overId, text: 'Item 51', isChecked: false });

      expect(res.status).toBe(201);
      expect(res.body.note.id).toBe(overId);
      expect(res.body.note.title).toBe('Continued from Big Note');
      expect(res.body.note.continuedFromId).toBe(origId);
      expect(res.body.original.continuedInId).toBe(overId);
    });

    it('returns 200 on identical overflow retry', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ text: `Item ${i + 1}`, isChecked: false }));
      await request(app).post('/api/notes').send({ id: origId, title: 'Big Note', checklistItems: items });

      await request(app)
        .post(`/api/notes/${origId}/overflow`)
        .send({ id: overId, text: 'Item 51', isChecked: false });

      const retryRes = await request(app)
        .post(`/api/notes/${origId}/overflow`)
        .send({ id: overId, text: 'Item 51', isChecked: false });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.note.id).toBe(overId);
    });
  });

  describe('Endpoint: DELETE /api/notes/:id (FR-05, N-08)', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    it('deletes note and returns 204 No Content', async () => {
      await request(app).post('/api/notes').send({ id, title: 'To Delete' });

      const res = await request(app).delete(`/api/notes/${id}`);
      expect(res.status).toBe(204);

      // Verify deletion
      const checkRes = await request(app).get(`/api/notes/${id}`);
      expect(checkRes.status).toBe(404);
    });

    it('returns 404 NOT_FOUND when deleting non-existent note', async () => {
      const res = await request(app).delete('/api/notes/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 NOT_FOUND for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
