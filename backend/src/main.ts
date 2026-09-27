import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Twelve-Factor XI: structured JSON logs to stdout, no log files.
    logger: new ConsoleLogger({ json: true, flattenParams: true }),
  });
  configureApp(app);

  // Twelve-Factor IX: close the HTTP server and connections cleanly on SIGTERM.
  app.enableShutdownHooks();

  const config: ConfigService<EnvironmentVariables, true> =
    app.get(ConfigService);
  // Twelve-Factor VII: self-contained, bound to the configured port.
  await app.listen(config.get('PORT', { infer: true }));
}

await bootstrap();
