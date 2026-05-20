import type { Ring } from './geometry.ts';
import { getIntersection, getTangents, getWallY } from './geometry.ts';
import { alphaFromDistribution, haloFromDistribution, illuminance, luminance } from './physics.ts';

// Sample counts for the falloff irradiance integral. The default Gaussian-on-halo
// surface collapses to a ~2 cm spike at 0% distribution; with 16 radial samples
// the spike falls between rings and the Riemann sum misses ~97% of its energy.
// 256 radial puts ~10 samples inside the 1/e core radius, which converges to
// within ~0.004 stops of the analytical value.
const FALLOFF_RADIAL_SAMPLES = 256;
const FALLOFF_ANGULAR_SAMPLES = 64;

// True on-axis irradiance from the modifier disc, in absolute physical units.
// illuminance() returns the *disc-averaged* form ∫∫L·cosθ/d² dA / πR², so we
// multiply back by πR² to recover the irradiance the receiver actually sees —
// otherwise the modifier area normalises out and a bigger softbox reads the
// same EV as a smaller one at the same distance.
function irradianceAt(x: number, modifierR: number, distribution: number, beamHalfAngle: number): number {
  return illuminance({
    receiver: { x, y: 0, z: 0 },
    modifierR,
    distribution,
    beamHalfAngle,
    radialSamples: FALLOFF_RADIAL_SAMPLES,
    angularSamples: FALLOFF_ANGULAR_SAMPLES,
  }) * Math.PI * modifierR * modifierR;
}

// Calibrate physics to photographer's EV scale.
// At default settings (150 cm modifier, 150 cm to subject, 100% distribution,
// 180° beam) the on-axis irradiance maps to EV 15 (sunny-day exposure).
const EV_CALIBRATION = 15 - Math.log2(irradianceAt(150, 75, 1, Math.PI / 2));

/**
 * @param size         Diameter of the light source (centimeters)
 * @param dist         Distance from the edge of the light source to the model center (centimeters)
 * @param distribution Light surface quality 0 - 100%;
 *                     100% – perfect modifier no hotspot at all;
 *                     90% - best possible softbox;
 *                     70% - bounce umbrella with sock;
 *                     50% - shoot through umbrella;
 *                     0% – almost perfect hotspot;
 * @param beamAngle    Angle of light spread. Less or more collimated.
 *                     180 - typical umbrella or softbox;
 *                     60 - softbox with grids;
 *                     25 – magnum reflector;
 *                     10 - stage projector;
 */
