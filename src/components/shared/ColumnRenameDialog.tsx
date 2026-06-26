import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ColumnRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string, newType: 'text' | 'select' | 'textarea', newOptions: string[]) => void;
  currentName: string;
  currentType: 'text' | 'select' | 'textarea';
  currentOptions: string[];
}

export const ColumnRenameDialog = ({
  isOpen,
  onClose,
  onRename,
  currentName,
  currentType,
  currentOptions,
}: ColumnRenameDialogProps) => {
  const [name, setName] = useState(currentName);
  const [type, setType] = useState<'text' | 'select' | 'textarea'>(currentType);
  const [optionsText, setOptionsText] = useState(currentOptions.join(', '));

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setType(currentType);
      setOptionsText(currentOptions.join(', '));
    }
  }, [isOpen, currentName, currentType, currentOptions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    const options = type === 'select'
      ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    onRename(name.trim(), type, options);
    handleClose();
  };

  const handleClose = () => {
    setName(currentName);
    setType(currentType);
    setOptionsText(currentOptions.join(', '));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="col-name">Column Name</Label>
            <Input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter column name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); handleClose(); } }}
            />
          </div>

          <div>
            <Label htmlFor="col-type">Input Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'text' | 'select' | 'textarea')}>
              <SelectTrigger id="col-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
                <SelectItem value="textarea">Text Area</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'select' && (
            <div>
              <Label htmlFor="col-options">Options (comma-separated)</Label>
              <Textarea
                id="col-options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
