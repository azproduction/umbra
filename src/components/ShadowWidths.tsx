import type { Ring } from '../geometry';
import { useEffect, useRef } from 'react';

interface Props {
  rings: Ring[]
  outerRing: Ring | undefined
  effectiveLeftW: number
  effectiveCoreW: number
  effectiveRightW: number
  dominantIsAntumbra: boolean
}

export function ShadowWidths({ rings, outerRing, effectiveLeftW, effectiveCoreW, effectiveRightW, dominantIsAntumbra }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;
    const gOut = outerRing?.geometry;
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
      const center = (gOut.penumbraBottomY + gOut.penumbraTopY) / 2;
      const spread = Math.abs(gOut.penumbraBottomY - gOut.penumbraTopY);
      const scale = w / (Math.max(spread, 100) * 1.1);
      rings.forEach((ring) => {
        const g = ring.geometry;
        if (!g)
          return;
        const p1 = (g.penumbraTopY - center) * scale + w / 2;
        const p4 = (g.penumbraBottomY - center) * scale + w / 2;
        const u1 = (g.umbraTopY - center) * scale + w / 2;
        const u2 = (g.umbraBottomY - center) * scale + w / 2;
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
  }, [rings, outerRing]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <label className="text-sm text-gray-300">Wall Shadow Widths</label>
      </div>
      <div className="w-full bg-[#111] rounded-lg border border-gray-700 p-3 shadow-inner">
        <canvas ref={canvasRef} className="w-full h-8 rounded mb-2 border border-gray-800 bg-[#0a0a0a]" />
        <div className="flex text-center text-xs">
          <div className="flex-1 flex flex-col items-start border-r border-gray-800 pr-1">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Edge Left</span>
            <span className="font-mono text-gray-300">
              {effectiveLeftW.toFixed(0)}
              cm
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center border-r border-gray-800 px-1">
            <span className={`text-[9px] uppercase tracking-wider ${dominantIsAntumbra ? 'text-blue-400' : 'text-white'}`}>
              {dominantIsAntumbra ? 'Antumbra' : 'Umbra'}
            </span>
            <span className={`font-mono ${dominantIsAntumbra ? 'text-blue-400' : 'text-white'}`}>
              {effectiveCoreW.toFixed(0)}
              cm
            </span>
          </div>
          <div className="flex-1 flex flex-col items-end pl-1">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Edge Right</span>
            <span className="font-mono text-gray-300">
              {effectiveRightW.toFixed(0)}
              cm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
