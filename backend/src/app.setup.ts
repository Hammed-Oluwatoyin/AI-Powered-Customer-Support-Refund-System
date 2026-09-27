import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

/**
 * App-wide HTTP configuration, shared by main.ts and the e2e tests so the
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Don't advertise the framework to clients.
  app.disable('x-powered-by');
  // The backend is only reachable through nginx, so trust exactly one proxy
  // hop: req.ip is then the real client IP, which the rate limiter keys on.
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
}
