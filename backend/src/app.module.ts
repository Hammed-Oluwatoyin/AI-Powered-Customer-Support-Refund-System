import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';

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
    HealthModule,
  ],
})
export class AppModule {}
