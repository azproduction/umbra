interface SliderProps {
  label: string
  value: number
  defaultValue: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (value: number) => void
}

export function Slider({ label, value, defaultValue, min, max, unit, step, onChange }: SliderProps) {
  const reset = () => onChange(defaultValue);
  return (
    <div className="space-y-2" onDoubleClick={reset}>
      <div className="flex justify-between">
        <label className="text-sm text-gray-300 cursor-pointer select-none" title="Double-click to reset">{label}</label>
        <span className="text-sm font-mono text-white">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step ?? 1}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
