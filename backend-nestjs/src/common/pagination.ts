export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function normalizePagination(
  input: PaginationInput = {},
  defaultLimit = DEFAULT_LIMIT,
) {
  const page = Math.max(1, Math.floor(Number(input.page) || DEFAULT_PAGE));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number(input.limit) || defaultLimit)),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

export function sqlNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
