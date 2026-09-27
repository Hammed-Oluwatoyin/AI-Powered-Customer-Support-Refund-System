/**
 * Environment for the e2e suite. Runs before any app module is imported, so
 * these values win over a developer's local .env file.
 */

// Tests must be deterministic and must never call a real LLM.
process.env.LLM_PROVIDER = 'mock';

// Point at a dedicated test database, never the development one. CI sets
// TEST_DATABASE_URL to its Postgres service container.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://refunds:refunds@localhost:5433/refunds_test';

process.env.ADMIN_API_KEY ??= 'e2e-admin-key-0123456789';
