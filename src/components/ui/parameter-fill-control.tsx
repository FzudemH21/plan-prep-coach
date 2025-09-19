import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { Copy, Layers, Settings2 } from 'lucide-react';

interface ParameterFillControlProps {
  methodName: string;
  parameterName: string;
  parameterType: 'quantitative' | 'qualitative';
  parameterOptions?: string[];
  onFillRow: (value: string | number, allMesocycles?: boolean, fillEmptyOnly?: boolean) => void;
  disabled?: boolean;
}

export function ParameterFillControl({
  methodName,
  parameterName,
  parameterType,
  parameterOptions = [],
  onFillRow,
  disabled = false
}: ParameterFillControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fillValue, setFillValue] = useState('');

  const handleDropdownChange = (value: string | string[]) => {
    // Handle single selection for our use case
    const stringValue = Array.isArray(value) ? value[0] || '' : value;
    setFillValue(stringValue);
  };

  const handleFill = (allMesocycles: boolean, fillEmptyOnly: boolean) => {
    if (!fillValue.trim()) return;
    
    const value = parameterType === 'quantitative' ? 
      (isNaN(Number(fillValue)) ? fillValue : Number(fillValue)) : 
      fillValue;
    
    onFillRow(value, allMesocycles, fillEmptyOnly);
    setIsOpen(false);
    setFillValue('');
  };

  if (disabled) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
          title={`Fill ${parameterName} values`}
        >
          <Settings2 className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 z-[200]" align="start" side="right">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Fill Parameter Values</h4>
            <p className="text-xs text-muted-foreground">
              {methodName} → {parameterName}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fill-value" className="text-xs">
              Value to fill
            </Label>
            {parameterType === 'qualitative' ? (
              <SearchableDropdown
                value={fillValue}
                onValueChange={handleDropdownChange}
                options={parameterOptions}
                placeholder="Select option or type..."
                className="h-8 text-xs"
                allowCustomInput={true}
              />
            ) : (
              <Input
                id="fill-value"
                type="number"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                placeholder="Enter number"
                className="h-8 text-xs"
              />
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFill(false, false)}
                disabled={!fillValue.trim()}
                className="h-8 text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                Fill Row
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFill(false, true)}
                disabled={!fillValue.trim()}
                className="h-8 text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                Empty Only
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFill(true, false)}
                disabled={!fillValue.trim()}
                className="h-8 text-xs"
              >
                <Layers className="h-3 w-3 mr-1" />
                All Mesocycles
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFill(true, true)}
                disabled={!fillValue.trim()}
                className="h-8 text-xs"
              >
                <Layers className="h-3 w-3 mr-1" />
                All (Empty Only)
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}