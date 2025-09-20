import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ArrowUpAZ, ArrowDownZA, Filter, Check, X } from 'lucide-react';
import { CustomExercise } from '@/hooks/useCustomLibraries';

interface CustomLibraryColumnFilterProps {
  column: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSortChange: (direction: 'asc' | 'desc' | null) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  exercises: CustomExercise[];
  sortDirection: 'asc' | 'desc' | null;
}

export function CustomLibraryColumnFilter({
  column,
  searchTerm,
  onSearchChange,
  onSortChange,
  selectedIds,
  onSelectionChange,
  exercises,
  sortDirection
}: CustomLibraryColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get unique values for this column
  const columnValues = exercises
    .map(exercise => exercise.data[column] || '')
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

  // Filter exercises based on search term
  const filteredExercises = searchTerm
    ? exercises.filter(exercise => {
        const value = exercise.data[column] || '';
        return value.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : exercises;

  const handleSelectAll = () => {
    const allIds = exercises.map(exercise => exercise.id);
    onSelectionChange(allIds);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const handleSelectFiltered = () => {
    const filteredIds = filteredExercises.map(exercise => exercise.id);
    const newSelection = [...new Set([...selectedIds, ...filteredIds])];
    onSelectionChange(newSelection);
  };

  const handleClearFiltered = () => {
    const filteredIds = filteredExercises.map(exercise => exercise.id);
    const newSelection = selectedIds.filter(id => !filteredIds.includes(id));
    onSelectionChange(newSelection);
  };

  const hasSearchResults = searchTerm && filteredExercises.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 hover:bg-accent"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="space-y-4 p-4">
          {/* Search Section */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Search</h4>
            <Input
              placeholder={`Search ${column.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8"
            />
          </div>

          <Separator />

          {/* Sort Section */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Sort</h4>
            <div className="flex gap-2">
              <Button
                variant={sortDirection === 'asc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSortChange(sortDirection === 'asc' ? null : 'asc')}
                className="flex-1 h-8"
              >
                <ArrowUpAZ className="h-4 w-4 mr-1" />
                A-Z
              </Button>
              <Button
                variant={sortDirection === 'desc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSortChange(sortDirection === 'desc' ? null : 'desc')}
                className="flex-1 h-8"
              >
                <ArrowDownZA className="h-4 w-4 mr-1" />
                Z-A
              </Button>
            </div>
          </div>

          <Separator />

          {/* Selection Section */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Selection</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8"
              >
                <Check className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            {hasSearchResults && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectFiltered}
                  className="h-8 text-xs"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Select Filtered
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFiltered}
                  className="h-8 text-xs"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filtered
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Close Button */}
          <Button
            onClick={() => setIsOpen(false)}
            className="w-full h-8"
            size="sm"
          >
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}