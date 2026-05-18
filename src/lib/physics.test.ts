import { describe, expect, it } from 'vitest';
import { alphaFromDistribution, illuminance, luminance, MAX_CONTRAST_STOPS } from './physics.ts';

describe('luminance', () => {
  it('is uniform when distribution=1', () => {
    expect(luminance(0, 1)).toBeCloseTo(1, 6);
    expect(luminance(0.5, 1)).toBeCloseTo(1, 6);
    expect(luminance(1, 1)).toBeCloseTo(1, 6);
  });

  it('peaks at the centre when distribution=0, capped at MAX_CONTRAST_STOPS edge-to-centre', () => {
    const center = luminance(0, 0);
    const edge = luminance(1, 0);
    expect(center).toBeGreaterThan(1);
    expect(edge).toBeLessThan(1);
    expect(Math.log2(center / edge)).toBeCloseTo(MAX_CONTRAST_STOPS, 6);
  });

  it('disc-average is 1 regardless of distribution', () => {
    for (const d of [0, 0.3, 0.5, 0.7, 1]) {
      // Disc-average ≈ 2 ∫₀¹ L(r) · r dr (midpoint rule, fine grid).
      let acc = 0;
      const N = 10000;
      for (let i = 0; i < N; i++) {
        const r = (i + 0.5) / N;
        acc += luminance(r, d) * r;
      }
      const avg = (acc * 2) / N;
      expect(avg).toBeCloseTo(1, 3);
    }
  });

  it('alphaFromDistribution clamps to [0, ALPHA_MAX]', () => {
    expect(alphaFromDistribution(1)).toBe(0);
    expect(alphaFromDistribution(2)).toBe(0);
    expect(alphaFromDistribution(-1)).toBeGreaterThan(0);
    expect(alphaFromDistribution(0)).toBeGreaterThan(alphaFromDistribution(0.5));
  });
});

describe('illuminance', () => {
  it('matches the closed-form Lambertian disc on-axis (uniform)', () => {
    const R = 50;
    const d = 100;
    // Closed form: E = 2π(1 - d/√(d²+R²)) for a Lambertian disc onto a
    // surface oriented perpendicular to the source direction.
    const expectedIntegral = 2 * Math.PI * (1 - d / Math.sqrt(d * d + R * R));
    const expectedAvg = expectedIntegral / (Math.PI * R * R);

    const computed = illuminance({
      receiver: { x: d, y: 0, z: 0 },
      modifierR: R,
      distribution: 1,
      beamHalfAngle: Math.PI,
      radialSamples: 64,
      angularSamples: 64,
    });

    expect(computed / expectedAvg).toBeCloseTo(1, 2);
  });

  it('falls off roughly as 1/d² in the far field on-axis (uniform)', () => {
    const R = 20;
    const args = {
      modifierR: R,
      distribution: 1,
      beamHalfAngle: Math.PI,
      radialSamples: 32,
      angularSamples: 32,
    } as const;

    const e1 = illuminance({ receiver: { x: 200, y: 0, z: 0 }, ...args });
    const e2 = illuminance({ receiver: { x: 400, y: 0, z: 0 }, ...args });

    // 2× distance → ~4× dimmer.
    expect(e1 / e2).toBeCloseTo(4, 1);
  });

  it('beam cone clipping zeroes contributions outside the cone', () => {
    const R = 50;
    // Receiver well off-axis; a tight beam aimed +x cannot reach it.
    const wide = illuminance({
      receiver: { x: 100, y: 200, z: 0 },
      modifierR: R,
      distribution: 1,
      beamHalfAngle: Math.PI,
      radialSamples: 16,
      angularSamples: 24,
    });
    const narrow = illuminance({
      receiver: { x: 100, y: 200, z: 0 },
      modifierR: R,
      distribution: 1,
      beamHalfAngle: 5 * Math.PI / 180,
      radialSamples: 16,
      angularSamples: 24,
    });

    expect(wide).toBeGreaterThan(0);
    expect(narrow).toBe(0);
  });

  it('sphere occluder blocks light directly behind the subject', () => {
    // Subject sphere on the optical axis between source and receiver.
    const R = 30;
    const args = {
      receiver: { x: 200, y: 0, z: 0 },
      modifierR: R,
      distribution: 1,
      beamHalfAngle: Math.PI,
      radialSamples: 32,
      angularSamples: 32,
    } as const;

    const unblocked = illuminance(args);
    const blocked = illuminance({ ...args, occluder: { x: 100, y: 0, z: 0, r: 60 } });

    expect(blocked).toBeLessThan(unblocked * 0.05);
  });
});
