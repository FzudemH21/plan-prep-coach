import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';

interface AddLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddLibraryDialog({ isOpen, onClose }: AddLibraryDialogProps) {
  const [libraryName, setLibraryName] = useState('');
  const [libraryType, setLibraryType] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { addLibrary } = useCustomLibraries();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!libraryName.trim() || !libraryType || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create the actual library
      const newLibrary = addLibrary({
        name: libraryName,
        type: libraryType,
        description: description
      });

      toast({
        title: "Library Created",
        description: `${libraryName} has been created successfully and is now available for exercise selection.`,
      });

      // Reset form and close dialog
      setLibraryName('');
      setLibraryType('');
      setDescription('');
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create library. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setLibraryName('');
    setLibraryType('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Create New Library</span>
          </DialogTitle>
          <DialogDescription>
            Add a new exercise or training library to your collection.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="library-name">Library Name *</Label>
            <Input
              id="library-name"
              value={libraryName}
              onChange={(e) => setLibraryName(e.target.value)}
              placeholder="e.g., Olympic Lifting Library"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="library-type">Library Type *</Label>
            <Select value={libraryType} onValueChange={setLibraryType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select library type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resistance">Resistance Exercise Library</SelectItem>
                <SelectItem value="plyometrics">Plyometrics Library</SelectItem>
                <SelectItem value="cardio">Cardio Exercise Library</SelectItem>
                <SelectItem value="flexibility">Flexibility & Mobility Library</SelectItem>
                <SelectItem value="rehabilitation">Rehabilitation Library</SelectItem>
                <SelectItem value="sport-specific">Sport-Specific Library</SelectItem>
                <SelectItem value="custom">Custom Library</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and contents of this library..."
              rows={3}
              required
            />
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