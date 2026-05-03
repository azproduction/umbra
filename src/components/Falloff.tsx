interface FalloffPoint {
  label: string
  dist: number
  ev: number
}

interface Props {
  falloffData: FalloffPoint[]
}

export function Falloff({ falloffData }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end mb-1">
        <label className="text-sm text-gray-300">Light Falloff</label>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">EV, Relative</span>
      </div>
      <div
        className="w-full rounded-lg border border-gray-700 shadow-inner overflow-hidden px-4 py-2"
        style={{ background: 'linear-gradient(to right, #1a1a1a, #0f0f0f)' }}
      >
        <div className="flex justify-between">
          {falloffData.map(pt => (
            <div key={pt.label} className="flex flex-col items-center gap-[6px]">
              <div className="w-px h-2 bg-white/10" />
              <span className="text-[9px] font-bold text-[#888] leading-none">{pt.label}</span>
              <span className="text-[11px] font-bold font-mono text-white leading-none">{pt.ev.toFixed(1)}</span>
              <span className="text-[9px] font-mono text-[#555] leading-none">
                {pt.dist.toFixed(0)}
                cm
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
