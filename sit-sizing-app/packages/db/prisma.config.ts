// Prisma 7 CLI configuration. The datasource URL lives here, not in schema.prisma.
// Local runs read DATABASE_URL from the environment, then apps/web/.env.local
// (created by `pnpm dev:env`). Containers get it from compose or the secret store.
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env', '../../apps/web/.env.local'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    // A placeholder keeps `prisma generate` working where no database is configured
    // (Docker build, CI install). Commands that connect fail fast against it.
    url: process.env.DATABASE_URL ?? 'postgresql://unset@127.0.0.1:1/unset',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
