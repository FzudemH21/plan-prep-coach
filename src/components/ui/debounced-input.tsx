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
  const isEditing = useRef(false);
  const isComposing = useRef(false);

  // Sync internal value when external value changes (e.g., from fill/copy operations)
  // Only sync if we're not actively editing
  useEffect(() => {
    if (!isEditing.current && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value, internalValue]);

  const commitChange = (newValue: string) => {
    if (newValue !== value) {
      onValueChange(newValue);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    isEditing.current = true;
  };

  const handleBlur = () => {
    if (!isComposing.current) {
      commitChange(internalValue);
      isEditing.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposing.current) {
      commitChange(internalValue);
      isEditing.current = false;
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInternalValue(value);
      isEditing.current = false;
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
  };

  return (
    <Input
      type="text"
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder={placeholder}
      className={cn("h-8 text-xs", className)}
      disabled={disabled}
    />
  );
});
