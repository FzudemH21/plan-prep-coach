import React, { useState, useMemo, useEffect } from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ChevronUp, ChevronDown, X, Recycle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { FilterState } from '@/types/exercises';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import { ColumnFilter } from '@/components/exercises/ColumnFilter';
import { PlyometricsColumnFilter } from '@/components/plyometrics/PlyometricsColumnFilter';
import { NewExerciseDialog } from './NewExerciseDialog';

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
  singleSelect?: boolean;
  title?: string;
  defaultLibraryId?: string; // Pre-select this library tab when the popup opens
}

export function ExerciseLibraryPopup({
  isOpen,
  onClose,
  onSelectExercises,
  selectedExerciseIds,
  onExerciseCreated,
  singleSelect = false,
  title,
  defaultLibraryId,
}: ExerciseLibraryPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');
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

  const { libraries } = useCustomLibraries();

  // When the popup opens, jump to the default library; fall back to first library
  useEffect(() => {
    if (!isOpen || libraries.length === 0) return;
    const target = defaultLibraryId && libraries.find(lib => lib.id === defaultLibraryId)
      ? defaultLibraryId
      : libraries[0].id;
    setActiveTab(target);
  }, [isOpen, defaultLibraryId, libraries]);

  // Prepare data for all libraries using CustomLibrariesContext
  const allLibraries = useMemo(() => {
    const result: Record<string, any> = {};
    
    libraries.forEach(lib => {
      result[lib.id] = {
        name: lib.name,
        columns: lib.columns.map(col => ({
          key: col.id,
          label: col.name,
          type: col.type,
          options: col.options
        })),
        data: lib.exercises.map(ex => ({
          id: ex.id,
          ...ex.data,
          library: lib.id
        }))
      };
    });

    return result;
  }, [libraries]);

  const libraryData = useMemo(() => {
    const result: Record<string, any[]> = {};
    Object.keys(allLibraries).forEach(key => {
      result[key] = allLibraries[key].data;
    });
    return result;
  }, [allLibraries]);

  // Get column definitions based on active library
  const getColumnsForLibrary = (libraryKey: string): PopupTableColumn[] => {
    const library = allLibraries[libraryKey];
    if (!library) return [];
    
    return library.columns || [];
  };

  const currentColumns = useMemo(() => getColumnsForLibrary(activeTab), [activeTab]);

  // Filter and sort exercises
  const filteredAndSortedExercises = useMemo(() => {
    const exercises = libraryData[activeTab] || [];
    let filtered = exercises;

    // Apply search filter - search across all fields
    const searchTerm = filterState.search.trim();
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(exercise =>
        Object.values(exercise).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        )
      );
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
  }, [libraryData, activeTab, filterState]);

  // Check if search term exists in any library
  const searchExistsInAllLibraries = useMemo(() => {
    const searchTerm = filterState.search.trim();
    if (!searchTerm) return true;
    
    const allExercises = Object.values(libraryData).flat();
    return allExercises.some(exercise =>
      Object.values(exercise).some(value => 
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [libraryData, filterState.search]);

  // Handle search with smart detection for new exercises
  const handleSearchChange = (value: string) => {
    setFilterState(prev => ({ ...prev, search: value }));
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout to check if exercise exists
    if (value.trim()) {
      const timeout = setTimeout(() => {
        const allExercises = Object.values(libraryData).flat();
        const exerciseExists = allExercises.some(exercise => {
          // Get library info and find the name field
          const library = allLibraries[exercise.library];
          if (library && library.columns && library.columns.length > 0) {
            const nameField = exercise[library.columns[0].key];
            return nameField && nameField.toLowerCase() === value.toLowerCase();
          }
          
          // Fallback to common name fields
          const nameField = exercise.name || exercise.übungsname || exercise.übung || '';
          return nameField.toLowerCase() === value.toLowerCase();
        });
        
        if (!exerciseExists && value.trim().length > 2) {
          // Exercise doesn't exist, suggest creating it
          setNewExerciseName(value.trim());
        }
      }, 500);
      
      setSearchTimeout(timeout);
    }
  };

  // Handle sorting
  const handleSort = (columnKey: string) => {
    const newDirection = filterState.sortColumn === columnKey && filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    setFilterState(prev => ({
      ...prev,
      sortColumn: columnKey,
      sortDirection: newDirection
    }));
  };

  // Handle column filtering
  const handleColumnFilter = (columnKey: string, values: string[]) => {
    const newColumnFilters = { ...filterState.columnFilters };
    if (values.length === 0) {
      delete newColumnFilters[columnKey];
    } else {
      newColumnFilters[columnKey] = values;
    }
    setFilterState(prev => ({
      ...prev,
      columnFilters: newColumnFilters
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
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

  const handleItemSelect = (exerciseId: string, isSelected: boolean) => {
    if (singleSelect) {
      // Radio behavior: tick one replaces the previous selection
      if (isSelected) {
        setSelectedItems(new Set([exerciseId]));
      } else {
        setSelectedItems(new Set());
      }
      return;
    }

    // Multi-select mode
    const newSelected = new Set(selectedItems);
    if (isSelected) {
      newSelected.add(exerciseId);
    } else {
      newSelected.delete(exerciseId);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirm = () => {
    // Search across ALL library data, not just the active tab,
    // so selections survive a tab switch before confirming.
    const allExercises = Object.values(libraryData).flat();

    const selectedExercises: ExerciseSelection[] = Array.from(selectedItems).map(id => {
      const exercise = allExercises.find(ex => ex.id === id);
      if (!exercise) throw new Error('Exercise not found');

      const library = allLibraries[exercise.library];
      let exerciseName = 'Unknown Exercise';
      if (library && library.columns && library.columns.length > 0) {
        exerciseName = exercise[library.columns[0].key] || 'Unknown Exercise';
      } else {
        exerciseName = exercise.name || 'Unknown Exercise';
      }

      return {
        id: `${exercise.library}-${id}-${Date.now()}`,
        exerciseId: id,
        exerciseName,
        library: exercise.library,
      };
    });

    onSelectExercises(selectedExercises);
  };

  const handleClose = () => {
    setSelectedItems(new Set());
    setFilterState({
      search: '',
      columnFilters: {},
      sortColumn: null,
      sortDirection: 'asc'
    });
    setNewExerciseName('');
    setIsNewExerciseDialogOpen(false);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    onClose();
  };

  const handleCreateNewExercise = () => {
    if (newExerciseName.trim()) {
      setIsNewExerciseDialogOpen(true);
    }
  };

  const handleExerciseCreated = (exercise: ExerciseSelection) => {
    onExerciseCreated(exercise);
    setIsNewExerciseDialogOpen(false);
    setNewExerciseName('');
  };

  const hasActiveFilters = filterState.search || Object.keys(filterState.columnFilters).length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        {/* Custom overlay with higher z-index to darken the WorkoutSessionSheet */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "z-[120]"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[130] grid translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg",
            "max-w-[85vw] max-h-[85vh] w-[85vw] h-[85vh] flex flex-col"
          )}
        >
          <DialogHeader>
            <DialogTitle>{title ?? (singleSelect ? 'Select Exercise' : 'Select Exercises')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex flex-col overflow-hidden">
            {/* Library Tabs */}
            <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
              <h3 className="text-sm font-medium text-muted-foreground shrink-0">Exercise Libraries</h3>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="flex flex-wrap h-auto gap-1.5 shrink-0 justify-start bg-transparent p-0">
                  {Object.entries(allLibraries).sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([key, library]) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="shrink-0 border border-border rounded-md px-3 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=inactive]:bg-background data-[state=inactive]:text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                    >
                      {library.name} ({library.data.length})
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Search + filter controls — below the library tabs */}
                <div className="flex items-center justify-between gap-4 shrink-0 mt-3">
                  <div className="flex items-center gap-3">
                    <div className="relative px-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search exercises..."
                        value={filterState.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-8 w-64"
                      />
                      {filterState.search.trim() && !searchExistsInAllLibraries && filterState.search.trim().length > 2 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md p-2 shadow-md z-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-left"
                            onClick={handleCreateNewExercise}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            Create "{filterState.search}" as new exercise
                          </Button>
                        </div>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {filteredAndSortedExercises.length} exercises
                  </div>
                </div>

                {libraries.map(lib => {
                  const libCircuits = lib.circuits ?? [];
                  if (lib.id !== activeTab || libCircuits.length === 0) return null;
                  return (
                    <div key={`circuits-${lib.id}`} className="mt-3 shrink-0">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                        <Recycle className="h-3.5 w-3.5" />
                        Circuits in this library
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {libCircuits.map(circuit => (
                          <button
                            key={circuit.id}
                            className="flex items-center gap-2 px-3 py-1.5 border rounded-lg bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-colors text-sm"
                            onClick={() => {
                              onSelectExercises([{
                                id: `circuit-${circuit.id}-${Date.now()}`,
                                exerciseId: circuit.id,
                                exerciseName: circuit.name,
                                library: lib.id,
                                isCircuit: true,
                                circuitId: circuit.id,
                                circuitLibraryId: lib.id,
                                circuitExercises: [...circuit.exercises],
                                circuitRounds: circuit.rounds,
                                circuitRestBetweenRounds: circuit.restBetweenRounds,
                                circuitRestBetweenExercises: circuit.restBetweenExercises,
                                circuitComments: circuit.comments,
                              }]);
                              handleClose();
                            }}
                          >
                            <Recycle className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-medium">{circuit.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {circuit.exercises.length} ex.
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <TabsContent value={activeTab} className="mt-4 flex-1 flex flex-col overflow-hidden">
                  {/* Table with sticky headers and horizontal scroll */}
                  <div className="flex-1 border rounded-lg overflow-hidden">
                    <div className="overflow-auto max-h-[50vh] relative isolate" style={{scrollbarWidth: 'thin'}}>
                      <table className="w-full min-w-[1400px] table-fixed border-separate border-spacing-0">
                        {/* Sticky Header */}
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border w-12 bg-muted sticky left-0 top-0 z-50">
                              <div className="flex items-center">
                                <span className="text-xs">Select</span>
                              </div>
                            </th>
                            {currentColumns.map((column) => (
                              <th
                                key={column.key}
                                className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border text-xs min-w-[120px] bg-muted sticky top-0 z-40"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div 
                                    className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                                    onClick={() => handleSort(column.key)}
                                  >
                                    <span className="truncate">{column.label}</span>
                                    {filterState.sortColumn === column.key && (
                                      filterState.sortDirection === 'asc' ? (
                                        <ChevronUp className="h-3 w-3 shrink-0" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3 shrink-0" />
                                      )
                                    )}
                                  </div>
                                  {activeTab === 'resistance-training' ? (
                                    <ColumnFilter
                                      column={column as any}
                                      allData={libraryData[activeTab] || []}
                                      selectedValues={filterState.columnFilters[column.key] || []}
                                      onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                                      onSortChange={handleSort}
                                      withinModal={true}
                                    />
                                  ) : activeTab === 'plyometrics' ? (
                                    <PlyometricsColumnFilter
                                      column={column as any}
                                      allData={libraryData[activeTab] || []}
                                      selectedValues={filterState.columnFilters[column.key] || []}
                                      onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                                      onSortChange={handleSort}
                                      withinModal={true}
                                    />
                                  ) : (
                                    <ColumnFilter
                                      column={column as any}
                                      allData={libraryData[activeTab] || []}
                                      selectedValues={filterState.columnFilters[column.key] || []}
                                      onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                                      onSortChange={handleSort}
                                      withinModal={true}
                                    />
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedExercises.map((exercise) => {
                            const isAlreadySelected = selectedExerciseIds.includes(exercise.id);
                            const isCurrentlySelected = selectedItems.has(exercise.id);
                            
                            return (
                              <tr key={exercise.id} className={`border-b hover:bg-muted/25 transition-colors ${isAlreadySelected ? 'opacity-50' : ''}`}>
                                <td className="px-3 py-2 border-r border-border bg-background sticky left-0 z-30">
                                  <Checkbox
                                    checked={isCurrentlySelected}
                                    disabled={isAlreadySelected}
                                    onCheckedChange={(checked) => 
                                      handleItemSelect(exercise.id, checked as boolean)
                                    }
                                  />
                                </td>
                                {currentColumns.map(column => (
                                  <td key={column.key} className="px-3 py-2 border-r border-border text-xs min-w-[120px]">
                                    <div className="max-w-[200px] truncate" title={exercise[column.key] || ''}>
                                      {column.key === currentColumns[0].key && isAlreadySelected && (
                                        <>
                                          {exercise[column.key] || '-'}
                                          <Badge variant="secondary" className="ml-2 text-xs">
                                            Already selected
                                          </Badge>
                                        </>
                                      )}
                                      {(column.key !== currentColumns[0].key || !isAlreadySelected) && (
                                        exercise[column.key] || '-'
                                      )}
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          {filteredAndSortedExercises.length === 0 && filterState.search.trim() && (
                            <tr>
                              <td colSpan={currentColumns.length + 1} className="text-center py-8">
                                <div className="space-y-2">
                                  <p className="text-muted-foreground">No exercises found matching "{filterState.search}"</p>
                                  {filterState.search.trim().length > 2 && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCreateNewExercise}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Create "{filterState.search}" as new exercise
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          {filteredAndSortedExercises.length === 0 && !filterState.search.trim() && hasActiveFilters && (
                            <tr>
                              <td colSpan={currentColumns.length + 1} className="text-center py-8">
                                <div className="space-y-2">
                                  <p className="text-muted-foreground">No exercises match the current filters</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearAllFilters}
                                  >
                                    Clear All Filters
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
            >
              {singleSelect
                ? 'Select Exercise'
                : `Add Exercises${selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}`}
            </Button>
          </DialogFooter>

          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {/* New Exercise Dialog */}
          <NewExerciseDialog
            isOpen={isNewExerciseDialogOpen}
            onClose={() => {
              setIsNewExerciseDialogOpen(false);
              setNewExerciseName('');
            }}
            exerciseName={newExerciseName}
            onExerciseCreated={handleExerciseCreated}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}