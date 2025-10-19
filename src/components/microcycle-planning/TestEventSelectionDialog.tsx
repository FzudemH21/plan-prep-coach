import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trophy, Calendar } from 'lucide-react';
import { SubGoal, Event } from '@/types/training';

interface TestEventSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'test' | 'event';
  existingTests?: SubGoal[];
  existingEvents?: Event[];
  onSelect: (selected: { id: string; name: string; isNew: boolean }) => void;
}

export function TestEventSelectionDialog({
  open,
  onOpenChange,
  type,
  existingTests = [],
  existingEvents = [],
  onSelect,
}: TestEventSelectionDialogProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  
  const items = type === 'test' ? existingTests : existingEvents;
  const hasItems = items.length > 0;

  const handleConfirm = () => {
    if (mode === 'select' && selectedId) {
      const item = items.find(i => i.id === selectedId);
      if (item) {
        onSelect({
          id: item.id,
          name: type === 'test' ? (item as SubGoal).testMethod : (item as Event).name,
          isNew: false,
        });
      }
    } else if (mode === 'create' && newName.trim()) {
      onSelect({
        id: `${type}-${Date.now()}`,
        name: newName.trim(),
        isNew: true,
      });
    }
    onOpenChange(false);
    setSelectedId('');
    setNewName('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedId('');
    setNewName('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'test' ? <Trophy className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
            Add {type === 'test' ? 'Test' : 'Event'}
          </DialogTitle>
          <DialogDescription>
            {hasItems 
              ? `Select an existing ${type} or create a new one`
              : `Create a new ${type}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasItems && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('select')}
                  className="flex-1"
                >
                  Select Existing
                </Button>
                <Button
                  type="button"
                  variant={mode === 'create' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('create')}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create New
                </Button>
              </div>

              {mode === 'select' && (
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  <RadioGroup value={selectedId} onValueChange={setSelectedId}>
                    {items.map((item) => {
                      const name = type === 'test' 
                        ? (item as SubGoal).testMethod 
                        : (item as Event).name;
                      const description = type === 'test'
                        ? (item as SubGoal).description
                        : (item as Event).description;
                        
                      return (
                        <div key={item.id} className="flex items-start space-x-2 py-2">
                          <RadioGroupItem value={item.id} id={item.id} />
                          <Label htmlFor={item.id} className="flex-1 cursor-pointer">
                            <div className="font-medium">{name}</div>
                            {description && (
                              <div className="text-xs text-muted-foreground">{description}</div>
                            )}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </ScrollArea>
              )}
            </>
          )}

          {(mode === 'create' || !hasItems) && (
            <div className="space-y-2">
              <Label htmlFor="name">
                {type === 'test' ? 'Test Method' : 'Event Name'}
              </Label>
              <Input
                id="name"
                placeholder={type === 'test' ? 'e.g., 1RM Back Squat' : 'e.g., Regional Competition'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={
              (mode === 'select' && !selectedId) || 
              (mode === 'create' && !newName.trim())
            }
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
