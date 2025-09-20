import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ChevronUp, ChevronDown, X } from 'lucide-react';
import { ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { FilterState } from '@/types/exercises';
import { useExerciseData } from '@/hooks/useExerciseData';
import { usePlyometricsData } from '@/hooks/usePlyometricsData';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { ColumnFilter } from '@/components/exercises/ColumnFilter';
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
}

export function ExerciseLibraryPopup({ 
  isOpen, 
  onClose, 
  onSelectExercises, 
  selectedExerciseIds,
  onExerciseCreated 
}: ExerciseLibraryPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('exercise');
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

  const { data: exerciseData } = useExerciseData();
  const { data: plyometricsData } = usePlyometricsData();
  const { libraries: customLibraries } = useCustomLibraries();

  // Prepare data for all libraries (built-in + custom)
  const allLibraries = useMemo(() => {
    const libraries: Record<string, any> = {};
    
    // Built-in libraries
    libraries['exercise'] = {
      name: 'Resistance Exercise Library',
      data: exerciseData?.exercises?.map(ex => ({
        id: ex.id,
        übungsname: ex.übungsname,
        akzentuierteKörperregion: ex.akzentuierteKörperregion,
        dominantesBewegungsmuster: ex.dominantesBewegungsmuster,
        forcesActingOnSpine: ex.forcesActingOnSpine,
        übungsausführung: ex.übungsausführung,
        trunkTrainingFramework: ex.trunkTrainingFramework,
        mainMovementPlane: ex.mainMovementPlane,
        level: ex.level,
        artDesWiderstandes: ex.artDesWiderstandes,
        stand: ex.stand,
        variationen: ex.variationen,
        library: 'exercise'
      })) || []
    };

    libraries['plyometrics'] = {
      name: 'Plyometrics',
      data: plyometricsData?.exercises?.map(ex => ({
        id: ex.id,
        übung: ex.übung,
        intensität: ex.intensität,
        tier: ex.tier,
        dauerDVZ: ex.dauerDVZ,
        fokusrichtung: ex.fokusrichtung,
        bewegungsart: ex.bewegungsart,
        modus: ex.modus,
        emphasis: ex.emphasis,
        übungsgruppe: ex.übungsgruppe,
        kommentar: ex.kommentar,
        library: 'plyometrics'
      })) || []
    };

    // Custom libraries
    customLibraries.forEach(lib => {
      libraries[lib.id] = {
        name: lib.name,
        data: lib.exercises.map(ex => ({
          id: ex.id,
          name: ex.data.exercise || ex.data.name || ex.data.übungsname || ex.data.übung || 'Unnamed Exercise',
          category: ex.data.category || ex.data.type || '',
          type: ex.data.type || lib.type || '',
          library: lib.id
        }))
      };
    });

    return libraries;
  }, [exerciseData, plyometricsData, customLibraries]);

  const libraryData = useMemo(() => {
    const result: Record<string, any[]> = {};
    Object.keys(allLibraries).forEach(key => {
      result[key] = allLibraries[key].data;
    });
    return result;
  }, [allLibraries]);

  // Get column definitions based on active library
  const getColumnsForLibrary = (libraryKey: string): PopupTableColumn[] => {
    if (libraryKey === 'exercise') {
      return [
        { key: 'übungsname', label: 'Übungsname', type: 'text' },
        { key: 'akzentuierteKörperregion', label: 'Körperregion', type: 'text' },
        { key: 'dominantesBewegungsmuster', label: 'Bewegungsmuster', type: 'text' },
        { key: 'forcesActingOnSpine', label: 'Forces on Spine', type: 'text' },
        { key: 'übungsausführung', label: 'Ausführung', type: 'text' },
        { key: 'trunkTrainingFramework', label: 'Trunk Framework', type: 'text' },
        { key: 'mainMovementPlane', label: 'Movement Plane', type: 'text' },
        { key: 'level', label: 'Level', type: 'text' },
        { key: 'artDesWiderstandes', label: 'Widerstand', type: 'text' },
        { key: 'stand', label: 'Stand', type: 'text' },
        { key: 'variationen', label: 'Variationen', type: 'text' }
      ];
    } else if (libraryKey === 'plyometrics') {
      return [
        { key: 'übung', label: 'Übung', type: 'text' },
        { key: 'intensität', label: 'Intensität', type: 'text' },
        { key: 'tier', label: 'Tier', type: 'text' },
        { key: 'dauerDVZ', label: 'Dauer DVZ', type: 'text' },
        { key: 'fokusrichtung', label: 'Fokusrichtung', type: 'text' },
        { key: 'bewegungsart', label: 'Bewegungsart', type: 'text' },
        { key: 'modus', label: 'Modus', type: 'text' },
        { key: 'emphasis', label: 'Emphasis', type: 'text' },
        { key: 'übungsgruppe', label: 'Übungsgruppe', type: 'text' },
        { key: 'kommentar', label: 'Kommentar', type: 'text' }
      ];
    } else {
      // Custom library - show basic fields
      return [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'type', label: 'Type', type: 'text' }
      ];
    }
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
          const nameField = exercise.übungsname || exercise.übung || exercise.name || '';
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
    const newSelected = new Set(selectedItems);
    if (isSelected) {
      newSelected.add(exerciseId);
    } else {
      newSelected.delete(exerciseId);
    }
    setSelectedItems(newSelected);
  };

  const handleConfirm = () => {
    const selectedExercises: ExerciseSelection[] = Array.from(selectedItems).map(id => {
      const exercise = filteredAndSortedExercises.find(ex => ex.id === id);
      if (!exercise) throw new Error('Exercise not found');

      // Get exercise name from appropriate field based on library
      const exerciseName = exercise.übungsname || exercise.übung || exercise.name || 'Unknown Exercise';

      return {
        id: `${exercise.library}-${id}-${Date.now()}`,
        exerciseId: id,
        exerciseName: exerciseName,
        library: exercise.library
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
      <DialogContent className="max-w-[95vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Select Exercises</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex flex-col overflow-hidden">
          {/* Search and Filter Controls */}
          <div className="flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search exercises..."
                  value={filterState.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 w-64"
                />
                {/* Show create new exercise option when search doesn't match any exercise */}
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

          {/* Library Tabs */}
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-sm font-medium text-muted-foreground shrink-0">Exercise Libraries</h3>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full shrink-0" style={{ gridTemplateColumns: `repeat(${Object.keys(allLibraries).length}, 1fr)` }}>
                {Object.entries(allLibraries).map(([key, library]) => (
                  <TabsTrigger key={key} value={key}>
                    {library.name} ({library.data.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-4 flex-1 flex flex-col overflow-hidden">
                {/* Table with sticky headers and horizontal scroll */}
                <div className="flex-1 border rounded-lg overflow-hidden">
                  <div className="overflow-auto max-h-[50vh]" style={{scrollbarWidth: 'thin'}}>
                    <table className="w-full min-w-[1400px] border-collapse">
                      {/* Sticky Header */}
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border w-12 bg-background sticky left-0 z-20">
                            <div className="flex items-center">
                              <span className="text-xs">Select</span>
                            </div>
                          </th>
                          {currentColumns.map((column) => (
                            <th
                              key={column.key}
                              className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border text-xs min-w-[120px]"
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
                                <ColumnFilter
                                  column={column as any}
                                  allData={libraryData[activeTab] || []}
                                  selectedValues={filterState.columnFilters[column.key] || []}
                                  onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                                />
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
                              <td className="px-3 py-2 border-r border-border bg-background sticky left-0 z-10">
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
            Add Selected ({selectedItems.size})
          </Button>
        </DialogFooter>

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
      </DialogContent>
    </Dialog>
  );
}