import type { Ring } from './geometry.ts';
import { getIntersection, getTangents, getWallY } from './geometry.ts';
import { illuminance, luminance } from './physics.ts';

// Calibrate physics to photographer's EV scale.
// At default settings (150 cm modifier, 150 cm to subject, 100% distribution,
// 180° beam) the on-axis illuminance maps to EV 15 (sunny-day exposure).
const _refIlluminance = illuminance({
  receiver: { x: 150, y: 0, z: 0 },
  modifierR: 75,
  distribution: 1,
  beamHalfAngle: Math.PI / 2,
});
const EV_CALIBRATION = 15 - Math.log2(_refIlluminance);

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

  let exponent: number;
  if (dFactor >= 0.7) {
    exponent = (1.0 - dFactor) / 0.3;
  }
  else {
    exponent = 1.0 + (1.0 - (dFactor / 0.7)) * 9;
  }

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
    const t = i / 7;
    const factor = (1 - t) ** exponent;
    const ringSize = Math.max(1, size * factor);
    const halfSize = ringSize / 2;
    const perceptualWeight = (i + 1.5) ** ((1 - dFactor) * 6);

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
    const e = illuminance({
      receiver: { x, y: 0, z: 0 },
      modifierR: size / 2,
      distribution: dFactor,
      beamHalfAngle: beamHalfRad,
    });
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

/**
 * Intensity across the modifier surface, edge → centre → edge, in absolute EV.
 *
 * The shape is the normalised radial luminance profile (disc-average always 1),
 * so total flux is conserved: lowering `distribution` redistributes light into a
 * centre hotspot rather than adding it. In EV (log2) space the Gaussian profile
 * becomes a downward parabola — flat at 100% distribution, sharper as it drops.
 *
 * `x` runs -1 (one edge) → 0 (centre) → 1 (other edge). The curve is anchored so
 * a uniform modifier reads as a flat line at the subject-centre EV.
 */
export function intensityProfileAtSurface(
  size: number,
  dist: number,
  distribution: number,
  beamAngle: number,
  samples = 64,
): { x: number, ev: number }[] {
  const dFactor = distribution / 100;
  const beamHalfRad = (Math.min(beamAngle, 179.5) / 2) * (Math.PI / 180);

  const e0 = illuminance({
    receiver: { x: dist, y: 0, z: 0 },
    modifierR: size / 2,
    distribution: dFactor,
    beamHalfAngle: beamHalfRad,
  });
  const evBase = Math.log2(e0) + EV_CALIBRATION;

  const out: { x: number, ev: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const x = -1 + (2 * i) / (samples - 1);
    const L = luminance(Math.abs(x), dFactor);
    out.push({ x, ev: evBase + Math.log2(L) });
  }
  return out;
}
