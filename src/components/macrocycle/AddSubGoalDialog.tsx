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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Check, ChevronsUpDown, Target, CalendarIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubGoal, Event, SmartGoal } from "@/types/training";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AthleteParameter, ParameterDefinition } from "@/types/athlete";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

type ItemCategory = "subgoal" | "event";

interface ParameterWithDetails {
  id: string;
  definitionId: string;
  name: string;
  unit: string;
  type: string;
  latestValue: string | null;
  isFromAthlete: boolean;
}

interface AddSubGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSubGoal: (subGoal: Omit<SubGoal, 'id'>) => void;
  onAddEvent: (event: Omit<Event, 'id'>) => void;
  athleteParameters: AthleteParameter[];
  parameterDefinitions: ParameterDefinition[];
  subGoalOptions: string[];
  testMethodOptions: string[];
  smartGoals: SmartGoal[];
  defaultParentGoalId?: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function AddSubGoalDialog({
  open,
  onOpenChange,
  onAddSubGoal,
  onAddEvent,
  athleteParameters,
  parameterDefinitions,
  subGoalOptions,
  testMethodOptions,
  smartGoals,
  defaultParentGoalId,
}: AddSubGoalDialogProps) {
  // Category state
  const [category, setCategory] = useState<ItemCategory>("subgoal");
  
  // Common state
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [comments, setComments] = useState("");
  
  // Sub-goal specific state
  const [testMethod, setTestMethod] = useState("");
  const [preTestValue, setPreTestValue] = useState<number | "">("");
  const [goalValue, setGoalValue] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  const [parentGoalId, setParentGoalId] = useState<string | undefined>(defaultParentGoalId);
  
  // Event specific state
  const [eventName, setEventName] = useState("");
  
  // Update parentGoalId when defaultParentGoalId changes
  useEffect(() => {
    setParentGoalId(defaultParentGoalId);
  }, [defaultParentGoalId]);

  // Get athlete's parameters with their details
  const athleteParamsWithDetails = useMemo((): ParameterWithDetails[] => {
    return athleteParameters.map((ap) => {
      const definition = parameterDefinitions.find(
        (pd) => pd.id === ap.parameterDefinitionId
      );
      const latestValue =
        ap.values.length > 0 ? ap.values[ap.values.length - 1].value : null;
      return {
        id: ap.id,
        definitionId: definition?.id || "",
        name: definition?.name || "Unknown",
        unit: definition?.unit || "",
        type: definition?.type || "text",
        latestValue,
        isFromAthlete: true,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [athleteParameters, parameterDefinitions]);

  // Get all OTHER parameter definitions (not assigned to this athlete)
  const otherParameters = useMemo((): ParameterWithDetails[] => {
    const athleteDefIds = new Set(athleteParameters.map(ap => ap.parameterDefinitionId));
    
    return parameterDefinitions
      .filter(pd => !athleteDefIds.has(pd.id))
      .map(pd => ({
        id: `def-${pd.id}`,
        definitionId: pd.id,
        name: pd.name,
        unit: pd.unit || "",
        type: pd.type,
        latestValue: null,
        isFromAthlete: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [athleteParameters, parameterDefinitions]);

  // Calculate percent change
  const percentChange = useMemo(() => {
    if (typeof preTestValue === "number" && typeof goalValue === "number" && preTestValue > 0) {
      return ((goalValue - preTestValue) / preTestValue) * 100;
    }
    return 0;
  }, [preTestValue, goalValue]);

  const handleSelectParameter = (param: ParameterWithDetails) => {
    setSelectedParameterId(param.id);
    setDescription(param.name);
    setUnit(param.unit);
    setIsCustomMode(false);
    setCustomName("");
    
    // Auto-fill pre-test value if available (only for athlete's parameters)
    if (param.latestValue && param.isFromAthlete) {
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

  const handleSelectFromSubGoalOptions = (value: string) => {
    setDescription(value);
    setIsCustomMode(false);
    setSelectedParameterId(null);
    setComboboxOpen(false);
  };

  const handleEnterCustomMode = () => {
    setIsCustomMode(true);
    setSelectedParameterId(null);
    setDescription("");
    setPreTestValue("");
    setGoalValue("");
    setUnit("");
    setComboboxOpen(false);
  };

  const resetForm = () => {
    setCategory("subgoal");
    setComboboxOpen(false);
    setSelectedParameterId(null);
    setDescription("");
    setIsCustomMode(false);
    setCustomName("");
    setComments("");
    setTestMethod("");
    setPreTestValue("");
    setGoalValue("");
    setUnit("");
    setEventName("");
    setParentGoalId(defaultParentGoalId);
  };

  const handleSave = () => {
    if (category === "subgoal") {
      const goalDescription = isCustomMode ? customName : description;
      
      if (!goalDescription) return;

      onAddSubGoal({
        parentGoalId: parentGoalId || undefined,
        description: goalDescription,
        testMethod,
        preTestValue: typeof preTestValue === "number" ? preTestValue : 0,
        goalValue: typeof goalValue === "number" ? goalValue : 0,
        unit,
        percentChange,
        testDates: [],
        comments,
      });
    } else {
      if (!eventName.trim()) return;

      onAddEvent({
        name: eventName.trim(),
        description: "",
        eventDates: [],
        comments,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const isValid = category === "subgoal" 
    ? (isCustomMode ? customName : description)
    : eventName.trim();

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
            Add {category === "subgoal" ? "Sub-Goal / Test" : "Event"}
          </DialogTitle>
          <DialogDescription>
            Add a measurable sub-goal with testing or schedule an event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selector */}
          <div className="space-y-2">
            <Label>Category</Label>
            <RadioGroup
              value={category}
              onValueChange={(val) => setCategory(val as ItemCategory)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subgoal" id="cat-subgoal" />
                <Label htmlFor="cat-subgoal" className="font-normal cursor-pointer">
                  Sub-Goal / Test
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="event" id="cat-event" />
                <Label htmlFor="cat-event" className="font-normal cursor-pointer">
                  Other Event
                </Label>
              </div>
            </RadioGroup>
          </div>

          {category === "subgoal" ? (
            <>
              {/* Parent Goal Selector */}
              {smartGoals.length > 0 && (
                <div className="space-y-2">
                  <Label>Related Primary Goal (optional)</Label>
                  <Select
                    value={parentGoalId || "none"}
                    onValueChange={(val) => setParentGoalId(val === "none" ? undefined : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select primary goal..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Standalone sub-goal)</SelectItem>
                      {smartGoals.map((goal) => (
                        <SelectItem key={goal.id} value={goal.id}>
                          {goal.description} ({goal.baselineValue} → {goal.desiredValue} {goal.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Sub-Goal Parameter / Description Selector */}
              <div className="space-y-2">
                <Label>Sub-Goal Description</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="w-full justify-between"
                    >
                      {isCustomMode ? (
                        <span className="flex items-center gap-2">
                          <Pencil className="h-4 w-4" />
                          Custom: {customName || "..."}
                        </span>
                      ) : description ? (
                        <span className="truncate">{description}</span>
                      ) : (
                        "Select or create a sub-goal..."
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
                        
                        {/* Sub-Goal Options from Database */}
                        {subGoalOptions.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="Training Goals">
                              {subGoalOptions.slice(0, 20).map((option) => (
                                <CommandItem
                                  key={option}
                                  value={`goal-${option}`}
                                  onSelect={() => handleSelectFromSubGoalOptions(option)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      description === option && !selectedParameterId ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">{option}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                        
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem onSelect={handleEnterCustomMode}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Create custom sub-goal...
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Custom Name (if custom mode) */}
              {isCustomMode && (
                <div className="space-y-2">
                  <Label htmlFor="customName">Sub-Goal Name</Label>
                  <Input
                    id="customName"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g., Improve reactive strength"
                  />
                </div>
              )}

              {/* Test Method */}
              <div className="space-y-2">
                <Label>Test Method</Label>
                <SearchableDropdown
                  value={testMethod}
                  onChange={setTestMethod}
                  options={testMethodOptions}
                  placeholder="Select or type test method..."
                />
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
            Add {category === "subgoal" ? "Sub-Goal" : "Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
