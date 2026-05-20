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
import { Check, ChevronsUpDown, Target, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartGoal } from "@/types/training";
import { AthletePerformanceParameter } from "@/types/athlete";
import { ParameterV2 } from "@/types/parametersV2";

interface ParameterOptionItem {
  id: string;
  athleticismParameterId: string;
  name: string;
  unit: string;
  category?: string;
  latestValue: string | null;
  isFromAthlete: boolean;
}

interface AddSmartGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddGoal: (goal: Omit<SmartGoal, 'id'>) => void;
  onEditGoal?: (goal: SmartGoal) => void;
  editGoal?: SmartGoal | null;
  athletePerformanceParams: AthletePerformanceParameter[];
  athleticismParameters: ParameterV2[];
  onOpenCreateParameter?: () => void;
  defaultParameterId?: string | null;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function AddSmartGoalDialog({
  open,
  onOpenChange,
  onAddGoal,
  onEditGoal,
  editGoal,
  athletePerformanceParams,
  athleticismParameters,
  onOpenCreateParameter,
  defaultParameterId,
}: AddSmartGoalDialogProps) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(defaultParameterId ?? null);
  const [description, setDescription] = useState("");
  const [baselineValue, setBaselineValue] = useState<number | "">("");
  const [desiredValue, setDesiredValue] = useState<number | "">("");
  const [unit, setUnit] = useState("");

  // Pre-fill form when editing
  useEffect(() => {
    if (editGoal) {
      setDescription(editGoal.description);
      setBaselineValue(editGoal.baselineValue);
      setDesiredValue(editGoal.desiredValue);
      setUnit(editGoal.unit);
      setSelectedParameterId(editGoal.linkedParameterId || null);
    }
  }, [editGoal]);

  // Reset form when dialog closes or pre-select parameter when it opens
  useEffect(() => {
    if (!open) {
      setSelectedParameterId(null);
      setDescription("");
      setBaselineValue("");
      setDesiredValue("");
      setUnit("");
    } else if (!editGoal && defaultParameterId) {
      const param = athleticismParameters.find((p) => p.id === defaultParameterId);
      if (param) {
        setSelectedParameterId(param.id);
        setDescription(param.name);
        setUnit(param.unit ?? "");
        // Auto-fill baseline from athlete profile if available
        const athleteParam = athletePerformanceParams.find((pp) => pp.athleticismParameterId === param.id);
        if (athleteParam?.values?.length) {
          const latest = athleteParam.values.reduce((a, b) =>
            new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b
          );
          const num = parseFloat(latest.value);
          if (!isNaN(num)) setBaselineValue(num);
        } else {
          setBaselineValue("");
        }
        setDesiredValue("");
      }
    }
  }, [open, defaultParameterId, editGoal, athleticismParameters, athletePerformanceParams]);

  // Get athlete's performance parameters with their details
  const athleteParamsWithDetails = useMemo((): ParameterOptionItem[] => {
    return athletePerformanceParams.map((pp) => {
      const param = athleticismParameters.find(p => p.id === pp.athleticismParameterId);
      const latestValue = pp.values.length > 0 
        ? pp.values.reduce((latest, v) => 
            new Date(v.recordedAt) > new Date(latest.recordedAt) ? v : latest
          ).value 
        : null;
      
      return {
        id: pp.id,
        athleticismParameterId: pp.athleticismParameterId,
        name: param?.name || "Unknown",
        unit: param?.unit || "",
        category: param?.category,
        latestValue,
        isFromAthlete: true,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [athletePerformanceParams, athleticismParameters]);

  // Get all OTHER athleticism parameters (not assigned to this athlete)
  const otherParameters = useMemo((): ParameterOptionItem[] => {
    const athleteParamIds = new Set(athletePerformanceParams.map(pp => pp.athleticismParameterId));
    
    return athleticismParameters
      .filter(p => !athleteParamIds.has(p.id))
      .map(p => ({
        id: `param-${p.id}`,
        athleticismParameterId: p.id,
        name: p.name,
        unit: p.unit || "",
        category: p.category,
        latestValue: null,
        isFromAthlete: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [athletePerformanceParams, athleticismParameters]);

  // Calculate percent change
  const percentChange = useMemo(() => {
    if (typeof baselineValue === "number" && typeof desiredValue === "number" && baselineValue > 0) {
      return ((desiredValue - baselineValue) / baselineValue) * 100;
    }
    return 0;
  }, [baselineValue, desiredValue]);

  const handleSelectParameter = (param: ParameterOptionItem) => {
    setSelectedParameterId(param.athleticismParameterId);
    setDescription(param.name);
    setUnit(param.unit);
    
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

  const handleCreateNewParameter = () => {
    setComboboxOpen(false);
    onOpenChange(false);
    onOpenCreateParameter?.();
  };

  const handleSave = () => {
    if (!description || baselineValue === "" || desiredValue === "") {
      return;
    }

    if (editGoal && onEditGoal) {
      onEditGoal({
        ...editGoal,
        description,
        baselineValue: typeof baselineValue === "number" ? baselineValue : 0,
        desiredValue: typeof desiredValue === "number" ? desiredValue : 0,
        unit,
        percentChange,
        linkedParameterId: selectedParameterId || undefined,
      });
    } else {
      onAddGoal({
        description,
        baselineValue: typeof baselineValue === "number" ? baselineValue : 0,
        desiredValue: typeof desiredValue === "number" ? desiredValue : 0,
        unit,
        percentChange,
        linkedParameterId: selectedParameterId || undefined,
      });
    }

    // Auto-close
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const isValid = description && baselineValue !== "" && desiredValue !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {editGoal ? "Edit SMART Goal" : "Add SMART Goal"}
          </DialogTitle>
          <DialogDescription>
            Select a performance parameter to track as a goal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Parameter Selector */}
          <div className="space-y-2">
            <Label>Parameter</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedParameterId ? (
                    <span className="truncate">{description}</span>
                  ) : (
                    "Select a parameter..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Search parameters..." />
                  <CommandList>
                    <CommandEmpty>No parameters found.</CommandEmpty>
                    
                    {/* Athlete's Performance Parameters */}
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
                                selectedParameterId === param.athleticismParameterId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="truncate">{param.name}</span>
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
                    
                    {/* All Other Athleticism Parameters */}
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
                                  selectedParameterId === param.athleticismParameterId ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <span className="truncate">{param.name}</span>
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
                    
                    {/* Create New Parameter Option */}
                    {onOpenCreateParameter && (
                      <>
                        <CommandSeparator />
                        <CommandGroup>
                          <CommandItem onSelect={handleCreateNewParameter}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create new parameter...
                          </CommandItem>
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Baseline & Target Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseline">Baseline Value</Label>
              <Input
                id="baseline"
                type="number"
                step="0.01"
                value={baselineValue}
                onChange={(e) => setBaselineValue(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="Current value"
                className="flex-1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">Target Value</Label>
              <Input
                id="target"
                type="number"
                step="0.01"
                value={desiredValue}
                onChange={(e) => setDesiredValue(e.target.value ? parseFloat(e.target.value) : "")}
                placeholder="Goal value"
              />
            </div>
          </div>

          {/* Unit display and percent change */}
          {unit && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unit: {unit}</span>
              {percentChange !== 0 && (
                <Badge variant={percentChange < 0 ? "destructive" : "default"}>
                  {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
                </Badge>
              )}
            </div>
          )}

          {!unit && percentChange !== 0 && (
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
            {editGoal ? "Save Changes" : "Add Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
