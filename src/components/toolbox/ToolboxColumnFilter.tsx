import { useState, useMemo } from 'react';
import { Filter, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SubCategoryData {
  category: string;
  subCategory: string;
  parameters: any[];
  key: string;
}

interface ToolboxColumnFilterProps {
  columnKey: 'category' | 'subCategory';
  columnLabel: string;
  allData: SubCategoryData[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  onSortChange?: (columnKey: 'category' | 'subCategory', direction: 'asc' | 'desc') => void;
}

export function ToolboxColumnFilter({ 
  columnKey, 
  columnLabel, 
  allData, 
  selectedValues, 
  onSelectionChange,
  onSortChange 
}: ToolboxColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const uniqueValues = useMemo(() => {
    const values = allData.map(item => {
      const value = item[columnKey];
      return String(value || '');
    }).filter(value => value.trim() !== '');
    
    return [...new Set(values)].sort();
  }, [allData, columnKey]);

  const processedValues = useMemo(() => {
    let filtered = uniqueValues;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(value =>
        value.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [uniqueValues, searchTerm]);

  const handleSelectAll = () => {
    if (selectedValues.length === uniqueValues.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(uniqueValues);
    }
  };

  const handleSelectFiltered = () => {
    const newSelected = [...new Set([...selectedValues, ...processedValues])];
    onSelectionChange(newSelected);
  };

  const handleClearFiltered = () => {
    const newSelected = selectedValues.filter(v => !processedValues.includes(v));
    onSelectionChange(newSelected);
  };

  const handleValueToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const isAllSelected = selectedValues.length === uniqueValues.length;
  const isPartiallySelected = selectedValues.length > 0 && selectedValues.length < uniqueValues.length;
  const filteredSelectedCount = processedValues.filter(v => selectedValues.includes(v)).length;

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
          <h4 className="font-medium text-sm mb-2">Filter {columnLabel}</h4>
          <Input
            placeholder={`Search ${columnLabel.toLowerCase()}...`}
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
                  onClick={() => onSortChange(columnKey, 'asc')}
                >
                  <ArrowUpAZ className="h-3 w-3 mr-1" />
                  A-Z
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => onSortChange(columnKey, 'desc')}
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
          {processedValues.length < uniqueValues.length && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleSelectFiltered}
                disabled={filteredSelectedCount === processedValues.length}
              >
                Select Filtered ({processedValues.length})
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
            {processedValues.map((value) => (
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
            {processedValues.length === 0 && (
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
}