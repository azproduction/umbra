import { Slider } from './Slider.tsx';

interface Props {
  size: number
  dist: number
  distribution: number
  beamAngle: number
  iso: number
  onSize: (v: number) => void
  onDist: (v: number) => void
  onDistribution: (v: number) => void
  onBeamAngle: (v: number) => void
  onIso: (v: number) => void
}

export function LightSettings({ size, dist, distribution, beamAngle, iso, onSize, onDist, onDistribution, onBeamAngle, onIso }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium text-white">Light Settings</h2>
      <Slider label="Modifier Size" value={size} min={20} step={10} max={400} unit="cm" onChange={onSize} />
      <Slider label="Distance to Subject" value={dist} min={50} step={5} max={600} unit="cm" onChange={onDist} />
      <Slider label="Surface Distribution" value={distribution} min={0} max={100} unit="%" onChange={onDistribution} />
      <Slider label="Beam Angle (Grid)" value={beamAngle} min={10} step={5} max={180} unit="°" onChange={onBeamAngle} />
      <Slider label="Gain" value={iso} min={0} max={6400} step={100} unit=" ISO" onChange={onIso} />
    </div>
  );
}
