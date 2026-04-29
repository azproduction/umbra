import { useEffect, useRef } from 'react';

interface FalloffPoint {
  label: string
  dist: number
  ev: number
}

interface Props {
  falloffData: FalloffPoint[]
}

export function Falloff({ falloffData }: Props) {
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

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#1a1a1a');
      grad.addColorStop(1, '#050505');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = 'center';
      falloffData.forEach((pt, i) => {
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

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [falloffData]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <label className="text-sm text-gray-300">Light Falloff (Relative)</label>
      </div>
      <div className="w-full bg-[#111] rounded-lg border border-gray-700 shadow-inner overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-20 bg-[#0a0a0a] block" />
      </div>
    </div>
  );
}
