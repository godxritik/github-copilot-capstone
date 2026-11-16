import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getConfig, loadEnvFile, Config } from '../../src/config.js';

describe('Configuration module (B-01)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.DB_PATH;
    delete process.env.CLIENT_URL;
    delete process.env.NODE_ENV;
    delete process.env.HOST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('provides expected defaults when env variables are not set', () => {
    const conf = getConfig();
    expect(conf.port).toBe(3000);
    expect(conf.dbPath).toBe('./notes.sqlite');
    expect(conf.clientUrl).toBe('http://localhost:5173');
    expect(conf.nodeEnv).toBe('development');
  });

  it('reads custom environment variables accurately', () => {
    process.env.PORT = '8080';
    process.env.DB_PATH = '/custom/path/notes.db';
    process.env.CLIENT_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'production';

    const conf = getConfig();
    expect(conf.port).toBe(8080);
    expect(conf.dbPath).toBe('/custom/path/notes.db');
    expect(conf.clientUrl).toBe('http://localhost:3000');
    expect(conf.nodeEnv).toBe('production');
  });

  it('falls back to default port when PORT is non-numeric', () => {
    process.env.PORT = 'invalid-port';
    const conf = getConfig();
    expect(conf.port).toBe(3000);
  });

  it('does not export or expose any HOST setting (local loopback only per Architecture Section 9)', () => {
    const conf = getConfig();
    expect('host' in conf).toBe(false);
    expect((conf as unknown as Record<string, unknown>).HOST).toBeUndefined();
  });

  it('loads key-value pairs from .env file when present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
    const tmpEnv = path.join(tmpDir, '.env');
    fs.writeFileSync(tmpEnv, 'PORT=4000\nDB_PATH=./test.sqlite\nCLIENT_URL=http://localhost:4173\n# comment\n', 'utf8');

    loadEnvFile(tmpEnv);

    expect(process.env.PORT).toBe('4000');
    expect(process.env.DB_PATH).toBe('./test.sqlite');
    expect(process.env.CLIENT_URL).toBe('http://localhost:4173');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
