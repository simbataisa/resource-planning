// Schema and migration check (step 1.2). `prisma validate` always runs. The drift check
// compares the migration history with schema.prisma and needs an empty shadow database
// (Prisma 7: SHADOW_DATABASE_URL). `pnpm test:int` provides one in its test container, so
// CI always runs the drift check; on a laptop it runs only when you set SHADOW_DATABASE_URL.
import { execFileSync } from 'node:child_process';

const prisma = (args) => execFileSync('prisma', args, { stdio: 'inherit' });

prisma(['validate']);
if (!process.env.SHADOW_DATABASE_URL) {
  console.warn(
    '[db check] drift check skipped: SHADOW_DATABASE_URL is not set. It runs in `pnpm test:int`.',
  );
  process.exit(0);
}
prisma([
  'migrate',
  'diff',
  '--from-migrations',
  'prisma/migrations',
  '--to-schema',
  'prisma/schema.prisma',
  '--exit-code',
]);
process.stdout.write('[db check] migrations and schema.prisma agree\n');
