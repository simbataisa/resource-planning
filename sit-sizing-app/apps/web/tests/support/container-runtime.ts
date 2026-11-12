import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Rancher Desktop (macOS/Linux) exposes Docker at ~/.rd/docker.sock. Testcontainers mounts the
 * socket into its helper container, and inside the VM the socket lives at /var/run/docker.sock,
 * so the host path must be overridden (runbook section 3). Explicit settings always win.
 * Call before importing a Testcontainers module.
 */
export function configureContainerRuntime(): void {
  const rdSocket = join(homedir(), '.rd', 'docker.sock');
  const usesRancher =
    (process.env.DOCKER_HOST ?? '').includes('/.rd/docker.sock') ||
    (!process.env.DOCKER_HOST && !existsSync('/var/run/docker.sock') && existsSync(rdSocket));
  if (!usesRancher) return;
  process.env.DOCKER_HOST ??= `unix://${rdSocket}`;
  process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ??= '/var/run/docker.sock';
}
