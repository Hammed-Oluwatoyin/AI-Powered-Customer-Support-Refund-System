import { execSync } from 'node:child_process';
import { applyTestEnv } from './test-env.js';

/**
 * Runs once before the e2e suite: brings the test database schema up to date
 * with the same `migrate deploy` step used in production. Prisma creates the
 * database first if it does not exist.
 */
export default function setup(): void {
  applyTestEnv();
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
