import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  PagedRequests,
  RequestDetail,
  RequestStats,
} from './admin-views.js';
import { AdminService } from './admin.service.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto.js';
import { OverrideDecisionDto } from './dto/override-decision.dto.js';

/** Staff-only endpoints; every route requires the x-admin-key header. */
@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('requests')
  list(@Query() query: ListRequestsQueryDto): Promise<PagedRequests> {
    return this.admin.list(query);
  }

  @Get('requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<RequestDetail> {
    return this.admin.detail(id);
  }

  @Get('stats')
  stats(): Promise<RequestStats> {
    return this.admin.stats();
  }

  @Patch('requests/:id/decision')
  overrideDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideDecisionDto,
  ): Promise<RequestDetail> {
    return this.admin.overrideDecision(id, dto);
  }
}
