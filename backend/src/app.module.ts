import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  envValidationSchema,
  type EnvironmentVariables,
} from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RefundsModule } from './refunds/refunds.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
      // Local-development convenience only. Real environment variables always
      // win, and the Docker images contain no .env file.
      envFilePath: ['.env', '../.env'],
    }),
    // In-memory store: fine for one instance. Scaling out would need a shared
    // store such as Redis so the limit applies across instances.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
    RefundsModule,
  ],
})
export class AppModule {}
