import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExerciseSelection } from '@/types/microcycle-planning';
import { useExerciseData } from '@/hooks/useExerciseData';
import { usePlyometricsData } from '@/hooks/usePlyometricsData';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { useToast } from '@/hooks/use-toast';

interface NewExerciseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  onExerciseCreated: (exercise: ExerciseSelection) => void;
}

export function NewExerciseDialog({ 
  isOpen, 
  onClose, 
  exerciseName, 
  onExerciseCreated 
}: NewExerciseDialogProps) {
  const [selectedLibrary, setSelectedLibrary] = useState<string>('exercise');
  const [category, setCategory] = useState('');
  
  const { addEntry: addExercise } = useExerciseData();
  const { addEntry: addPlyometrics } = usePlyometricsData();
  const { libraries: customLibraries, addExerciseToLibrary } = useCustomLibraries();
  const { toast } = useToast();

  const handleCreate = async () => {
    try {
      let newExerciseId: string;
      let library = selectedLibrary;

      if (['exercise', 'plyometrics'].includes(selectedLibrary)) {
        // Built-in libraries
        switch (selectedLibrary) {
          case 'exercise':
            addExercise({
              übungsname: exerciseName,
              akzentuierteKörperregion: category || 'Uncategorized',
              dominantesBewegungsmuster: '',
              forcesActingOnSpine: '',
              übungsausführung: '',
              trunkTrainingFramework: '',
              mainMovementPlane: '',
              level: '',
              artDesWiderstandes: '',
              stand: '',
              variationen: ''
            });
            newExerciseId = Date.now().toString();
            break;

          case 'plyometrics':
            addPlyometrics({
              übung: exerciseName,
              intensität: '',
              tier: '',
              dauerDVZ: '',
              fokusrichtung: '',
              bewegungsart: '',
              modus: '',
              emphasis: '',
              übungsgruppe: category || 'Uncategorized',
              kommentar: ''
            });
            newExerciseId = Date.now().toString();
            break;

          default:
            throw new Error('Invalid built-in library selected');
        }
      } else {
        // Custom library
        const customLib = customLibraries.find(lib => lib.id === selectedLibrary);
        if (!customLib) throw new Error('Custom library not found');
        
        const newExercise = addExerciseToLibrary(selectedLibrary, {
          name: exerciseName,
          category: category || 'Uncategorized',
          type: '',
          metadata: {}
        });
        newExerciseId = newExercise.id;
        library = selectedLibrary;
      }

      const newExercise: ExerciseSelection = {
        id: `new-${library}-${newExerciseId}-${Date.now()}`,
        exerciseId: newExerciseId,
        exerciseName: exerciseName,
        library: library
      };

      onExerciseCreated(newExercise);
      
      toast({
        title: "Exercise created",
        description: `"${exerciseName}" has been added to the ${customLibraries.find(lib => lib.id === selectedLibrary)?.name || selectedLibrary} library.`
      });

    } catch (error) {
      console.error('Error creating exercise:', error);
      toast({
        title: "Error",
        description: "Failed to create exercise. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Exercise Name</Label>
            <Input value={exerciseName} readOnly className="bg-muted" />
          </div>

          <div>
            <Label>Add to Library</Label>
            <Select value={selectedLibrary} onValueChange={(value: string) => setSelectedLibrary(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exercise">Resistance Exercise Library</SelectItem>
                <SelectItem value="plyometrics">Plyometrics Library</SelectItem>
                {customLibraries.map(lib => (
                  <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Category (Optional)</Label>
            <Input 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Lower Body, Upper Body, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create Exercise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}