import { describe, expect, it } from 'vitest';
import * as members from '@/app/api/v1/projects/[projectId]/members/route';
import { call, seeded } from './helpers';

describe('PUT /projects/:id/members', () => {
  it('needs a QE Lead, rejects unknown people and keeps at least one QE Lead', async () => {
    const { demo } = await seeded();
    const params = { projectId: demo.id };
    const same = {
      members: [
        { email: 'lead@example.invalid', role: 'QE_LEAD' },
        { email: 'estimator@example.invalid', role: 'ESTIMATOR' },
        { email: 'viewer@example.invalid', role: 'VIEWER' },
      ],
    };
    expect(
      (await call(members.PUT, { who: 'dev-estimator', method: 'PUT', params, body: same })).status,
    ).toBe(403);
    expect(
      (await call(members.PUT, { who: 'dev-outsider', method: 'PUT', params, body: same })).status,
    ).toBe(404);
    expect(
      (
        await call(members.PUT, {
          who: 'dev-lead',
          method: 'PUT',
          params,
          body: { members: [{ email: 'lead@example.invalid', role: 'VIEWER' }] },
        })
      ).status,
    ).toBe(400);
    const unknown = await call(members.PUT, {
      who: 'dev-lead',
      method: 'PUT',
      params,
      body: { members: [...same.members, { email: 'nobody@example.invalid', role: 'VIEWER' }] },
    });
    expect(unknown.status).toBe(422);
    const ok = await call(members.PUT, { who: 'dev-lead', method: 'PUT', params, body: same });
    expect(ok.status).toBe(200);
    expect(ok.json.members).toHaveLength(3);
  });
});
