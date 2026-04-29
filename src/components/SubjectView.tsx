import type { calculateShadowModel } from '../lib/calculateShadowModel.ts';
import { CatchlightIndicator } from './CatchlightIndicator';
import { Falloff } from './Falloff';
import { FovVisualizer } from './FovVisualizer';
import { ShadowWidths } from './ShadowWidths';
import { SkinSoftness } from './SkinSoftness';

type Model = ReturnType<typeof calculateShadowModel>;

interface Props {
  model: Model
}

export function SubjectView({ model }: Props) {
  return (
    <div className="space-y-5 mt-2">
      <h2 className="text-lg font-medium text-white">Subject View</h2>
      <CatchlightIndicator rings={model.rings} effectiveAngleDeg={model.effectiveAngleDeg} />
      <FovVisualizer rings={model.rings} />
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
