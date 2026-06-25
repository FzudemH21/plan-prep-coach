import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';

interface AddLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddLibraryDialog({ isOpen, onClose }: AddLibraryDialogProps) {
  const [libraryName, setLibraryName] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { addLibrary } = useCustomLibraries();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!libraryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Library name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      addLibrary({
        name: libraryName.trim(),
        type: 'exercise',
        description: description.trim(),
        columns: [
          { id: 'exercise', name: 'Exercise', type: 'text', required: true }
        ]
      });

      toast({
        title: "Success",
        description: "Library created successfully"
      });

      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create library",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setLibraryName('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Library</DialogTitle>
            <DialogDescription>
              Create a new exercise or training library.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="library-name">Library Name</Label>
              <Input
                id="library-name"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Enter library name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="library-description">Description</Label>
              <Textarea
                id="library-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter library description"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Library
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}