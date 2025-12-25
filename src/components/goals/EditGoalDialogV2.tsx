import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Search } from 'lucide-react';
import { GoalV2, GoalInteraction, GoalMethodV2, GoalCategory, GOAL_CATEGORIES } from '@/types/goalsV2';
import { ToolboxEntry } from '@/types/toolbox';
import { MethodParametersEditor } from './MethodParametersEditor';
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

interface EditGoalDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalV2;
  allGoals: GoalV2[];
  interactions: GoalInteraction[];
  goalMethods: GoalMethodV2[];
  toolboxEntries: ToolboxEntry[];
  onUpdateGoal: (updates: Partial<GoalV2>) => void;
  onAddInteraction: (interactingGoalId: string) => void;
  onRemoveInteraction: (id: string) => void;
  onAddMethod: (methodId: string) => void;
  onUpdateMethod: (id: string, updates: Partial<GoalMethodV2>) => void;
  onRemoveMethod: (id: string) => void;
}

const COMMON_UNITS = [
  'kg', 'lbs', 's', 'min', 'm', 'cm', 'km', 'mph', 'm/s', '%', 'reps', 'sets',
  'kg/bw', '%1RM', 'W', 'W/kg', 'bpm', 'kcal', 'RPE', 'RiR'
];

export function EditGoalDialogV2({
  open,
  onOpenChange,
  goal,
  allGoals,
  interactions,
  goalMethods,
  toolboxEntries,
  onUpdateGoal,
  onAddInteraction,
  onRemoveInteraction,
  onAddMethod,
  onUpdateMethod,
  onRemoveMethod,
}: EditGoalDialogV2Props) {
  const [name, setName] = useState(goal.name);
  const [unit, setUnit] = useState(goal.unit || '');
  const [customUnit, setCustomUnit] = useState('');
  const [category, setCategory] = useState<GoalCategory | ''>(goal.category || '');
  const [goalSearchOpen, setGoalSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);

  useEffect(() => {
    setName(goal.name);
    setUnit(goal.unit || '');
    setCategory(goal.category || '');
  }, [goal]);

  // Get available goals for interaction (exclude self and already linked)
  const interactingGoalIds = interactions.map((i) => i.interactingGoalId);
  const availableGoals = allGoals.filter(
    (g) => g.id !== goal.id && !interactingGoalIds.includes(g.id)
  );

  // Get unique methods from toolbox (category - subCategory)
  const availableMethods = useMemo(() => {
    const methodMap = new Map<string, string>();
    toolboxEntries.forEach((entry) => {
      const methodId = `${entry.category} - ${entry.subCategory}`;
      if (!methodMap.has(methodId)) {
        methodMap.set(methodId, methodId);
      }
    });
    return Array.from(methodMap.keys()).sort();
  }, [toolboxEntries]);

  // Filter out already added methods
  const addedMethodIds = goalMethods.map((m) => m.methodId);
  const selectableMethods = availableMethods.filter(
    (m) => !addedMethodIds.includes(m)
  );

  const handleSave = () => {
    const finalUnit = unit === 'custom' ? customUnit : unit;
    onUpdateGoal({
      name: name.trim(),
      unit: finalUnit || undefined,
      category: category || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Basic Info
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Goal Name</Label>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={COMMON_UNITS.includes(unit) ? unit : unit ? 'custom' : ''}
                      onValueChange={(v) => {
                        if (v === 'custom') {
                          setUnit('custom');
                          setCustomUnit(unit);
                        } else {
                          setUnit(v);
                          setTimeout(handleSave, 0);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                    {unit === 'custom' && (
                      <Input
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        onBlur={handleSave}
                        placeholder="Enter custom unit"
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v as GoalCategory);
                        setTimeout(handleSave, 0);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {GOAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Interacting Goals */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Interacting Goals
                </h3>
                <Popover open={goalSearchOpen} onOpenChange={setGoalSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={availableGoals.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search goals..." />
                      <CommandList>
                        <CommandEmpty>No goals found.</CommandEmpty>
                        <CommandGroup>
                          {availableGoals.map((g) => (
                            <CommandItem
                              key={g.id}
                              onSelect={() => {
                                onAddInteraction(g.id);
                                setGoalSearchOpen(false);
                              }}
                            >
                              {g.name}
                              {g.unit && (
                                <span className="text-muted-foreground ml-1">({g.unit})</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {interactions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {interactions.map((interaction) => {
                    const linkedGoal = allGoals.find((g) => g.id === interaction.interactingGoalId);
                    if (!linkedGoal) return null;
                    return (
                      <Badge
                        key={interaction.id}
                        variant="secondary"
                        className="flex items-center gap-1 py-1"
                      >
                        {linkedGoal.name}
                        <button
                          onClick={() => onRemoveInteraction(interaction.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No interacting goals added yet.
                </p>
              )}
            </div>

            <Separator />

            {/* Associated Methods */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Associated Methods
                </h3>
                <Popover open={methodSearchOpen} onOpenChange={setMethodSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" disabled={selectableMethods.length === 0}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Method
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search methods..." />
                      <CommandList>
                        <CommandEmpty>No methods found.</CommandEmpty>
                        <CommandGroup>
                          {selectableMethods.map((methodId) => (
                            <CommandItem
                              key={methodId}
                              onSelect={() => {
                                onAddMethod(methodId);
                                setMethodSearchOpen(false);
                              }}
                            >
                              {methodId}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {goalMethods.length > 0 ? (
                <div className="space-y-2">
                  {goalMethods.map((method) => (
                    <MethodParametersEditor
                      key={method.id}
                      method={method}
                      methodName={method.methodId}
                      toolboxEntries={toolboxEntries}
                      onUpdate={(updates) => onUpdateMethod(method.id, updates)}
                      onRemove={() => onRemoveMethod(method.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No methods associated yet.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
