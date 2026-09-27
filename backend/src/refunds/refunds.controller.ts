import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateRefundRequestDto } from './dto/create-refund-request.dto.js';
import type { RefundResponse } from './refund-response.js';
import { RefundsService } from './refunds.service.js';

/** The public, customer-facing refund endpoint. */
@Controller('refunds')
@UseGuards(ThrottlerGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  submit(@Body() dto: CreateRefundRequestDto): Promise<RefundResponse> {
    return this.refunds.submit(dto);
  }
}
