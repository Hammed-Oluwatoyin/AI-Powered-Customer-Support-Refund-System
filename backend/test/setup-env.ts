import { applyTestEnv } from './test-env.js';

// Runs in each test worker before any app module is imported, so these values
// win over a developer's local .env file.
applyTestEnv();
