import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { useExerciseData } from '@/hooks/useExerciseData';
import { usePlyometricsData } from '@/hooks/usePlyometricsData';
import { ExerciseLibraryFilter } from './ExerciseLibraryFilter';

interface ExerciseLibraryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercises: (exercises: ExerciseSelection[]) => void;
  selectedExerciseIds: string[];
}

export function ExerciseLibraryPopup({ 
  isOpen, 
  onClose, 
  onSelectExercises, 
  selectedExerciseIds 
}: ExerciseLibraryPopupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<ExerciseLibraryType>('exercise');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    name: [],
    category: [],
    type: []
  });

  const { data: exerciseData } = useExerciseData();
  const { data: plyometricsData } = usePlyometricsData();

  // Prepare data for each library (removed athleticism)
  const libraryData = useMemo(() => {
    const exercise = exerciseData?.exercises?.map(ex => ({
      id: ex.id,
      name: ex.übungsname,
      category: ex.akzentuierteKörperregion,
      type: ex.dominantesBewegungsmuster,
      library: 'exercise' as ExerciseLibraryType
    })) || [];

    const plyometrics = plyometricsData?.exercises?.map(ex => ({
      id: ex.id,
      name: ex.übung,
      category: ex.übungsgruppe,
      type: ex.intensität,
      library: 'plyometrics' as ExerciseLibraryType
    })) || [];

    return { exercise, plyometrics };
  }, [exerciseData, plyometricsData]);

  // Filter exercises based on search term and column filters
  const filteredExercises = useMemo(() => {
    const exercises = libraryData[activeTab];
    
    let filtered = exercises;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply column filters
    if (columnFilters.name.length > 0) {
      filtered = filtered.filter(exercise => columnFilters.name.includes(exercise.name));
    }
    if (columnFilters.category.length > 0) {
      filtered = filtered.filter(exercise => exercise.category && columnFilters.category.includes(exercise.category));
    }
    if (columnFilters.type.length > 0) {
      filtered = filtered.filter(exercise => exercise.type && columnFilters.type.includes(exercise.type));
    }

    return filtered;
  }, [libraryData, activeTab, searchTerm, columnFilters]);

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

      return {
        id: `${exercise.library}-${id}-${Date.now()}`,
        exerciseId: id,
        exerciseName: exercise.name,
        library: exercise.library
      };
    });

    onSelectExercises(selectedExercises);
  };

  const handleClose = () => {
    setSelectedItems(new Set());
    setSearchTerm('');
    setColumnFilters({ name: [], category: [], type: [] });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Library Tabs */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Exercise Libraries</h3>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ExerciseLibraryType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="exercise">
                  Resistance Exercise Library ({libraryData.exercise.length})
                </TabsTrigger>
                <TabsTrigger value="plyometrics">
                  Plyometrics ({libraryData.plyometrics.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {/* Filter Controls */}
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Filters:</span>
                  <ExerciseLibraryFilter
                    columnKey="name"
                    columnLabel="Name"
                    allData={libraryData[activeTab]}
                    selectedValues={columnFilters.name}
                    onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, name: values }))}
                  />
                  <ExerciseLibraryFilter
                    columnKey="category"
                    columnLabel="Category"
                    allData={libraryData[activeTab]}
                    selectedValues={columnFilters.category}
                    onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, category: values }))}
                  />
                  <ExerciseLibraryFilter
                    columnKey="type"
                    columnLabel="Type"
                    allData={libraryData[activeTab]}
                    selectedValues={columnFilters.type}
                    onSelectionChange={(values) => setColumnFilters(prev => ({ ...prev, type: values }))}
                  />
                  {(columnFilters.name.length > 0 || columnFilters.category.length > 0 || columnFilters.type.length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setColumnFilters({ name: [], category: [], type: [] })}
                      className="text-xs"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Exercise Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {filteredExercises.map((exercise) => {
                      const isAlreadySelected = selectedExerciseIds.includes(exercise.id);
                      const isCurrentlySelected = selectedItems.has(exercise.id);
                      
                      return (
                        <TableRow key={exercise.id} className={isAlreadySelected ? 'opacity-50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={isCurrentlySelected}
                              disabled={isAlreadySelected}
                              onCheckedChange={(checked) => 
                                handleItemSelect(exercise.id, checked as boolean)
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {exercise.name}
                            {isAlreadySelected && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Already selected
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{exercise.category || '-'}</TableCell>
                          <TableCell>{exercise.type || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  </Table>
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
      </DialogContent>
    </Dialog>
  );
}