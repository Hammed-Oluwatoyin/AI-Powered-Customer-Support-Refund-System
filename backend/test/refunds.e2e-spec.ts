import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { NOT_FOUND_REPLY } from '../src/ai/reply-templates.js';
import { PAST_REFUNDS } from '../src/demo/fixtures.js';
import { seedDemoData } from '../src/demo/seed.js';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import type { PolicyInput } from '../src/policy/policy.types.js';
import { RulesEngineService } from '../src/policy/rules-engine.service.js';
import { createTestApp } from './app.js';
import { createTestPrismaClient, truncateAll } from './database.js';

const ADA = DEMO_SCENARIOS[0];

describe('POST /api/refunds (e2e, mock LLM)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  const post = (body: object) =>
    request(app.getHttpServer()).post('/api/refunds').send(body);

  const savedRequest = (id: string) =>
    prisma.refundRequest.findUniqueOrThrow({
      where: { id },
      include: { auditEvents: { orderBy: { id: 'asc' } } },
    });

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

  describe('every seed scenario', () => {
    it.each(DEMO_SCENARIOS)(
      'scenario $id ($title): $expected.status $expected.decision',
      async ({ email, message, expected }) => {
        const response = await post({ email, message }).expect(201);

        expect(response.body).toMatchObject({
          decision: expected.decision,
          status: expected.status,
          refundAmount: expected.refundAmount,
        });
        expect(response.body.reply).toEqual(expect.any(String));

        if (expected.rule) {
          const saved = await savedRequest(response.body.requestId);
          expect((saved.rulesFired as string[]).at(-1)).toMatch(
            new RegExp(`^${expected.rule}_`),
          );
        }
      },
    );

    it('never approves the prompt-injection scenario', async () => {
      const injection = DEMO_SCENARIOS.find((s) => s.id === 9);

      const response = await post({
        email: injection?.email,
        message: injection?.message,
      }).expect(201);

      expect(response.body.decision).not.toBe('APPROVED');
      expect(response.body.decision).toBe('ESCALATED');
      expect(response.body.refundAmount).toBeNull();
    });
  });

  describe('response', () => {
    it('contains only customer-safe fields and no internal reasoning', async () => {
      for (const { email, message } of DEMO_SCENARIOS) {
        await truncateAll(prisma);
        await seedDemoData(prisma);

        const { body } = await post({ email, message }).expect(201);

        expect(Object.keys(body).sort()).toEqual([
          'candidateOrders',
          'decision',
          'refundAmount',
          'reply',
          'requestId',
          'status',
        ]);
        expect(body.reply).not.toMatch(/\bP[1-9]\b|_[A-Z]{3,}|inject|fraud/i);
      }
    });
  });

  describe('audit trail', () => {
    it('records every pipeline step, in order', async () => {
      const { body } = await post({
        email: ADA.email,
        message: ADA.message,
      }).expect(201);

      const saved = await savedRequest(body.requestId);
      expect(saved.auditEvents.map((e) => e.step)).toEqual([
        'RECEIVED',
        'EXTRACTED',
        'VERIFIED',
        'EVALUATED',
        'REPLIED',
      ]);
      expect(saved).toMatchObject({
        customerEmail: ADA.email,
        orderId: 'ORD-1001',
        decision: 'APPROVED',
        status: 'DECIDED',
        aiReply: body.reply,
      });
      expect(saved.refundAmount?.toFixed(2)).toBe('80.00');
    });

    it('stores the policy input so the decision can be reproduced exactly', async () => {
      const { body } = await post({
        email: 'musa.ibrahim@example.com',
        message: DEMO_SCENARIOS[12].message,
      }).expect(201);

      const saved = await savedRequest(body.requestId);
      const evaluated = saved.auditEvents.find((e) => e.step === 'EVALUATED');
      const payload = evaluated?.payload as unknown as {
        input: PolicyInput;
        decision: string;
        refundAmountCents: number;
      };
      const input: PolicyInput = {
        ...payload.input,
        now: new Date(payload.input.now),
        order: {
          ...payload.input.order,
          deliveredAt:
            payload.input.order.deliveredAt &&
            new Date(payload.input.order.deliveredAt),
        },
      };

      const replayed = new RulesEngineService().evaluate(input);
      expect(replayed).toMatchObject({
        decision: payload.decision,
        refundAmountCents: payload.refundAmountCents,
      });
    });
  });

  describe('choosing the order', () => {
    const KEMI = DEMO_SCENARIOS[10];

    it('asks which order when several could match, and lists them', async () => {
      const { body } = await post({
        email: KEMI.email,
        message: KEMI.message,
      }).expect(201);

      expect(body).toMatchObject({ status: 'NEEDS_INFO', decision: null });
      expect(body.candidateOrders.map((o: { id: string }) => o.id)).toEqual([
        'ORD-1012',
        'ORD-1013',
      ]);
      expect(body.reply).toContain('ORD-1012');
      expect(body.reply).toContain('ORD-1013');
    });

    it('decides once the customer picks one of the orders', async () => {
      const { body } = await post({
        email: KEMI.email,
        message: KEMI.message,
        orderId: 'ORD-1012',
      }).expect(201);

      expect(body).toMatchObject({
        status: 'DECIDED',
        decision: 'APPROVED',
        refundAmount: 35,
        candidateOrders: [],
      });
    });

    it("uses the customer's only refundable order when none is named", async () => {
      const { body } = await post({
        email: 'ben.carter@example.com',
        message: 'The running shoes are the wrong size.',
      }).expect(201);

      expect(body).toMatchObject({ decision: 'APPROVED', refundAmount: 45 });
      expect((await savedRequest(body.requestId)).orderId).toBe('ORD-1003');
    });

    it('prefers the orderId field over an order ID in the message', async () => {
      const { body } = await post({
        email: ADA.email,
        orderId: 'ord-1001',
        message: 'My order ORD-1002 arrived damaged.',
      }).expect(201);

      expect((await savedRequest(body.requestId)).orderId).toBe('ORD-1001');
    });
  });

  describe('unknown details', () => {
    it('gives the same generic reply for an unknown email and an unknown order', async () => {
      const unknownEmail = await post({
        email: 'nobody@example.com',
        message: 'My order ORD-1001 arrived damaged.',
      }).expect(201);
      const unknownOrder = await post({
        email: ADA.email,
        message: 'My order ORD-9999 arrived damaged.',
      }).expect(201);

      for (const { body } of [unknownEmail, unknownOrder]) {
        expect(body).toMatchObject({
          status: 'NEEDS_INFO',
          decision: null,
          reply: NOT_FOUND_REPLY,
          refundAmount: null,
        });
      }
    });

    it('does not call the AI for an unknown email, but still audits the request', async () => {
      const { body } = await post({
        email: 'nobody@example.com',
        message: 'Refund please',
      }).expect(201);

      const saved = await savedRequest(body.requestId);
      expect(saved.auditEvents.map((e) => e.step)).toEqual([
        'RECEIVED',
        'VERIFIED',
        'REPLIED',
      ]);
      expect(saved.extractedIntent).toBeNull();
    });
  });

  describe('refund state', () => {
    it('marks approved items refunded, so a repeat request is denied (P4)', async () => {
      await post({ email: ADA.email, message: ADA.message }).expect(201);

      const repeat = await post({
        email: ADA.email,
        message: ADA.message,
      }).expect(201);

      expect(repeat.body.decision).toBe('DENIED');
      const item = await prisma.orderItem.findUniqueOrThrow({
        where: { id: 'ORD-1001-1' },
      });
      expect(item.refunded).toBe(true);
    });

    it('refunds an item only once when duplicate requests arrive together', async () => {
      const responses = await Promise.all(
        [1, 2, 3].map(() => post({ email: ADA.email, message: ADA.message })),
      );

      const decisions = responses.map((r) => r.body.decision).sort();
      expect(decisions).toEqual(['APPROVED', 'DENIED', 'DENIED']);
      expect(
        await prisma.refundRequest.count({
          where: { orderId: 'ORD-1001', decision: 'APPROVED' },
        }),
      ).toBe(1);
    });

    it('does not refund anything for an escalation, but records the amount at stake', async () => {
      const emeka = DEMO_SCENARIOS[4];

      const { body } = await post({
        email: emeka.email,
        message: emeka.message,
      }).expect(201);

      expect(body).toMatchObject({ decision: 'ESCALATED', refundAmount: null });
      const saved = await savedRequest(body.requestId);
      expect(saved.refundAmount?.toFixed(2)).toBe('750.00');
      const item = await prisma.orderItem.findUniqueOrThrow({
        where: { id: 'ORD-1006-1' },
      });
      expect(item.refunded).toBe(false);
    });

    it('matches the email case-insensitively', async () => {
      const { body } = await post({
        email: '  ADA.Okafor@Example.COM ',
        message: ADA.message,
      }).expect(201);

      expect(body.decision).toBe('APPROVED');
    });
  });

  describe('validation', () => {
    it.each([
      ['a missing email', { message: 'Refund please' }],
      ['an invalid email', { email: 'not-an-email', message: 'Refund please' }],
      ['a missing message', { email: ADA.email }],
      ['an empty message', { email: ADA.email, message: '' }],
      ['a whitespace-only message', { email: ADA.email, message: '   \n ' }],
      [
        'a message over 1000 characters',
        { email: ADA.email, message: 'a'.repeat(1001) },
      ],
      ['a non-string message', { email: ADA.email, message: 42 }],
      [
        'a malformed order ID',
        { email: ADA.email, orderId: '1001', message: 'Refund please' },
      ],
      [
        'an unexpected field',
        { email: ADA.email, message: 'Refund please', decision: 'APPROVED' },
      ],
    ])(
      'rejects %s with a 400 in the standard error shape',
      async (_label, body) => {
        const response = await post(body).expect(400);

        expect(response.body).toEqual({
          statusCode: 400,
          error: 'Bad Request',
          message: expect.any(Array),
          path: '/api/refunds',
          timestamp: expect.any(String),
        });
        // Nothing is saved for an invalid request: only the seeded history remains.
        expect(await prisma.refundRequest.count()).toBe(PAST_REFUNDS.length);
      },
    );

    it('accepts a message of exactly 1000 characters', async () => {
      await post({ email: ADA.email, message: 'a'.repeat(1000) }).expect(201);
    });

    it('accepts emoji and non-Latin text', async () => {
      const { body } = await post({
        email: ADA.email,
        message:
          'Mi pedido ORD-1001 llegó roto 😢 — the mugs arrived broken. 杯子碎了',
      }).expect(201);

      expect(body.decision).toBe('APPROVED');
      expect((await savedRequest(body.requestId)).message).toContain('😢');
    });

    it('rejects a malformed JSON body with a 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Content-Type', 'application/json')
        .send('{"email": "ada.okafor@example.com", "message": ')
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
    });

    it('rejects a body over 16 KB with a 413 in the standard error shape', async () => {
      const response = await post({
        email: ADA.email,
        message: 'x'.repeat(20_000),
      }).expect(413);

      expect(response.body).toMatchObject({
        statusCode: 413,
        error: 'Payload Too Large',
        path: '/api/refunds',
      });
    });

    it('returns unknown routes as a 404 in the standard error shape', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/nope')
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: '/api/nope',
      });
    });
  });
});
