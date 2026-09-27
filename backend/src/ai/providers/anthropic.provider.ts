import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ExtractedIntentSchema } from '../extracted-intent.schema.js';
import {
  LlmProviderError,
  type CustomerOrderSummary,
  type LlmProvider,
  type ReplyContext,
} from '../llm-provider.js';
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserContent,
} from '../prompts/extraction.prompt.js';
import {
  REPLY_SYSTEM_PROMPT,
  buildReplyUserContent,
} from '../prompts/reply.prompt.js';

/**
 * Constrains the model's output to the extraction schema (structured
 * outputs). The SDK sends constraints that strict mode can't express, such
 * as the reason enum and the confidence range, as hints in the field
 * descriptions, so AiService still parses and validates the response with
 * zod, as it does for any provider.
 */
const EXTRACTION_OUTPUT_FORMAT = zodOutputFormat(ExtractedIntentSchema);

/** Client errors that will fail the same way on a retry. */
const NON_RETRYABLE_ERRORS = [
  Anthropic.BadRequestError,
  Anthropic.AuthenticationError,
  Anthropic.PermissionDeniedError,
  Anthropic.NotFoundError,
  Anthropic.UnprocessableEntityError,
];

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic' as const;

  /**
   * @param client should be created with `maxRetries: 0`: AiService owns the
   * retry policy, so an attempt is exactly one HTTP call.
   */
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async extractIntent(
    message: string,
    customerOrders: CustomerOrderSummary[],
    signal: AbortSignal,
  ): Promise<string> {
    return this.complete(
      {
        model: this.model,
        max_tokens: 2_048,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildExtractionUserContent(message, customerOrders),
          },
        ],
        // Low effort suits a short classification task and keeps latency down.
        output_config: { effort: 'low', format: EXTRACTION_OUTPUT_FORMAT },
      },
      signal,
    );
  }

  async composeReply(
    context: ReplyContext,
    signal: AbortSignal,
  ): Promise<string> {
    return this.complete(
      {
        model: this.model,
        max_tokens: 1_024,
        system: REPLY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildReplyUserContent(context) }],
        output_config: { effort: 'low' },
      },
      signal,
    );
  }

  /** Sends one request and returns its text, mapping failures to LlmProviderError. */
  private async complete(
    params: Anthropic.MessageCreateParamsNonStreaming,
    signal: AbortSignal,
  ): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create(params, { signal });
    } catch (error) {
      throw toProviderError(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new LlmProviderError('The model declined the request.', {
        retryable: false,
      });
    }
    if (response.stop_reason === 'max_tokens') {
      throw new LlmProviderError('The model output was cut off (max_tokens).', {
        retryable: true,
      });
    }

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}

function toProviderError(error: unknown): LlmProviderError {
  if (error instanceof Anthropic.APIError) {
    const retryable = !NON_RETRYABLE_ERRORS.some(
      (errorClass) => error instanceof errorClass,
    );
    const status = error.status === undefined ? '' : ` ${error.status}`;
    return new LlmProviderError(
      `Anthropic API error${status}: ${error.message}`,
      { retryable, cause: error },
    );
  }
  return new LlmProviderError(
    `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
    { retryable: true, cause: error },
  );
}
