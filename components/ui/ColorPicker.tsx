"use client";

import React from "react";
import { COLOR_OPTIONS, ColorKey } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value?: ColorKey;
  onChange: (color: ColorKey) => void;
  options?: typeof COLOR_OPTIONS;
}

export default function ColorPicker({
  value,
  onChange,
  options = COLOR_OPTIONS,
}: ColorPickerProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition",
              selected ? "ring-2 ring-offset-2 ring-primary" : "border-transparent",
              opt.bgClass
            )}
            aria-label={opt.name}
          />
        );
      })}
    </div>
  );
}
