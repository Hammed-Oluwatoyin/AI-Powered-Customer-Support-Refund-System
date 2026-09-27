import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PAST_REFUNDS } from '../src/demo/fixtures.js';
import { seedDemoData } from '../src/demo/seed.js';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestApp } from './app.js';
import { createTestPrismaClient, truncateAll } from './database.js';

const ADMIN_KEY = process.env.ADMIN_API_KEY ?? '';

describe('Admin API (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  const http = () => request(app.getHttpServer());
  const admin = {
    get: (path: string) => http().get(path).set('x-admin-key', ADMIN_KEY),
    patch: (path: string, body: object) =>
      http().patch(path).set('x-admin-key', ADMIN_KEY).send(body),
  };

  /** Submits a demo scenario through the public API and returns its request ID. */
  async function submit(
    scenarioId: number,
    extra: object = {},
  ): Promise<string> {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
    const { body } = await http()
      .post('/api/refunds')
      .send({ email: scenario?.email, message: scenario?.message, ...extra })
      .expect(201);
    return body.requestId as string;
  }

  const override = (
    id: string,
    decision: string,
    note = 'Checked the photos.',
  ) => admin.patch(`/api/admin/requests/${id}/decision`, { decision, note });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = createTestPrismaClient();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await seedDemoData(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('authentication', () => {
    const SOME_ID = '5eed0000-0000-4000-8000-000000000001';
    const routes: Array<[string, () => request.Test]> = [
      ['GET /api/admin/requests', () => http().get('/api/admin/requests')],
      [
        'GET /api/admin/requests/:id',
        () => http().get(`/api/admin/requests/${SOME_ID}`),
      ],
      ['GET /api/admin/stats', () => http().get('/api/admin/stats')],
      [
        'PATCH /api/admin/requests/:id/decision',
        () =>
          http()
            .patch(`/api/admin/requests/${SOME_ID}/decision`)
            .send({ decision: 'APPROVED', note: 'x' }),
      ],
    ];

    it.each(routes)('%s returns 401 without a key', async (_route, call) => {
      const response = await call().expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'A valid x-admin-key header is required.',
      });
    });

    it.each(routes)('%s returns 401 with a wrong key', async (_route, call) => {
      await call().set('x-admin-key', 'wrong-key-wrong-key-wrong').expect(401);
    });

    it('does not change anything when an unauthorised override is attempted', async () => {
      const id = await submit(5);

      await http()
        .patch(`/api/admin/requests/${id}/decision`)
        .send({ decision: 'APPROVED', note: 'let me in' })
        .expect(401);

      const saved = await prisma.refundRequest.findUniqueOrThrow({
        where: { id },
      });
      expect(saved.status).toBe('DECIDED');
    });
  });

  describe('GET /api/admin/requests', () => {
    it('lists requests newest first with pagination details', async () => {
      const first = await submit(1);
      const second = await submit(5);

      const { body } = await admin.get('/api/admin/requests').expect(200);

      expect(body).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2 + PAST_REFUNDS.length,
      });
      expect(body.items.slice(0, 2).map((r: { id: string }) => r.id)).toEqual([
        second,
        first,
      ]);
      expect(body.items[0]).toEqual({
        id: second,
        createdAt: expect.any(String),
        customerEmail: 'emeka.nwosu@example.com',
        orderId: 'ORD-1006',
        decision: 'ESCALATED',
        status: 'DECIDED',
        refundAmount: 750,
        rulesFired: ['P3_HUMAN_REVIEW_THRESHOLD'],
        messagePreview: DEMO_SCENARIOS[4].message,
      });
    });

    it('filters by decision and by status', async () => {
      await submit(1); // APPROVED
      const escalated = await submit(5); // ESCALATED
      const needsInfo = await submit(11); // NEEDS_INFO

      const byDecision = await admin
        .get('/api/admin/requests?decision=ESCALATED')
        .expect(200);
      const byStatus = await admin
        .get('/api/admin/requests?status=NEEDS_INFO')
        .expect(200);

      expect(byDecision.body.items.map((r: { id: string }) => r.id)).toEqual([
        escalated,
      ]);
      expect(byStatus.body.items.map((r: { id: string }) => r.id)).toEqual([
        needsInfo,
      ]);
    });

    it('treats empty filters as not given', async () => {
      const { body } = await admin
        .get('/api/admin/requests?decision=&page=&pageSize=')
        .expect(200);

      expect(body).toMatchObject({ page: 1, pageSize: 20 });
    });

    it('pages through results', async () => {
      const { body } = await admin
        .get('/api/admin/requests?page=2&pageSize=3')
        .expect(200);

      expect(body).toMatchObject({
        page: 2,
        pageSize: 3,
        total: PAST_REFUNDS.length,
        totalPages: 2,
      });
      expect(body.items).toHaveLength(PAST_REFUNDS.length - 3);
    });

    it.each([
      ['an unknown decision', 'decision=MAYBE'],
      ['page 0', 'page=0'],
      ['a page size over 100', 'pageSize=101'],
      ['a non-numeric page', 'page=two'],
      ['an unknown parameter', 'sort=amount'],
    ])('rejects %s with a 400', async (_label, query) => {
      await admin.get(`/api/admin/requests?${query}`).expect(400);
    });
  });

  describe('GET /api/admin/requests/:id', () => {
    it('returns everything needed to trace the request, with audit events in order', async () => {
      const id = await submit(13); // Musa, partial refund

      const { body } = await admin.get(`/api/admin/requests/${id}`).expect(200);

      expect(body).toMatchObject({
        id,
        customerEmail: 'musa.ibrahim@example.com',
        message: DEMO_SCENARIOS[12].message,
        decision: 'APPROVED',
        status: 'DECIDED',
        refundAmount: 70,
        rulesFired: ['P2_FINAL_SALE'],
        reasons: [
          expect.stringContaining('Clearance Wool Scarf'),
          expect.stringContaining('$70.00'),
        ],
        aiReply: expect.stringContaining('$70.00'),
        extractedIntent: {
          ok: true,
          intent: { orderId: 'ORD-1015', reason: 'not_as_described' },
        },
        order: {
          id: 'ORD-1015',
          items: [
            {
              name: 'Clearance Wool Scarf',
              isFinalSale: true,
              refunded: false,
            },
            { name: 'Leather Wallet', unitPrice: 70, refunded: true },
          ],
        },
      });
      expect(body.auditEvents.map((e: { step: string }) => e.step)).toEqual([
        'RECEIVED',
        'EXTRACTED',
        'VERIFIED',
        'EVALUATED',
        'REPLIED',
      ]);
    });

    it('returns 404 for an unknown request', async () => {
      await admin
        .get('/api/admin/requests/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });

    it('returns 400 for an ID that is not a UUID', async () => {
      await admin.get('/api/admin/requests/not-a-uuid').expect(400);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('counts requests by decision and status, and those awaiting review', async () => {
      await submit(1); // APPROVED
      await submit(3); // DENIED
      await submit(5); // ESCALATED
      await submit(11); // NEEDS_INFO

      const { body } = await admin.get('/api/admin/stats').expect(200);

      expect(body).toEqual({
        total: 4 + PAST_REFUNDS.length,
        awaitingReview: 2,
        byDecision: {
          APPROVED: 1 + PAST_REFUNDS.length,
          DENIED: 1,
          ESCALATED: 1,
          NONE: 1,
        },
        byStatus: {
          DECIDED: 3 + PAST_REFUNDS.length,
          NEEDS_INFO: 1,
          RESOLVED_BY_ADMIN: 0,
        },
      });
    });
  });

  describe('PATCH /api/admin/requests/:id/decision', () => {
    it('approves an escalation, refunds the items and records the override', async () => {
      const id = await submit(5); // Emeka, $750 laptop

      const { body } = await override(
        id,
        'APPROVED',
        'Photos confirm the damage.',
      ).expect(200);

      expect(body).toMatchObject({
        decision: 'APPROVED',
        status: 'RESOLVED_BY_ADMIN',
        refundAmount: 750,
        order: { items: [{ refunded: true }] },
      });
      expect(body.auditEvents.at(-1)).toMatchObject({
        step: 'ADMIN_OVERRIDE',
        payload: {
          previousDecision: 'ESCALATED',
          previousStatus: 'DECIDED',
          decision: 'APPROVED',
          note: 'Photos confirm the damage.',
          refundedItemIds: ['ORD-1006-1'],
          refundAmount: '750.00',
        },
      });
    });

    it('denies an escalation without refunding anything', async () => {
      const id = await submit(5);

      const { body } = await override(id, 'DENIED').expect(200);

      expect(body).toMatchObject({
        decision: 'DENIED',
        status: 'RESOLVED_BY_ADMIN',
        refundAmount: null,
        order: { items: [{ refunded: false }] },
      });
    });

    it('works out the refund for escalations stopped before the amount was assessed', async () => {
      const id = await submit(9); // Ifeoma: suspected injection, $220 watch

      const { body } = await override(
        id,
        'APPROVED',
        'Genuine customer, rude message.',
      ).expect(200);

      expect(body).toMatchObject({ decision: 'APPROVED', refundAmount: 220 });
    });

    it('resolves a needs-info request without a refund', async () => {
      const id = await submit(11); // Kemi, no order chosen

      const { body } = await override(id, 'APPROVED').expect(200);

      expect(body).toMatchObject({
        decision: 'APPROVED',
        status: 'RESOLVED_BY_ADMIN',
        orderId: null,
        refundAmount: null,
      });
    });

    it("counts an admin approval toward the customer's recent refunds (P8)", async () => {
      const id = await submit(5);
      await override(id, 'APPROVED').expect(200);

      const approvals = await prisma.refundRequest.count({
        where: {
          customerEmail: 'emeka.nwosu@example.com',
          decision: 'APPROVED',
        },
      });
      expect(approvals).toBe(1);
    });

    it('rejects overriding a request the policy already decided (409)', async () => {
      const approved = await submit(1);
      const denied = await submit(3);

      await override(approved, 'DENIED').expect(409);
      await override(denied, 'APPROVED').expect(409);
    });

    it('rejects resolving the same request twice (409)', async () => {
      const id = await submit(5);
      await override(id, 'APPROVED').expect(200);

      const response = await override(id, 'DENIED').expect(409);

      expect(response.body.message).toMatch(/have not been resolved/);
    });

    it('refuses to approve when nothing on the order can still be refunded (409)', async () => {
      await submit(1); // Ada's mugs are refunded
      const james = await submit(10); // James asked for Ada's order

      const response = await override(james, 'APPROVED').expect(409);

      expect(response.body.message).toMatch(/Deny the request instead/);
    });

    it.each([
      [
        'a decision other than APPROVED or DENIED',
        { decision: 'ESCALATED', note: 'x' },
      ],
      ['a missing note', { decision: 'APPROVED' }],
      ['a blank note', { decision: 'APPROVED', note: '   ' }],
    ])('rejects %s with a 400', async (_label, body) => {
      const id = await submit(5);

      await admin.patch(`/api/admin/requests/${id}/decision`, body).expect(400);
    });

    it('returns 404 for an unknown request', async () => {
      await override('00000000-0000-4000-8000-000000000000', 'APPROVED').expect(
        404,
      );
    });
  });
});
