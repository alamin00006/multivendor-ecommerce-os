import { buildPaginationMeta, type PaginationMeta } from '@marketbd/shared';

/** Returned by services for list endpoints; the response interceptor moves `meta` into the envelope. */
export class PaginatedResult<T> {
  constructor(
    readonly items: T[],
    readonly meta: PaginationMeta,
  ) {}

  static of<T>(items: T[], page: number, limit: number, total: number): PaginatedResult<T> {
    return new PaginatedResult(items, buildPaginationMeta(page, limit, total));
  }
}

export const skipTake = (page: number, limit: number) => ({ skip: (page - 1) * limit, take: limit });
