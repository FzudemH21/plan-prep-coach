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
import { useAthleticismData } from '@/hooks/useAthleticismData';

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

  const { data: exerciseData } = useExerciseData();
  const { data: plyometricsData } = usePlyometricsData();
  const { data: athleticismData } = useAthleticismData();

  // Prepare data for each library
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

    const athleticism = athleticismData?.entries?.map(ex => ({
      id: ex.id,
      name: `${ex.overarchingGoal} - ${ex.subGoal}`,
      category: ex.quality,
      type: ex.overarchingGoal,
      library: 'athleticism' as ExerciseLibraryType
    })) || [];

    return { exercise, plyometrics, athleticism };
  }, [exerciseData, plyometricsData, athleticismData]);

  // Filter exercises based on search term
  const filteredExercises = useMemo(() => {
    const exercises = libraryData[activeTab];
    if (!searchTerm.trim()) return exercises;

    return exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [libraryData, activeTab, searchTerm]);

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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ExerciseLibraryType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="exercise">
                Exercise Library ({libraryData.exercise.length})
              </TabsTrigger>
              <TabsTrigger value="plyometrics">
                Plyometrics ({libraryData.plyometrics.length})
              </TabsTrigger>
              <TabsTrigger value="athleticism">
                Athleticism ({libraryData.athleticism.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ScrollArea className="h-[400px]">
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