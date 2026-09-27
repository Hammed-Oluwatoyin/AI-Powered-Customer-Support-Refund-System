import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './app.js';

const LIMIT = 3;

describe('rate limiting of POST /api/refunds (e2e)', () => {
  let app: NestExpressApplication;

  // An unknown email is answered without touching orders or the AI.
  const refundRequest = (clientIp?: string) => {
    const req = request(app.getHttpServer()).post('/api/refunds');
    if (clientIp) req.set('X-Forwarded-For', clientIp);
    return req.send({ email: 'nobody@example.com', message: 'Refund please' });
  };

  beforeAll(async () => {
    process.env.THROTTLE_LIMIT = String(LIMIT);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`allows ${LIMIT} requests per window, then answers 429 in the standard error shape`, async () => {
    for (let i = 0; i < LIMIT; i++) {
      await refundRequest('198.51.100.1').expect(201);
    }

    const response = await refundRequest('198.51.100.1').expect(429);

    expect(response.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      path: '/api/refunds',
    });
  });

  it('limits each client separately, using the IP forwarded by the proxy', async () => {
    await refundRequest('198.51.100.2').expect(201);
  });

  it('does not rate-limit the health check', async () => {
    for (let i = 0; i < LIMIT + 2; i++) {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    }
  });
});
