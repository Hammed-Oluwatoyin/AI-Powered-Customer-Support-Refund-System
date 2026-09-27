import Joi from 'joi';

export const LLM_PROVIDERS = ['anthropic', 'mock'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

/**
 * Shape of the validated environment. Read it through
 * `ConfigService<EnvironmentVariables, true>` so every lookup is typed.
 */
export interface EnvironmentVariables {
  PORT: number;
  DATABASE_URL: string;
  LLM_PROVIDER: LlmProviderName;
  ANTHROPIC_API_KEY?: string;
  LLM_MODEL: string;
  ADMIN_API_KEY: string;
  THROTTLE_TTL_MS: number;
  THROTTLE_LIMIT: number;
}

/**
 * Twelve-Factor III: all config comes from the environment and is validated
 * once at startup, so a misconfigured deploy fails fast instead of at the
 * first request. Business rules (the refund policy) are not config and live
 * in code.
 */
export const envValidationSchema = Joi.object<EnvironmentVariables>({
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  LLM_PROVIDER: Joi.string()
    .valid(...LLM_PROVIDERS)
    .default('mock'),
  ANTHROPIC_API_KEY: Joi.when('LLM_PROVIDER', {
    is: 'anthropic',
    // oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional API uses a `then` key.
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  LLM_MODEL: Joi.string().default('claude-sonnet-5'),
  ADMIN_API_KEY: Joi.string().min(16).required(),
  // Rate limit for POST /api/refunds, per client IP. Deploy-specific, so config.
  THROTTLE_TTL_MS: Joi.number().integer().positive().default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(10),
});
