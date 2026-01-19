import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExerciseSelection } from '@/types/microcycle-planning';
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
  const { libraries: customLibraries, addExerciseToLibrary } = useCustomLibraries();
  const { toast } = useToast();
  
  const [selectedLibrary, setSelectedLibrary] = useState<string>(customLibraries[0]?.id || '');
  const [category, setCategory] = useState('');

  const handleCreate = async () => {
    try {
      if (!selectedLibrary) {
        toast({
          title: "No library selected",
          description: "Please select a library to add the exercise to.",
          variant: "destructive"
        });
        return;
      }

      const customLib = customLibraries.find(lib => lib.id === selectedLibrary);
      if (!customLib) throw new Error('Library not found');
      
      const newExercise = addExerciseToLibrary(selectedLibrary, {
        data: {
          exercise: exerciseName,
          description: category || ''
        }
      });

      const exercise: ExerciseSelection = {
        id: `new-${selectedLibrary}-${newExercise.id}-${Date.now()}`,
        exerciseId: newExercise.id,
        exerciseName: exerciseName,
        library: selectedLibrary
      };

      onExerciseCreated(exercise);
      
      toast({
        title: "Exercise created",
        description: `"${exerciseName}" has been added to the ${customLib.name} library.`
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

  const hasLibraries = customLibraries.length > 0;

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

          {hasLibraries ? (
            <>
              <div>
                <Label>Add to Library</Label>
                <Select value={selectedLibrary} onValueChange={setSelectedLibrary}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a library..." />
                  </SelectTrigger>
                  <SelectContent>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No exercise libraries found. Please create a library first in Templates &amp; Library.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!hasLibraries || !selectedLibrary}>
            Create Exercise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
