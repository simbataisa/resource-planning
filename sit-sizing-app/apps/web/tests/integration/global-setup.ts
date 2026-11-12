import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/**
 * Rancher Desktop (macOS/Linux) exposes Docker at ~/.rd/docker.sock. Testcontainers mounts the
 * socket into its helper container, and inside the VM the socket lives at /var/run/docker.sock,
 * so the host path must be overridden (runbook section 3). Explicit settings always win.
 */
function configureContainerRuntime(): void {
  const rdSocket = join(homedir(), '.rd', 'docker.sock');
  const usesRancher =
    (process.env.DOCKER_HOST ?? '').includes('/.rd/docker.sock') ||
    (!process.env.DOCKER_HOST && !existsSync('/var/run/docker.sock') && existsSync(rdSocket));
  if (!usesRancher) return;
  process.env.DOCKER_HOST ??= `unix://${rdSocket}`;
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ??= '/var/run/docker.sock';
}

const run = (args: string[], env: Record<string, string>) =>
  execFileSync('pnpm', ['--filter', '@sit/db', ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

/** Starts PostgreSQL, applies migrations, checks schema drift and loads the synthetic seed. */
export default async function setup(project: TestProject) {
  configureContainerRuntime();
  // Imported after the runtime is configured: Testcontainers reads these variables on first use.
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const image = `${process.env.REGISTRY_PREFIX ?? ''}postgres:17-alpine`;
  container = await new PostgreSqlContainer(image)
    .withDatabase('app')
    .withUsername('app_user')
    .withPassword('synthetic-test-only')
    .start();
  const url = container.getConnectionUri();
  await container.exec(['psql', '-U', 'app_user', '-d', 'app', '-c', 'CREATE DATABASE shadow']);
  const shadow = url.replace(/\/app(\?|$)/, '/shadow$1');

  run(['migrate:deploy'], { DATABASE_URL: url });
  run(['check'], { DATABASE_URL: url, SHADOW_DATABASE_URL: shadow });
  run(['seed'], { DATABASE_URL: url, APP_ENV: 'local' });

  project.provide('databaseUrl', url);
  return async () => {
    await container?.stop();
  };
}
