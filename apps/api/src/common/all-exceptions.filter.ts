import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody } from '@marketbd/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';

const zodIssues = (error: ZodError) =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/** Converts every thrown error into the standard error envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        success: false,
        data: null,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: zodError instanceof ZodError ? zodIssues(zodError) : [],
      };
    }
    if (exception instanceof ThrottlerException) {
      return {
        success: false,
        data: null,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please try again shortly.',
      };
    }
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : typeof res === 'object' && res !== null && 'message' in res
            ? Array.isArray(res.message)
              ? res.message.join(', ')
              : String(res.message)
            : exception.message;
      return { success: false, data: null, statusCode: exception.getStatus(), message };
    }
    if (exception instanceof ZodError) {
      return {
        success: false,
        data: null,
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: zodIssues(exception),
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const target = (exception.meta?.target as string[] | string | undefined) ?? 'field';
        return {
          success: false,
          data: null,
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists`,
        };
      }
      if (exception.code === 'P2025') {
        return { success: false, data: null, statusCode: HttpStatus.NOT_FOUND, message: 'Record not found' };
      }
      if (exception.code === 'P2003') {
        return {
          success: false,
          data: null,
          statusCode: HttpStatus.CONFLICT,
          message: 'This record is referenced by other data and cannot be changed',
        };
      }
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return {
      success: false,
      data: null,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again.',
    };
  }
}
