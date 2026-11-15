import { vi } from 'vitest';
import type { ZodType } from 'zod';
import type { ApiClient, Query } from './api-client';
import type { Logger } from './logger';

/** Synthetic `GET /me` body (no real person). */
export const ME = {
  id: 'clx0synthetic0001',
  displayName: 'Sample Estimator',
  email: 'sample.estimator@example.test',
  globalRole: 'USER',
  locale: 'vi',
  memberships: [
    {
      projectId: 'clx0synthetic0p01',
      projectKey: 'SYN',
      projectName: 'Synthetic Project',
      role: 'ESTIMATOR',
    },
  ],
  tours: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
} as const;

/** A fake API client whose `get` answers from a path → body map. */
export function fakeApi(bodies: Record<string, unknown | Error> = { '/me': ME }) {
  const get = vi.fn(async <T>(path: string, schema: ZodType<T>, _query?: Query): Promise<T> => {
    const body = bodies[path];
    if (body instanceof Error) throw body;
    return schema.parse(body);
  });
  const api: ApiClient = {
    get: get as ApiClient['get'],
    post: vi.fn() as unknown as ApiClient['post'],
    patch: vi.fn() as unknown as ApiClient['patch'],
    del: vi.fn() as unknown as ApiClient['del'],
  };
  return { api, get };
}

/** A logger that records every call, so tests can check what was (not) logged. */
export function fakeLogger() {
  const calls: unknown[][] = [];
  const make = (bindings: object): Logger => ({
    info: (...a: unknown[]) => void calls.push(['info', bindings, ...a]),
    warn: (...a: unknown[]) => void calls.push(['warn', bindings, ...a]),
    error: (...a: unknown[]) => void calls.push(['error', bindings, ...a]),
    child: (b: object) => make({ ...bindings, ...b }),
  });
  return { log: make({}), calls };
}
