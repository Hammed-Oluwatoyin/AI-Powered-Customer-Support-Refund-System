import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AiModule } from './ai.module.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { MockProvider } from './providers/mock.provider.js';

async function providerFor(env: Record<string, string>): Promise<LlmProvider> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => env],
      }),
      AiModule,
    ],
  }).compile();
  moduleRef.useLogger(false);
  return moduleRef.get<LlmProvider>(LLM_PROVIDER);
}

describe('AiModule', () => {
  it('uses the mock provider when LLM_PROVIDER=mock', async () => {
    const provider = await providerFor({ LLM_PROVIDER: 'mock' });

    expect(provider).toBeInstanceOf(MockProvider);
  });

  it('uses the Anthropic provider when LLM_PROVIDER=anthropic', async () => {
    const provider = await providerFor({
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      LLM_MODEL: 'claude-sonnet-5',
    });

    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });
});
