import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { configureApp } from '../src/app.setup.js';

/**
 * Builds the real application for an e2e test, configured exactly like
 * main.ts. AppModule is imported lazily, so a test can adjust the
 * environment first (the config is read when the module is loaded).
 */
export async function createTestApp(
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<NestExpressApplication> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}
