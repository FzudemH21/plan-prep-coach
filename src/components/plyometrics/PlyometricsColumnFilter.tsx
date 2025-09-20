import React, { useState, useMemo } from 'react';
import { PlyometricsEntry, PlyometricsTableColumn } from '@/types/plyometrics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlyometricsColumnFilterProps {
  column: PlyometricsTableColumn;
  allData: PlyometricsEntry[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  onSortChange?: (columnKey: string, direction: 'asc' | 'desc') => void;
}

export const PlyometricsColumnFilter: React.FC<PlyometricsColumnFilterProps> = ({
  column,
  allData,
  selectedValues,
  onSelectionChange,
  onSortChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract unique values for this column
  const uniqueValues = useMemo(() => {
    const values = allData
      .map(item => item[column.key])
      .filter(value => value && value.trim() !== '')
      .map(value => value.trim());
    
    const unique = Array.from(new Set(values)).sort((a, b) => 
      a.localeCompare(b, 'de', { sensitivity: 'base' })
    );
    
    return unique;
  }, [allData, column.key]);

  // Filter values based on search term
  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(value => 
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm]);

  const handleSelectFiltered = () => {
    const newSelected = [...new Set([...selectedValues, ...filteredValues])];
    onSelectionChange(newSelected);
  };

  const handleClearFiltered = () => {
    const newSelected = selectedValues.filter(v => !filteredValues.includes(v));
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === uniqueValues.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...uniqueValues]);
    }
  };

  const handleValueToggle = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onSelectionChange(newSelection);
  };

  const isAllSelected = selectedValues.length === uniqueValues.length;
  const isPartiallySelected = selectedValues.length > 0 && selectedValues.length < uniqueValues.length;
  const filteredSelectedCount = filteredValues.filter(v => selectedValues.includes(v)).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-normal hover:bg-muted"
        >
          <Filter className="h-3 w-3 mr-1" />
          {selectedValues.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
              {selectedValues.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm mb-2">Filter {column.label}</h4>
          <Input
            placeholder={`Search ${column.label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Column Sort */}
        {onSortChange && (
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sort Column</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => onSortChange!(column.key as string, 'asc')}
                >
                  <ArrowUpAZ className="h-3 w-3 mr-1" />
                  A-Z
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => onSortChange!(column.key as string, 'desc')}
                >
                  <ArrowDownZA className="h-3 w-3 mr-1" />
                  Z-A
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Selection Controls */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              ref={(el) => {
                if (el && 'indeterminate' in el) {
                  (el as any).indeterminate = isPartiallySelected;
                }
              }}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All ({uniqueValues.length})
            </label>
          </div>
          {filteredValues.length < uniqueValues.length && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleSelectFiltered}
                disabled={filteredSelectedCount === filteredValues.length}
              >
                Select Filtered ({filteredValues.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleClearFiltered}
                disabled={filteredSelectedCount === 0}
              >
                Clear Filtered
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="h-64">
          <div className="p-3 space-y-2">
            {filteredValues.map((value) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={`filter-${value}`}
                  checked={selectedValues.includes(value)}
                  onCheckedChange={() => handleValueToggle(value)}
                />
                <label
                  htmlFor={`filter-${value}`}
                  className="text-sm cursor-pointer flex-1 truncate"
                  title={value}
                >
                  {value}
                </label>
              </div>
            ))}
            {filteredValues.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No matches found
              </p>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={selectedValues.length === 0}
          >
            Clear All
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};