import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { ApiKeyGuard } from './api-key.guard.js';

const KEY = 'a-long-enough-admin-key';

function contextWithHeader(value: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => (name === 'x-admin-key' ? value : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const config = {
    get: () => KEY,
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const guard = new ApiKeyGuard(config);

  it('allows the configured key', () => {
    expect(guard.canActivate(contextWithHeader(KEY))).toBe(true);
  });

  it.each([
    ['a missing header', undefined],
    ['an empty header', ''],
    ['a wrong key', 'not-the-admin-key-at-all'],
    ['a prefix of the key', KEY.slice(0, -1)],
    ['the key with extra characters', `${KEY}x`],
  ])('rejects %s with 401', (_label, header) => {
    expect(() => guard.canActivate(contextWithHeader(header))).toThrow(
      UnauthorizedException,
    );
  });
});
