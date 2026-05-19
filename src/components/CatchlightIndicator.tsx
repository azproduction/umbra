import type { Ring } from '../lib/geometry.ts';

interface Props {
  rings: Ring[]
  effectiveAngleDeg: number
}

export function CatchlightIndicator({ rings, effectiveAngleDeg }: Props) {
  const weights = rings.map(r => r.perceptualWeight);
  const maxWeight = Math.max(...weights, 1e-6);

  return (
    <div className="flex items-center gap-4">
      <div className="w-16 h-16 rounded-full bg-black relative overflow-hidden border-2 border-gray-800 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0">
        <div className="w-10 h-10 rounded-full bg-blue-900 absolute flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
          <div className="w-4 h-4 rounded-full bg-black absolute"></div>
        </div>
        {rings.map((r, i) => {
          const size = Math.max(4, r.fovRatio * 40);
          return (
            <div
              key={r.ringIndex}
              className="absolute bg-white rounded-full mix-blend-screen"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top: `${20 - size / 2}px`,
                left: `${44 - size / 2}px`,
                opacity: (weights[i] / maxWeight) * 0.55,
                transform: 'rotate(45deg)',
              }}
            />
          );
        })}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-300">Catchlight Size</p>
        <p className="text-xs text-gray-500 font-mono">
          {effectiveAngleDeg.toFixed(1)}
          ° (Avg FOV)
        </p>
      </div>
    </div>
  );
}
