import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TourKey, type Me } from '@sit/schemas';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import { TOURS } from './registry';

type Tree = { [k: string]: string | Tree };
const get = (tree: Tree, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Tree | undefined)?.[k], tree);

const me = (
  roles: Array<'VIEWER' | 'ESTIMATOR' | 'QE_LEAD'>,
  globalRole: 'USER' | 'ADMIN' = 'USER',
): Me => ({
  id: 'u1',
  displayName: 'Test User',
  email: 'test@example.invalid',
  globalRole,
  locale: 'en',
  memberships: roles.map((role, i) => ({
    projectId: `p${i}`,
    projectKey: `K${i}`,
    projectName: `Project ${i}`,
    role,
  })),
  tours: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-06-01T00:00:00.000Z',
});

const tour = (id: string) => {
  const found = TOURS.find((t) => t.id === id);
  if (!found) throw new Error(`missing tour ${id}`);
  return found;
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(tsx?|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('tour registry', () => {
  it('has the four tours with unique ids matching TourKey', () => {
    const ids = TOURS.map((t) => t.id);
    expect(ids.sort()).toEqual(
      ['first-estimate-admin@1', 'first-estimate@1', 'no-project@1', 'reading-tour@1'].sort(),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(TourKey.safeParse(id).success).toBe(true);
    expect(tour('first-estimate-admin@1').after).toBe('first-estimate@1');
  });

  it('has a title and body in both languages for every step', () => {
    for (const t of TOURS) {
      for (const s of t.steps) {
        for (const [name, tree] of [
          ['en', en],
          ['vi', vi],
        ] as const) {
          for (const part of ['title', 'body']) {
            const text = get(tree as Tree, `${s.messageKey}.${part}`);
            expect(typeof text, `${name} ${s.messageKey}.${part}`).toBe('string');
          }
        }
      }
    }
  });

  it('points every target at a data-tour attribute that exists in the source', () => {
    const root = join(__dirname, '../..');
    const source = [...sourceFiles(join(root, 'components')), ...sourceFiles(join(root, 'app'))]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const t of TOURS) {
      for (const s of t.steps) {
        if (s.target === 'center') continue;
        const m = /^\[data-tour="([\w-]+)"\]$/.exec(s.target);
        expect(m, `target ${s.target}`).not.toBeNull();
        // Sidebar links take the name through SidebarNavLink's `tour` prop, which sets data-tour.
        const name = m![1]!;
        const found = source.includes(`data-tour="${name}"`) || source.includes(` tour="${name}"`);
        expect(found, `data-tour "${name}"`).toBe(true);
      }
    }
  });

  it('starts the first-estimate and no-project steps on matching routes', () => {
    const steps = tour('first-estimate@1').steps;
    expect(steps.map((s) => s.advance)).toEqual([
      'next',
      'navigate',
      'click',
      { event: 'estimate-created' },
      'next',
      'next',
      'next',
      'next',
      'next',
      { event: 'version-saved' },
      'next',
    ]);
    expect(steps[1]!.route.test('/projects')).toBe(true);
    expect(steps[4]!.route.test('/estimates/e1')).toBe(true);
  });

  it('shows the user email on the no-project card', () => {
    const step = tour('no-project@1').steps[0]!;
    expect(step.values?.(me([]))).toEqual({ email: 'test@example.invalid' });
    expect(String(get(en as Tree, `${step.messageKey}.body`))).toContain('{email}');
    expect(String(get(vi as Tree, `${step.messageKey}.body`))).toContain('{email}');
  });

  it('selects the audiences from spec 6.5', () => {
    const who = {
      estimator: me(['ESTIMATOR']),
      lead: me(['QE_LEAD']),
      adminNoProject: me([], 'ADMIN'),
      viewer: me(['VIEWER']),
      none: me([]),
      mixed: me(['VIEWER', 'ESTIMATOR']),
      adminViewer: me(['VIEWER'], 'ADMIN'),
    };
    const hits = (id: string) =>
      Object.entries(who)
        .filter(([, m]) => tour(id).audience(m))
        .map(([k]) => k)
        .sort();
    expect(hits('first-estimate@1')).toEqual([
      'adminNoProject',
      'adminViewer',
      'estimator',
      'lead',
      'mixed',
    ]);
    expect(hits('reading-tour@1')).toEqual(['viewer']);
    expect(hits('no-project@1')).toEqual(['none']);
    expect(hits('first-estimate-admin@1')).toEqual(['adminNoProject', 'adminViewer']);
  });
});
