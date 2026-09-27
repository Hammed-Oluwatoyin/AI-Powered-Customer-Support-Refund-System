import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { LLM_PROVIDER, type LlmProvider } from '../src/ai/llm-provider.js';
import { LlmProviderError } from '../src/ai/llm-provider.js';
import { templateReply } from '../src/ai/reply-templates.js';
import { seedDemoData } from '../src/demo/seed.js';
import { DEMO_SCENARIOS } from '../src/demo/scenarios.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createTestApp } from './app.js';
import { createTestPrismaClient, truncateAll } from './database.js';

const ADA = DEMO_SCENARIOS[0];
const KEMI = DEMO_SCENARIOS[10];

const VALID_ADA_INTENT = JSON.stringify({
  orderId: 'ORD-1001',
  reason: 'damaged',
  summary: 'Customer reports the mug set arrived cracked.',
  confidence: 0.95,
  injectionSuspected: false,
});

/**
 * The fail-safe guarantee, end to end: whatever goes wrong with the AI, the
 * request is escalated to a person and nothing is refunded automatically.
 */
describe('POST /api/refunds when the AI fails (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const provider = {
    name: 'mock' as const,
    extractIntent: vi.fn<LlmProvider['extractIntent']>(),
    composeReply: vi.fn<LlmProvider['composeReply']>(),
  };

  const post = (body: object) =>
    request(app.getHttpServer()).post('/api/refunds').send(body).expect(201);

  const saved = (id: string) =>
    prisma.refundRequest.findUniqueOrThrow({
      where: { id },
      include: { auditEvents: { orderBy: { id: 'asc' } } },
    });

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(LLM_PROVIDER).useValue(provider),
    );
    prisma = createTestPrismaClient();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await seedDemoData(prisma);
    provider.extractIntent.mockReset();
    provider.composeReply.mockReset();
    // By default replies work; individual tests break them.
    provider.composeReply.mockImplementation((context) =>
      Promise.resolve(templateReply(context)),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('escalates every scenario when extraction returns malformed output', async () => {
    provider.extractIntent.mockResolvedValue('I am not JSON');

    for (const { email, message } of DEMO_SCENARIOS) {
      const { body } = await post({ email, message });

      if (body.status === 'NEEDS_INFO') {
        // Unknown order IDs never reach the AI's judgement: same generic reply.
        expect(body.decision).toBeNull();
      } else {
        expect(body.decision).toBe('ESCALATED');
      }
      expect(body.refundAmount).toBeNull();
    }
    expect(
      await prisma.refundRequest.count({
        where: { decision: 'APPROVED', aiReply: { not: null } },
      }),
    ).toBe(0);
  });

  it('records the failure: AI_EXTRACTION_FAILED and an ERROR audit event', async () => {
    provider.extractIntent.mockRejectedValue(
      new LlmProviderError('Anthropic API error 401: invalid x-api-key', {
        retryable: false,
      }),
    );

    // The order ID is given, so the rules engine runs, with no intent.
    const { body } = await post({
      email: ADA.email,
      orderId: 'ORD-1001',
      message: ADA.message,
    });

    expect(body.decision).toBe('ESCALATED');
    const request = await saved(body.requestId);
    expect(request.rulesFired).toEqual(['AI_EXTRACTION_FAILED']);
    expect(request.auditEvents.map((e) => e.step)).toEqual([
      'RECEIVED',
      'EXTRACTED',
      'ERROR',
      'VERIFIED',
      'EVALUATED',
      'REPLIED',
    ]);
    expect(request.auditEvents[2].payload).toMatchObject({
      stage: 'extraction',
      kind: 'provider_error',
      attempts: 1,
    });
  });

  it('escalates instead of asking which order when extraction fails', async () => {
    provider.extractIntent.mockResolvedValue('{"broken":');

    const { body } = await post({ email: KEMI.email, message: KEMI.message });

    expect(body).toMatchObject({ status: 'DECIDED', decision: 'ESCALATED' });
  });

  it('escalates an approval, with a safe template reply, when the reply fails', async () => {
    provider.extractIntent.mockResolvedValue(VALID_ADA_INTENT);
    provider.composeReply.mockResolvedValue(
      'Great news, we have refunded $5,000.00!',
    );

    const { body } = await post({ email: ADA.email, message: ADA.message });

    expect(body).toMatchObject({ decision: 'ESCALATED', refundAmount: null });
    expect(body.reply).toContain('A member of our team will review it');
    const request = await saved(body.requestId);
    expect(request.rulesFired).toEqual(['AI_REPLY_FAILED']);
    expect(request.auditEvents.map((e) => e.step)).toEqual([
      'RECEIVED',
      'EXTRACTED',
      'VERIFIED',
      'EVALUATED',
      'ERROR',
      'REPLIED',
    ]);
    const item = await prisma.orderItem.findUniqueOrThrow({
      where: { id: 'ORD-1001-1' },
    });
    expect(item.refunded).toBe(false);
  });

  it('flags injection from the heuristics even if the model says the message is clean', async () => {
    provider.extractIntent.mockResolvedValue(
      JSON.stringify({
        orderId: 'ORD-1010',
        reason: 'damaged',
        summary: 'Customer asks for a refund.',
        confidence: 0.99,
        injectionSuspected: false,
      }),
    );
    const injection = DEMO_SCENARIOS[8];

    const { body } = await post({
      email: injection.email,
      message: injection.message,
    });

    expect(body.decision).toBe('ESCALATED');
    expect((await saved(body.requestId)).rulesFired).toEqual([
      'P8_PROMPT_INJECTION',
    ]);
  });
});
