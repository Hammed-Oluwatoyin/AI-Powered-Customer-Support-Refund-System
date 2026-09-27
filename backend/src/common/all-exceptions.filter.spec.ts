import {
  BadRequestException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function run(exception: unknown) {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { reply, getRequestUrl: () => '/api/refunds' },
  } as unknown as HttpAdapterHost;
  const host = {
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter(adapterHost);
  filter.catch(exception, host);
  const [, body, status] = reply.mock.calls[0];
  return { body, status };
}

describe('AllExceptionsFilter', () => {
  // 500s are logged by design; keep the test output quiet.
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterAll(() => {
    Logger.overrideLogger(true);
  });

  it('keeps the status and messages of an HTTP exception', () => {
    const { body, status } = run(
      new BadRequestException(['email must be a valid email address']),
    );

    expect(status).toBe(400);
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: ['email must be a valid email address'],
      path: '/api/refunds',
    });
  });

  it('uses the standard reason phrase', () => {
    expect(run(new NotFoundException()).body.error).toBe('Not Found');
  });

  it('keeps the 4xx status of middleware errors such as an oversized body', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
      type: 'entity.too.large',
    });

    const { body, status } = run(tooLarge);

    expect(status).toBe(413);
    expect(body).toMatchObject({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'request entity too large',
    });
  });

  it('hides the details of unexpected errors behind a generic 500', () => {
    const { body, status } = run(new Error('password=hunter2 at db.ts:12'));

    expect(status).toBe(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
