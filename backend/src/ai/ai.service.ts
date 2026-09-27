import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ExtractedIntent } from './extracted-intent.schema.js';
import { InjectionDetector } from './injection-detector.js';
import { parseExtractedIntent, type Validated } from './intent-parser.js';
import {
  LLM_PROVIDER,
  LlmProviderError,
  type CustomerOrderSummary,
  type LlmProvider,
  type ReplyContext,
} from './llm-provider.js';
import { validateReply } from './reply-guard.js';

/** Per-attempt time limit for a model call. */
export const AI_TIMEOUT_MS = 10_000;

/** One initial attempt plus one retry. */
export const AI_MAX_ATTEMPTS = 2;

export interface AiFailure {
  kind: 'timeout' | 'provider_error' | 'invalid_output';
  message: string;
}

export interface InjectionAssessment {
  /** True if either signal fired. */
  suspected: boolean;
  /** Heuristic patterns that matched (independent of the model). */
  heuristicMatches: string[];
  /** The model's own flag, or null when extraction failed. */
  modelFlagged: boolean | null;
}

interface CallMetadata {
  provider: string;
  attempts: number;
}

export type ExtractionResult = CallMetadata & {
  injection: InjectionAssessment;
} & ({ ok: true; intent: ExtractedIntent } | { ok: false; failure: AiFailure });

export type ReplyResult = CallMetadata &
  ({ ok: true; reply: string } | { ok: false; failure: AiFailure });

type Attempted<T> = CallMetadata &
  ({ ok: true; value: T } | { ok: false; failure: AiFailure });

class AiTimeoutError extends Error {
  constructor(ms: number) {
    super(`No response within ${ms} ms.`);
    this.name = 'AiTimeoutError';
  }
}

/**
 * The only way the app talks to a language model. Whatever the provider,
 * every call gets a 10s timeout, at most one retry, and validation of the
 * output. Failures are returned as flagged results, never thrown, so the
 * caller can turn them into an escalation (an AI failure never approves).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly injectionDetector: InjectionDetector,
  ) {}

  async extractIntent(
    message: string,
    customerOrders: CustomerOrderSummary[],
  ): Promise<ExtractionResult> {
    // The heuristic check runs whatever happens to the model call.
    const scan = this.injectionDetector.detect(message);
    const result = await this.attempt(
      'extractIntent',
      (signal) => this.provider.extractIntent(message, customerOrders, signal),
      parseExtractedIntent,
    );

    const modelFlagged = result.ok ? result.value.injectionSuspected : null;
    const injection: InjectionAssessment = {
      suspected: scan.suspected || modelFlagged === true,
      heuristicMatches: scan.matches,
      modelFlagged,
    };

    const { provider, attempts } = result;
    return result.ok
      ? { ok: true, intent: result.value, injection, provider, attempts }
      : { ok: false, failure: result.failure, injection, provider, attempts };
  }

  async composeReply(context: ReplyContext): Promise<ReplyResult> {
    const result = await this.attempt(
      'composeReply',
      (signal) => this.provider.composeReply(context, signal),
      (raw) => validateReply(raw, context),
    );
    const { provider, attempts } = result;
    return result.ok
      ? { ok: true, reply: result.value, provider, attempts }
      : { ok: false, failure: result.failure, provider, attempts };
  }

  /** Calls the provider with a timeout, validates the output, and retries once on failure. */
  private async attempt<T>(
    operation: string,
    call: (signal: AbortSignal) => Promise<string>,
    validate: (raw: string) => Validated<T>,
  ): Promise<Attempted<T>> {
    const provider = this.provider.name;
    let failure: AiFailure = {
      kind: 'provider_error',
      message: 'Not attempted.',
    };

    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
      let retryable = true;
      try {
        const validated = validate(await withTimeout(call, AI_TIMEOUT_MS));
        if (validated.ok) {
          return {
            ok: true,
            value: validated.value,
            provider,
            attempts: attempt,
          };
        }
        failure = { kind: 'invalid_output', message: validated.error };
      } catch (error) {
        failure = toFailure(error);
        retryable = !(error instanceof LlmProviderError) || error.retryable;
      }

      this.logger.warn('LLM call failed', {
        operation,
        provider,
        attempt,
        kind: failure.kind,
        error: failure.message,
      });
      if (!retryable) {
        return { ok: false, failure, provider, attempts: attempt };
      }
    }

    return { ok: false, failure, provider, attempts: AI_MAX_ATTEMPTS };
  }
}

/** Rejects after `ms` and aborts the underlying request so it stops using resources. */
async function withTimeout(
  call: (signal: AbortSignal) => Promise<string>,
  ms: number,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiTimeoutError(ms));
    }, ms);
  });

  try {
    return await Promise.race([call(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function toFailure(error: unknown): AiFailure {
  if (error instanceof AiTimeoutError) {
    return { kind: 'timeout', message: error.message };
  }
  return {
    kind: 'provider_error',
    message: error instanceof Error ? error.message : String(error),
  };
}
