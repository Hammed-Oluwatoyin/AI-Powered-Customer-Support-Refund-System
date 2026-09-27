import { Module } from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service.js';

@Module({
  providers: [RulesEngineService],
  exports: [RulesEngineService],
})
export class PolicyModule {}
