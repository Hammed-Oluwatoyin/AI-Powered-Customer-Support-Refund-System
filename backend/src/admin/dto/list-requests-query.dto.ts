import { Transform, Type, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Decision, RefundStatus } from '../../generated/prisma/enums.js';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Treats an empty query parameter (?page=) as not given. It checks the raw
 * value, because @Type(() => Number) has already turned '' into 0.
 */
const emptyAsUndefined = ({ obj, key, value }: TransformFnParams): unknown =>
  (obj as Record<string, unknown>)[key] === '' ? undefined : value;

export class ListRequestsQueryDto {
  @IsOptional()
  @Transform(emptyAsUndefined)
  @IsIn(Object.values(Decision))
  decision?: Decision;

  @IsOptional()
  @Transform(emptyAsUndefined)
  @IsIn(Object.values(RefundStatus))
  status?: RefundStatus;

  @IsOptional()
  @Transform(emptyAsUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(emptyAsUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}
