import type { INestApplication } from '@nestjs/common';

/**
 * App-wide HTTP configuration, shared by main.ts and the e2e tests so the
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
}
