import Anthropic from '@anthropic-ai/sdk';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AI_TIMEOUT_MS, AiService } from './ai.service.js';
import { InjectionDetector } from './injection-detector.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { MockProvider } from './providers/mock.provider.js';

/**
 * Picks the LLM provider from LLM_PROVIDER at startup. The model is an
 * attached resource (Twelve-Factor IV): switching providers or models is a
 * config change, not a code change.
 */
@Module({
  providers: [
    InjectionDetector,
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, InjectionDetector],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
        injectionDetector: InjectionDetector,
      ): LlmProvider => {
        const logger = new Logger('AiModule');
        if (config.get('LLM_PROVIDER', { infer: true }) === 'anthropic') {
          const model = config.get('LLM_MODEL', { infer: true });
          logger.log(`Using the Anthropic provider with model ${model}`);
          const client = new Anthropic({
            apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
            // AiService owns retries and timeouts; these stop the SDK from
            // retrying on top of them and act as a backstop.
            maxRetries: 0,
            timeout: AI_TIMEOUT_MS,
          });
          return new AnthropicProvider(client, model);
        }
        logger.log('Using the deterministic mock LLM provider');
        return new MockProvider(injectionDetector);
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
