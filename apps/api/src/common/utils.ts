import { Prisma } from '@prisma/client';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function csv(value?: string | string[]): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(',');
  return list.map((v) => v.trim()).filter(Boolean);
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export function paginate(page?: number, limit?: number, maxLimit = 100) {
  const p = Math.max(1, Math.floor(page || 1));
  const l = Math.min(maxLimit, Math.max(1, Math.floor(limit || 20)));
  return { page: p, limit: l, skip: (p - 1) * l, take: l };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** yyyyMMdd in Indian Standard Time — used for order / return numbers. */
export function istDateStamp(date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Generates ids like ORD-20261006-000123 using a per-day counter row. Must run inside the
 * caller's transaction so the counter increment is atomic with the insert.
 */
export async function nextSequenceNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  date = new Date(),
): Promise<string> {
  const stamp = istDateStamp(date);
  const key = `${prefix}-${stamp}`;
  const counter = await tx.dailyCounter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${stamp}-${String(counter.value).padStart(6, '0')}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
