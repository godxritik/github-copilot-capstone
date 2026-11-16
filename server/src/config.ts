import fs from 'node:fs';
import path from 'node:path';

export function loadEnvFile(envPath?: string): void {
  const targetPath = envPath || path.resolve(process.cwd(), '.env');
  if (fs.existsSync(targetPath)) {
    try {
      const content = fs.readFileSync(targetPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
      }
    } catch {
      // Ignore errors reading local .env file
    }
  }
}

export interface Config {
  port: number;
  dbPath: string;
  clientUrl: string;
  nodeEnv: string;
}

export function getConfig(): Config {
  loadEnvFile();

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const dbPath = process.env.DB_PATH || './notes.sqlite';
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    port: isNaN(port) ? 3000 : port,
    dbPath,
    clientUrl,
    nodeEnv,
  };
}

export const config = getConfig();
