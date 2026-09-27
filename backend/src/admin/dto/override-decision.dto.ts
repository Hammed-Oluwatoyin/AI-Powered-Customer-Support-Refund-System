import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

export const OVERRIDE_DECISIONS = ['APPROVED', 'DENIED'] as const;
export type OverrideDecision = (typeof OVERRIDE_DECISIONS)[number];

export class OverrideDecisionDto {
  @IsIn(OVERRIDE_DECISIONS, { message: 'decision must be APPROVED or DENIED' })
  decision!: OverrideDecision;

  /** Why the admin decided this way; kept in the audit trail. */
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1_000, { message: 'note must be between 1 and 1000 characters' })
  note!: string;
}