export function calculateShadowModel(size: number, dist: number, distribution: number, beamAngle: number) {
  const subjectRadius = 20;
  const shadowWallX = 200;
  const lightX = -dist;
  const dFactor = distribution / 100;

  const safeBeamAngle = Math.min(beamAngle, 179.5);
  const beamHalfRad = (safeBeamAngle / 2) * (Math.PI / 180);

  // The 8-ring decomposition is a level-set ("layer-cake") discretisation of the
  // surface luminance: ring i is the uniform disc whose radius is where the
  // cumulative luminance staircase reaches level Λ_i. One source of truth — the same
  // profile as physics.luminance(): a Gaussian core on a uniform `halo` floor.
  const alpha = alphaFromDistribution(dFactor);
  const halo = haloFromDistribution(dFactor);
  const lEdge = luminance(1, dFactor);
  const lCenter = luminance(0, dFactor);
  const lSpan = lCenter - lEdge;

  const rings: Ring[] = [];
  let effFovSum = 0;
  let effDegSum = 0;
  let effUmbraCoreSum = 0;
  let effAntumbraCoreSum = 0;
  let effLeftSum = 0;
  let effRightSum = 0;
  let totalPerceptualWeight = 0;
  let umbraWeight = 0;
  let antumbraWeight = 0;

  // To simplify the distribution model we break it into 8 perfect modifiers, which decrease in sizes
  // 100% - they all take full width
  // 0% - they almost all collapse to the center
  for (let i = 0; i < 8; i++) {
    const lambda = lEdge + (i / 8) * lSpan;
    const delta = i === 0 ? lEdge : lSpan / 8;
    // Invert L(r) = λ for the Gaussian-on-halo profile: levels at or below the
    // halo floor are reached everywhere (rNorm=1); above it the core decides.
    const rNorm = alpha < 1e-4 || lambda <= halo
      ? 1
      : Math.min(1, Math.sqrt(Math.max(0, Math.log((lCenter - halo) / (lambda - halo))) / alpha));
    const ringSize = Math.max(1, size * rNorm);
    const halfSize = ringSize / 2;
    const perceptualWeight = delta * rNorm * rNorm;

    const geoAngleRad = 2 * Math.atan(halfSize / dist);
    const effectiveAngleRad = Math.min(geoAngleRad, (safeBeamAngle * Math.PI) / 180);
    const angleDegrees = effectiveAngleRad * 180 / Math.PI;
    const fovRatio = Math.min(effectiveAngleRad / Math.PI, 1);

    const lightTop = { x: lightX, y: -halfSize };
    const lightBottom = { x: lightX, y: halfSize };

    const topT = getTangents(lightTop.x, lightTop.y, 0, 0, subjectRadius);
    const botT = getTangents(lightBottom.x, lightBottom.y, 0, 0, subjectRadius);

    if (topT && botT) {
      const checkBeam = (pStart: { x: number, y: number }, pEnd: { x: number, y: number }) => {
        const angle = Math.abs(Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x));
        return angle <= beamHalfRad;
      };

      const umbraTopPoint = topT.upper;
      const penumbraBottomPoint = topT.lower;
      const penumbraTopPoint = botT.upper;
      const umbraBottomPoint = botT.lower;

      const beamLimitY = halfSize + Math.tan(beamHalfRad) * (shadowWallX - lightX);

      const penumbraTopGeoY = getWallY(lightBottom, penumbraTopPoint, shadowWallX);
      const penumbraBottomGeoY = getWallY(lightTop, penumbraBottomPoint, shadowWallX);
      const umbraTopGeoY = getWallY(lightTop, umbraTopPoint, shadowWallX);
      const umbraBottomGeoY = getWallY(lightBottom, umbraBottomPoint, shadowWallX);

      const penumbraTopY = Math.max(-beamLimitY, penumbraTopGeoY);
      const penumbraBottomY = Math.min(beamLimitY, penumbraBottomGeoY);
      const umbraTopY = Math.max(-beamLimitY, umbraTopGeoY);
      const umbraBottomY = Math.min(beamLimitY, umbraBottomGeoY);

      const cross = getIntersection(lightTop, umbraTopPoint, lightBottom, umbraBottomPoint);
      const isRingAntumbra = !!(cross && cross.x > 0 && cross.x < shadowWallX && halfSize > subjectRadius);

      const geometry = {
        lightTop,
        lightBottom,
        subjectRadius,
        shadowWallX,
        umbraTopPoint,
        penumbraBottomPoint,
        penumbraTopPoint,
        umbraBottomPoint,
        penumbraTopY,
        penumbraBottomY,
        umbraTopY,
        umbraBottomY,
        penumbraTopGeoY,
        penumbraBottomGeoY,
        umbraTopGeoY,
        umbraBottomGeoY,
        beamClipsShadow: penumbraTopY !== penumbraTopGeoY || penumbraBottomY !== penumbraBottomGeoY
          || umbraTopY !== umbraTopGeoY || umbraBottomY !== umbraBottomGeoY,
        cross,
        beamLimitY,
        topRayActive: checkBeam(lightBottom, penumbraTopPoint),
        bottomRayActive: checkBeam(lightTop, penumbraBottomPoint),
        umbraTopRayActive: checkBeam(lightTop, umbraTopPoint),
        umbraBottomRayActive: checkBeam(lightBottom, umbraBottomPoint),
      };

      const s = Math.max(0, penumbraBottomY - penumbraTopY);
      const core = Math.max(0, Math.abs(umbraBottomY - umbraTopY));
      let left = 0;
      let right = 0;

      if (s > 0) {
        if (isRingAntumbra) {
          left = (s - core) / 2;
          right = left;
          antumbraWeight += perceptualWeight;
          effAntumbraCoreSum += core * perceptualWeight;
        }
        else {
          left = Math.max(0, umbraTopY - penumbraTopY);
          right = Math.max(0, penumbraBottomY - umbraBottomY);
          umbraWeight += perceptualWeight;
          effUmbraCoreSum += core * perceptualWeight;
        }
      }

      effLeftSum += left * perceptualWeight;
      effRightSum += right * perceptualWeight;
      rings.push({ ringSize, fovRatio, angleDegrees, geometry, isAntumbra: isRingAntumbra, perceptualWeight, ringIndex: i });
    }

    effFovSum += fovRatio * perceptualWeight;
    effDegSum += angleDegrees * perceptualWeight;
    totalPerceptualWeight += perceptualWeight;
  }

  const div = totalPerceptualWeight || 1;
  const dominantIsAntumbra = antumbraWeight > (totalPerceptualWeight / 2);
  const effectiveCoreW = dominantIsAntumbra
    ? effAntumbraCoreSum / (antumbraWeight || 1)
    : effUmbraCoreSum / (umbraWeight || 1);

  const getEVAtDistance = (x: number): number | null => {
    if (x <= 0)
      return null;
    const e = irradianceAt(x, size / 2, dFactor, beamHalfRad);
    if (e < 1e-30)
      return null;
    return Math.log2(e) + EV_CALIBRATION;
  };

  // First measurement point: normally 70cm before center, but never behind
  // the modifier — stay at least 20cm from the modifier surface.
  const firstX = Math.max(20, dist - 70);

  const falloffData = [
    { label: `-${dist - firstX}cm`, dist: firstX },
    { label: 'Face', dist: dist - 20 },
    { label: 'Center', dist },
    { label: 'Back', dist: dist + 20 },
    { label: '+50cm', dist: dist + 70 },
  ].map(p => ({ ...p, ev: getEVAtDistance(p.dist) }));

  const effectiveFovRatio = effFovSum / div;
  const textureDesc
    = effectiveFovRatio > 0.5
      ? 'Extr. Soft'
      : effectiveFovRatio > 0.25
        ? 'Very Soft'
        : effectiveFovRatio > 0.08
          ? 'Soft'
          : effectiveFovRatio > 0.03
            ? 'Hard'
            : 'Extr. Hard';

  return {
    rings,
    effectiveFovRatio,
    effectiveAngleDeg: effDegSum / div,
    effectiveCoreW,
    effectiveLeftW: effLeftSum / div,
    effectiveRightW: effRightSum / div,
    dominantIsAntumbra,
    outerRing: rings[0],
    safeBeamAngle,
    falloffData,
    textureDesc,
  };
}

