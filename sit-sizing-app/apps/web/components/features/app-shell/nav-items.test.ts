import { describe, expect, it } from 'vitest';
import { NAV_ICONS, type NavSection, sectionFor } from './nav-items';

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

  it('every section has an icon', () => {
    const sections: NavSection[] = [
      'projects',
      'profiles',
      'portfolio',
      'audit',
      'users',
      'guide',
      'method',
      'standards',
    ];
    for (const section of sections) expect(NAV_ICONS[section]).toBeTruthy();
    expect(NAV_ICONS.apiDocs).toBeTruthy();
  });
});
