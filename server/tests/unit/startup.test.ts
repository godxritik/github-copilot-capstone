import { describe, it, expect } from 'vitest';
import http from 'node:http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initializeDatabase, closeDatabase } from '../../src/db/database.js';
import { createApp } from '../../src/app.js';

describe('Application Startup and Loopback Bind (B-13)', () => {
  it('starts HTTP server on 127.0.0.1, responds to GET /api/notes?archived=false, and closes cleanly', async () => {
    const tmpDbPath = path.join(os.tmpdir(), `startup-test-${Date.now()}.sqlite`);
    const db = initializeDatabase(tmpDbPath);
    const app = createApp({ clientUrl: 'http://localhost:5173', db });

    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address() as { address: string; port: number };
    expect(address.address).toBe('127.0.0.1');

    // Make an actual HTTP GET request over loopback
    const res = await fetch(`http://127.0.0.1:${address.port}/api/notes?archived=false`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);

    // Clean shutdown
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    closeDatabase(db);
    if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  });
});
