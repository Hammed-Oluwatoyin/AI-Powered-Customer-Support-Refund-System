import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';

export const ADMIN_KEY_HEADER = 'x-admin-key';

/**
 * Protects the admin API with a shared key sent in the x-admin-key header.
 * A deliberate simplification of real staff authentication; see the README.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.expectedDigest = digest(config.get('ADMIN_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const provided = context
      .switchToHttp()
      .getRequest<Request>()
      .header(ADMIN_KEY_HEADER);

    // Comparing fixed-length digests in constant time means the response
    // time reveals nothing about how much of the key was right.
    if (
      provided === undefined ||
      !timingSafeEqual(digest(provided), this.expectedDigest)
    ) {
      throw new UnauthorizedException(
        `A valid ${ADMIN_KEY_HEADER} header is required.`,
      );
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
