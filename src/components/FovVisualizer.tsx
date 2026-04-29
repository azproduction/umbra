import type { Ring } from '../geometry';
import { useLayoutEffect, useRef, useState } from 'react';

interface Props {
  rings: Ring[]
}

export function FovVisualizer({ rings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(270);

  useLayoutEffect(() => {
    if (containerRef.current)
      setContainerWidth(containerRef.current.clientWidth);
    const handleResize = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.clientWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pixelsPerDegree = containerWidth / 180;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <label className="text-sm text-gray-300">Subject Field of View</label>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">180&deg; H / 140&deg; V</span>
      </div>
      <div ref={containerRef} className="w-full h-24 bg-[#0a0a0a] border border-gray-700 rounded-lg relative overflow-hidden flex items-center justify-center shadow-inner">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: 'center center' }}></div>
        {rings.map(r => (
          <div
            key={r.ringIndex}
            className="bg-white absolute rounded-full mix-blend-screen"
            style={{ width: `${Math.max(2, r.angleDegrees * pixelsPerDegree)}px`, height: `${Math.max(2, r.angleDegrees * pixelsPerDegree)}px`, opacity: 0.20 }}
          />
        ))}
      </div>
    </div>
  );
}
