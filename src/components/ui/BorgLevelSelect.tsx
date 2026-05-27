/**
 * BorgLevelSelect — shadcn Select wrapper for the Borg CR10 intensity scale.
 *
 * Shows all 11 levels (0–10) as options with a color dot + full label.
 * Import and use wherever an intensity dropdown is needed.
 */

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BorgLevel,
  BORG_SCALE,
  getBorgBg,
  getBorgFg,
  getBorgLabelFull,
} from "@/utils/intensityScale";

interface BorgLevelSelectProps {
  value: BorgLevel;
  onChange: (level: BorgLevel) => void;
  disabled?: boolean;
  /** Tailwind class(es) applied to the trigger button */
  className?: string;
  placeholder?: string;
}

export function BorgLevelSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select intensity",
}: BorgLevelSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as BorgLevel)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {/* Inline preview of selected value */}
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0 border border-black/10"
              style={{ backgroundColor: getBorgBg(value) }}
            />
            <span>{getBorgLabelFull(value)}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {BORG_SCALE.map((entry) => (
          <SelectItem key={entry.level} value={entry.level}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: getBorgBg(entry.level) }}
              />
              <span>{getBorgLabelFull(entry.level)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
