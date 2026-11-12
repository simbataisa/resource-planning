import { describe, expect, it } from 'vitest';
import { NAV_ICONS, SECTION_LABEL, sectionFor } from './nav-items';

describe('navigation model', () => {
  it('sectionFor maps nested and localised paths', () => {
    expect(sectionFor('/projects/p1')).toBe('projects');
    expect(sectionFor('/vi/estimates/abc/compare')).toBe('projects');
    expect(sectionFor('/en/admin/users')).toBe('users');
    expect(sectionFor('/audit')).toBe('audit');
    expect(sectionFor('/profiles/x')).toBe('profiles');
    expect(sectionFor('/portfolio')).toBe('portfolio');
    expect(sectionFor('/vi/method')).toBe('method');
    expect(sectionFor('/')).toBeNull();
    expect(sectionFor('/vi')).toBeNull();
    expect(sectionFor('/signed-out')).toBeNull();
  });

  it('every section has a label key and an icon', () => {
    for (const section of Object.keys(SECTION_LABEL)) {
      expect(NAV_ICONS[section as keyof typeof NAV_ICONS]).toBeTruthy();
    }
    expect(NAV_ICONS.apiDocs).toBeTruthy();
    expect(SECTION_LABEL.guide).toBe('content.nav.guide');
  });
});
