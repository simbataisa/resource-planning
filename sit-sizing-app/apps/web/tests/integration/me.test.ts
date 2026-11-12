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
