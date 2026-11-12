import { describe, expect, it } from 'vitest';
import { isLocale, localeOf, localeRedirect, pickLocale } from './i18n';

describe('locale helpers', () => {
  it('picks the cookie, then the browser language, then English', () => {
    expect(pickLocale('vi', 'en-US')).toBe('vi');
    expect(pickLocale(undefined, 'vi-VN,vi;q=0.9,en;q=0.8')).toBe('vi');
    expect(pickLocale('fr', 'en-GB')).toBe('en');
    expect(pickLocale(undefined, null)).toBe('en');
  });

  it('reads the locale prefix', () => {
    expect(localeOf('/vi/projects')).toBe('vi');
    expect(localeOf('/en')).toBe('en');
    expect(localeOf('/projects')).toBeNull();
    expect(isLocale('de')).toBe(false);
  });

  it('adds a prefix to page paths only', () => {
    expect(localeRedirect('/', 'vi')).toBe('/vi');
    expect(localeRedirect('/signed-out', 'en')).toBe('/en/signed-out');
    expect(localeRedirect('/en/projects', 'vi')).toBeNull();
    expect(localeRedirect('/api/v1/me', 'en')).toBeNull();
    expect(localeRedirect('/_next/data/x', 'en')).toBeNull();
  });
});
