import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { DRIVERS, FIELD_TYPES } from './catalogue.ts';
import type { Counts, Mode } from './types.ts';
import { clone, num, sum3, zero3, type Band, type Triple } from './util.ts';

/** Driver counts for a mode (prototype `counts()`). Rough mode expands features through size proxies. */
export function counts(mode: Mode, A: Assumptions, S: EstimateInputs): Counts {
  const c: Counts = {
    api: zero3(),
    screen: zero3(),
    integration: zero3(),
    rule: zero3(),
    workflow: zero3(),
    batch: zero3(),
    event: zero3(),
    journey: zero3(),
    fields: 0,
    roles: 0,
    actions: 0,
    languages: 1,
    critical: 0,
    variants: 1,
    approvals: 0,
    ch: S.channels ?? {},
    a11y: !!S.a11y,
    data: {
      feed: zero3(),
      pipe: zero3(),
      table: zero3(),
      report: zero3(),
      columns: 0,
      dq: 0,
      scd: 0,
      secured: 0,
      accessRoles: 0,
    },
    ai: { intent: zero3(), ocr: zero3(), rag: 0, tools: 0, guard: 0, hitl: 0 },
  };
  if (mode === 'rough') {
    for (const f of S.features) {
      const t = f.type ?? 'app';
      const q = num(f.qty);
      const b = num(f.cx) as Band;
      if (t === 'data') {
        const p = A.dproxies[f.size];
        if (!p) continue;
        for (const k of ['feed', 'pipe', 'table', 'report'] as const)
          c.data[k][b] += (p[k] || 0) * q;
        for (const k of ['columns', 'dq', 'scd', 'secured'] as const) c.data[k] += (p[k] || 0) * q;
        continue;
      }
      if (t === 'ai') {
        const p = A.aproxies[f.size];
        if (!p) continue;
        for (const k of ['intent', 'ocr'] as const) c.ai[k][b] += (p[k] || 0) * q;
        for (const k of ['rag', 'tools', 'hitl'] as const) c.ai[k] += (p[k] || 0) * q;
        // Prototype behaviour (engine-findings): guardrail categories take the max across AI features.
        if (q > 0) c.ai.guard = Math.max(c.ai.guard, p.guard || 0);
        continue;
      }
      const p = A.proxies[f.size];
      if (!p) continue;
      for (const d of DRIVERS) c[d][b] += (p[d] || 0) * q;
      c.fields += p.field * q;
      c.actions += p.actions * q;
    }
    c.data.accessRoles = num(S.roughRoles);
    c.roles = num(S.roughRoles);
    c.languages = Math.max(1, num(S.roughLanguages) || 1);
    c.critical = sum3(c.rule) * A.criticalShare;
    c.variants = Math.max(1, num(S.roughVariants) || 1);
    c.approvals = Math.round(sum3(c.workflow) * A.roughApprovalShare);
  } else {
    const d = S.detail;
    for (const k of DRIVERS) c[k] = (d[k] ?? zero3()).map((x) => num(x)) as Triple;
    c.fields = num(d.fields);
    c.roles = num(d.roles);
    c.actions = num(d.actions);
    c.languages = Math.max(1, num(d.languages) || 1);
    c.critical = Math.max(0, num(d.critical));
    c.variants = Math.max(1, num(d.variants) || 1);
    c.approvals = Math.max(0, num(d.approvals));
    if (d.data) c.data = clone(d.data) as Counts['data'];
    if (d.ai) c.ai = clone(d.ai) as Counts['ai'];
  }
  return c;
}

export interface FieldProfile {
  /** True when detailed mode has typed field counts. */
  typed: boolean;
  /** Number of typed fields, or null when untyped. */
  count: number | null;
  /** Matrix cases per field: typed average, or the typical-mix average. */
  per: number;
}

/** Cases per field from the field-type matrix (prototype `fieldProfile()`). */
export function fieldProfile(mode: Mode, A: Assumptions, S: EstimateInputs): FieldProfile {
  const ft: Partial<Record<string, number>> =
    mode === 'detailed' ? (S.detail.fieldTypes ?? {}) : {};
  let n = 0;
  let sum = 0;
  let m = 0;
  let s2 = 0;
  for (const t of FIELD_TYPES) {
    const k = num(ft[t]);
    const a = A.ftypes[t];
    n += k;
    sum += k * a.cases;
    m += num(a.mix);
    s2 += num(a.mix) * a.cases;
  }
  return n > 0
    ? { typed: true, count: n, per: sum / n }
    : { typed: false, count: null, per: m > 0 ? s2 / m : 0 };
}
