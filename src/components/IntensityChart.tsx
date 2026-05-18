import { useEffect, useRef } from 'react';
import { intensityProfileAtSurface } from '../lib/calculateShadowModel.ts';
import { MAX_CONTRAST_STOPS } from '../lib/physics.ts';

interface Props {
  distribution: number
}

const GRID_LINES = 5;

// Fixed vertical scale so the curve's magnitude is honest: a near-uniform
// modifier reads as a flat line, the worst modifier fills the window. The
// window tracks the centre peak so the curve stays in frame, but EV-per-pixel
// is constant. 1 stop = 1 EV, so the window spans the worst-case contrast
// (MAX_CONTRAST_STOPS) plus a little margin.
const WINDOW_EV = MAX_CONTRAST_STOPS + 1;
const PEAK_PAD_EV = 0.5;

export function IntensityChart({ distribution }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas)
      return;
    const ctx = canvas.getContext('2d')!;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h)
      return;

    const dpr = window.devicePixelRatio;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const samples = intensityProfileAtSurface(distribution).filter(s => s.ev > -100);
    if (samples.length < 2)
      return;

    const peak = Math.max(...samples.map(s => s.ev));
    const evTop = peak + PEAK_PAD_EV;
    const evBot = evTop - WINDOW_EV;

    const evToY = (ev: number) => h - ((ev - evBot) / (evTop - evBot)) * h;
    const sampleToX = (x: number) => ((x + 1) / 2) * w;

    // Faint horizontal gridlines behind the curve.
    for (let i = 0; i < GRID_LINES; i++) {
      const y = (i / (GRID_LINES - 1)) * h;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    // Parabola.
    ctx.beginPath();
    samples.forEach((s, i) => {
      const px = sampleToX(s.x);
      const py = evToY(s.ev);
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Fill below the curve.
    const last = samples[samples.length - 1];
    ctx.lineTo(sampleToX(last.x), h);
    ctx.lineTo(sampleToX(samples[0].x), h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    ctx.restore();

    // Five light-meter readings overlaid along the x-axis.
    const readings = intensityProfileAtSurface(distribution, 5);
    ctx.font = '9px monospace';
    ctx.textBaseline = 'bottom';
    readings.forEach((r, i) => {
      const px = sampleToX(r.x);
      const label = r.ev.toFixed(1);
      const align = i === 0 ? 'left' : i === readings.length - 1 ? 'right' : 'center';
      ctx.textAlign = align;
      const tw = ctx.measureText(label).width;
      const bx = align === 'left' ? px : align === 'right' ? px - tw : px - tw / 2;
      ctx.fillStyle = 'rgba(10,10,10,0.6)';
      ctx.beginPath();
      ctx.roundRect(bx - 3, h - 16, tw + 6, 13, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,220,220,0.7)';
      ctx.fillText(label, px, h - 4);
    });
  }, [distribution]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <label className="text-sm text-gray-300">Surface Distribution</label>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">EV, Absolute</span>
      </div>
      <div className="w-full h-24 bg-[#0a0a0a] border border-gray-700 rounded-lg relative overflow-hidden shadow-inner">
        <canvas ref={canvasRef} className="w-full h-full block absolute inset-0" />
      </div>
    </div>
  );
}
