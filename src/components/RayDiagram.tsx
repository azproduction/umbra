import type { calculateShadowModel } from '../lib/calculateShadowModel.ts';
import { useEffect, useRef } from 'react';
import { LightFieldRenderer } from './LightFieldRenderer.tsx';

type Model = ReturnType<typeof calculateShadowModel>;

interface Props {
  model: Model
  size: number
  dist: number
  beamAngle: number
  distribution: number
  exposure: number
}

export function RayDiagram({ model, size, dist, beamAngle, distribution, exposure }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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
      const beamEdgeY = gOut.beamLimitY;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(gOut.lightTop.x, gOut.lightTop.y);
      ctx.lineTo(gOut.shadowWallX, -beamEdgeY);
      ctx.lineTo(gOut.shadowWallX, beamEdgeY);
      ctx.lineTo(gOut.lightBottom.x, gOut.lightBottom.y);
      ctx.closePath();
      ctx.clip();
      ctx.restore();

      /// GEMINI HERE!!!

      // const beamDist = gOut.shadowWallX - gOut.lightTop.x;
      // const radialGrad = ctx.createRadialGradient(gOut.lightTop.x, 0, 0, gOut.lightTop.x, 0, beamDist * 1.5);
      // radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      // radialGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
      // radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      // ctx.fillStyle = radialGrad;
      // ctx.fillRect(gOut.lightTop.x, -beamEdgeY, beamDist, beamEdgeY * 2);

      // model.rings.forEach((ring) => {
      //   if (!ring.geometry)
      //     return;
      //   const g = ring.geometry;
      //   ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      //   ctx.lineWidth = 1 / pxPerCm;
      //   ctx.beginPath();
      //   ctx.moveTo(g.shadowWallX, g.penumbraTopY);
      //   ctx.lineTo(g.shadowWallX, g.penumbraBottomY);
      //   ctx.lineTo(g.penumbraBottomPoint.x, g.penumbraBottomPoint.y);
      //   ctx.lineTo(g.penumbraTopPoint.x, g.penumbraTopPoint.y);
      //   ctx.stroke();
      // });

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 / pxPerCm;
      if (gOut.topRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.lightBottom.x, gOut.lightBottom.y);
        ctx.lineTo(gOut.shadowWallX, gOut.penumbraTopGeoY);
        ctx.stroke();
      }
      if (gOut.bottomRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.lightTop.x, gOut.lightTop.y);
        ctx.lineTo(gOut.shadowWallX, gOut.penumbraBottomGeoY);
        ctx.stroke();
      }
      if (gOut.umbraTopRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.lightTop.x, gOut.lightTop.y);
        ctx.lineTo(gOut.shadowWallX, gOut.umbraTopGeoY);
        ctx.stroke();
      }
      if (gOut.umbraBottomRayActive) {
        ctx.beginPath();
        ctx.moveTo(gOut.lightBottom.x, gOut.lightBottom.y);
        ctx.lineTo(gOut.shadowWallX, gOut.umbraBottomGeoY);
        ctx.stroke();
      }

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 4 / pxPerCm;
      ctx.beginPath();
      ctx.moveTo(gOut.shadowWallX, -height / (2 * pxPerCm));
      ctx.lineTo(gOut.shadowWallX, height / (2 * pxPerCm));
      ctx.stroke();

      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.moveTo(gOut.lightTop.x, gOut.lightTop.y);
      ctx.quadraticCurveTo(gOut.lightTop.x - (size / 2) * 0.7, 0, gOut.lightBottom.x, gOut.lightBottom.y);
      ctx.fill();

      model.rings.forEach((ring) => {
        if (!ring.geometry)
          return;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(ring.geometry.lightTop.x, ring.geometry.lightTop.y);
        ctx.lineTo(ring.geometry.lightBottom.x, ring.geometry.lightBottom.y);
        ctx.stroke();
      });

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.scale(1 / pxPerCm, 1 / pxPerCm);
      ctx.fillStyle = '#000';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Model', 0, 4);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Wall', gOut.shadowWallX * pxPerCm + 10, 5);
      ctx.restore();

      ctx.restore();
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [model, size]);

  return (
    <div className="flex-1 relative h-full w-full">
      <LightFieldRenderer
        modifierSize={size}
        distSubject={dist}
        subjectDiam={40}
        distWall={200}
        beamAngle={beamAngle}
        exposure={exposure}
        distribution={distribution / 100}
        wallOffsetRight={100}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div className="absolute top-6 left-6 pointer-events-none z-10">
        <h1 className="text-2xl font-light tracking-wide text-white drop-shadow-md">Umbra</h1>
        <p className="text-sm text-gray-300 mt-1 drop-shadow-md">Light Modifier Playground</p>
      </div>
    </div>
  );
}
