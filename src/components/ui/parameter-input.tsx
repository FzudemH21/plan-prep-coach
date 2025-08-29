import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';

interface QuantitativeParameterInputProps {
  value: string;
  onValueChange: (value: string) => void;
  unit?: string;
  onUnitChange?: (unit: string) => void;
  units: string[];
  placeholder?: string;
}

export function QuantitativeParameterInput({
  value,
  onValueChange,
  unit,
  onUnitChange,
  units,
  placeholder = "Enter value"
}: QuantitativeParameterInputProps) {
  // Check if there are any units defined (empty array means no unit dropdown)
  const hasMeaningfulUnits = units.length > 0;

  return (
    <div className="flex gap-1 items-center w-full">
      <Input
        type="number"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        className={hasMeaningfulUnits ? "flex-1 min-w-0" : "w-full"}
      />
      {hasMeaningfulUnits && (
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger className="w-20 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-background border">
            {units.map((unitOption) => (
              <SelectItem key={unitOption} value={unitOption}>
                {unitOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

interface QualitativeParameterInputProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function QualitativeParameterInput({
  value,
  onValueChange,
  options,
  placeholder = "Select or type..."
}: QualitativeParameterInputProps) {
  return (
    <SearchableDropdown
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      allowCustomInput={true}
      className="w-full"
    />
  );
}