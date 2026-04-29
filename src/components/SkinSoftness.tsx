import { useEffect, useRef } from 'react';

interface Props {
  effectiveFovRatio: number
  textureDesc: string
}

export function SkinSoftness({ effectiveFovRatio, textureDesc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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
      const amp = Math.max(0.15, 1 - (effectiveFovRatio * 3.5));
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
      const sOp = Math.max(0, 0.8 - (effectiveFovRatio * 3.0));
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
      const hOp = Math.max(0, 0.6 - (effectiveFovRatio * 2.0));
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
      const glow = 0.1 + (effectiveFovRatio * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, pts[0]);
      pts.forEach((y, x) => ctx.lineTo(x, y));
      ctx.strokeStyle = `rgba(255, 255, 255, ${glow})`;
      ctx.lineWidth = 1 + effectiveFovRatio;
      ctx.stroke();
    };
    draw();
  }, [effectiveFovRatio]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <label className="text-sm text-gray-300">Perceived Skin Softness</label>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{textureDesc}</span>
      </div>
      <div className="w-full h-24 bg-[#111] rounded-lg relative overflow-hidden shadow-inner border border-gray-700">
        <canvas ref={canvasRef} className="w-full h-full block absolute inset-0" />
      </div>
    </div>
  );
}
