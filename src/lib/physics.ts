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

// The physical property that defines the worst case is the *size* of the bright
// core, not its contrast. At 0% distribution the modifier collapses to a central
// spike whose Gaussian 1/e radius is SPIKE_RADIUS_RATIO of the modifier radius —
// roughly a 2 cm core on a 100 cm modifier, i.e. effectively a point light. The
// edge-to-centre contrast is then whatever this geometry implies; it is a result,
// not a target. Every consumer (GLSL shader, intensity chart, tests) derives from
// this — change it here only.
export const SPIKE_RADIUS_RATIO = 0.02;

// Gaussian sharpness with a 1/e radius of SPIKE_RADIUS_RATIO: α·r² = 1 at
// r = SPIKE_RADIUS_RATIO, so α = 1 / SPIKE_RADIUS_RATIO².
const ALPHA_SPIKE = 1 / (SPIKE_RADIUS_RATIO * SPIKE_RADIUS_RATIO);

// Sharpness at the failure point — a mediocre but still extended source
// (1/e radius ≈ 1/√ALPHA_FAIL ≈ 0.29 of the modifier radius).
const ALPHA_FAIL = 12;

// Slider fraction where a misused modifier starts to fail. Above it the surface
// degrades gently from uniform; below it sharpness climbs steeply to a point light.
const FAILURE_POINT = 0.2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Gaussian sharpness α of the surface luminance for a given distribution.
 *
 * A correctly-used modifier (high distribution) degrades only gently; below
 * FAILURE_POINT the light quality falls off a cliff, modelling a misused
 * modifier — e.g. a bulb pointing out of a bounce umbrella.
 *
 *   d ≥ FAILURE_POINT: gentle linear ease from α=0 (uniform, d=1) to ALPHA_FAIL.
 *   d < FAILURE_POINT: geometric cliff from ALPHA_FAIL up to ALPHA_SPIKE at d=0,
 *     where the modifier behaves as a ~2 cm point light. Continuous at FAILURE_POINT.
 */
export function alphaFromDistribution(distribution: number): number {
  const d = clamp01(distribution);
  if (d >= FAILURE_POINT) {
    return ALPHA_FAIL * (1 - d) / (1 - FAILURE_POINT);
  }
  const t = (FAILURE_POINT - d) / FAILURE_POINT;
  return ALPHA_FAIL * (ALPHA_SPIKE / ALPHA_FAIL) ** t;
}

// Flux fraction held back from the spike as a broad, near-uniform halo at 0%
// distribution — the faint surround of the collapsed core. A single Gaussian
// conserving flux into a 2 cm spike leaves nothing for the surroundings; this
// pedestal explicitly reserves a slice so the halo physically exists.
const HALO_FLUX = 0.03;

/**
 * Flux fraction in the uniform halo floor for a given distribution.
 *
 * Zero above FAILURE_POINT (the modifier is a pure Gaussian there) and ramps
 * linearly to HALO_FLUX at d=0, so the halo is purely a feature of the
 * misuse collapse and never disturbs a correctly-used modifier.
 */
export function haloFromDistribution(distribution: number): number {
  const d = clamp01(distribution);
  if (d >= FAILURE_POINT) {
    return 0;
  }
  return HALO_FLUX * (FAILURE_POINT - d) / FAILURE_POINT;
}

/**
 * Normalised radial luminance: L(r/R, distribution).
 *
 * A Gaussian core sitting on a uniform halo floor: the core carries (1-halo)
 * of the flux, the halo carries `halo`. Both components are individually
 * disc-average-normalised, so the total disc-average is exactly 1 for any
 * distribution. With halo=0 this is a plain Gaussian.
 */
export function luminance(rNorm: number, distribution: number): number {
  const alpha = alphaFromDistribution(distribution);
  if (alpha < 1e-4)
    return 1;
  const halo = haloFromDistribution(distribution);
  const norm = alpha / (1 - Math.exp(-alpha));
  return halo + (1 - halo) * norm * Math.exp(-alpha * rNorm * rNorm);
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
