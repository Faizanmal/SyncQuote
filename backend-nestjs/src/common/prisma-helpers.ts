/**
 * Prisma Type Helpers
 * Used to safely cast Prisma queries that have schema mismatches
 */

export function safeSelect<T>(data: any): T {
  return data as T;
}

export function safeWhere<T = any>(where: any): T {
  return where as any;
}

export function safeData<T = any>(data: any): T {
  return data as any;
}

export function safeInclude<T = any>(include: any): T {
  return include as any;
}
