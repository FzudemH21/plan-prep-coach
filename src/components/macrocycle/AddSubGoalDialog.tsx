import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Target, CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubGoal, Event, SmartGoal } from "@/types/training";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParameterV2 } from "@/types/parametersV2";
import { AthletePerformanceParameter } from "@/types/athlete";


type ItemCategory = "subgoal" | "event";

interface AddSubGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSubGoal: (subGoal: Omit<SubGoal, 'id'>) => void;
  onEditSubGoal?: (subGoal: SubGoal) => void;
  editSubGoal?: SubGoal | null;
  onAddEvent: (event: Omit<Event, 'id'>) => void;
  onEditEvent?: (event: Event) => void;
  editEvent?: Event | null;
  // Athleticism Database parameters
  athleticismParameters: ParameterV2[];
  // Athlete's current performance values
  athletePerformanceParams?: AthletePerformanceParameter[];
  smartGoals: SmartGoal[];
  defaultParentGoalId?: string;
  defaultCategory?: ItemCategory;
  defaultParameterId?: string | null;
  onCreateNewParameter?: (parentGoalId: string | undefined) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function AddSubGoalDialog({
  open,
  onOpenChange,
  onAddSubGoal,
  onEditSubGoal,
  editSubGoal,
  onAddEvent,
  onEditEvent,
  editEvent,
  athleticismParameters,
  athletePerformanceParams,
  smartGoals,
  defaultParentGoalId,
  defaultCategory,
  defaultParameterId,
  onCreateNewParameter,
}: AddSubGoalDialogProps) {
  // Category state
  const [category, setCategory] = useState<ItemCategory>(defaultCategory || "subgoal");

  // Common state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(defaultParameterId ?? null);
  const [description, setDescription] = useState("");
  const [comments, setComments] = useState("");
  
  // Sub-goal specific state
  const [preTestValue, setPreTestValue] = useState<number | "">("");
  const [goalValue, setGoalValue] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  const [parentGoalId, setParentGoalId] = useState<string | undefined>(defaultParentGoalId);
  
  // Event specific state
  const [eventName, setEventName] = useState("");
  
  // Update category when defaultCategory changes
  useEffect(() => {
    if (defaultCategory) {
      setCategory(defaultCategory);
    }
  }, [defaultCategory]);

  // Update parentGoalId when defaultParentGoalId changes
  useEffect(() => {
    setParentGoalId(defaultParentGoalId);
  }, [defaultParentGoalId]);

  // Pre-select parameter when defaultParameterId changes (AI-triggered open)
  useEffect(() => {
    if (!defaultParameterId) return;
    const param = athleticismParameters.find((p) => p.id === defaultParameterId);
    if (!param) return;
    setSelectedParameterId(param.id);
    setDescription(param.name);
    setUnit(param.unit ?? "");
    const athleteParam = athletePerformanceParams?.find((pp) => pp.athleticismParameterId === param.id);
    if (athleteParam?.values?.length) {
      const latest = athleteParam.values[athleteParam.values.length - 1];
      const num = parseFloat(latest.value);
      if (!isNaN(num)) setPreTestValue(num);
    } else {
      setPreTestValue("");
    }
    setGoalValue("");
  }, [defaultParameterId, athleticismParameters, athletePerformanceParams]);

  // Pre-fill form when editing sub-goal
  useEffect(() => {
    if (editSubGoal) {
      setDescription(editSubGoal.description);
      setPreTestValue(editSubGoal.preTestValue);
      setGoalValue(editSubGoal.goalValue);
      setUnit(editSubGoal.unit);
      setComments(editSubGoal.comments || "");
      setParentGoalId(editSubGoal.parentGoalId);
      setCategory("subgoal");
    }
  }, [editSubGoal]);

  // Pre-fill form when editing event
  useEffect(() => {
    if (editEvent) {
      setEventName(editEvent.name);
      setComments(editEvent.comments || "");
      setCategory("event");
    }
  }, [editEvent]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory(defaultCategory || "subgoal");
      setComboboxOpen(false);
      setSelectedParameterId(null);
      setDescription("");
      setComments("");
      setPreTestValue("");
      setGoalValue("");
      setUnit("");
      setEventName("");
      setParentGoalId(defaultParentGoalId);
    }
  }, [open, defaultParentGoalId, defaultCategory]);

  // Get parameters with athlete's current values
  interface ParameterWithValue {
    id: string;
    name: string;
    unit: string;
    latestValue: string | null;
    hasAthleteValue: boolean;
  }

  // Parameters that the athlete has recorded values for
  const athleteParamsWithDetails = useMemo((): ParameterWithValue[] => {
    if (!athletePerformanceParams || athletePerformanceParams.length === 0) return [];
    
    return athletePerformanceParams
      .map((pp) => {
        const param = athleticismParameters.find((p) => p.id === pp.athleticismParameterId);
        if (!param) return null;
        
        const latestValue = pp.values.length > 0 
          ? pp.values[pp.values.length - 1].value 
          : null;
        
        return {
          id: param.id,
          name: param.name,
          unit: param.unit || "",
          latestValue,
          hasAthleteValue: true,
        };
      })
      .filter((p): p is ParameterWithValue => p !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [athletePerformanceParams, athleticismParameters]);

  // All other parameters from the Athleticism Database
  const otherParameters = useMemo((): ParameterWithValue[] => {
    const athleteParamIds = new Set(
      athletePerformanceParams?.map((pp) => pp.athleticismParameterId) || []
    );
    
    return athleticismParameters
      .filter((p) => !athleteParamIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || "",
        latestValue: null,
        hasAthleteValue: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [athletePerformanceParams, athleticismParameters]);

  // Calculate percent change
  const percentChange = useMemo(() => {
    if (typeof preTestValue === "number" && typeof goalValue === "number" && preTestValue > 0) {
      return ((goalValue - preTestValue) / preTestValue) * 100;
    }
    return 0;
  }, [preTestValue, goalValue]);

  const handleSelectParameter = (param: ParameterWithValue) => {
    setSelectedParameterId(param.id);
    setDescription(param.name);
    setUnit(param.unit);
    
    // Auto-fill pre-test value if athlete has recorded values for this parameter
    if (param.latestValue && param.hasAthleteValue) {
      const numValue = parseFloat(param.latestValue);
      if (!isNaN(numValue)) {
        setPreTestValue(numValue);
      }
    } else {
      setPreTestValue("");
    }
    setGoalValue("");
    setComboboxOpen(false);
  };

  const resetForm = () => {
    setCategory(defaultCategory || "subgoal");
    setComboboxOpen(false);
    setSelectedParameterId(null);
    setDescription("");
    setComments("");
    setPreTestValue("");
    setGoalValue("");
    setUnit("");
    setEventName("");
    setParentGoalId(defaultParentGoalId);
  };

  const handleSave = () => {
    if (category === "subgoal") {
      const goalDescription = description;
      
      if (!goalDescription && !editSubGoal) return;

      if (editSubGoal && onEditSubGoal) {
        onEditSubGoal({
          ...editSubGoal,
          parentGoalId: parentGoalId || undefined,
          description: goalDescription || editSubGoal.description,
          testMethod: '',
          preTestValue: typeof preTestValue === "number" ? preTestValue : 0,
          goalValue: typeof goalValue === "number" ? goalValue : 0,
          unit,
          percentChange,
          comments,
        });
      } else {
        onAddSubGoal({
          parentGoalId: parentGoalId || undefined,
          description: goalDescription,
          testMethod: '',
          preTestValue: typeof preTestValue === "number" ? preTestValue : 0,
          goalValue: typeof goalValue === "number" ? goalValue : 0,
          unit,
          percentChange,
          testDates: [],
          comments,
        });
      }
    } else {
      if (!eventName.trim()) return;

      if (editEvent && onEditEvent) {
        onEditEvent({
          ...editEvent,
          name: eventName.trim(),
          comments,
        });
      } else {
        onAddEvent({
          name: eventName.trim(),
          description: "",
          eventDates: [],
          comments,
        });
      }
    }

    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const isValid = category === "subgoal" 
    ? description || editSubGoal
    : eventName.trim();

  // Determine if we should hide category selector (when opened with defaultParentGoalId, it's always a sub-goal, or editing)
  const hideCategorySelector = !!defaultParentGoalId || !!editSubGoal || !!editEvent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {category === "subgoal" ? (
              <Target className="h-5 w-5" />
            ) : (
              <CalendarIcon className="h-5 w-5" />
            )}
            {editSubGoal ? "Edit Sub-Goal" : editEvent ? "Edit Event" : `Add ${category === "subgoal" ? "Sub-Goal / Test" : "Event"}`}
          </DialogTitle>
          <DialogDescription>
            {editSubGoal 
              ? "Edit the sub-goal details below."
              : editEvent
              ? "Edit the event details below."
              : "Add a measurable sub-goal with testing or schedule an event."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">

          {category === "subgoal" ? (
            <>
              {/* Parameter Description Selector */}
              <div className="space-y-2">
                <Label>Parameter Description</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                    >
                      {description ? (
                        <span className="truncate">{description}</span>
                      ) : (
                        "Select or create a parameter..."
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Search..." />
                      <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        
                        {/* Athlete's Parameters */}
                        {athleteParamsWithDetails.length > 0 && (
                          <CommandGroup heading="Athlete Parameters">
                            {athleteParamsWithDetails.map((param) => (
                              <CommandItem
                                key={param.id}
                                value={`athlete-${param.name}`}
                                onSelect={() => handleSelectParameter(param)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedParameterId === param.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <span>{param.name}</span>
                                  {param.latestValue && (
                                    <span className="ml-2 text-muted-foreground text-sm">
                                      (current: {param.latestValue} {param.unit})
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                        
                        {/* All Other Parameters */}
                        {otherParameters.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="All Parameters">
                              {otherParameters.map((param) => (
                                <CommandItem
                                  key={param.id}
                                  value={`all-${param.name}`}
                                  onSelect={() => handleSelectParameter(param)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedParameterId === param.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1">
                                    <span>{param.name}</span>
                                    {param.unit && (
                                      <span className="ml-2 text-muted-foreground text-sm">
                                        ({param.unit})
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                        
                        {onCreateNewParameter && (
                          <>
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem 
                                onSelect={() => {
                                  onOpenChange(false);
                                  onCreateNewParameter(parentGoalId);
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Parameter
                              </CommandItem>
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Pre-Test Value, Goal Value, Percent Change */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Pre-Test Value</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={preTestValue}
                      onChange={(e) => setPreTestValue(e.target.value ? parseFloat(e.target.value) : "")}
                      placeholder="150"
                      className="flex-1"
                    />
                    <Input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="kg"
                      className="w-14"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Goal Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value ? parseFloat(e.target.value) : "")}
                    placeholder="180"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Change</Label>
                  <div className="flex items-center h-10">
                    <Badge variant={percentChange > 0 ? "default" : percentChange < 0 ? "destructive" : "secondary"}>
                      {percentChange !== 0 ? `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%` : "0%"}
                    </Badge>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Event Form */
            <div className="space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Competition, Vacation, Match"
              />
            </div>
          )}

          {/* Comments (shared) */}
          <div className="space-y-2">
            <Label htmlFor="comments">
              Comments
              <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={category === "subgoal" 
                ? "Add notes about testing protocol, preparation, etc." 
                : "Add notes about this event..."
              }
              rows={2}
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {editSubGoal ? "Save Changes" : `Add ${category === "subgoal" ? "Sub-Goal" : "Event"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
