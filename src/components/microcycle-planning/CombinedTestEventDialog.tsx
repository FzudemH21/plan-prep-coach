import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trophy, Calendar, X, ChevronDown } from 'lucide-react';
import { SubGoal, Event } from '@/types/training';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CombinedTestEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTests: SubGoal[];
  existingEvents: Event[];
  scheduledTestNames?: string[];
  scheduledEventNames?: string[];
  onSelect: (selected: { 
    type: 'test' | 'event';
    id: string; 
    name: string; 
    isNew: boolean;
    comments?: string;
  }) => void;
  onDelete: (type: 'test' | 'event', name: string) => void;
  onUpdateComment?: (type: 'test' | 'event', id: string, comments: string) => void;
}

export function CombinedTestEventDialog({
  open,
  onOpenChange,
  existingTests = [],
  existingEvents = [],
  scheduledTestNames = [],
  scheduledEventNames = [],
  onSelect,
  onDelete,
  onUpdateComment,
}: CombinedTestEventDialogProps) {
  const [type, setType] = useState<'test' | 'event'>('test');
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newComments, setNewComments] = useState('');
  
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
          comments: (item as any).comments
        });
      }
    } else if (mode === 'create' && newName.trim()) {
      onSelect({
        type,
        id: `${type}-${Date.now()}`,
        name: newName.trim(),
        isNew: true,
        comments: newComments.trim() || undefined
      });
    }
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedId('');
    setNewName('');
    setNewComments('');
    setType('test');
    setMode('select');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="z-[150] bg-black/80" />
        <DialogContent className="sm:max-w-[500px] z-[160]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Manage Tests/Events</DialogTitle>
          <DialogDescription>
            View currently scheduled items and add new tests or events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Currently Scheduled Section */}
          {(scheduledTestNames.length > 0 || scheduledEventNames.length > 0) && (
            <div className="space-y-2 pb-4 border-b">
              <Label className="text-sm font-semibold">Currently Scheduled</Label>
              <div className="space-y-2">
                {scheduledTestNames.map((testName, idx) => {
                  const testData = existingTests.find(t => t.testMethod === testName);
                  
                  return (
                    <Collapsible key={`test-${idx}`}>
                      <div className="rounded-md border bg-muted/50 overflow-hidden">
                        <div className="flex items-center justify-between p-2">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80">
                              <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                              <span className="text-sm font-medium">{testName}</span>
                              <ChevronDown className="h-3 w-3 ml-auto" />
                            </button>
                          </CollapsibleTrigger>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete('test', testName);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1">
                            <Label htmlFor={`scheduled-test-comment-${idx}`} className="text-xs text-muted-foreground mb-1">
                              Comments:
                            </Label>
                            <Textarea
                              id={`scheduled-test-comment-${idx}`}
                              value={testData?.comments || ""}
                              onChange={(e) => {
                                if (testData?.id && onUpdateComment) {
                                  onUpdateComment('test', testData.id, e.target.value);
                                }
                              }}
                              placeholder="Add notes about this test..."
                              rows={2}
                              className="text-xs mt-1"
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
                
                {scheduledEventNames.map((eventName, idx) => {
                  const eventData = existingEvents.find(e => e.name === eventName);
                  
                  return (
                    <Collapsible key={`event-${idx}`}>
                      <div className="rounded-md border bg-muted/50 overflow-hidden">
                        <div className="flex items-center justify-between p-2">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80">
                              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                              <span className="text-sm font-medium">{eventName}</span>
                              <ChevronDown className="h-3 w-3 ml-auto" />
                            </button>
                          </CollapsibleTrigger>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete('event', eventName);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1">
                            <Label htmlFor={`scheduled-event-comment-${idx}`} className="text-xs text-muted-foreground mb-1">
                              Comments:
                            </Label>
                            <Textarea
                              id={`scheduled-event-comment-${idx}`}
                              value={eventData?.comments || ""}
                              onChange={(e) => {
                                if (eventData?.id && onUpdateComment) {
                                  onUpdateComment('event', eventData.id, e.target.value);
                                }
                              }}
                              placeholder="Add notes about this event..."
                              rows={2}
                              className="text-xs mt-1"
                            />
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}

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
                  {(item as any).comments && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      💬 {(item as any).comments}
                    </div>
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
            <div className="space-y-4">
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
                    if (e.key === 'Enter' && newComments.trim() === '' && newName.trim()) {
                      handleConfirm();
                    }
                  }}
                />
              </div>
              
              {/* Comments field */}
              <div className="space-y-2">
                <Label htmlFor="comments">
                  Comments
                  <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                </Label>
                <Textarea
                  id="comments"
                  placeholder="Add notes or context about this test/event..."
                  value={newComments}
                  onChange={(e) => setNewComments(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>
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
      </DialogPortal>
    </Dialog>
  );
}
