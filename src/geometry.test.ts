import { describe, expect, it } from 'vitest';
import { getIntersection, getTangents, getWallY } from './geometry';

describe('getTangents', () => {
  it('returns null when point is inside the circle', () => {
    expect(getTangents(0, 0, 0, 0, 10)).toBeNull();
    expect(getTangents(5, 0, 0, 0, 10)).toBeNull();
  });

  it('returns null when point is on the circle edge', () => {
    expect(getTangents(10, 0, 0, 0, 10)).toBeNull();
  });

  it('returns upper and lower tangent points for a point to the left of the circle', () => {
    const result = getTangents(-100, 0, 0, 0, 20);
    expect(result).not.toBeNull();
    expect(result!.upper.y).toBeLessThan(result!.lower.y);
  });

  it('tangent points are on the circle surface', () => {
    const r = 20;
    const result = getTangents(-100, 0, 0, 0, r);
    expect(result).not.toBeNull();
    const distUpper = Math.sqrt(result!.upper.x ** 2 + result!.upper.y ** 2);
    const distLower = Math.sqrt(result!.lower.x ** 2 + result!.lower.y ** 2);
    expect(distUpper).toBeCloseTo(r, 5);
    expect(distLower).toBeCloseTo(r, 5);
  });

  it('is symmetric for a source on the horizontal axis', () => {
    const result = getTangents(-100, 0, 0, 0, 20);
    expect(result).not.toBeNull();
    expect(result!.upper.y).toBeCloseTo(-result!.lower.y, 10);
    expect(result!.upper.x).toBeCloseTo(result!.lower.x, 10);
  });
});

describe('getIntersection', () => {
  it('returns null for parallel horizontal lines', () => {
    const result = getIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
    expect(result).toBeNull();
  });

  it('returns null for parallel diagonal lines', () => {
    const result = getIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 2 });
    expect(result).toBeNull();
  });

  it('finds intersection of two perpendicular lines', () => {
    const result = getIntersection(
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(0);
    expect(result!.y).toBeCloseTo(0);
  });

  it('finds intersection of two diagonal lines', () => {
    const result = getIntersection(
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: 2, y: 0 },
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(1);
    expect(result!.y).toBeCloseTo(1);
  });
});

describe('getWallY', () => {
  it('returns the y value at the given x on a horizontal line', () => {
    expect(getWallY({ x: 0, y: 5 }, { x: 10, y: 5 }, 7)).toBeCloseTo(5);
  });

  it('returns the y value for a diagonal line', () => {
    // Line from (0, 0) to (10, 10), query at x=5 → y=5
    expect(getWallY({ x: 0, y: 0 }, { x: 10, y: 10 }, 5)).toBeCloseTo(5);
  });

  it('extrapolates past the second point', () => {
    // Line from (0, 0) to (5, 5), query at x=200
    expect(getWallY({ x: 0, y: 0 }, { x: 5, y: 5 }, 200)).toBeCloseTo(200);
  });

  it('handles negative slope', () => {
    // Line from (-100, -20) to (0, 0), query at wallX=200
    const result = getWallY({ x: -100, y: -20 }, { x: 0, y: 0 }, 200);
    expect(result).toBeCloseTo(40);
  });
});
