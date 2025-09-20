import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ChevronUp, ChevronDown, X, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExerciseSelection } from '@/types/microcycle-planning';
import { FilterState } from '@/types/exercises';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { NewExerciseDialog } from './NewExerciseDialog';

// Simple column filter component for the popup
interface PopupColumnFilterProps {
  columnKey: string;
  columnLabel: string;
  allData: any[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

const PopupColumnFilter: React.FC<PopupColumnFilterProps> = ({
  columnKey,
  columnLabel,
  allData,
  selectedValues,
  onSelectionChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const uniqueValues = useMemo(() => {
    const values = allData
      .map(item => item[columnKey])
      .filter(value => value != null && value !== '')
      .map(value => String(value));
    
    return Array.from(new Set(values)).sort();
  }, [allData, columnKey]);

  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter(value =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm]);

  const handleSelectFiltered = () => {
    const newSelection = Array.from(new Set([...selectedValues, ...filteredValues]));
    onSelectionChange(newSelection);
  };

  const handleClearFiltered = () => {
    const filteredSet = new Set(filteredValues);
    const newSelection = selectedValues.filter(value => !filteredSet.has(value));
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    onSelectionChange([...uniqueValues]);
  };

  const handleValueToggle = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const hasActiveFilters = selectedValues.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${hasActiveFilters ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <Input
            placeholder={`Search ${columnLabel.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
          
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectFiltered}
              className="h-6 text-xs"
            >
              Select Filtered
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFiltered}
              className="h-6 text-xs"
            >
              Clear Filtered
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 text-xs"
            >
              Select All
            </Button>
          </div>

          <ScrollArea className="h-48">
            <div className="space-y-1">
              {filteredValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                >
                  <Checkbox
                    checked={selectedValues.includes(value)}
                    onCheckedChange={() => handleValueToggle(value)}
                  />
                  <span className="text-sm">{value}</span>
                </label>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectionChange([])}
              className="h-6 text-xs"
            >
              Clear All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Define a more flexible column type for the popup
interface PopupTableColumn {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiline';
  options?: string[];
}

interface ExerciseLibraryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercises: (exercises: ExerciseSelection[]) => void;
  selectedExerciseIds: string[];
  onExerciseCreated: (exercise: ExerciseSelection) => void;
}

export function ExerciseLibraryPopup({ 
  isOpen, 
  onClose, 
  onSelectExercises, 
  selectedExerciseIds,
  onExerciseCreated 
}: ExerciseLibraryPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('resistance-training');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    columnFilters: {},
    sortColumn: null,
    sortDirection: 'asc'
  });
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isNewExerciseDialogOpen, setIsNewExerciseDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

  // Data hooks - only use CustomLibrariesContext
  const { libraries: allLibrariesData } = useCustomLibraries();

  // Prepare all available libraries with their data
  const allLibraries = useMemo(() => {
    return allLibrariesData.map(lib => ({
      id: lib.id,
      name: lib.name,
      exerciseCount: lib.exercises.length
    }));
  }, [allLibrariesData]);

  // Prepare library data for the current tab
  const libraryData = useMemo(() => {
    const library = allLibrariesData.find(lib => lib.id === activeTab);
    if (library) {
      return library.exercises.map(exercise => ({
        id: exercise.id,
        library: library.id,
        ...exercise.data
      }));
    }
    return [];
  }, [activeTab, allLibrariesData]);

  // Get column definitions for the current library
  const getColumnsForLibrary = useCallback((libraryId: string): PopupTableColumn[] => {
    const library = allLibrariesData.find(lib => lib.id === libraryId);
    if (library) {
      return library.columns.map(col => ({
        key: col.id,
        label: col.name,
        type: col.type as 'text' | 'select',
        options: col.options
      }));
    }
    return [];
  }, [allLibrariesData]);

  const currentColumns = useMemo(() => getColumnsForLibrary(activeTab), [activeTab, getColumnsForLibrary]);

  // Get exercise name from data based on library type
  const getExerciseName = useCallback((exercise: any, libraryId: string): string => {
    const library = allLibrariesData.find(lib => lib.id === libraryId);
    if (library) {
      // Try to find a column that likely contains the exercise name
      const nameColumn = library.columns.find(col => 
        col.name.toLowerCase().includes('name') || 
        col.name.toLowerCase().includes('exercise') ||
        col.name.toLowerCase().includes('übung')
      );
      if (nameColumn) {
        return exercise[nameColumn.id] || '';
      }
      // Fallback to first text column
      const firstTextColumn = library.columns.find(col => col.type === 'text');
      if (firstTextColumn) {
        return exercise[firstTextColumn.id] || '';
      }
    }
    return exercise.name || exercise.exercise || Object.values(exercise)[0] || '';
  }, [allLibrariesData]);

  // Search logic with debouncing
  const filteredAndSortedExercises = useMemo(() => {
    let filtered = libraryData;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(exercise => {
        // Search across all data fields for any library
        return Object.values(exercise).some(value => 
          String(value).toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply column filters
    Object.entries(filterState.columnFilters).forEach(([columnKey, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(exercise => {
          const exerciseValue = exercise[columnKey];
          return exerciseValue && values.some(value => 
            exerciseValue.toString().toLowerCase().includes(value.toLowerCase())
          );
        });
      }
    });

    // Apply sorting
    if (filterState.sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[filterState.sortColumn!] || '';
        const bValue = b[filterState.sortColumn!] || '';
        const comparison = aValue.toString().localeCompare(bValue.toString(), 'de', { sensitivity: 'base' });
        return filterState.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [libraryData, searchTerm, filterState]);

  // Handle search input changes with debouncing
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      setFilterState(prev => ({ ...prev, search: value }));
    }, 300);
    
    setSearchTimeout(timeout);
  };

  // Suggest creating new exercise if search doesn't match anything
  const shouldSuggestNewExercise = useMemo(() => {
    if (!searchTerm.trim() || filteredAndSortedExercises.length > 0) return false;
    return searchTerm.length >= 3; // Only suggest if search term is meaningful
  }, [searchTerm, filteredAndSortedExercises.length]);

  // Handle sorting
  const handleSort = (column: string) => {
    setFilterState(prev => ({
      ...prev,
      sortColumn: column,
      sortDirection: prev.sortColumn === column && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle column filtering
  const handleColumnFilter = (columnKey: string, selectedValues: string[]) => {
    setFilterState(prev => ({
      ...prev,
      columnFilters: {
        ...prev.columnFilters,
        [columnKey]: selectedValues
      }
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterState({
      search: '',
      columnFilters: {},
      sortColumn: null,
      sortDirection: 'asc'
    });
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Handle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(filteredAndSortedExercises.map(ex => ex.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  // Handle confirmation
  const handleConfirm = () => {
    const exerciseSelections: ExerciseSelection[] = Array.from(selectedItems)
      .map(id => {
        const exercise = filteredAndSortedExercises.find(ex => ex.id === id);
        if (exercise) {
          return {
            id: `selection-${Date.now()}-${id}`,
            exerciseId: exercise.id,
            exerciseName: getExerciseName(exercise, activeTab),
            library: activeTab
          };
        }
        return null;
      })
      .filter(Boolean) as ExerciseSelection[];

    onSelectExercises(exerciseSelections);
    onClose();
    setSelectedItems(new Set());
  };

  // Handle new exercise creation
  const handleNewExercise = () => {
    setNewExerciseName(searchTerm);
    setIsNewExerciseDialogOpen(true);
  };

  // Ensure we have a valid activeTab when libraries change
  useEffect(() => {
    if (allLibraries.length > 0 && !allLibraries.find(lib => lib.id === activeTab)) {
      setActiveTab(allLibraries[0].id);
    }
  }, [allLibraries, activeTab]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[800px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Exercises</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Library Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${allLibraries.length}, 1fr)` }}>
                {allLibraries.map(library => (
                  <TabsTrigger key={library.id} value={library.id} className="text-xs">
                    {library.name} ({library.exerciseCount})
                  </TabsTrigger>
                ))}
              </TabsList>

              {allLibraries.map(library => (
                <TabsContent key={library.id} value={library.id} className="flex-1 flex flex-col min-h-0 mt-4">
                  <div className="space-y-4 flex-1 flex flex-col">
                    {/* Search and Controls */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search exercises..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={clearAllFilters}
                        className="whitespace-nowrap"
                      >
                        Clear Filters
                      </Button>
                      {shouldSuggestNewExercise && (
                        <Button 
                          variant="outline" 
                          onClick={handleNewExercise}
                          className="whitespace-nowrap"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create "{searchTerm}"
                        </Button>
                      )}
                    </div>

                    {/* Selection Controls */}
                    <div className="flex items-center gap-2 py-2 border-b">
                      <Button variant="ghost" size="sm" onClick={selectAll}>
                        Select All ({filteredAndSortedExercises.length})
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear Selection
                      </Button>
                      {selectedItems.size > 0 && (
                        <Badge variant="secondary">
                          {selectedItems.size} selected
                        </Badge>
                      )}
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-auto border rounded-md">
                      <div className="min-w-full">
                        {/* Header */}
                        <div className="bg-muted/50 border-b sticky top-0 z-10">
                          <div className="flex">
                            <div className="w-12 p-2 border-r">
                              <Checkbox
                                checked={filteredAndSortedExercises.length > 0 && selectedItems.size === filteredAndSortedExercises.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    selectAll();
                                  } else {
                                    clearSelection();
                                  }
                                }}
                              />
                            </div>
                            {currentColumns.map((column) => (
                              <div key={column.key} className="flex-1 min-w-[120px] p-2 border-r last:border-r-0">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleSort(column.key)}
                                    className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                                  >
                                    {column.label}
                                    {filterState.sortColumn === column.key ? (
                                      filterState.sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                    ) : null}
                                  </button>
                                  <PopupColumnFilter
                                    columnKey={column.key}
                                    columnLabel={column.label}
                                    allData={libraryData}
                                    selectedValues={filterState.columnFilters[column.key] || []}
                                    onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="divide-y">
                          {filteredAndSortedExercises.map((exercise) => (
                            <div key={exercise.id} className="flex hover:bg-muted/30">
                              <div className="w-12 p-2 border-r flex items-center">
                                <Checkbox
                                  checked={selectedItems.has(exercise.id)}
                                  onCheckedChange={() => toggleItemSelection(exercise.id)}
                                />
                              </div>
                              {currentColumns.map((column) => (
                                <div key={column.key} className="flex-1 min-w-[120px] p-2 border-r last:border-r-0 text-sm">
                                  {exercise[column.key] || '-'}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>

                        {filteredAndSortedExercises.length === 0 && (
                          <div className="p-8 text-center text-muted-foreground">
                            {searchTerm ? 'No exercises found matching your search.' : 'No exercises available.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={selectedItems.size === 0}
            >
              Add Selected ({selectedItems.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewExerciseDialog
        isOpen={isNewExerciseDialogOpen}
        onClose={() => setIsNewExerciseDialogOpen(false)}
        exerciseName={newExerciseName}
        onExerciseCreated={onExerciseCreated}
      />
    </>
  );
}