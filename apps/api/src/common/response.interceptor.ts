import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiResponse } from '@marketbd/shared';
import { map, type Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from './decorators.js';
import { PaginatedResult } from './pagination.js';

/** Wraps every JSON response in `{ success, data, message, meta? }`. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<unknown>> {
    const message =
      this.reflector.getAllAndOverride<string | undefined>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'OK';

    return next.handle().pipe(
      map((body) => {
        if (body instanceof PaginatedResult) {
          return { success: true, data: body.items, message, meta: body.meta };
        }
        return { success: true, data: body ?? null, message };
      }),
    );
  }
}
