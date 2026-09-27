import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import { createTestApp } from './app.js';

describe('GET /api/demo/scenarios (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves every scenario with its email, message and expected outcome', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/demo/scenarios')
      .expect(200);

    expect(body).toHaveLength(DEMO_SCENARIOS.length);
    expect(body[0]).toEqual({
      id: 1,
      title: 'Damaged item',
      customerName: 'Ada Okafor',
      email: 'ada.okafor@example.com',
      message: DEMO_SCENARIOS[0].message,
      expected: { decision: 'APPROVED', status: 'DECIDED', refundAmount: 80 },
    });
  });

  it('does not expose internal rule codes', async () => {
    const { text } = await request(app.getHttpServer())
      .get('/api/demo/scenarios')
      .expect(200);

    expect(text).not.toMatch(/"rule"|\bP[1-9]\b/);
  });
});
