import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus } from 'lucide-react';
import { ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { useExerciseData } from '@/hooks/useExerciseData';
import { usePlyometricsData } from '@/hooks/usePlyometricsData';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { ExerciseLibraryFilter } from './ExerciseLibraryFilter';
import { NewExerciseDialog } from './NewExerciseDialog';

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
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
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
          name: ex.name,
          category: ex.category || '',
          type: ex.type || '',
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
  const getColumnsForLibrary = (libraryKey: string) => {
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

  // Filter exercises based on search term and column filters
  const filteredExercises = useMemo(() => {
    const exercises = libraryData[activeTab] || [];
    
    let filtered = exercises;

    // Apply search filter - search across all fields
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(exercise =>
        Object.values(exercise).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, values]) => {
      if (values.length > 0) {
        filtered = filtered.filter(exercise => {
          const exerciseValue = exercise[columnKey];
          return exerciseValue && values.some(value => 
            exerciseValue.toString().toLowerCase().includes(value.toLowerCase())
          );
        });
      }
    });

    return filtered;
  }, [libraryData, activeTab, searchTerm, columnFilters]);

  // Check if search term exists in any library
  const searchExistsInAllLibraries = useMemo(() => {
    if (!searchTerm.trim()) return true;
    
    const allExercises = Object.values(libraryData).flat();
    return allExercises.some(exercise =>
      Object.values(exercise).some(value => 
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [libraryData, searchTerm]);

  // Handle search with smart detection for new exercises
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
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
      const exercise = filteredExercises.find(ex => ex.id === id);
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
    setSearchTerm('');
    setColumnFilters({});
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Select Exercises</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
            {/* Show create new exercise option when search doesn't match any exercise */}
            {searchTerm.trim() && !searchExistsInAllLibraries && searchTerm.trim().length > 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md p-2 shadow-md z-10">
                <Button
                  variant="ghost" 
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={handleCreateNewExercise}
                >
                  <Plus className="h-3 w-3 mr-2" />
                  Create "{searchTerm}" as new exercise
                </Button>
              </div>
            )}
          </div>

          {/* Library Tabs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Exercise Libraries</h3>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.keys(allLibraries).length}, 1fr)` }}>
                {Object.entries(allLibraries).map(([key, library]) => (
                  <TabsTrigger key={key} value={key}>
                    {library.name} ({library.data.length})
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {/* Filter Controls */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted/50 rounded-lg flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Filters:</span>
                  {currentColumns.slice(0, 5).map(column => (
                    <ExerciseLibraryFilter
                      key={column.key}
                      columnKey={column.key}
                      columnLabel={column.label}
                      allData={libraryData[activeTab] || []}
                      selectedValues={columnFilters[column.key] || []}
                      onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, [column.key]: values }))}
                    />
                  ))}
                  {Object.keys(columnFilters).some(key => columnFilters[key].length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setColumnFilters({})}
                      className="text-xs"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="h-[400px] w-full">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 sticky left-0 bg-background z-10">Select</TableHead>
                          {currentColumns.map(column => (
                            <TableHead key={column.key} className="min-w-[120px] text-xs">
                              {column.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExercises.map((exercise) => {
                          const isAlreadySelected = selectedExerciseIds.includes(exercise.id);
                          const isCurrentlySelected = selectedItems.has(exercise.id);
                          const exerciseName = exercise.übungsname || exercise.übung || exercise.name || 'Unknown Exercise';
                          
                          return (
                            <TableRow key={exercise.id} className={isAlreadySelected ? 'opacity-50' : ''}>
                              <TableCell className="sticky left-0 bg-background z-10">
                                <Checkbox
                                  checked={isCurrentlySelected}
                                  disabled={isAlreadySelected}
                                  onCheckedChange={(checked) => 
                                    handleItemSelect(exercise.id, checked as boolean)
                                  }
                                />
                              </TableCell>
                              {currentColumns.map(column => (
                                <TableCell key={column.key} className="text-xs min-w-[120px]">
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
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                        {filteredExercises.length === 0 && searchTerm.trim() && (
                          <TableRow>
                            <TableCell colSpan={currentColumns.length + 1} className="text-center py-4">
                              <div className="space-y-2">
                                <p className="text-muted-foreground">No exercises found matching "{searchTerm}"</p>
                                {searchTerm.trim().length > 2 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCreateNewExercise}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Create "{searchTerm}" as new exercise
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
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