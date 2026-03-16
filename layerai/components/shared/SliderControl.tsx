"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SliderControlProps {
  icon?: LucideIcon;
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function SliderControl({
  icon: Icon,
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "%",
  onChange,
  className,
}: SliderControlProps) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {Icon && <Icon className="w-4 h-4 text-neutral-400 flex-none" strokeWidth={1.5} />}
      {label && <div className="w-[52px] text-xs text-neutral-500 flex-none">{label}</div>}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0])}
        className="flex-1"
      />
      <div className="flex items-center bg-[#1a1a1c] border border-neutral-800 rounded px-2 py-1 w-16">
        <span className="text-sm text-neutral-200 flex-1 text-right">{value}</span>
        <span className="text-xs text-neutral-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}
