import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries, CustomLibrary } from '@/hooks/useCustomLibraries';

interface EditLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  library: CustomLibrary | null;
}

export function EditLibraryDialog({ isOpen, onClose, library }: EditLibraryDialogProps) {
  const [libraryName, setLibraryName] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { editLibrary } = useCustomLibraries();

  useEffect(() => {
    if (library && isOpen) {
      setLibraryName(library.name);
      setDescription(library.description);
    }
  }, [library, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!library) return;
    
    if (!libraryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Library name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      editLibrary(library.id, {
        name: libraryName.trim(),
        description: description.trim()
      });

      toast({
        title: "Success",
        description: "Library updated successfully"
      });

      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update library",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setLibraryName('');
    setDescription('');
    onClose();
  };

  if (!library) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Library</DialogTitle>
            <DialogDescription>
              Update the name and description of your library.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-library-name">Library Name</Label>
              <Input
                id="edit-library-name"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Enter library name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-library-description">Description</Label>
              <Textarea
                id="edit-library-description"
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
              Update Library
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}