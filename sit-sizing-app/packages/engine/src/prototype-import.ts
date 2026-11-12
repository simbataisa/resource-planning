import type { Assumptions, EstimateInputs, Feature } from '@sit/schemas';
import { SIZES } from './catalogue.ts';
import { DEFAULT_ASSUMPTIONS, EXAMPLE_INPUTS } from './defaults.ts';
import { clone } from './util.ts';

export type PrototypeImportErrorCode = 'NOT_A_PROFILE' | 'NO_ASSUMPTIONS';

export class PrototypeImportError extends Error {
  readonly code: PrototypeImportErrorCode;
  constructor(code: PrototypeImportErrorCode) {
    super(code);
    this.name = 'PrototypeImportError';
    this.code = code;
  }
}

/**
 * Prototype `merge(base, over)`: keep the shape of `base`, take values from `over`
 * only where the type matches; arrays must keep their length; non-finite numbers are ignored.
 */
export function mergeShape<T>(base: T, over: unknown): T {
  if (over == null || typeof over !== typeof base) return base;
  if (Array.isArray(base)) {
    return (
      Array.isArray(over) && over.length === base.length
        ? over.map((v: unknown, i) => (typeof v === 'number' && Number.isFinite(v) ? v : base[i]))
        : base
    ) as T;
  }
  if (typeof base === 'object' && base !== null) {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(base)) {
      o[k] = mergeShape((base as Record<string, unknown>)[k], (over as Record<string, unknown>)[k]);
    }
    return o as T;
  }
  return (typeof over === 'number' && Number.isFinite(over)) ||
    typeof over === 'string' ||
    typeof over === 'boolean'
    ? (over as T)
    : base;
}

function normaliseFeature(f: Record<string, unknown>): Feature {
  const type = f.type;
  const size = f.size;
  const cx = Number(f.cx);
  return {
    name: String(f.name || 'Feature'),
    pt: !!f.pt,
    type: type === 'app' || type === 'data' || type === 'ai' ? type : 'app',
    size: (SIZES as readonly unknown[]).includes(size) ? (size as Feature['size']) : 'M',
    cx: cx === 0 || cx === 1 || cx === 2 ? cx : 1,
    qty: Math.max(0, Number(f.qty) || 0),
  };
}

/**
 * Reads a profile exported from the HTML prototype ({assumptions, scope?, profile?})
 * with the prototype's own tolerance rules (loadProfile). Validate the result with
 * the Zod schemas before saving.
 */
export function fromPrototypeProfile(obj: unknown): {
  assumptions: Assumptions;
  inputs: EstimateInputs | null;
  profile: string;
} {
  if (!obj || typeof obj !== 'object') throw new PrototypeImportError('NOT_A_PROFILE');
  const o = obj as Record<string, unknown>;
  const asm = o.assumptions ?? o.A;
  if (!asm) throw new PrototypeImportError('NO_ASSUMPTIONS');
  const assumptions = mergeShape(clone(DEFAULT_ASSUMPTIONS) as Assumptions, asm);
  let inputs: EstimateInputs | null = null;
  if (o.scope) {
    const sc = o.scope as Record<string, unknown>;
    const base = clone(EXAMPLE_INPUTS) as EstimateInputs;
    const ns = mergeShape(base, sc);
    ns.features = Array.isArray(sc.features)
      ? sc.features
          .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
          .map(normaliseFeature)
      : base.features;
    inputs = ns;
  }
  return { assumptions, inputs, profile: typeof o.profile === 'string' ? o.profile : '' };
}
