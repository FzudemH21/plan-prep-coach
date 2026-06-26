import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUpAZ, ArrowDownZA, Filter } from 'lucide-react';
import { CustomExercise } from '@/hooks/useCustomLibraries';
import { cn } from '@/lib/utils';

interface CustomLibraryColumnFilterProps {
  columnId: string;
  columnName: string;
  exercises: CustomExercise[];
  selectedValues: string[];
  onValueFilterChange: (values: string[]) => void;
  onSortChange: (direction: 'asc' | 'desc' | null) => void;
  sortDirection: 'asc' | 'desc' | null;
}

export function CustomLibraryColumnFilter({
  columnId,
  columnName,
  exercises,
  selectedValues,
  onValueFilterChange,
  onSortChange,
  sortDirection,
}: CustomLibraryColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isActive = selectedValues.length > 0;

  // All unique non-empty values for this column, sorted A-Z
  const allValues = [...new Set(
    exercises.map(ex => ex.data[columnId] || '').filter(Boolean)
  )].sort();

  // Values visible in the list after local search
  const visibleValues = search
    ? allValues.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : allValues;

  const allVisibleSelected = visibleValues.length > 0 && visibleValues.every(v => selectedValues.includes(v));
  const someVisibleSelected = visibleValues.some(v => selectedValues.includes(v));

  const toggleValue = (value: string, checked: boolean) => {
    if (checked) {
      onValueFilterChange([...selectedValues, value]);
    } else {
      onValueFilterChange(selectedValues.filter(v => v !== value));
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      onValueFilterChange([...new Set([...selectedValues, ...visibleValues])]);
    } else {
      onValueFilterChange(selectedValues.filter(v => !visibleValues.includes(v)));
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 px-2 hover:bg-accent', isActive && 'text-primary')}
        >
          <Filter className={cn('h-4 w-4', isActive && 'fill-primary/20')} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* Header */}
        <div className="px-3 py-2.5 border-b">
          <Input
            placeholder={`Search ${columnName.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>

        {/* Sort */}
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Sort Column</span>
          <div className="flex gap-1">
            <Button
              variant={sortDirection === 'asc' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSortChange(sortDirection === 'asc' ? null : 'asc')}
            >
              <ArrowUpAZ className="h-3.5 w-3.5 mr-1" /> A-Z
            </Button>
            <Button
              variant={sortDirection === 'desc' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSortChange(sortDirection === 'desc' ? null : 'desc')}
            >
              <ArrowDownZA className="h-3.5 w-3.5 mr-1" /> Z-A
            </Button>
          </div>
        </div>

        {/* Select All row */}
        {visibleValues.length > 0 && (
          <div className="px-3 py-2 border-b">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(checked) => toggleAll(!!checked)}
                className={cn(!allVisibleSelected && someVisibleSelected && 'data-[state=unchecked]:bg-primary/20')}
              />
              <span className="text-sm font-medium">Select All ({visibleValues.length})</span>
            </label>
          </div>
        )}

        {/* Value list */}
        <div className="max-h-52 overflow-y-auto py-1">
          {visibleValues.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-3 py-3">
              {allValues.length === 0 ? 'No values in this column' : 'No matches'}
            </p>
          ) : (
            visibleValues.map(value => (
              <label key={value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/40 cursor-pointer">
                <Checkbox
                  checked={selectedValues.includes(value)}
                  onCheckedChange={(checked) => toggleValue(value, !!checked)}
                />
                <span className="text-sm truncate">{value}</span>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onValueFilterChange([])}
            disabled={selectedValues.length === 0}
          >
            Clear All
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
