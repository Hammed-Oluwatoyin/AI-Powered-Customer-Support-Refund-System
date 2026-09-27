import { Injectable, Logger } from '@nestjs/common';
import { toJson } from '../common/json.js';
import type { AuditStep } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface AuditEntry {
  step: AuditStep;
  payload: Prisma.InputJsonValue;
  at: Date;
}

/**
 * The audit events for one refund request, in the order they happened.
 *
 * Each event is logged to stdout as it is recorded, tagged with the request
 * ID (Twelve-Factor XI), and later written to the database in the same
 * transaction as the request, so a request and its audit trail are never
 * stored one without the other.
 */
export class AuditTrail {
  private readonly entries: AuditEntry[] = [];

  constructor(
    readonly requestId: string,
    private readonly logger: Logger,
  ) {}

  record(step: AuditStep, payload: object): void {
    const entry: AuditEntry = {
      step,
      payload: toJson(payload),
      at: new Date(),
    };
    this.entries.push(entry);
    this.logger.log(`Refund request ${step}`, {
      requestId: this.requestId,
      step,
    });
  }

  /** A copy with the same events so far, for retrying later steps. */
  fork(): AuditTrail {
    const copy = new AuditTrail(this.requestId, this.logger);
    copy.entries.push(...this.entries);
    return copy;
  }

  get events(): readonly AuditEntry[] {
    return this.entries;
  }
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('RefundAudit');

  startTrail(requestId: string): AuditTrail {
    return new AuditTrail(requestId, this.logger);
  }

  /** Writes a trail's events. Call inside the transaction that saves the request. */
  async writeTrail(
    tx: Prisma.TransactionClient,
    trail: AuditTrail,
  ): Promise<void> {
    await tx.auditEvent.createMany({
      data: trail.events.map((entry) => ({
        refundRequestId: trail.requestId,
        step: entry.step,
        payload: entry.payload,
        createdAt: entry.at,
      })),
    });
  }

  /** Writes a single event for an existing request, e.g. an admin override. */
  async record(
    tx: Prisma.TransactionClient,
    refundRequestId: string,
    step: AuditStep,
    payload: object,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: { refundRequestId, step, payload: toJson(payload) },
    });
    this.logger.log(`Refund request ${step}`, {
      requestId: refundRequestId,
      step,
    });
  }
}
