import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

interface Point { x: number, y: number }

interface Geometry {
  L_top: Point
  L_bot: Point
  subR: number
  wallX: number
  u_top_pt: Point
  p_bot_pt: Point
  p_top_pt: Point
  u_bot_pt: Point
  penumbraTopY: number
  penumbraBotY: number
  umbraTopY: number
  umbraBotY: number
  cross: Point | null
  beamLimitY: number
  topRayActive: boolean
  botRayActive: boolean
  uTopRayActive: boolean
  uBotRayActive: boolean
}

interface Ring {
  ringSize: number
  fovRatio: number
  angleDegNum: number
  geometry: Geometry
  isAntumbra: boolean
  perceptualWeight: number
  ringIndex: number
}

function getTangents(lx: number, ly: number, cx: number, cy: number, r: number) {
  const dx = cx - lx;
  const dy = cy - ly;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= r)
    return null;

  const a = Math.asin(r / d);
  const t = Math.atan2(dy, dx);

  const t1 = t - a;
  const t2 = t + a;

  const distT = Math.sqrt(d * d - r * r);
  const p1 = { x: lx + distT * Math.cos(t1), y: ly + distT * Math.sin(t1) };
  const p2 = { x: lx + distT * Math.cos(t2), y: ly + distT * Math.sin(t2) };

  return p1.y < p2.y ? { upper: p1, lower: p2 } : { upper: p2, lower: p1 };
}

function getIntersection(p1: Point, p2: Point, p3: Point, p4: Point) {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < 0.001)
    return null;
  const intersectX = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
  const intersectY = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;
  return { x: intersectX, y: intersectY };
}

function getWallY(p1: Point, p2: Point, wallX: number) {
  const slope = (p2.y - p1.y) / (p2.x - p1.x);
  return p1.y + slope * (wallX - p1.x);
}

