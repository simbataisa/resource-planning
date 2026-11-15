import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from '@sit/engine';
import { createHttp } from '../http';
import { createApi } from '.';

const user = { id: 'u1', displayName: 'Synthetic Estimator', email: 'estimator@example.invalid' };
const NOW = '2026-11-12T07:00:00.000Z';
const version = {
  id: 'v1',
  number: 1,
  status: 'DRAFT',
  engineVersion: '1.0.0',
  roughFte: 1,
  detailedFte: 1,
  totalCasesDetailed: 1,
  uncalibrated: 0,
  note: null,
  createdBy: user,
  createdAt: NOW,
  updatedAt: NOW,
  inputs: EXAMPLE_INPUTS,
  assumptions: DEFAULT_ASSUMPTIONS,
  result: {},
  profileId: null,
  schemaVersion: 1,
  rowVersion: 1,
  lock: null,
  submittedBy: null,
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  reviews: [],
};

function recorder(data: unknown) {
  const seen: { method?: string; url?: string; token?: unknown }[] = [];
  const adapter: AxiosAdapter = async (config) => {
    seen.push({
      method: config.method,
      url: config.url,
      token: AxiosHeaders.from(config.headers).get('x-lock-token'),
    });
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const http = createHttp();
  http.defaults.adapter = adapter;
  return { api: createApi(http), seen };
}

describe('Draft lock token header (X-Lock-Token)', () => {
  it('sends the token on every call that uses the lock', async () => {
    const { api, seen } = recorder(version);
    await api.estimates.lock('e1', { takeover: false }, 'tok-1').catch(() => undefined);
    await api.estimates
      .patchDraft('e1', { rowVersion: 1, note: 'x' }, 'tok-1')
      .catch(() => undefined);
    await api.estimates
      .applyProfile('e1', { profileId: 'p1', rowVersion: 1 }, 'tok-1')
      .catch(() => undefined);
    await api.estimates.saveVersion('e1', {}, 'tok-1').catch(() => undefined);
    await api.estimates.unlock('e1', 'tok-1');
    expect(seen.map((s) => s.token)).toEqual(['tok-1', 'tok-1', 'tok-1', 'tok-1', 'tok-1']);
    expect(seen.at(-1)).toMatchObject({ method: 'delete', url: '/estimates/e1/draft/lock' });
  });

  it('sends no header when the tab has no token yet', async () => {
    const { api, seen } = recorder(version);
    await api.estimates.lock('e1').catch(() => undefined);
    expect(seen[0]!.token).toBeUndefined();
  });

  it('returns the token from creating an estimate', async () => {
    const { api } = recorder({
      id: 'e1',
      projectId: 'p1',
      name: 'Synthetic',
      description: null,
      archived: false,
      createdBy: user,
      createdAt: NOW,
      latest: null,
      hasDraft: true,
      lockToken: 'tok-9',
    });
    const created = await api.estimates.create('p1', { name: 'Synthetic' });
    expect(created.lockToken).toBe('tok-9');
  });
});
