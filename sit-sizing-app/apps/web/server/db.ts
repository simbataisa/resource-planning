import { createPrismaClient, type PrismaClient } from '@sit/db';
import { getEnv } from './env';

/** One Prisma client per process (kept on globalThis so dev hot reload does not leak pools). */
const store = globalThis as unknown as { __sitDb?: PrismaClient };

export function db(): PrismaClient {
  store.__sitDb ??= createPrismaClient(getEnv().DATABASE_URL);
  return store.__sitDb;
}

/** Tests only: drop the cached client (for example after changing DATABASE_URL). */
export async function resetDbForTests(): Promise<void> {
  await store.__sitDb?.$disconnect();
  store.__sitDb = undefined;
}

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type DbOrTx = PrismaClient | Tx;