export default function App() {
  const [size, setSize] = useState(150);
  const [dist, setDist] = useState(150);
  const [distribution, setDistribution] = useState(100);
  const [beamAngle, setBeamAngle] = useState(180);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const skinCanvasRef = useRef<HTMLCanvasElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);
  const falloffCanvasRef = useRef<HTMLCanvasElement>(null);
  const fovContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(270);

  useLayoutEffect(() => {
    if (fovContainerRef.current) {
      setContainerWidth(fovContainerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (fovContainerRef.current)
        setContainerWidth(fovContainerRef.current.clientWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const model = useMemo(() => {
    const subR = 20;
    const wallX = 200;
    const lightX = -dist;
    const dFactor = distribution / 100;

    const safeBeamAngle = Math.min(beamAngle, 179.5);
    const beamHalfRad = (safeBeamAngle / 2) * (Math.PI / 180);

    const rings: Ring[] = [];
    let effFovSum = 0;
    let effDegSum = 0;
    let effCoreSum = 0;
    let effLeftSum = 0;
    let effRightSum = 0;
    let totalPerceptualWeight = 0;
    let antumbraWeight = 0;

    let exponent;
    if (dFactor >= 0.7) {
      exponent = (1.0 - dFactor) / 0.3;
    }
    else {
      exponent = 1.0 + (1.0 - (dFactor / 0.7)) * 9;
    }

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
        const checkBeam = (pStart: Point, pEnd: Point) => {
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
        let isRingAntumbra = false;
        if (cross && cross.x > 0 && cross.x < wallX && halfSize > subR) {
          isRingAntumbra = true;
        }

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

    return {
      rings,
      effectiveFovRatio: effFovSum / div,
      effectiveAngleDeg: effDegSum / div,
      effectiveCoreW: effCoreSum / div,
      effectiveLeftW: effLeftSum / div,
      effectiveRightW: effRightSum / div,
      dominantIsAntumbra,
      outerRing: rings[0],
      safeBeamAngle,
      falloffData,
    };
  }, [size, dist, distribution, beamAngle]);

  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const width = canvas.parentElement!.clientWidth;
      const height = canvas.parentElement!.clientHeight;
      if (!width || !height)
        return;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, width, height);

      if (!model.outerRing?.geometry)
        return;
      const pxPerCm = width / 1000;
      const cx = width * 0.90 - (200 * pxPerCm);
      const cy = height / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pxPerCm, pxPerCm);

      const gOut = model.outerRing.geometry;
      const beamRad = (model.safeBeamAngle / 2) * (Math.PI / 180);
      const beamDist = gOut.wallX - gOut.L_top.x;
      const hSource = Math.abs(gOut.L_top.y);
      const beamEdgeY = hSource + Math.tan(beamRad) * beamDist;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(gOut.L_top.x, gOut.L_top.y);
      ctx.lineTo(gOut.wallX, -beamEdgeY);
      ctx.lineTo(gOut.wallX, beamEdgeY);
      ctx.lineTo(gOut.L_bot.x, gOut.L_bot.y);
      ctx.closePath();
      ctx.clip();

      const radialGrad = ctx.createRadialGradient(gOut.L_top.x, 0, 0, gOut.L_top.x, 0, beamDist * 1.5);
      radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      radialGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
      radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(gOut.L_top.x, -beamEdgeY, beamDist, beamEdgeY * 2);
      ctx.restore();

      model.rings.forEach((ring) => {
        if (!ring.geometry)
          return;
        const g = ring.geometry;
        ctx.fillStyle = `rgba(0, 0, 0, 0.12)`;
        ctx.beginPath();
        ctx.moveTo(g.wallX, g.penumbraTopY);
        ctx.lineTo(g.wallX, g.penumbraBotY);
        ctx.lineTo(g.p_bot_pt.x, g.p_bot_pt.y);
        ctx.lineTo(g.p_top_pt.x, g.p_top_pt.y);
        ctx.fill();
      });

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 / pxPerCm;
      if (gOut.topRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.L_bot.x, gOut.L_bot.y);
        ctx.lineTo(gOut.wallX, gOut.penumbraTopY);
        ctx.stroke();
      }
      if (gOut.botRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.L_top.x, gOut.L_top.y);
        ctx.lineTo(gOut.wallX, gOut.penumbraBotY);
        ctx.stroke();
      }
      if (gOut.uTopRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.L_top.x, gOut.L_top.y);
        ctx.lineTo(gOut.wallX, gOut.umbraTopY);
        ctx.stroke();
      }
      if (gOut.uBotRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.L_bot.x, gOut.L_bot.y);
        ctx.lineTo(gOut.wallX, gOut.umbraBotY);
        ctx.stroke();
      }

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4 / pxPerCm;
      ctx.beginPath();
      ctx.moveTo(gOut.wallX, -height / (2 * pxPerCm));
      ctx.lineTo(gOut.wallX, height / (2 * pxPerCm));
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(gOut.L_top.x, gOut.L_top.y);
      ctx.quadraticCurveTo(gOut.L_top.x - (size / 2) * 0.7, 0, gOut.L_bot.x, gOut.L_bot.y);
      ctx.fill();

      model.rings.forEach((ring) => {
        if (!ring.geometry)
          return;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(ring.geometry.L_top.x, ring.geometry.L_top.y);
        ctx.lineTo(ring.geometry.L_bot.x, ring.geometry.L_bot.y);
        ctx.stroke();
      });

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.scale(1 / pxPerCm, 1 / pxPerCm);
      ctx.fillStyle = '#000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Model', 0, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Shadow', gOut.wallX * pxPerCm + 10, 5);
      ctx.restore();

      ctx.restore();
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [model, size, dist]);

  useEffect(() => {
    const canvas = profileCanvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;
    const gOut = model.outerRing?.geometry;
    if (!gOut)
      return;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h)
        return;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, w, h);
      const center = (gOut.penumbraBotY + gOut.penumbraTopY) / 2;
      const spread = Math.abs(gOut.penumbraBotY - gOut.penumbraTopY);
      const scale = w / (Math.max(spread, 100) * 1.1);
      model.rings.forEach((ring) => {
        const g = ring.geometry;
        if (!g)
          return;
        const p1 = (g.penumbraTopY - center) * scale + w / 2;
        const p4 = (g.penumbraBotY - center) * scale + w / 2;
        const u1 = (g.umbraTopY - center) * scale + w / 2;
        const u2 = (g.umbraBotY - center) * scale + w / 2;
        const wGrad = p4 - p1;
        if (wGrad < 0.1 || !Number.isFinite(p1) || !Number.isFinite(p4))
          return;
        try {
          const grad = ctx.createLinearGradient(p1, 0, p4, 0);
          const alpha = ring.isAntumbra ? 0.25 : 0.18;
          const color = ring.isAntumbra ? `rgba(100, 150, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(Math.max(0, Math.min(1, (u1 - p1) / wGrad)), color);
          grad.addColorStop(Math.max(0, Math.min(1, (u2 - p1) / wGrad)), color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(p1, 0, wGrad, h);
        }
        catch {}
      });
    };
    draw();
  }, [model]);

  useEffect(() => {
    const canvas = falloffCanvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h)
        return;

      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#1a1a1a');
      grad.addColorStop(1, '#050505');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = 'center';
      model.falloffData.forEach((pt, i) => {
        const x = (i / 4) * (w - 60) + 30;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x - 0.5, 2, 1, 8);

        ctx.fillStyle = '#888';
        ctx.font = 'bold 9px system-ui';
        ctx.fillText(pt.label, x, h - 52);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${pt.ev.toFixed(1)}`, x, h - 34);

        ctx.fillStyle = '#555';
        ctx.font = '9px monospace';
        ctx.fillText(`${pt.dist.toFixed(0)}cm`, x, h - 16);
      });
    };

    // Initial draw
    draw();

    // Handle potential delay in container sizing
    const timer = setTimeout(draw, 100);
    return () => clearTimeout(timer);
  }, [model.falloffData, containerWidth]);

  useEffect(() => {
    const canvas = skinCanvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h)
        return;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      const amp = Math.max(0.15, 1 - (model.effectiveFovRatio * 3.5));
      const baseH = h * 0.65;
      const pts = [];
      for (let x = 0; x <= w; x++) {
        const y = baseH + (Math.sin(x * 0.07) * 8 + Math.sin(x * 0.3) * 2) * amp;
        pts.push(y);
      }
      ctx.beginPath();
      ctx.moveTo(0, h);
      pts.forEach((y, x) => ctx.lineTo(x, y));
      ctx.lineTo(w, h);
      ctx.fillStyle = '#333';
      ctx.fill();
      const sOp = Math.max(0, 0.8 - (model.effectiveFovRatio * 3.0));
      ctx.fillStyle = `rgba(0, 0, 0, ${sOp})`;
      let rayY = pts[0];
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, pts[0]);
      for (let x = 1; x <= w; x++) {
        rayY += 0.4;
        if (pts[x] > rayY) {
          ctx.lineTo(x, rayY);
        }
        else {
          ctx.lineTo(x, pts[x]);
          rayY = pts[x];
        }
      }
      ctx.lineTo(w, h);
      ctx.fill();
      const hOp = Math.max(0, 0.6 - (model.effectiveFovRatio * 2.0));
      if (hOp > 0) {
        ctx.beginPath();
        for (let x = 0; x < w - 1; x++) {
          if (pts[x + 1] - pts[x] < -0.05) {
            ctx.moveTo(x, pts[x]);
            ctx.lineTo(x + 1, pts[x + 1]);
          }
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${hOp})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      const glow = 0.1 + (model.effectiveFovRatio * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, pts[0]);
      pts.forEach((y, x) => ctx.lineTo(x, y));
      ctx.strokeStyle = `rgba(255, 255, 255, ${glow})`;
      ctx.lineWidth = 1 + model.effectiveFovRatio;
      ctx.stroke();
    };
    draw();
  }, [model.effectiveFovRatio]);

  const pixelsPerDegree = containerWidth / 180;
  const textureDesc = model.effectiveFovRatio > 0.5 ? 'Extremely Soft' : model.effectiveFovRatio > 0.25 ? 'Very Soft' : model.effectiveFovRatio > 0.08 ? 'Soft' : model.effectiveFovRatio > 0.03 ? 'Hard' : 'Extremely Hard';

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] text-[#e5e5e5] font-sans flex flex-col md:flex-row overflow-hidden">
      <style>
        {`
                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #fff; cursor: pointer; margin-top: -6px; box-shadow: 0 0 10px rgba(255,255,255,0.5); }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #404040; border-radius: 2px; }
                input[type=range]:focus { outline: none; }
                .glass-panel { background: rgba(30, 30, 30, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); }
            `}
      </style>
      <div className="flex-1 relative h-full w-full">
        <canvas ref={mainCanvasRef} className="absolute inset-0 w-full h-full block" />
        <div className="absolute top-6 left-6 pointer-events-none z-10">
          <h1 className="text-2xl font-light tracking-wide text-white drop-shadow-md">Umbra</h1>
          <p className="text-sm text-gray-300 mt-1 drop-shadow-md">Cosplay Photography Masterclass</p>
        </div>
      </div>
      <div className="w-full md:w-80 glass-panel p-6 flex flex-col gap-6 z-10 shadow-2xl overflow-y-auto">
        <div className="space-y-5">
          <h2 className="text-lg font-medium text-white">Light Settings</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-gray-300">Modifier Size</label>
              <span className="text-sm font-mono text-white">
                {size}
                cm
              </span>
            </div>
            <input type="range" min="20" max="400" value={size} onChange={e => setSize(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-gray-300">Distance to Subject</label>
              <span className="text-sm font-mono text-white">
                {dist}
                cm
              </span>
            </div>
            <input type="range" min="50" max="600" value={dist} onChange={e => setDist(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-gray-300">Surface Distribution</label>
              <span className="text-sm font-mono text-white">
                {distribution}
                %
              </span>
            </div>
            <input type="range" min="0" max="100" value={distribution} onChange={e => setDistribution(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm text-gray-300">Beam Angle (Grid)</label>
              <span className="text-sm font-mono text-white">
                {beamAngle}
                &deg;
              </span>
            </div>
            <input type="range" min="10" max="180" value={beamAngle} onChange={e => setBeamAngle(Number(e.target.value))} className="w-full" />
          </div>
        </div>
        <div className="space-y-5 mt-2">
          <h2 className="text-lg font-medium text-white">Subject View</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-black relative overflow-hidden border-2 border-gray-800 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-900 absolute flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]"><div className="w-4 h-4 rounded-full bg-black absolute"></div></div>
              {model.rings.map(r => (
                <div
                  key={r.ringIndex}
                  className="absolute bg-white rounded-full mix-blend-screen"
                  style={{ width: `${Math.max(4, r.fovRatio * 40)}px`, height: `${Math.max(4, r.fovRatio * 40)}px`, top: `${20 - Math.max(4, r.fovRatio * 40) / 2}px`, left: `${44 - Math.max(4, r.fovRatio * 40) / 2}px`, opacity: 0.25, transform: 'rotate(45deg)' }}
                />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">Catchlight Size</p>
              <p className="text-xs text-gray-500 font-mono">
                {model.effectiveAngleDeg.toFixed(1)}
                ° (Avg FOV)
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm text-gray-300">Subject Field of View</label>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">180&deg; H / 140&deg; V</span>
            </div>
            <div ref={fovContainerRef} className="w-full h-24 bg-[#0a0a0a] border border-gray-700 rounded-lg relative overflow-hidden flex items-center justify-center shadow-inner">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: 'center center' }}></div>
              {model.rings.map(r => (
                <div
                  key={r.ringIndex}
                  className="bg-white absolute rounded-full mix-blend-screen"
                  style={{ width: `${Math.max(2, r.angleDegNum * pixelsPerDegree)}px`, height: `${Math.max(2, r.angleDegNum * pixelsPerDegree)}px`, opacity: 0.20 }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm text-gray-300">Perceived Skin Softness</label>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">{textureDesc}</span>
            </div>
            <div className="w-full h-24 bg-[#111] rounded-lg relative overflow-hidden shadow-inner border border-gray-700"><canvas ref={skinCanvasRef} className="w-full h-full block absolute inset-0" /></div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end mb-1"><label className="text-sm text-gray-300">Wall Shadow Widths</label></div>
            <div className="w-full bg-[#111] rounded-lg border border-gray-700 p-3 shadow-inner">
              <canvas ref={profileCanvasRef} className="w-full h-8 rounded mb-2 border border-gray-800 bg-[#0a0a0a]" />
              <div className="flex text-center text-xs">
                <div className="flex-1 flex flex-col items-start border-r border-gray-800 pr-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Edge Left</span>
                  <span className="font-mono text-gray-300">
                    {model.effectiveLeftW.toFixed(0)}
                    cm
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-center border-r border-gray-800 px-1">
                  <span className={`text-[9px] uppercase tracking-wider ${model.dominantIsAntumbra ? 'text-blue-400' : 'text-white'}`}>
                    {model.dominantIsAntumbra ? 'Antumbra' : 'Umbra'}
                  </span>
                  <span className={`font-mono ${model.dominantIsAntumbra ? 'text-blue-400' : 'text-white'}`}>
                    {model.effectiveCoreW.toFixed(0)}
                    cm
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-end pl-1">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Edge Right</span>
                  <span className="font-mono text-gray-300">
                    {model.effectiveRightW.toFixed(0)}
                    cm
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-end mb-1"><label className="text-sm text-gray-300">Light Falloff (Relative)</label></div>
            <div className="w-full bg-[#111] rounded-lg border border-gray-700 shadow-inner overflow-hidden">
              <canvas ref={falloffCanvasRef} className="w-full h-20 bg-[#0a0a0a] block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
