// Local only: re-imports the Keycloak realm from docker/keycloak after you change the realm
// files. Keycloak imports a realm only when it does not exist, so this drops and recreates
// the local `keycloak` database (same roles and grants as docker/postgres/init) and restarts
// Keycloak. App data in the `app` database is not touched.
import { execFileSync } from 'node:child_process';

const compose = [
  'compose',
  '--env-file',
  '.env',
  '-f',
  'docker/compose.yaml',
  '-f',
  'docker/compose.dev.yaml',
];
const run = (args) => execFileSync('docker', [...compose, ...args], { stdio: 'inherit' });
const psql = (db, ...sql) =>
  run([
    'exec',
    '-T',
    'db',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    db,
    ...sql.flatMap((s) => ['-c', s]),
  ]);

if (['sit', 'prod'].includes(process.env.APP_ENV ?? '')) throw new Error('Local development only');

run(['stop', 'keycloak']);
psql(
  'postgres',
  'DROP DATABASE IF EXISTS keycloak WITH (FORCE)',
  'CREATE DATABASE keycloak OWNER keycloak_user',
  'REVOKE ALL ON DATABASE keycloak FROM PUBLIC',
  'GRANT CONNECT ON DATABASE keycloak TO keycloak_user',
);
psql(
  'keycloak',
  'ALTER SCHEMA public OWNER TO keycloak_user',
  'REVOKE CREATE ON SCHEMA public FROM PUBLIC',
);
run(['up', '-d', '--wait', 'keycloak']);
console.log('[sit-sizing] Keycloak realm re-imported from docker/keycloak');
