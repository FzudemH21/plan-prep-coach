import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { cn } from '@/lib/utils';

interface QuantitativeParameterInputProps {
  value: string;
  onValueChange: (value: string) => void;
  unit?: string;
  onUnitChange?: (unit: string) => void;
  units: string[];
  placeholder?: string;
  cellId?: string;
  onDragStart?: (cellId: string, value: string | number) => void;
  onDragEnd?: () => void;
  isDragSource?: boolean;
  isInDragSelection?: boolean;
  isEnabled?: boolean;
}

export const QuantitativeParameterInput = React.memo(function QuantitativeParameterInput({
  value,
  onValueChange,
  unit,
  onUnitChange,
  units,
  placeholder = "Enter value",
  cellId,
  onDragStart,
  onDragEnd,
  isDragSource = false,
  isInDragSelection = false,
  isEnabled = true
}: QuantitativeParameterInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync internal value when external value changes (e.g., from fill/copy operations)
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  const commitChange = (newValue: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onValueChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced timer
    debounceTimerRef.current = window.setTimeout(() => {
      onValueChange(newValue);
    }, 150);
  };

  const handleBlur = () => {
    // Immediately commit on blur
    commitChange(internalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediately commit on Enter
      commitChange(internalValue);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (cellId && onDragStart) {
      onDragStart(cellId, parseFloat(internalValue) || 0);
    }
  };

  const handleDragEnd = (e: React.MouseEvent) => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  // Check if there are any units defined (empty array means no unit dropdown)
  const hasMeaningfulUnits = units.length > 0;

  return (
    <div 
      className={cn(
        "flex gap-1 items-center w-full relative",
        isDragSource && "ring-2 ring-primary bg-primary/10",
        isInDragSelection && "bg-primary/20 ring-1 ring-primary"
      )}
      data-drag-cell={cellId}
      data-allocated={isEnabled ? 'true' : 'false'}
    >
      <Input
        type="number"
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          hasMeaningfulUnits ? "flex-1 min-w-0 h-8 text-xs" : "w-full h-8 text-xs",
          isDragSource && "ring-1 ring-primary",
          isInDragSelection && "bg-primary/10"
        )}
      />
      {hasMeaningfulUnits && (
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger className="w-16 min-w-0 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50 bg-background border">
            {units.map((unitOption) => (
              <SelectItem key={unitOption} value={unitOption} className="text-xs">
                {unitOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
});

interface QualitativeParameterInputProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  cellId?: string;
  onDragStart?: (cellId: string, value: string | number) => void;
  onDragEnd?: () => void;
  isDragSource?: boolean;
  isInDragSelection?: boolean;
  isEnabled?: boolean;
}

export const QualitativeParameterInput = React.memo(function QualitativeParameterInput({
  value,
  onValueChange,
  options,
  placeholder = "Select or type...",
  cellId,
  onDragStart,
  onDragEnd,
  isDragSource = false,
  isInDragSelection = false,
  isEnabled = true
}: QualitativeParameterInputProps) {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync internal value when external value changes (e.g., from fill/copy operations)
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  const commitChange = (newValue: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onValueChange(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced timer
    debounceTimerRef.current = window.setTimeout(() => {
      onValueChange(newValue);
    }, 150);
  };

  const handleBlur = () => {
    // Immediately commit on blur
    commitChange(internalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Immediately commit on Enter
      commitChange(internalValue);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (cellId && onDragStart) {
      onDragStart(cellId, internalValue);
    }
  };

  const handleDragEnd = (e: React.MouseEvent) => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  // Check if there are any options defined (empty array means plain text input)
  const hasMeaningfulOptions = options.length > 0;

  return (
    <div 
      className={cn(
        "relative w-full",
        isDragSource && "ring-2 ring-primary bg-primary/10",
        isInDragSelection && "bg-primary/20 ring-1 ring-primary"
      )}
      data-drag-cell={cellId}
      data-allocated={isEnabled ? 'true' : 'false'}
    >
      {hasMeaningfulOptions ? (
        <SearchableDropdown
          value={value}
          onValueChange={onValueChange}
          options={options}
          placeholder={placeholder}
          allowCustomInput={true}
          className={cn(
            "w-full h-8 text-xs",
            isDragSource && "ring-1 ring-primary",
            isInDragSelection && "bg-primary/10"
          )}
        />
      ) : (
        <Input
          type="text"
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full h-8 text-xs",
            isDragSource && "ring-1 ring-primary",
            isInDragSelection && "bg-primary/10"
          )}
        />
      )}
    </div>
  );
});