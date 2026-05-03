// Shared physics for a round Lambertian modifier with a radial luminance profile.
// The same formulas live in GLSL inside `LightFieldRenderer.tsx`; keep them in sync.
//
// Conventions:
//   - The modifier is a flat disc of radius R in the plane x=0, normal +x.
//   - distribution ∈ [0, 1]: 1 = uniform luminance, 0 = sharply peaked centre.
//   - L(r/R, distribution) is normalised so the disc-average is always 1; total
//     flux therefore scales with R² (fixed-luminance interpretation).
//   - illuminance() returns the disc-averaged value of L·cos(θ)/d², matching
//     what the shader computes pre-`lightPower` scaling.

const ALPHA_MAX = 10;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function alphaFromDistribution(distribution: number): number {
  return ALPHA_MAX * (1 - clamp01(distribution));
}

/**
 * Normalised radial luminance: L(r/R, distribution).
 * Gaussian profile, average over the unit disc is exactly 1 for any distribution.
 */
export function luminance(rNorm: number, distribution: number): number {
  const alpha = alphaFromDistribution(distribution);
  if (alpha < 1e-4)
    return 1;
  const norm = alpha / (1 - Math.exp(-alpha));
  return norm * Math.exp(-alpha * rNorm * rNorm);
}

interface Vec3 { x: number, y: number, z: number }
interface Sphere { x: number, y: number, z: number, r: number }

interface IlluminanceParams {
  receiver: Vec3
  modifierR: number
  distribution: number
  beamHalfAngle: number
  occluder?: Sphere
  radialSamples?: number
  angularSamples?: number
}

/**
 * Disc-averaged irradiance at `receiver` from a round Lambertian source of
 * radius `modifierR` centred at the origin in the plane x=0 with normal +x.
 *
 * Formally returns (1/πR²) · ∫∫ L(r/R) · cos(θ) / d² dA over the disc, where
 * elements outside the beam cone or occluded by `occluder` contribute zero.
 *
 * 2D Riemann sum in polar coordinates with midpoint sampling.
 */
export function illuminance({
  receiver,
  modifierR,
  distribution,
  beamHalfAngle,
  occluder,
  radialSamples = 16,
  angularSamples = 24,
}: IlluminanceParams): number {
  const M = radialSamples;
  const N = angularSamples;
  const cosBeam = Math.cos(beamHalfAngle);
  let sum = 0;

  for (let i = 0; i < M; i++) {
    const rNorm = (i + 0.5) / M;
    const rs = rNorm * modifierR;
    const L = luminance(rNorm, distribution);

    for (let j = 0; j < N; j++) {
      // Left-endpoint angular sampling: j=0 → φ=0 and j=N/2 → φ=π land on the
      // cross-section plane (zs=0). Equivalent to midpoint for periodic integrands.
      const phi = j * (2 * Math.PI) / N;
      const ys = rs * Math.cos(phi);
      const zs = rs * Math.sin(phi);

      const dx = receiver.x;
      const dy = receiver.y - ys;
      const dz = receiver.z - zs;
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);
      const cosTheta = dx / dist;

      if (cosTheta <= 0)
        continue;
      if (cosTheta < cosBeam)
        continue;

      if (occluder) {
        const fx = -occluder.x;
        const fy = ys - occluder.y;
        const fz = zs - occluder.z;
        const a = distSq;
        const b = 2 * (fx * dx + fy * dy + fz * dz);
        const c = fx * fx + fy * fy + fz * fz - occluder.r * occluder.r;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sqrtDisc = Math.sqrt(disc);
          const t1 = (-b - sqrtDisc) / (2 * a);
          const t2 = (-b + sqrtDisc) / (2 * a);
          if ((t1 > 0 && t1 < 1) || (t2 > 0 && t2 < 1))
            continue;
        }
      }

      sum += L * cosTheta / distSq * rs;
    }
  }

  // Riemann weight per sample: rs · (R/M) · (2π/N).
  // Disc-average normalisation: divide by area πR².
  // Combined factor: 2 / (M · N · R).
  return (sum * 2) / (M * N * modifierR);
}
