import { describe, expect, it } from 'vitest';
import { auditWhere } from './audit';

describe('audit filters (H-01)', () => {
  it('is empty without filters', () => {
    expect(auditWhere({})).toEqual({});
  });

  it('matches an action exactly, or every action under a prefix ending in a dot', () => {
    expect(auditWhere({ action: 'actuals.record' })).toEqual({ action: 'actuals.record' });
    expect(auditWhere({ action: 'estimate.version.' })).toEqual({
      action: { startsWith: 'estimate.version.' },
    });
  });

  it('covers whole UTC days, both ends included', () => {
    expect(auditWhere({ from: '2026-11-01', to: '2026-11-13' })).toEqual({
      at: {
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lte: new Date('2026-11-13T23:59:59.999Z'),
      },
    });
    expect(auditWhere({ to: '2026-11-13' }).at).toEqual({
      lte: new Date('2026-11-13T23:59:59.999Z'),
    });
  });

  it('passes project, entity and actor through', () => {
    expect(auditWhere({ projectId: 'p', entity: 'Actuals', actorId: 'u' })).toEqual({
      projectId: 'p',
      entity: 'Actuals',
      actorId: 'u',
    });
  });
});
