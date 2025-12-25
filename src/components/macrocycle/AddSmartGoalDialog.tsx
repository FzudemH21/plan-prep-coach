import { useState, useMemo } from "react";
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
import { Check, ChevronsUpDown, Target, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartGoal } from "@/types/training";
import { AthleteParameter, ParameterDefinition } from "@/types/athlete";

interface AthleteParameterWithDetails {
  id: string;
  definitionId: string;
  name: string;
  unit: string;
  type: string;
  latestValue: string | null;
  isFromAthlete: boolean;
}

interface AddSmartGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddGoal: (goal: Omit<SmartGoal, 'id'>) => void;
  athleteParameters: AthleteParameter[];
  parameterDefinitions: ParameterDefinition[];
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function AddSmartGoalDialog({
  open,
  onOpenChange,
  onAddGoal,
  athleteParameters,
  parameterDefinitions,
}: AddSmartGoalDialogProps) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(null);
  const [customGoalName, setCustomGoalName] = useState("");
  const [description, setDescription] = useState("");
  const [baselineValue, setBaselineValue] = useState<number | "">("");
  const [desiredValue, setDesiredValue] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Get athlete's parameters with their details
  const athleteParamsWithDetails = useMemo((): AthleteParameterWithDetails[] => {
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
  const otherParameters = useMemo((): AthleteParameterWithDetails[] => {
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
    if (typeof baselineValue === "number" && typeof desiredValue === "number" && baselineValue > 0) {
      return ((desiredValue - baselineValue) / baselineValue) * 100;
    }
    return 0;
  }, [baselineValue, desiredValue]);

  const handleSelectParameter = (param: AthleteParameterWithDetails) => {
    setSelectedParameterId(param.id);
    setDescription(param.name);
    setUnit(param.unit);
    setIsCustomMode(false);
    setCustomGoalName("");
    
    // Auto-fill baseline if value exists (only for athlete's parameters)
    if (param.latestValue && param.isFromAthlete) {
      const numValue = parseFloat(param.latestValue);
      if (!isNaN(numValue)) {
        setBaselineValue(numValue);
      }
    } else {
      setBaselineValue("");
    }
    setDesiredValue("");
    setComboboxOpen(false);
  };

  const handleEnterCustomMode = () => {
    setIsCustomMode(true);
    setSelectedParameterId(null);
    setDescription("");
    setBaselineValue("");
    setDesiredValue("");
    setUnit("");
    setComboboxOpen(false);
  };

  const handleSave = () => {
    const goalDescription = isCustomMode ? customGoalName : description;
    
    if (!goalDescription || baselineValue === "" || desiredValue === "") {
      return;
    }

    onAddGoal({
      description: goalDescription,
      baselineValue: typeof baselineValue === "number" ? baselineValue : 0,
      desiredValue: typeof desiredValue === "number" ? desiredValue : 0,
      unit,
      percentChange,
      linkedParameterId: selectedParameterId || undefined,
    });

    // Reset form
    setSelectedParameterId(null);
    setCustomGoalName("");
    setDescription("");
    setBaselineValue("");
    setDesiredValue("");
    setUnit("");
    setIsCustomMode(false);

    // Auto-close
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedParameterId(null);
    setCustomGoalName("");
    setDescription("");
    setBaselineValue("");
    setDesiredValue("");
    setUnit("");
    setIsCustomMode(false);
    onOpenChange(false);
  };

  const isValid = (isCustomMode ? customGoalName : description) && 
    baselineValue !== "" && 
    desiredValue !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Add SMART Goal
          </DialogTitle>
          <DialogDescription>
            Select an existing parameter or create a custom goal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Parameter / Goal Selector */}
          <div className="space-y-2">
            <Label>Goal / Parameter</Label>
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
                      Custom goal: {customGoalName || "..."}
                    </span>
                  ) : selectedParameterId ? (
                    description
                  ) : (
                    "Select a parameter or create custom..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Search parameters..." />
                  <CommandList>
                    <CommandEmpty>No parameters found.</CommandEmpty>
                    
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
                    
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleEnterCustomMode}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Create custom goal...
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Custom Goal Name (if custom mode) */}
          {isCustomMode && (
            <div className="space-y-2">
              <Label htmlFor="customGoalName">Goal Name</Label>
              <Input
                id="customGoalName"
                value={customGoalName}
                onChange={(e) => setCustomGoalName(e.target.value)}
                placeholder="e.g., 100m Sprint Time"
              />
            </div>
          )}

          {/* Baseline & Target Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseline">Baseline Value</Label>
              <div className="flex gap-2">
                <Input
                  id="baseline"
                  type="number"
                  step="0.01"
                  value={baselineValue}
                  onChange={(e) => setBaselineValue(e.target.value ? parseFloat(e.target.value) : "")}
                  placeholder="10.9"
                  className="flex-1"
                />
                {isCustomMode && (
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="unit"
                    className="w-20"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">Target Value</Label>
              <Input
                id="target"
                type="number"
                step="0.01"
                value={desiredValue}
                onChange={(e) => setDesiredValue(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="10.5"
              />
            </div>
          </div>

          {/* Unit display and percent change */}
          {!isCustomMode && unit && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unit: {unit}</span>
              {percentChange !== 0 && (
                <Badge variant={percentChange < 0 ? "destructive" : "default"}>
                  {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
                </Badge>
              )}
            </div>
          )}

          {isCustomMode && percentChange !== 0 && (
            <div className="flex justify-end">
              <Badge variant={percentChange < 0 ? "destructive" : "default"}>
                {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Add Goal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
