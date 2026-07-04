import { INestApplication } from '@nestjs/common';

/**
 * Global application configuration applied in both production bootstrap
 * (main.ts) and e2e tests, so the two stay in sync.
 *
 * CORS is required because the admin front-end runs on a different origin
 * (http://localhost:3000 by default) than the API (http://localhost:3001).
 * Without it, browsers block cross-origin requests ("Failed to fetch").
 * The allowed origin is configurable via CORS_ORIGIN.
 */
export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });
}
