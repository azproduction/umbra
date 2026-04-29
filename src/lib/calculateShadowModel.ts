import type { Ring } from './geometry.ts';
import { getIntersection, getTangents, getWallY } from './geometry.ts';

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
  let effCoreSum = 0;
  let effLeftSum = 0;
  let effRightSum = 0;
  let totalPerceptualWeight = 0;
  let antumbraWeight = 0;

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
      const penumbraTopY = Math.max(-beamLimitY, getWallY(lightBottom, penumbraTopPoint, shadowWallX));
      const penumbraBottomY = Math.min(beamLimitY, getWallY(lightTop, penumbraBottomPoint, shadowWallX));
      const umbraTopY = Math.max(-beamLimitY, getWallY(lightTop, umbraTopPoint, shadowWallX));
      const umbraBottomY = Math.min(beamLimitY, getWallY(lightBottom, umbraBottomPoint, shadowWallX));

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
        }
        else {
          left = Math.max(0, umbraTopY - penumbraTopY);
          right = Math.max(0, penumbraBottomY - umbraBottomY);
        }
        effCoreSum += core * perceptualWeight;
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

  const getEVAtDistance = (x: number) => {
    if (x <= 5)
      return 20;
    let totalIntensity = 0;
    const falloffExponent = 2 * (beamAngle / 180);
    const totalRings = 8;
    const totalPowerPool = totalRings * 4;

    rings.forEach((r, idx) => {
      const ringPowerFactor = (dFactor * (1 / totalRings)) + ((1 - dFactor) * (idx === 7 ? 1 : 0));
      const ringIntensity = totalPowerPool * ringPowerFactor;
      const effectiveX = Math.sqrt(x * x + (r.ringSize / 2) * (r.ringSize / 2));
      totalIntensity += ringIntensity / (effectiveX / 100) ** falloffExponent;
    });

    return 10 + Math.log2(totalIntensity);
  };

  const falloffData = [
    { label: '-50cm', dist: dist - 70, ev: getEVAtDistance(dist - 70) },
    { label: 'Front', dist: dist - 20, ev: getEVAtDistance(dist - 20) },
    { label: 'Mid', dist, ev: getEVAtDistance(dist) },
    { label: 'End', dist: dist + 20, ev: getEVAtDistance(dist + 20) },
    { label: '+50cm', dist: dist + 70, ev: getEVAtDistance(dist + 70) },
  ];

  const effectiveFovRatio = effFovSum / div;
  const textureDesc
    = effectiveFovRatio > 0.5
      ? 'Extremely Soft'
      : effectiveFovRatio > 0.25
        ? 'Very Soft'
        : effectiveFovRatio > 0.08
          ? 'Soft'
          : effectiveFovRatio > 0.03
            ? 'Hard'
            : 'Extremely Hard';

  return {
    rings,
    effectiveFovRatio,
    effectiveAngleDeg: effDegSum / div,
    effectiveCoreW: effCoreSum / div,
    effectiveLeftW: effLeftSum / div,
    effectiveRightW: effRightSum / div,
    dominantIsAntumbra,
    outerRing: rings[0],
    safeBeamAngle,
    falloffData,
    textureDesc,
  };
}
