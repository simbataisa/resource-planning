import { describe, expect, it } from 'vitest';
import * as me from '@/app/api/v1/me/route';
import { call } from './helpers';

describe('PATCH /me (design 8.5: language saved to the profile)', () => {
  it('saves the language for the caller only, and GET returns it', async () => {
    const saved = await call(me.PATCH, {
      who: 'dev-viewer',
      method: 'PATCH',
      path: '/me',
      body: { locale: 'vi' },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.locale).toBe('vi');
    expect((await call(me.GET, { who: 'dev-viewer', path: '/me' })).json.locale).toBe('vi');
    expect((await call(me.GET, { who: 'dev-estimator', path: '/me' })).json.locale).toBe('en');

    const back = await call(me.PATCH, {
      who: 'dev-viewer',
      method: 'PATCH',
      path: '/me',
      body: { locale: 'en' },
    });
    expect(back.json.locale).toBe('en');
  });

  it('rejects unsupported languages and anonymous callers', async () => {
    const bad = await call(me.PATCH, {
      who: 'dev-viewer',
      method: 'PATCH',
      path: '/me',
      body: { locale: 'fr' },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe('VALIDATION_FAILED');
    const anon = await call(me.PATCH, {
      who: null,
      method: 'PATCH',
      path: '/me',
      body: { locale: 'vi' },
    });
    expect(anon.status).toBe(401);
  });
});

describe('PATCH /me tours (guided tours)', () => {
  const patch = (body: unknown, who: 'dev-viewer' | 'dev-estimator' = 'dev-viewer') =>
    call(me.PATCH, { who, method: 'PATCH', path: '/me', body });

  it('saves tour state for the caller only, without changing the language', async () => {
    expect((await patch({ locale: 'vi' })).json.locale).toBe('vi');
    const saved = await patch({ tours: { 'first-estimate@1': { status: 'skipped' } } });
    expect(saved.status).toBe(200);
    expect(saved.json.tours['first-estimate@1'].status).toBe('skipped');
    expect(saved.json.locale).toBe('vi');
    const got = await call(me.GET, { who: 'dev-viewer', path: '/me' });
    expect(got.json.locale).toBe('vi');
    expect(got.json.tours['first-estimate@1'].status).toBe('skipped');
    const other = await call(me.GET, { who: 'dev-estimator', path: '/me' });
    expect(other.json.tours).toEqual({});
    expect((await patch({ locale: 'en' })).json.locale).toBe('en');
  });

  it('removes a key given null', async () => {
    await patch({ tours: { 'first-estimate@1': { status: 'completed' } } });
    const gone = await patch({ tours: { 'first-estimate@1': null } });
    expect(gone.status).toBe(200);
    expect(gone.json.tours['first-estimate@1']).toBeUndefined();
  });

  it('rejects a bad key and an empty body', async () => {
    const bad = await patch({ tours: { 'Bad Key': { status: 'completed' } } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe('VALIDATION_FAILED');
    expect((await patch({})).status).toBe(400);
  });

  it('rejects an over-long key and more than 100 keys in one update', async () => {
    const long = await patch({ tours: { [`${'a'.repeat(63)}@1`]: { status: 'completed' } } });
    expect(long.status).toBe(400);
    expect(long.json.error.code).toBe('VALIDATION_FAILED');
    const many = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`t${i}@1`, { status: 'skipped' }]),
    );
    const tooMany = await patch({ tours: many });
    expect(tooMany.status).toBe(400);
    expect(tooMany.json.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /me returns createdAt and lastLoginAt', async () => {
    const { json } = await call(me.GET, { who: 'dev-viewer', path: '/me' });
    expect(new Date(json.createdAt).toISOString()).toBe(json.createdAt);
    expect(
      json.lastLoginAt === null || new Date(json.lastLoginAt).toISOString() === json.lastLoginAt,
    ).toBe(true);
  });
});
