import http from 'node:http';
import type Database from 'better-sqlite3';
import { config } from './config.js';
import { initializeDatabase, closeDatabase } from './db/database.js';
import { createApp } from './app.js';

const db: Database.Database = initializeDatabase(config.dbPath);
const app = createApp({ clientUrl: config.clientUrl, db });

// Bind strictly to 127.0.0.1 (Architecture Section 9, P-09: no HOST setting)
const server = http.createServer(app);

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    closeDatabase(db);
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server, db, app };
