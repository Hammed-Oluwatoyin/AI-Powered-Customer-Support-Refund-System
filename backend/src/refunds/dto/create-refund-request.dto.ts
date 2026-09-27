import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export const MAX_MESSAGE_LENGTH = 1_000;

/** Trims strings and removes NUL characters, which Postgres cannot store. */
const clean =
  (normalise: (value: string) => string = (value) => value) =>
  ({ value }: TransformFnParams): unknown =>
    typeof value === 'string'
      ? normalise(value.replaceAll('\u0000', '').trim())
      : value;

export class CreateRefundRequestDto {
  @Transform(clean((value) => value.toLowerCase()))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email!: string;

  /** Optional: when omitted, the order is taken from the message or the customer's orders. */
  @IsOptional()
  @Transform(clean((value) => value.toUpperCase()))
  @Matches(/^ORD-\d+$/, { message: 'orderId must look like ORD-1001' })
  orderId?: string;

  @Transform(clean())
  @IsString()
  @Length(1, MAX_MESSAGE_LENGTH, {
    message: `message must be between 1 and ${MAX_MESSAGE_LENGTH} characters`,
  })
  message!: string;
}
