import { z } from 'zod';

/** A finite, non-negative number. */
export const NonNeg = z.number().min(0);
/** Simple / Medium / Complex counts or rates. */
export const Band3 = z.tuple([NonNeg, NonNeg, NonNeg]);
export type Band3 = z.infer<typeof Band3>;

export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export const Size = z.enum(SIZES);
export type Size = z.infer<typeof Size>;

/** 0 = Simple, 1 = Medium, 2 = Complex. */
export const Complexity = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type Complexity = z.infer<typeof Complexity>;

/** Percentage 0–100 as entered (coverage, mutation score, reuse). */
export const Percent = z.number().min(0).max(100);

export const FIELD_TYPES = [
  'text',
  'integer',
  'decimal',
  'percentage',
  'currency',
  'email',
  'phone',
  'date',
  'datetime',
  'boolean',
  'enum',
  'checkbox',
  'radio',
  'password',
  'url',
  'account',
  'citizenId',
  'taxCode',
  'iban',
  'file',
  'image',
] as const;
export const FieldType = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof FieldType>;

export const PT_TYPES = ['load', 'stress', 'soak', 'spike', 'failover'] as const;
export const PtType = z.enum(PT_TYPES);
export type PtType = z.infer<typeof PtType>;

/** Builds an object schema with exactly the given keys, all sharing one value schema. */
export function keyed<const K extends readonly string[], V extends z.ZodType>(keys: K, value: V) {
  return z.object(Object.fromEntries(keys.map((k) => [k, value])) as { [P in K[number]]: V });
}
