export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
    if (Array.isArray(record.proposals)) {
      return record.proposals as T[];
    }
    if (Array.isArray(record.invoices)) {
      return record.invoices as T[];
    }
  }

  return [];
}

export function unwrapPagination(payload: unknown): PaginationMeta | null {
  if (payload && typeof payload === 'object' && 'pagination' in payload) {
    const pagination = (payload as Paginated<unknown>).pagination;
    if (pagination && typeof pagination.page === 'number') {
      return pagination;
    }
  }
  return null;
}
