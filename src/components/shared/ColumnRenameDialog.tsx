import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ColumnRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

export const ColumnRenameDialog = ({ isOpen, onClose, onRename, currentName }: ColumnRenameDialogProps) => {
  const [newName, setNewName] = useState(currentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName !== currentName) {
      onRename(newName.trim());
      onClose();
    }
  };

  const handleClose = () => {
    setNewName(currentName);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="column-name">Column Name</Label>
            <Input
              id="column-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new column name"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!newName.trim() || newName === currentName}
            >
              Rename
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};