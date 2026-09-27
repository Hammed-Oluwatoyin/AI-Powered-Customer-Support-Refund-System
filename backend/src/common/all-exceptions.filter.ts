import { STATUS_CODES } from 'node:http';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Turns every error into the same JSON shape. Unexpected errors are logged
 * in full but only reported to the client as a generic 500, so internals
 * never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const { statusCode, message } = describe(exception);

    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      path: String(httpAdapter.getRequestUrl(ctx.getRequest())),
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }
}

function describe(exception: unknown): {
  statusCode: number;
  message: string | string[];
} {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const message =
      typeof response === 'object' && 'message' in response
        ? (response.message as string | string[])
        : exception.message;
    return { statusCode: exception.getStatus(), message };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}
