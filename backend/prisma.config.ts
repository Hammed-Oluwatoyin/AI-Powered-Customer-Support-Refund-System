import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local-development convenience: load the repo-root .env when running the
// Prisma CLI on the host. Variables already set in the environment win, and
// Docker images contain no .env file.
if (existsSync('../.env')) {
  process.loadEnvFile('../.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // The seed is compiled with the app, so it runs in the production image.
    seed: 'node dist/prisma/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
