import { Controller, Get } from '@nestjs/common';
import type { Decision, RefundStatus } from '../generated/prisma/enums.js';
import { DEMO_SCENARIOS } from './scenarios.js';

export interface PublicScenario {
  id: number;
  title: string;
  customerName: string;
  email: string;
  message: string;
  expected: {
    decision: Decision | null;
    status: RefundStatus;
    refundAmount: number | null;
  };
}

/**
 * Serves the demo scenarios to the chat page's "Try a scenario" chips, so
 * the UI and the e2e tests share one source. Internal rule codes are left
 * out because this is a customer-facing page.
 */
@Controller('demo')
export class DemoController {
  @Get('scenarios')
  scenarios(): PublicScenario[] {
    return DEMO_SCENARIOS.map(
      ({ id, title, customerName, email, message, expected }) => ({
        id,
        title,
        customerName,
        email,
        message,
        expected: {
          decision: expected.decision,
          status: expected.status,
          refundAmount: expected.refundAmount,
        },
      }),
    );
  }
}
