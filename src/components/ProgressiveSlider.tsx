import React from 'react';

interface ProgressiveSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  valueFormatter?: (val: number) => string;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
}

export const ProgressiveSlider: React.FC<ProgressiveSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  valueFormatter,
  onChange,
  disabled = false,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const displayString = valueFormatter ? valueFormatter(value) : `${value} ${unit}`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
        <span>{label}</span>
        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 tabular-nums">
          {displayString}
        </span>
      </div>
      <div className="relative flex items-center w-full">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="progressive-slider w-full h-2 rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, #059669 0%, #059669 ${percentage}%, #d1fae5 ${percentage}%, #d1fae5 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
};
