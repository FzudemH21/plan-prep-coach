import { useState, useMemo } from 'react';
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

import { Separator } from '@/components/ui/separator';
import { Plus, X, Pencil, Check } from 'lucide-react';
import { GoalV2, GOAL_CATEGORIES } from '@/types/goalsV2';
import { ToolboxEntry } from '@/types/toolbox';
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
import { MethodParametersDialog } from './MethodParametersDialog';

interface PendingMethod {
  methodId: string;
  loadingRecommendations: Record<string, string | number>;
  rationale?: string;
}

interface AddGoalDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allGoals: GoalV2[];
  toolboxEntries: ToolboxEntry[];
  onAdd: (goal: {
    name: string;
    unit?: string;
    category?: string;
    interactions: string[];
    methods: PendingMethod[];
  }) => void;
}

export function AddGoalDialogV2({
  open,
  onOpenChange,
  allGoals,
  toolboxEntries,
  onAdd,
}: AddGoalDialogV2Props) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [pendingInteractions, setPendingInteractions] = useState<string[]>([]);
  const [pendingMethods, setPendingMethods] = useState<PendingMethod[]>([]);
  const [goalSearchOpen, setGoalSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [unitSearchOpen, setUnitSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  
  // State for the method parameters dialog
  const [editingMethod, setEditingMethod] = useState<string | null>(null);

const COMMON_UNITS = [
  'kg', 'lbs', 's', 'min', 'm', 'cm', 'km', 'mph', 'm/s', '%', 'reps', 'sets',
  'kg/bw', '%1RM', 'W', 'W/kg', 'bpm', 'kcal', 'RPE', 'RiR'
];

  // Get available goals (exclude already selected)
  const availableGoals = allGoals.filter(
    (g) => !pendingInteractions.includes(g.id)
  );

  // Get unique methods from toolbox
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
  const addedMethodIds = pendingMethods.map((m) => m.methodId);
  const selectableMethods = availableMethods.filter(
    (m) => !addedMethodIds.includes(m)
  );

  // Get parameters for a method from toolbox (each entry is a parameter)
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

  const handleAddInteraction = (goalId: string) => {
    setPendingInteractions([...pendingInteractions, goalId]);
    setGoalSearchOpen(false);
  };

  const handleRemoveInteraction = (goalId: string) => {
    setPendingInteractions(pendingInteractions.filter((id) => id !== goalId));
  };

  const handleAddMethod = (methodId: string) => {
    setPendingMethods([
      ...pendingMethods,
      { methodId, loadingRecommendations: {}, rationale: '' },
    ]);
    setMethodSearchOpen(false);
  };

  const handleRemoveMethod = (methodId: string) => {
    setPendingMethods(pendingMethods.filter((m) => m.methodId !== methodId));
  };

  const handleSaveMethodParams = (
    methodId: string,
    values: Record<string, string | number>,
    rationale: string
  ) => {
    setPendingMethods(
      pendingMethods.map((m) =>
        m.methodId === methodId
          ? { ...m, loadingRecommendations: values, rationale }
          : m
      )
    );
    setEditingMethod(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      unit: unit || undefined,
      category: category || undefined,
      interactions: pendingInteractions,
      methods: pendingMethods,
    });

    // Reset form
    setName('');
    setUnit('');
    setCategory('');
    setPendingInteractions([]);
    setPendingMethods([]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setName('');
    setUnit('');
    setCategory('');
    setPendingInteractions([]);
    setPendingMethods([]);
    onOpenChange(false);
  };

  // Get the method being edited
  const editingMethodData = editingMethod
    ? pendingMethods.find((m) => m.methodId === editingMethod)
    : null;
  const editingMethodParams = editingMethod
    ? getMethodParameters(editingMethod)
    : [];

  // Helper to count filled parameters
  const getFilledParamCount = (method: PendingMethod) => {
    const params = getMethodParameters(method.methodId);
    const filled = Object.values(method.loadingRecommendations).filter(
      (v) => v !== '' && v !== undefined
    ).length;
    return { filled, total: params.length };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col mx-4 sm:mx-auto">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add New Goal</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-4">
            <div className="space-y-6 pb-6 px-1">
              {/* Goal Name */}
              <div className="space-y-2">
                <Label htmlFor="goal-name">Goal Name *</Label>
                <Input
                  id="goal-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., 1RM Front Squat, 100m Sprint Time"
                  autoFocus
                />
              </div>

              {/* Unit & Category */}
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
                            if (search && !COMMON_UNITS.includes(search)) {
                              setUnit(search);
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <button
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                              onClick={() => setUnitSearchOpen(false)}
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
                              onClick={() => setCategorySearchOpen(false)}
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

              <Separator />

              {/* Interacting Goals */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Interacting Goals
                  </h3>
                  <Popover open={goalSearchOpen} onOpenChange={setGoalSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={availableGoals.length === 0}
                      >
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
                                onSelect={() => handleAddInteraction(g.id)}
                              >
                                {g.name}
                                {g.unit && (
                                  <span className="text-muted-foreground ml-1">
                                    ({g.unit})
                                  </span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {pendingInteractions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingInteractions.map((goalId) => {
                      const goal = allGoals.find((g) => g.id === goalId);
                      if (!goal) return null;
                      return (
                        <Badge
                          key={goalId}
                          variant="secondary"
                          className="flex items-center gap-1 py-1"
                        >
                          {goal.name}
                          <button
                            type="button"
                            onClick={() => handleRemoveInteraction(goalId)}
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
                    No interacting goals selected. Add goals that influence or are
                    influenced by this goal.
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
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={selectableMethods.length === 0}
                      >
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
                                onSelect={() => handleAddMethod(methodId)}
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

                {pendingMethods.length > 0 ? (
                  <div className="space-y-2">
                    {pendingMethods.map((method) => {
                      const { filled, total } = getFilledParamCount(method);
                      const hasParams = total > 0;

                      return (
                        <div
                          key={method.methodId}
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
                              onClick={() => setEditingMethod(method.methodId)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveMethod(method.methodId)}
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
                    No methods selected. Add training methods that improve this goal.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              Add Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Method Parameters Dialog */}
      {editingMethod && editingMethodData && (
        <MethodParametersDialog
          open={!!editingMethod}
          onOpenChange={(open) => {
            if (!open) setEditingMethod(null);
          }}
          methodId={editingMethod}
          parameters={editingMethodParams}
          currentValues={editingMethodData.loadingRecommendations}
          currentRationale={editingMethodData.rationale || ''}
          onSave={(values, rationale) =>
            handleSaveMethodParams(editingMethod, values, rationale)
          }
        />
      )}
    </>
  );
}
