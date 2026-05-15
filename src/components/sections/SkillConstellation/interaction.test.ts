import { describe, expect, it } from 'vitest';
import { depthFactor, highlightDash, normalizePointer } from './interaction';

describe('depthFactor', () => {
  it('cycles through three stable layers by index', () => {
    expect(depthFactor(0)).toBe(1);
    expect(depthFactor(1)).toBe(0.66);
    expect(depthFactor(2)).toBe(0.4);
    expect(depthFactor(3)).toBe(1);
  });

  it('is deterministic for the same index', () => {
    expect(depthFactor(7)).toBe(depthFactor(7));
  });
});

describe('normalizePointer', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it('maps the center to 0,0', () => {
    expect(normalizePointer(200, 100, rect)).toEqual({ x: 0, y: 0 });
  });

  it('maps corners to -1/1 and clamps beyond the rect', () => {
    expect(normalizePointer(100, 50, rect)).toEqual({ x: -1, y: -1 });
    expect(normalizePointer(300, 150, rect)).toEqual({ x: 1, y: 1 });
    expect(normalizePointer(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });

  it('returns 0,0 for a zero-size rect', () => {
    expect(normalizePointer(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('highlightDash', () => {
  it('returns a hidden pattern for non-positive length', () => {
    expect(highlightDash(0, 0.5, 100)).toEqual({ dasharray: '0 1', dashoffset: 0 });
  });

  it('reveals a window centered on the fraction', () => {
    expect(highlightDash(1000, 0.5, 100)).toEqual({
      dasharray: '0 450 100 1000',
      dashoffset: 0,
    });
  });

  it('clamps the window at the path start', () => {
    expect(highlightDash(1000, 0, 100)).toEqual({
      dasharray: '0 0 50 1000',
      dashoffset: 0,
    });
  });

  it('clamps the window at the path end', () => {
    expect(highlightDash(1000, 1, 100)).toEqual({
      dasharray: '0 950 50 1000',
      dashoffset: 0,
    });
  });
});
