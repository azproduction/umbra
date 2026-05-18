import type { calculateShadowModel } from '../lib/calculateShadowModel.ts';
import { CatchlightIndicator } from './CatchlightIndicator';
import { Falloff } from './Falloff';
import { FovVisualizer } from './FovVisualizer';
import { IntensityChart } from './IntensityChart';
import { ShadowWidths } from './ShadowWidths';
import { SkinSoftness } from './SkinSoftness';

type Model = ReturnType<typeof calculateShadowModel>;

interface Props {
  model: Model
  distribution: number
  size: number
  dist: number
  beamAngle: number
}

export function SubjectView({ model, distribution, size, dist, beamAngle }: Props) {
  return (
    <div className="space-y-5 mt-2">
      <CatchlightIndicator rings={model.rings} effectiveAngleDeg={model.effectiveAngleDeg} distribution={distribution} />
      <FovVisualizer rings={model.rings} distribution={distribution} />
      <IntensityChart size={size} dist={dist} distribution={distribution} beamAngle={beamAngle} />
      <SkinSoftness effectiveFovRatio={model.effectiveFovRatio} textureDesc={model.textureDesc} />
      <ShadowWidths
        rings={model.rings}
        outerRing={model.outerRing}
        effectiveLeftW={model.effectiveLeftW}
        effectiveCoreW={model.effectiveCoreW}
        effectiveRightW={model.effectiveRightW}
        dominantIsAntumbra={model.dominantIsAntumbra}
      />
      <Falloff falloffData={model.falloffData} />
    </div>
  );
}
