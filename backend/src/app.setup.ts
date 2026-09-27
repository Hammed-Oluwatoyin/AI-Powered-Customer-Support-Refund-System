import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * App-wide HTTP configuration, shared by main.ts and the e2e tests so the
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Don't advertise the framework to clients.
  app.disable('x-powered-by');
}
