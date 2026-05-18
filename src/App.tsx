import { useMemo, useState } from 'react';
import { LightSettings } from './components/LightSettings';
import { RayDiagram } from './components/RayDiagram';
import { SubjectView } from './components/SubjectView';
import { calculateShadowModel } from './lib/calculateShadowModel.ts';

export default function App() {
  const [size, setSize] = useState(150);
  const [dist, setDist] = useState(150);
  const [distribution, setDistribution] = useState(100);
  const [beamAngle, setBeamAngle] = useState(180);
  const [iso, onIso] = useState(400);

  const model = useMemo(() => calculateShadowModel(size, dist, distribution, beamAngle), [size, dist, distribution, beamAngle]);

  return (
    <div className="h-screen w-screen bg-[#1a1a1a] text-[#e5e5e5] font-sans flex flex-row overflow-hidden">
      <style>
        {`
                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #fff; cursor: pointer; margin-top: -6px; box-shadow: 0 0 10px rgba(255,255,255,0.5); }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #404040; border-radius: 2px; }
                input[type=range]:focus { outline: none; }
                .glass-panel { background: rgba(30, 30, 30, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); }
            `}
      </style>

      {/* Canvas fills remaining space */}
      <div className="flex-1 relative">
        <RayDiagram
          model={model}
          size={size}
          dist={dist}
          beamAngle={beamAngle}
          distribution={distribution}
          exposure={iso / 10}
        />

        {/* Subject View widgets float over the canvas, no background */}
        <div className="absolute top-4 left-4 w-64 z-10 overflow-y-auto max-h-[calc(100vh-5rem)] pointer-events-none">
          <SubjectView model={model} distribution={distribution} size={size} dist={dist} beamAngle={beamAngle} />
        </div>
      </div>

      {/* Right panel — fixed, same as before */}
      <div className="w-80 glass-panel p-6 flex flex-col gap-6 z-10 shadow-2xl overflow-y-auto">
        <LightSettings
          size={size}
          dist={dist}
          distribution={distribution}
          beamAngle={beamAngle}
          iso={iso}
          onSize={setSize}
          onDist={setDist}
          onDistribution={setDistribution}
          onBeamAngle={setBeamAngle}
          onIso={onIso}
        />
      </div>
    </div>
  );
}
