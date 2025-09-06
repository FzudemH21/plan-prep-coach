import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExerciseSelection, ExerciseLibraryType } from '@/types/microcycle-planning';
import { useExerciseData } from '@/hooks/useExerciseData';
import { usePlyometricsData } from '@/hooks/usePlyometricsData';
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
  const [selectedLibrary, setSelectedLibrary] = useState<ExerciseLibraryType>('exercise');
  const [category, setCategory] = useState('');
  
  const { addEntry: addExercise } = useExerciseData();
  const { addEntry: addPlyometrics } = usePlyometricsData();
  const { toast } = useToast();

  const handleCreate = async () => {
    try {
      let newExerciseId: string;

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
          throw new Error('Invalid library selected');
      }

      const newExercise: ExerciseSelection = {
        id: `new-${selectedLibrary}-${newExerciseId}-${Date.now()}`,
        exerciseId: newExerciseId,
        exerciseName: exerciseName,
        library: selectedLibrary
      };

      onExerciseCreated(newExercise);
      
      toast({
        title: "Exercise created",
        description: `"${exerciseName}" has been added to the ${selectedLibrary} library.`
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
            <Select value={selectedLibrary} onValueChange={(value: ExerciseLibraryType) => setSelectedLibrary(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exercise">Resistance Exercise Library</SelectItem>
                <SelectItem value="plyometrics">Plyometrics Library</SelectItem>
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