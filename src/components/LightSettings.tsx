import { Slider } from '../Slider';

interface Props {
  size: number
  dist: number
  distribution: number
  beamAngle: number
  onSize: (v: number) => void
  onDist: (v: number) => void
  onDistribution: (v: number) => void
  onBeamAngle: (v: number) => void
}

export function LightSettings({ size, dist, distribution, beamAngle, onSize, onDist, onDistribution, onBeamAngle }: Props) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium text-white">Light Settings</h2>
      <Slider label="Modifier Size" value={size} min={20} max={400} unit="cm" onChange={onSize} />
      <Slider label="Distance to Subject" value={dist} min={50} max={600} unit="cm" onChange={onDist} />
      <Slider label="Surface Distribution" value={distribution} min={0} max={100} unit="%" onChange={onDistribution} />
      <Slider label="Beam Angle (Grid)" value={beamAngle} min={10} max={180} unit="°" onChange={onBeamAngle} />
    </div>
  );
}
