import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DebouncedTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DebouncedTextInput = React.memo(function DebouncedTextInput({
  value,
  onValueChange,
  placeholder = "",
  className,
  disabled = false
}: DebouncedTextInputProps) {
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

  return (
    <Input
      type="text"
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn("h-8 text-xs", className)}
      disabled={disabled}
    />
  );
});
