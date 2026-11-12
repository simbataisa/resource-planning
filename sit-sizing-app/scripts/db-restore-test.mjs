// Backup and restore test (design 12.7): "a restore test into a scratch environment before
// each release, recorded in the runbook".
//
//   pnpm db:restore-test        against the running compose stack (`pnpm dev:up` or `stack:up`)
//
// 1. pg_dump (custom format) of the `app` and `keycloak` databases into reports/backup/
// 2. pg_restore of each dump into a scratch database in the same server
// 3. compare row counts of the key tables between source and restored copy
// 4. drop the scratch databases and append the result to reports/restore-test.log
// Uses the database superuser inside the db container (local socket); no password is read
// or printed. Data is synthetic outside production; on a real environment run it against a
// scratch server restored from the platform backup instead (runbook "Backup and restore").
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const compose = ['compose', '--env-file', '.env', '-f', 'docker/compose.yaml'];
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(root, 'reports/backup');
mkdirSync(outDir, { recursive: true });

const CHECKS = {
  app: [
    '"User"',
    '"Project"',
    '"ProjectMember"',
    '"Estimate"',
    '"EstimateVersion"',
    '"AssumptionProfile"',
    '"AuditEvent"',
  ],
  keycloak: ['realm', 'user_entity', 'client', 'keycloak_group'],
};

const execDb = (args, opts = {}) =>
  execFileSync('docker', [...compose, 'exec', '-T', 'db', ...args], {
    cwd: root,
    encoding: 'utf8',
    ...opts,
  });
const psql = (db, sql) => execDb(['psql', '-U', 'postgres', '-d', db, '-At', '-c', sql]).trim();

function dump(db) {
  const file = join(outDir, `${db}-${stamp}.dump`);
  const fd = openSync(file, 'w');
  const r = spawnSync(
    'docker',
    [...compose, 'exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '-Fc', db],
    {
      cwd: root,
      stdio: ['ignore', fd, 'inherit'],
    },
  );
  closeSync(fd);
  if (r.status !== 0) throw new Error(`pg_dump ${db} failed`);
  return file;
}

function restore(file, target) {
  psql('postgres', `DROP DATABASE IF EXISTS ${target}`);
  psql('postgres', `CREATE DATABASE ${target}`);
  const fd = openSync(file, 'r');
  const r = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'db',
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      target,
      '--no-owner',
      '--no-acl',
    ],
    { cwd: root, stdio: [fd, 'inherit', 'inherit'] },
  );
  closeSync(fd);
  if (r.status !== 0) throw new Error(`pg_restore into ${target} failed`);
}

const results = [];
let ok = true;
for (const [db, tables] of Object.entries(CHECKS)) {
  const scratch = `restore_check_${db}`;
  const file = dump(db);
  restore(file, scratch);
  for (const t of tables) {
    const a = psql(db, `SELECT count(*) FROM ${t}`);
    const b = psql(scratch, `SELECT count(*) FROM ${t}`);
    const same = a === b;
    ok &&= same;
    results.push(`${db}.${t}: ${a} → ${b}${same ? '' : '  MISMATCH'}`);
  }
  psql('postgres', `DROP DATABASE ${scratch}`);
  results.push(
    `${db}: dump ${(statSync(file).size / 1024).toFixed(0)} KiB (${file.slice(root.length + 1)})`,
  );
}

const line = `${new Date().toISOString()} restore test ${ok ? 'PASSED' : 'FAILED'}\n  ${results.join('\n  ')}\n`;
appendFileSync(join(root, 'reports/restore-test.log'), line);
process.stdout.write(line);
if (!ok) process.exitCode = 1;
