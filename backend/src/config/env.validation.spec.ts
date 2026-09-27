import { envValidationSchema } from './env.validation.js';

const validEnv = {
  DATABASE_URL: 'postgresql://refunds:refunds@localhost:5432/refunds',
  ADMIN_API_KEY: 'a-long-enough-admin-key',
};

function validate(env: Record<string, string>) {
  return envValidationSchema.validate(env, { abortEarly: false });
}

describe('envValidationSchema', () => {
  it('applies defaults for optional values', () => {
    const { error, value } = validate(validEnv);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      PORT: 3001,
      LLM_PROVIDER: 'mock',
      LLM_MODEL: 'claude-sonnet-5',
    });
  });

  it('coerces PORT to a number', () => {
    const { value } = validate({ ...validEnv, PORT: '8080' });

    expect(value.PORT).toBe(8080);
  });

  it('does not require an API key for the mock provider', () => {
    const { error } = validate({
      ...validEnv,
      LLM_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: '',
    });

    expect(error).toBeUndefined();
  });

  it('requires ANTHROPIC_API_KEY when the provider is anthropic', () => {
    const { error } = validate({ ...validEnv, LLM_PROVIDER: 'anthropic' });

    expect(error?.message).toContain('ANTHROPIC_API_KEY');
  });

  it('accepts the anthropic provider when a key is set', () => {
    const { error } = validate({
      ...validEnv,
      LLM_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });

    expect(error).toBeUndefined();
  });

  it('rejects an unknown LLM provider', () => {
    const { error } = validate({ ...validEnv, LLM_PROVIDER: 'openai' });

    expect(error?.message).toContain('LLM_PROVIDER');
  });

  it('requires a postgres DATABASE_URL', () => {
    expect(
      validate({ ADMIN_API_KEY: validEnv.ADMIN_API_KEY }).error,
    ).toBeDefined();
    expect(
      validate({ ...validEnv, DATABASE_URL: 'mysql://localhost/refunds' })
        .error,
    ).toBeDefined();
  });

  it('rejects a missing or short ADMIN_API_KEY', () => {
    expect(
      validate({ DATABASE_URL: validEnv.DATABASE_URL }).error,
    ).toBeDefined();
    expect(
      validate({ ...validEnv, ADMIN_API_KEY: 'short' }).error,
    ).toBeDefined();
  });
});
