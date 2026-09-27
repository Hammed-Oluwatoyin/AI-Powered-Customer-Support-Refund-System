/**
 * Environment for the e2e suite, shared by the global setup (migrations) and
 * the per-worker setup (the app under test).
 */

// CI sets this to its Postgres service container. Locally it points at the
// Compose Postgres, never at the development database.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://refunds:refunds@localhost:5433/refunds_test';

export function applyTestEnv(): void {
  // Tests must be deterministic and must never call a real LLM.
  process.env.LLM_PROVIDER = 'mock';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.ADMIN_API_KEY ??= 'e2e-admin-key-0123456789';
  // High enough that the scenario suites never hit it; the throttling test
  // sets its own low limit.
  process.env.THROTTLE_LIMIT = '1000';
}