// EV a hemisphere incident meter reads at the modifier surface for a uniform
// (100% distribution) disc — the natural anchor of the surface scan and the
// d→0⁺ continuation of the falloff curve. See intensityProfileAtSurface below.
export const SURFACE_UNIFORM_EV = Math.log2(2 * Math.PI) + EV_CALIBRATION;

/**
 * Surface-meter EV across the modifier face, edge → centre → edge.
 *
 * Models the same hemispheric incident meter the Light Falloff widget uses,
 * but placed at the modifier surface itself. In the touching-the-surface limit
 * (ε → 0⁺) the integral ∫∫L·cosθ/d² dA is dominated by the local singularity
 * directly under the meter, collapsing to `2π · L(y/R)` — the no-receiver-
 * cosine convention shared with illuminance(), so the surface reading at y=0
 * is the d→0⁺ continuation of the on-axis falloff curve on the same EV scale.
 *
 * `x` runs -1 (one edge) → 0 (centre) → 1 (other edge). At distribution=100%
 * the profile is flat at SURFACE_UNIFORM_EV ≈ EV_CALIBRATION + 2.65 stops,
 * sitting above the brightest falloff reading. Lower distributions redistribute
 * the same total flux into a centre spike, so the chart's centre rises and
 * its edges drop to the halo floor.
 */
export function intensityProfileAtSurface(
  distribution: number,
  samples = 64,
): { x: number, ev: number }[] {
  const dFactor = distribution / 100;

  const out: { x: number, ev: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const x = -1 + (2 * i) / (samples - 1);
    const L = luminance(Math.abs(x), dFactor);
    out.push({ x, ev: Math.log2(2 * Math.PI * L) + EV_CALIBRATION });
  }
  return out;
}
