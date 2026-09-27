import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { PolicyModule } from '../policy/policy.module.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';

@Module({
  imports: [AiModule, AuditModule, CustomersModule, PolicyModule],
  controllers: [RefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
