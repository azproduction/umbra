import type { Ring } from './geometry';
import { useMemo } from 'react';
import { getIntersection, getTangents, getWallY } from './geometry';

export function useShadowModel(size: number, dist: number, distribution: number, beamAngle: number) {
  return useMemo(() => {
    const subR = 20;
    const wallX = 200;
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
      const angleDegNum = effectiveAngleRad * 180 / Math.PI;
      const fovRatio = Math.min(effectiveAngleRad / Math.PI, 1);

      const L_top = { x: lightX, y: -halfSize };
      const L_bot = { x: lightX, y: halfSize };

      const topT = getTangents(L_top.x, L_top.y, 0, 0, subR);
      const botT = getTangents(L_bot.x, L_bot.y, 0, 0, subR);

      if (topT && botT) {
        const checkBeam = (pStart: { x: number, y: number }, pEnd: { x: number, y: number }) => {
          const angle = Math.abs(Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x));
          return angle <= beamHalfRad;
        };

        const u_top_pt = topT.upper;
        const p_bot_pt = topT.lower;
        const p_top_pt = botT.upper;
        const u_bot_pt = botT.lower;

        const beamLimitY = halfSize + Math.tan(beamHalfRad) * (wallX - lightX);
        const penumbraTopY = Math.max(-beamLimitY, getWallY(L_bot, p_top_pt, wallX));
        const penumbraBotY = Math.min(beamLimitY, getWallY(L_top, p_bot_pt, wallX));
        const umbraTopY = Math.max(-beamLimitY, getWallY(L_top, u_top_pt, wallX));
        const umbraBotY = Math.min(beamLimitY, getWallY(L_bot, u_bot_pt, wallX));

        const cross = getIntersection(L_top, u_top_pt, L_bot, u_bot_pt);
        const isRingAntumbra = !!(cross && cross.x > 0 && cross.x < wallX && halfSize > subR);

        const geometry = {
          L_top,
          L_bot,
          subR,
          wallX,
          u_top_pt,
          p_bot_pt,
          p_top_pt,
          u_bot_pt,
          penumbraTopY,
          penumbraBotY,
          umbraTopY,
          umbraBotY,
          cross,
          beamLimitY,
          topRayActive: checkBeam(L_bot, p_top_pt),
          botRayActive: checkBeam(L_top, p_bot_pt),
          uTopRayActive: checkBeam(L_top, u_top_pt),
          uBotRayActive: checkBeam(L_bot, u_bot_pt),
        };

        const s = Math.max(0, penumbraBotY - penumbraTopY);
        const core = Math.max(0, Math.abs(umbraBotY - umbraTopY));
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
            right = Math.max(0, penumbraBotY - umbraBotY);
          }
          effCoreSum += core * perceptualWeight;
        }

        effLeftSum += left * perceptualWeight;
        effRightSum += right * perceptualWeight;
        rings.push({ ringSize, fovRatio, angleDegNum, geometry, isAntumbra: isRingAntumbra, perceptualWeight, ringIndex: i });
      }

      effFovSum += fovRatio * perceptualWeight;
      effDegSum += angleDegNum * perceptualWeight;
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
  }, [size, dist, distribution, beamAngle]);
}
