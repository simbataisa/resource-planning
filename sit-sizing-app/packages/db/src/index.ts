/**
 * @sit/db — Prisma client for the app database (design 5.2).
 * Import the client only from server code (apps/web/server/**, seed, tests).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

export * from './generated/prisma/client.ts';

/** A Prisma client over node-postgres. One per process; reuse it. */
export function createPrismaClient(
  connectionString: string,
  options: { max?: number } = {},
): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: options.max ?? 10 });
  return new PrismaClient({ adapter });
}
