import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Settings2, X } from 'lucide-react';

export interface MesocycleOption {
  id: string;
  name: string;
  isAllocated: boolean;
}

interface ParameterFillControlProps {
  methodName: string;
  parameterName: string;
  parameterType: 'quantitative' | 'qualitative';
  parameterOptions?: string[];
  parameterUnits?: string[];
  mesocycles?: MesocycleOption[];
  onFillRow: (
    value: string | number, 
    unit?: string,
    selectedMesocycleIds?: string[],
    fillEmptyOnly?: boolean
  ) => void;
  disabled?: boolean;
}

export function ParameterFillControl({
  methodName,
  parameterName,
  parameterType,
  parameterOptions = [],
  parameterUnits = [],
  mesocycles = [],
  onFillRow,
  disabled = false
}: ParameterFillControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fillValue, setFillValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(parameterUnits[0] || '');
  
  // Get allocated mesocycles
  const allocatedMesocycles = useMemo(() => 
    mesocycles.filter(m => m.isAllocated), 
    [mesocycles]
  );
  
  // Default: all allocated mesocycles selected
  const [selectedMesocycleIds, setSelectedMesocycleIds] = useState<Set<string>>(
    new Set(allocatedMesocycles.map(m => m.id))
  );

  // Reset selections when popover opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setFillValue('');
      setSelectedUnit(parameterUnits[0] || '');
      setSelectedMesocycleIds(new Set(allocatedMesocycles.map(m => m.id)));
    }
  };

  const handleDropdownChange = (value: string | string[]) => {
    const stringValue = Array.isArray(value) ? value[0] || '' : value;
    setFillValue(stringValue);
  };

  const toggleMesocycle = (mesoId: string) => {
    setSelectedMesocycleIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mesoId)) {
        newSet.delete(mesoId);
      } else {
        newSet.add(mesoId);
      }
      return newSet;
    });
  };

  const selectAllMesocycles = () => {
    setSelectedMesocycleIds(new Set(allocatedMesocycles.map(m => m.id)));
  };

  const clearAllMesocycles = () => {
    setSelectedMesocycleIds(new Set());
  };

  const handleFill = (fillEmptyOnly: boolean) => {
    if (!fillValue.trim() || selectedMesocycleIds.size === 0) return;
    
    const value = parameterType === 'quantitative' ? 
      (isNaN(Number(fillValue)) ? fillValue : Number(fillValue)) : 
      fillValue;
    
    const unit = parameterType === 'quantitative' && parameterUnits.length > 0 
      ? selectedUnit 
      : undefined;
    
    onFillRow(value, unit, Array.from(selectedMesocycleIds), fillEmptyOnly);
    setIsOpen(false);
    setFillValue('');
  };

  const handleClear = () => {
    if (selectedMesocycleIds.size === 0) return;
    // Pass empty string to clear values (unit remains as is)
    onFillRow('', undefined, Array.from(selectedMesocycleIds), false);
    setIsOpen(false);
  };

  if (disabled) {
    return null;
  }

  const hasUnits = parameterType === 'quantitative' && parameterUnits.length > 0;
  const canFill = fillValue.trim() && selectedMesocycleIds.size > 0;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
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
      <PopoverContent className="w-80 z-[200] bg-popover" align="start" side="right">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Fill Parameter Values</h4>
            <p className="text-xs text-muted-foreground">
              {methodName} → {parameterName}
            </p>
          </div>
          
          {/* Value Input with optional Unit */}
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
              <div className="flex gap-2">
                <Input
                  id="fill-value"
                  type="number"
                  value={fillValue}
                  onChange={(e) => setFillValue(e.target.value)}
                  placeholder="Enter number"
                  className={`h-8 text-xs ${hasUnits ? 'flex-1' : 'w-full'}`}
                />
                {hasUnits && (
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="w-20 h-8 text-xs">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent className="z-[250] bg-popover">
                      {parameterUnits.map((unit) => (
                        <SelectItem key={unit} value={unit} className="text-xs">
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Mesocycle Selection */}
          {allocatedMesocycles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Apply to Mesocycles</Label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllMesocycles}
                    className="h-6 px-2 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllMesocycles}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allocatedMesocycles.map((meso) => (
                  <div
                    key={meso.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleMesocycle(meso.id)}
                  >
                    <Checkbox
                      checked={selectedMesocycleIds.has(meso.id)}
                      onCheckedChange={() => toggleMesocycle(meso.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs truncate">{meso.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={selectedMesocycleIds.size === 0}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Selected
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleFill(false)}
              disabled={!canFill}
              className="h-8 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Fill Selected
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
