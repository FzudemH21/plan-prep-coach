import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface MethodParameter {
  name: string;
  type: 'number' | 'text' | 'select';
  unit?: string;
  options?: string[];
  defaultValue?: string | number;
}

interface ParameterInputFieldProps {
  parameter: MethodParameter;
  value: string | number;
  unit?: string;
  onValueChange: (value: string | number) => void;
  onUnitChange?: (unit: string) => void;
  showLabel?: boolean;
}

export function ParameterInputField({
  parameter,
  value,
  unit,
  onValueChange,
  onUnitChange,
  showLabel = true
}: ParameterInputFieldProps) {
  if (parameter.type === 'select' && parameter.options) {
    return (
      <div className="space-y-1">
        {showLabel && <Label className="text-xs text-muted-foreground">{parameter.name}</Label>}
        <Select value={String(value)} onValueChange={onValueChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {parameter.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {showLabel && <Label className="text-xs text-muted-foreground">{parameter.name}</Label>}
      <div className="flex gap-2">
        <Input
          type={parameter.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onValueChange(parameter.type === 'number' ? Number(e.target.value) : e.target.value)}
          className="h-8"
        />
        {parameter.unit && (
          <div className="flex items-center px-2 text-sm text-muted-foreground">
            {parameter.unit}
          </div>
        )}
      </div>
    </div>
  );
}
