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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { GoalV2 } from '@/types/goalsV2';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const [pendingInteractions, setPendingInteractions] = useState<string[]>([]);
  const [pendingMethods, setPendingMethods] = useState<PendingMethod[]>([]);
  const [goalSearchOpen, setGoalSearchOpen] = useState(false);
  const [methodSearchOpen, setMethodSearchOpen] = useState(false);
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());

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
    // Find all entries for this method - each entry represents a parameter
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
    // Auto-expand newly added method
    setExpandedMethods(new Set([...expandedMethods, methodId]));
  };

  const handleRemoveMethod = (methodId: string) => {
    setPendingMethods(pendingMethods.filter((m) => m.methodId !== methodId));
    const newExpanded = new Set(expandedMethods);
    newExpanded.delete(methodId);
    setExpandedMethods(newExpanded);
  };

  const handleUpdateMethodParam = (
    methodId: string,
    paramName: string,
    value: string | number
  ) => {
    setPendingMethods(
      pendingMethods.map((m) =>
        m.methodId === methodId
          ? {
              ...m,
              loadingRecommendations: {
                ...m.loadingRecommendations,
                [paramName]: value,
              },
            }
          : m
      )
    );
  };

  const handleUpdateMethodRationale = (methodId: string, rationale: string) => {
    setPendingMethods(
      pendingMethods.map((m) =>
        m.methodId === methodId ? { ...m, rationale } : m
      )
    );
  };

  const toggleMethodExpanded = (methodId: string) => {
    const newExpanded = new Set(expandedMethods);
    if (newExpanded.has(methodId)) {
      newExpanded.delete(methodId);
    } else {
      newExpanded.add(methodId);
    }
    setExpandedMethods(newExpanded);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      interactions: pendingInteractions,
      methods: pendingMethods,
    });

    // Reset form
    setName('');
    setPendingInteractions([]);
    setPendingMethods([]);
    setExpandedMethods(new Set());
    onOpenChange(false);
  };

  const handleClose = () => {
    setName('');
    setPendingInteractions([]);
    setPendingMethods([]);
    setExpandedMethods(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
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
                    const parameters = getMethodParameters(method.methodId);
                    const isExpanded = expandedMethods.has(method.methodId);

                    return (
                      <Collapsible
                        key={method.methodId}
                        open={isExpanded}
                        onOpenChange={() => toggleMethodExpanded(method.methodId)}
                      >
                        <div className="border rounded-lg">
                          <div className="flex items-center justify-between p-3 bg-muted/30">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                {method.methodId}
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                    >
                                      <Info className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    {method.rationale || 'No rationale provided yet.'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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

                          <CollapsibleContent>
                            <div className="p-3 pt-0 space-y-3">
                              {/* Parameters */}
                              {parameters.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                  {parameters.map((param) => (
                                    <div key={param.parameterName} className="space-y-1">
                                      <Label className="text-xs">
                                        {param.parameterName}
                                      </Label>
                                      {param.options && param.options.length > 0 ? (
                                        <select
                                          className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                                          value={
                                            method.loadingRecommendations[
                                              param.parameterName
                                            ] || ''
                                          }
                                          onChange={(e) =>
                                            handleUpdateMethodParam(
                                              method.methodId,
                                              param.parameterName,
                                              e.target.value
                                            )
                                          }
                                        >
                                          <option value="">Select...</option>
                                          {param.options.map((opt) => (
                                            <option key={opt} value={opt}>
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <Input
                                          className="h-9"
                                          placeholder={param.parameterName}
                                          value={
                                            method.loadingRecommendations[
                                              param.parameterName
                                            ] || ''
                                          }
                                          onChange={(e) =>
                                            handleUpdateMethodParam(
                                              method.methodId,
                                              param.parameterName,
                                              e.target.value
                                            )
                                          }
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  No parameters defined for this method.
                                </p>
                              )}

                              {/* Rationale */}
                              <div className="space-y-1">
                                <Label className="text-xs">Rationale (why?)</Label>
                                <Textarea
                                  placeholder="Explain why this method is used for this goal..."
                                  className="min-h-[60px] text-sm"
                                  value={method.rationale || ''}
                                  onChange={(e) =>
                                    handleUpdateMethodRationale(
                                      method.methodId,
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
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
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Add Goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
