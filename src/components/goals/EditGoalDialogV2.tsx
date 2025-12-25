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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Pencil, Check } from 'lucide-react';
import { GoalV2, GoalInteraction, GoalMethodV2, GOAL_CATEGORIES } from '@/types/goalsV2';
import { ToolboxEntry } from '@/types/toolbox';
import { MethodParametersDialog } from './MethodParametersDialog';
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
  allInteractions: GoalInteraction[];
  allGoalMethods: GoalMethodV2[];
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
  allInteractions,
  allGoalMethods,
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
  const [category, setCategory] = useState(goal.category || '');
  const [goalSearchOpen, setGoalSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  
  // State for the method parameters dialog
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);

  // Filter interactions and methods for this goal
  const interactions = useMemo(() => 
    allInteractions.filter((i) => i.goalId === goal.id),
    [allInteractions, goal.id]
  );
  const goalMethods = useMemo(() => 
    allGoalMethods.filter((m) => m.goalId === goal.id),
    [allGoalMethods, goal.id]
  );

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

  // Get parameters for a method from toolbox
  const getMethodParameters = (methodId: string) => {
    const [category, subCategory] = methodId.split(' - ');
    const entries = toolboxEntries.filter(
      (e) => e.category === category && e.subCategory === subCategory
    );
    return entries.map((e) => ({
      parameterName: e.parameterName,
      parameterType: e.parameterType,
      options: e.options || [],
    }));
  };

  const handleSave = () => {
    const finalUnit = unit === 'custom' ? customUnit : unit;
    onUpdateGoal({
      name: name.trim(),
      unit: finalUnit || undefined,
      category: category || undefined,
    });
  };

  const handleSaveMethodParams = (
    methodDbId: string,
    values: Record<string, string | number>,
    rationale: string
  ) => {
    onUpdateMethod(methodDbId, {
      loadingRecommendations: values,
      rationale,
    });
    setEditingMethodId(null);
  };

  // Get the method being edited
  const editingMethod = editingMethodId
    ? goalMethods.find((m) => m.id === editingMethodId)
    : null;
  const editingMethodParams = editingMethod
    ? getMethodParameters(editingMethod.methodId)
    : [];

  // Helper to count filled parameters
  const getFilledParamCount = (method: GoalMethodV2) => {
    const params = getMethodParameters(method.methodId);
    const filled = Object.values(method.loadingRecommendations || {}).filter(
      (v) => v !== '' && v !== undefined
    ).length;
    return { filled, total: params.length };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            <div className="space-y-6 pb-4 px-1">
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
                      <Popover open={unitSearchOpen} onOpenChange={setUnitSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={unitSearchOpen}
                            className="w-full justify-between font-normal"
                          >
                            {unit || "Select unit..."}
                            <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search or type..." 
                              onValueChange={(search) => {
                                // Allow setting custom value directly
                                if (search && !COMMON_UNITS.includes(search)) {
                                  setUnit(search);
                                }
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <button
                                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                                  onClick={() => {
                                    setUnitSearchOpen(false);
                                    setTimeout(handleSave, 0);
                                  }}
                                >
                                  Use "{unit}" as custom unit
                                </button>
                              </CommandEmpty>
                              <CommandGroup>
                                {COMMON_UNITS.map((u) => (
                                  <CommandItem
                                    key={u}
                                    onSelect={() => {
                                      setUnit(u);
                                      setUnitSearchOpen(false);
                                      setTimeout(handleSave, 0);
                                    }}
                                  >
                                    {u}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={categorySearchOpen}
                            className="w-full justify-between font-normal"
                          >
                            {GOAL_CATEGORIES.find((c) => c.value === category)?.label || category || "Select category..."}
                            <span className="ml-2 h-4 w-4 shrink-0 opacity-50">▼</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search or type..." 
                              onValueChange={(search) => {
                                // Allow setting custom value directly
                                const predefined = GOAL_CATEGORIES.find((c) => 
                                  c.label.toLowerCase() === search.toLowerCase() || 
                                  c.value === search.toLowerCase()
                                );
                                if (!predefined && search) {
                                  setCategory(search);
                                }
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <button
                                  className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                                  onClick={() => {
                                    setCategorySearchOpen(false);
                                    setTimeout(handleSave, 0);
                                  }}
                                >
                                  Use "{category}" as custom category
                                </button>
                              </CommandEmpty>
                              <CommandGroup>
                                {GOAL_CATEGORIES.map((cat) => (
                                  <CommandItem
                                    key={cat.value}
                                    onSelect={() => {
                                      setCategory(cat.value);
                                      setCategorySearchOpen(false);
                                      setTimeout(handleSave, 0);
                                    }}
                                  >
                                    {cat.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                    {goalMethods.map((method) => {
                      const { filled, total } = getFilledParamCount(method);
                      const hasParams = total > 0;

                      return (
                        <div
                          key={method.id}
                          className="border rounded-lg p-3 bg-card flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {method.methodId}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hasParams ? (
                                filled > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <Check className="h-3 w-3 text-green-500" />
                                    {filled}/{total} parameters set
                                  </span>
                                ) : (
                                  `${total} parameters available`
                                )
                              ) : (
                                'No parameters'
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingMethodId(method.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => onRemoveMethod(method.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Method Parameters Dialog */}
      {editingMethodId && editingMethod && (
        <MethodParametersDialog
          open={!!editingMethodId}
          onOpenChange={(open) => {
            if (!open) setEditingMethodId(null);
          }}
          methodId={editingMethod.methodId}
          parameters={editingMethodParams}
          currentValues={editingMethod.loadingRecommendations || {}}
          currentRationale={editingMethod.rationale || ''}
          onSave={(values, rationale) =>
            handleSaveMethodParams(editingMethodId, values, rationale)
          }
        />
      )}
    </>
  );
}
