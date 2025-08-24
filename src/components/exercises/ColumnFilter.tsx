import React, { useState, useMemo } from 'react';
import { ExerciseEntry, TableColumn } from '@/types/exercises';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilterProps {
  column: TableColumn;
  allData: ExerciseEntry[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({
  column,
  allData,
  selectedValues,
  onSelectionChange,
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 flex items-center gap-1",
            selectedValues.length > 0 && "bg-accent text-accent-foreground"
          )}
        >
          <Filter className="h-3 w-3" />
          {selectedValues.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b border-border">
          <Input
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
        
        <div className="p-2">
          <div className="flex items-center space-x-2 p-2 hover:bg-accent hover:text-accent-foreground rounded">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              ref={(el) => {
                if (el && 'indeterminate' in el) (el as any).indeterminate = isPartiallySelected;
              }}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Alles auswählen
            </label>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {filteredValues.map((value) => (
              <div
                key={value}
                className="flex items-center space-x-2 p-2 hover:bg-accent hover:text-accent-foreground rounded"
              >
                <Checkbox
                  id={`value-${value}`}
                  checked={selectedValues.includes(value)}
                  onCheckedChange={() => handleValueToggle(value)}
                />
                <label
                  htmlFor={`value-${value}`}
                  className="text-sm cursor-pointer flex-1 truncate"
                  title={value}
                >
                  {value}
                </label>
              </div>
            ))}
          </div>
          
          {filteredValues.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              Keine Werte gefunden
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-border flex justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionChange([])}
            disabled={selectedValues.length === 0}
          >
            Alle entfernen
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Schließen
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};