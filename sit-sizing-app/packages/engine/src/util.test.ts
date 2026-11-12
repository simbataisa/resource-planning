import { describe, expect, it } from 'vitest';
import { bands, clone, dot3, map3, num, raw, sum3, zero3 } from './util.ts';

describe('util', () => {
  it('num() mirrors the prototype `+x||0`', () => {
    expect(num('3')).toBe(3);
    expect(num(undefined)).toBe(0);
    expect(num(Number.NaN)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('raw() keeps undefined comparisons false', () => {
    expect(raw(undefined) >= 0).toBe(false);
    expect(raw(5)).toBe(5);
  });

  it('triple helpers keep band order', () => {
    expect(sum3([1, 2, 3])).toBe(6);
    expect(zero3()).toEqual([0, 0, 0]);
    expect(map3([1, 2, 3], (n, b) => n * b)).toEqual([0, 2, 6]);
    expect(bands((b) => b + 1)).toEqual([1, 2, 3]);
    expect(dot3([1, 2, 3], [10, 20, 30])).toBe(140);
  });

  it('clone() is a deep copy', () => {
    const a = { x: [1, 2] };
    const b = clone(a);
    b.x[0] = 9;
    expect(a.x[0]).toBe(1);
  });
});
