import { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FlatAthleticismRow } from '@/types/athleticism';

interface AthleticismColumnFilterProps {
  columnKey: keyof FlatAthleticismRow;
  columnLabel: string;
  allData: FlatAthleticismRow[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

export function AthleticismColumnFilter({ 
  columnKey, 
  columnLabel, 
  allData, 
  selectedValues, 
  onSelectionChange 
}: AthleticismColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const uniqueValues = useMemo(() => {
    const values = allData.map(item => {
      const value = item[columnKey];
      if (columnKey === 'loadingRecommendations') {
        // For loading recommendations, extract meaningful text
        if (typeof value === 'object' && value !== null) {
          const params = Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
          return params || 'No recommendations';
        }
        return 'No recommendations';
      }
      return String(value || '');
    }).filter(value => value.trim() !== '');
    
    return [...new Set(values)].sort();
  }, [allData, columnKey]);

  const filteredValues = useMemo(
    () => uniqueValues.filter(value =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [uniqueValues, searchTerm]
  );

  const handleSelectAll = () => {
    if (selectedValues.length === uniqueValues.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(uniqueValues);
    }
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
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm mb-2">Filter {columnLabel}</h4>
          <Input
            placeholder={`Search ${columnLabel.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="p-3 border-b">
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
}