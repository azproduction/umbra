import { useEffect, useRef } from 'react';
import { intensityProfileAtSurface, SURFACE_UNIFORM_EV } from '../lib/calculateShadowModel.ts';

interface Props {
  distribution: number
  size: number
}

const GRID_LINES = 5;
const READOUT_POINTS = 5;

// Fixed, absolute vertical scale. The worst modifier (0% distribution) is a
// point-light spike: its peak EV sets the top of the scale. Its edges fall away
// to (numerically) -∞, so rather than anchor the floor to a meaningless extreme,
// the scale is mirrored around the uniform-modifier reading — a uniform modifier
// sits mid-chart, and the steep edges of a spiked profile simply clip off the
// bottom. Every curve is drawn against this same range, so a given EV always
// maps to the same height.
const EV_MARGIN = 0.5;
const EV_CEIL = Math.max(...intensityProfileAtSurface(0).map(s => s.ev)) + EV_MARGIN;
const EV_FLOOR = SURFACE_UNIFORM_EV - (EV_CEIL - SURFACE_UNIFORM_EV);

const POSITION_LABELS = ['L Edge', 'L Mid', 'Center', 'R Mid', 'R Edge'];

export function IntensityChart({ distribution, size }: Props) {
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

    const samples = intensityProfileAtSurface(distribution);
    if (samples.length < 2)
      return;

    // Clamp below the floor (a spiked profile's edges run to -∞) so coordinates
    // stay finite; the clip rect then trims the curve at the chart boundary.
    const evToY = (ev: number) => h - ((Math.max(ev, EV_FLOOR - 5) - EV_FLOOR) / (EV_CEIL - EV_FLOOR)) * h;
    const sampleToX = (x: number) => ((x + 1) / 2) * w;

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

    ctx.beginPath();
    samples.forEach((s, i) => {
      const px = sampleToX(s.x);
      const py = evToY(s.ev);
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const last = samples[samples.length - 1];
    ctx.lineTo(sampleToX(last.x), h);
    ctx.lineTo(sampleToX(samples[0].x), h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    ctx.restore();
  }, [distribution]);

  const readings = intensityProfileAtSurface(distribution, READOUT_POINTS);
  const R = size / 2;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <label className="text-sm text-gray-300">Surface Intensity</label>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">EV, Absolute</span>
      </div>
      <div
        className="w-full rounded-lg border border-gray-700 shadow-inner overflow-hidden relative px-4 py-2"
        style={{ background: 'linear-gradient(to right, #1a1a1a, #0f0f0f)' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="relative flex justify-between">
          {readings.map((r, i) => {
            const cmAbs = Math.round(Math.abs(r.x) * R);
            const cmLabel = r.x > 0 ? `+${cmAbs}cm` : r.x < 0 ? `-${cmAbs}cm` : `${cmAbs}cm`;
            const ev = Math.max(r.ev, EV_FLOOR);
            return (
              <div key={POSITION_LABELS[i]} className="flex flex-col items-center gap-[6px]">
                <div className="w-px h-2 bg-white/10" />
                <span className="text-[9px] font-bold text-[#888] leading-none">{POSITION_LABELS[i]}</span>
                <span className="text-[11px] font-bold font-mono text-white leading-none">{ev.toFixed(1)}</span>
                <span className="text-[9px] font-mono text-[#555] leading-none">{cmLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
