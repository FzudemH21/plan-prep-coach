import React, { useState, useMemo, useEffect } from 'react';
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
import { Plus, Trophy, Calendar, X, ChevronDown, Check } from 'lucide-react';
import { SubGoal, Event } from '@/types/training';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ParameterV2 } from '@/types/parametersV2';
import { ToolboxEntry } from '@/types/toolbox';
import { AddParameterDialogV2 } from '@/components/goals/AddParameterDialogV2';
import { AthletePerformanceParameter } from '@/types/athlete';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
    goalValue?: number;
    baselineValue?: number;
    unit?: string;
  }) => void;
  onDelete: (type: 'test' | 'event', name: string) => void;
  onUpdateComment?: (type: 'test' | 'event', id: string, comments: string) => void;
  // New props for parameters database integration
  allParameters?: ParameterV2[];
  toolboxEntries?: ToolboxEntry[];
  onAddParameter?: (parameter: {
    name: string;
    unit?: string;
    category?: string;
    interactions: { targetParameterId: string; direction: string; strength: string }[];
    methods: { methodId: string; rationale?: string }[];
  }) => void;
  // New props for baseline auto-population
  selectedAthleteId?: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
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
  allParameters = [],
  toolboxEntries = [],
  onAddParameter,
  selectedAthleteId,
  athletePerformanceParameters = [],
}: CombinedTestEventDialogProps) {
  const [type, setType] = useState<'test' | 'event'>('test');
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newComments, setNewComments] = useState('');
  const [parameterDropdownOpen, setParameterDropdownOpen] = useState(false);
  const [addParameterDialogOpen, setAddParameterDialogOpen] = useState(false);
  const [goalValue, setGoalValue] = useState('');
  const [baselineValue, setBaselineValue] = useState('');
  const [selectedParameterUnit, setSelectedParameterUnit] = useState('');
  
  const items = type === 'test' ? existingTests : existingEvents;
  const hasItems = items.length > 0;
  
  // Derived boolean: treat "no existing items" as create context
  const isCreateContext = mode === 'create' || !hasItems;

  // Auto-set mode to 'create' when dialog opens with no items
  useEffect(() => {
    if (open && !hasItems) {
      setMode('create');
    }
  }, [open, hasItems]);

  // Group parameters by category for the dropdown
  const parametersByCategory = useMemo(() => {
    const grouped: Record<string, ParameterV2[]> = {};
    allParameters.forEach((param) => {
      const cat = param.category || 'Other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(param);
    });
    // Sort each group alphabetically
    Object.keys(grouped).forEach((cat) => {
      grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
    });
    return grouped;
  }, [allParameters]);

  const categoryOrder = ['strength', 'speed', 'power', 'endurance', 'mobility', 'technique', 'body_composition', 'other'];

  const handleParameterSelect = (param: ParameterV2) => {
    setNewName(param.name);
    setSelectedParameterUnit(param.unit || '');
    setParameterDropdownOpen(false);
    
    // Auto-fill baseline value from athlete's data
    if (selectedAthleteId && athletePerformanceParameters.length > 0) {
      const athleteParam = athletePerformanceParameters.find(
        pp => pp.athleticismParameterId === param.id
      );
      if (athleteParam && athleteParam.values.length > 0) {
        // Get latest value (sorted by recordedAt)
        const sortedValues = [...athleteParam.values].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        );
        setBaselineValue(sortedValues[0].value);
      } else {
        setBaselineValue('');
      }
    } else {
      setBaselineValue('');
    }
  };

  const handleAddNewParameter = (parameter: {
    name: string;
    unit?: string;
    category?: string;
    interactions: any[];
    methods: any[];
  }) => {
    onAddParameter?.(parameter);
    // Auto-select the new parameter name
    setNewName(parameter.name);
    setAddParameterDialogOpen(false);
  };

  const handleConfirm = () => {
    if (!isCreateContext && selectedId) {
      // Select existing item mode
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
    } else if (isCreateContext && newName.trim()) {
      // Create new item mode (or no existing items)
      onSelect({
        type,
        id: `${type}-${Date.now()}`,
        name: newName.trim(),
        isNew: true,
        comments: newComments.trim() || undefined,
        goalValue: type === 'test' && goalValue ? parseFloat(goalValue) : undefined,
        baselineValue: type === 'test' && baselineValue ? parseFloat(baselineValue) : undefined,
        unit: type === 'test' ? selectedParameterUnit || undefined : undefined,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
    setGoalValue('');
    setBaselineValue('');
    setSelectedParameterUnit('');
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
                
                {/* Test: Show parameter dropdown if parameters are available */}
                {type === 'test' && allParameters.length > 0 ? (
                  <Popover open={parameterDropdownOpen} onOpenChange={setParameterDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={parameterDropdownOpen}
                        className="w-full justify-between font-normal h-10"
                      >
                        <span className={cn(!newName && "text-muted-foreground")}>
                          {newName || "Select a parameter..."}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 bg-popover z-[300]" align="start">
                      <Command>
                        <CommandInput placeholder="Search parameters..." />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>No parameters found.</CommandEmpty>
                          {/* Render categories in order */}
                          {categoryOrder
                            .filter(cat => parametersByCategory[cat]?.length > 0)
                            .map((cat) => (
                              <CommandGroup 
                                key={cat} 
                                heading={cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                              >
                                {parametersByCategory[cat].map((param) => (
                                  <CommandItem
                                    key={param.id}
                                    value={param.name}
                                    onSelect={() => handleParameterSelect(param)}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newName === param.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {param.name}
                                    {param.unit && (
                                      <span className="text-muted-foreground ml-1">({param.unit})</span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                          {/* Categories not in order */}
                          {Object.keys(parametersByCategory)
                            .filter(cat => !categoryOrder.includes(cat))
                            .sort()
                            .map((cat) => (
                              <CommandGroup 
                                key={cat} 
                                heading={cat.charAt(0).toUpperCase() + cat.slice(1)}
                              >
                                {parametersByCategory[cat].map((param) => (
                                  <CommandItem
                                    key={param.id}
                                    value={param.name}
                                    onSelect={() => handleParameterSelect(param)}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        newName === param.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {param.name}
                                    {param.unit && (
                                      <span className="text-muted-foreground ml-1">({param.unit})</span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            ))}
                        </CommandList>
                        {/* Create New Parameter option */}
                        {onAddParameter && (
                          <div className="border-t p-2">
                            <Button
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => {
                                setParameterDropdownOpen(false);
                                setAddParameterDialogOpen(true);
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create New Parameter
                            </Button>
                          </div>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  /* Event or no parameters: Show regular input */
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
                )}
              </div>
              
              {/* Baseline Value field - only for tests */}
              {type === 'test' && (
                <div className="space-y-2">
                  <Label htmlFor="baselineValue">
                    Baseline Value
                    {selectedParameterUnit && (
                      <span className="text-xs text-muted-foreground ml-2">({selectedParameterUnit})</span>
                    )}
                  </Label>
                  <Input
                    id="baselineValue"
                    type="number"
                    placeholder={selectedAthleteId ? "Auto-filled from athlete data" : "e.g., 100"}
                    value={baselineValue}
                    onChange={(e) => setBaselineValue(e.target.value)}
                  />
                </div>
              )}

              {/* Goal Value field - only for tests */}
              {type === 'test' && (
                <div className="space-y-2">
                  <Label htmlFor="goalValue">
                    Goal Value
                    {selectedParameterUnit && (
                      <span className="text-xs text-muted-foreground ml-2">({selectedParameterUnit})</span>
                    )}
                  </Label>
                  <Input
                    id="goalValue"
                    type="number"
                    placeholder="e.g., 120"
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value)}
                  />
                </div>
              )}

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
              (!isCreateContext && !selectedId) || 
              (isCreateContext && !newName.trim())
            }
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
      </DialogPortal>

      {/* Nested Add Parameter Dialog */}
      {onAddParameter && (
        <AddParameterDialogV2
          open={addParameterDialogOpen}
          onOpenChange={setAddParameterDialogOpen}
          allParameters={allParameters}
          toolboxEntries={toolboxEntries}
          onAdd={handleAddNewParameter}
          containerClassName="z-[200]"
        />
      )}
    </Dialog>
  );
}
