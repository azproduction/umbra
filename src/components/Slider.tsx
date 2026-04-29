interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, unit, onChange }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <label className="text-sm text-gray-300">{label}</label>
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
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
