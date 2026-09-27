import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // The files share one database, so run them one at a time.
    fileParallelism: false,
    // Building the app loads the whole module graph, which can take over the
    // 10s default on a cold cache. This only covers setup hooks.
    hookTimeout: 30_000,
  },
});
