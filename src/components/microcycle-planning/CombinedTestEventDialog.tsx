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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface CombinedTestEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTests: SubGoal[];
  existingEvents: Event[];
  onSelect: (selected: { 
    type: 'test' | 'event';
    id: string; 
    name: string; 
    isNew: boolean 
  }) => void;
}

export function CombinedTestEventDialog({
  open,
  onOpenChange,
  existingTests = [],
  existingEvents = [],
  onSelect,
}: CombinedTestEventDialogProps) {
  const [type, setType] = useState<'test' | 'event'>('test');
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
          type,
          id: item.id,
          name: type === 'test' ? (item as SubGoal).testMethod : (item as Event).name,
          isNew: false,
        });
      }
    } else if (mode === 'create' && newName.trim()) {
      onSelect({
        type,
        id: `${type}-${Date.now()}`,
        name: newName.trim(),
        isNew: true,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedId('');
    setNewName('');
    setType('test');
    setMode('select');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add Test/Event</DialogTitle>
          <DialogDescription>
            Select the type, then choose from existing items or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Type</Label>
            <ToggleGroup 
              type="single" 
              value={type} 
              onValueChange={(value) => {
                if (value) {
                  setType(value as 'test' | 'event');
                  setSelectedId('');
                  setNewName('');
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="test" aria-label="Test" className="flex-1">
                <Trophy className="h-4 w-4 mr-2" />
                Test
              </ToggleGroupItem>
              <ToggleGroupItem value="event" aria-label="Event" className="flex-1">
                <Calendar className="h-4 w-4 mr-2" />
                Event
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {hasItems && (
            <>
              {/* Mode toggle */}
              <div className="space-y-2">
                <Label>Action</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mode === 'select' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setMode('select');
                      setNewName('');
                    }}
                    className="flex-1"
                  >
                    Select Existing
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'create' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setMode('create');
                      setSelectedId('');
                    }}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create New
                  </Button>
                </div>
              </div>

              {mode === 'select' && (
                <ScrollArea className="h-[250px] rounded-md border p-4">
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
