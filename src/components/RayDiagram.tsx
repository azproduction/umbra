import type { useShadowModel } from '../useShadowModel';
import { useEffect, useRef } from 'react';

type Model = ReturnType<typeof useShadowModel>;

interface Props {
  model: Model
  size: number
}

export function RayDiagram({ model, size }: Props) {
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
  }, [model, size]);

  return (
    <div className="flex-1 relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div className="absolute top-6 left-6 pointer-events-none z-10">
        <h1 className="text-2xl font-light tracking-wide text-white drop-shadow-md">Umbra</h1>
        <p className="text-sm text-gray-300 mt-1 drop-shadow-md">Cosplay Photography Masterclass</p>
      </div>
    </div>
  );
}
