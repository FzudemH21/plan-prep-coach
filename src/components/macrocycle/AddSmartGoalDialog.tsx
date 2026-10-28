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
import { SmartGoal, type GoalSide } from "@/types/training";
import { AthletePerformanceParameter } from "@/types/athlete";
import { ParameterV2 } from "@/types/parametersV2";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasCustomMeasures, measureById, parameterMeasures } from "@/utils/parameterMeasures";
import { GOAL_SIDE_LABELS, goalBaseline, goalDescription, goalShowsPercent, goalUnit } from "@/utils/goalMeasures";

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
  /** With defaultParameterId: the measure to start with (e.g. "add a goal for another measure") */
  defaultMeasureId?: string;
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
  defaultMeasureId,
}: AddSmartGoalDialogProps) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string | null>(defaultParameterId ?? null);
  const [description, setDescription] = useState("");
  const [baselineValue, setBaselineValue] = useState<number | "">("");
  const [desiredValue, setDesiredValue] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  // Which measure of the parameter (unset = main), which side (parameters recorded per side), when
  const [measureId, setMeasureId] = useState<string | undefined>(undefined);
  const [side, setSide] = useState<GoalSide | undefined>(undefined);
  const [phaseNote, setPhaseNote] = useState("");
  const selectedParam = useMemo(() => athleticismParameters.find((p) => p.id === selectedParameterId), [athleticismParameters, selectedParameterId]);
  const measure = selectedParam ? measureById(selectedParam, measureId) : undefined;
  const kind = measure?.kind ?? "number";

  /** Baseline = the athlete's latest value of exactly this measure (and side) */
  const fillBaseline = (paramId: string | null, mId: string | undefined, sd: GoalSide | undefined) => {
    const param = athleticismParameters.find((p) => p.id === paramId);
    const athleteParam = athletePerformanceParams.find((pp) => pp.athleticismParameterId === paramId);
    const latest = param && athleteParam ? goalBaseline({ measureId: mId, side: sd }, param, athleteParam.values) : null;
    const m = param ? measureById(param, mId) : undefined;
    setBaselineValue(latest ?? (m?.kind === "passFail" ? 0 : ""));
    setDesiredValue(m?.kind === "passFail" ? 1 : "");
  };
  /** The side to start with for a parameter recorded per side: the LSI for numbers, both sides otherwise */
  const defaultSide = (param: ParameterV2 | undefined, mId: string | undefined): GoalSide | undefined => {
    if (!param?.perSide) return undefined;
    return measureById(param, mId)?.kind === "number" ? "lsi" : "both";
  };

  // Pre-fill form when editing
  useEffect(() => {
    if (editGoal) {
      setDescription(editGoal.description);
      setBaselineValue(editGoal.baselineValue);
      setDesiredValue(editGoal.desiredValue);
      setUnit(editGoal.unit);
      setSelectedParameterId(editGoal.linkedParameterId || null);
      setMeasureId(editGoal.measureId);
      setSide(editGoal.side);
      setPhaseNote(editGoal.phaseNote ?? "");
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
      setMeasureId(undefined);
      setSide(undefined);
      setPhaseNote("");
    } else if (!editGoal && defaultParameterId) {
      const param = athleticismParameters.find((p) => p.id === defaultParameterId);
      if (param) {
        setSelectedParameterId(param.id);
        setDescription(param.name);
        setUnit(param.unit ?? "");
        setMeasureId(defaultMeasureId);
        const sd = defaultSide(param, defaultMeasureId);
        setSide(sd);
        // Auto-fill baseline from athlete profile if available
        fillBaseline(param.id, defaultMeasureId, sd);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultParameterId, defaultMeasureId, editGoal, athleticismParameters, athletePerformanceParams]);

  // Get athlete's performance parameters with their details. Filters out
  // entries whose underlying parameter has been deleted from the database —
  // without this, a deleted parameter kept showing up here as "Unknown"
  // instead of disappearing.
  const athleteParamsWithDetails = useMemo((): ParameterOptionItem[] => {
    return athletePerformanceParams
      .map((pp): ParameterOptionItem | null => {
        const param = athleticismParameters.find(p => p.id === pp.athleticismParameterId);
        if (!param) return null;
        const latestValue = pp.values.length > 0
          ? pp.values.reduce((latest, v) =>
              new Date(v.recordedAt) > new Date(latest.recordedAt) ? v : latest
            ).value
          : null;

        return {
          id: pp.id,
          athleticismParameterId: pp.athleticismParameterId,
          name: param.name,
          unit: param.unit || "",
          category: param.category,
          latestValue,
          isFromAthlete: true,
        };
      })
      .filter((p): p is ParameterOptionItem => p !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
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

  // Calculate percent change (numbers and LSI only)
  const showsPercent = goalShowsPercent({ measureId, side }, selectedParam);
  const percentChange = useMemo(() => {
    if (showsPercent && typeof baselineValue === "number" && typeof desiredValue === "number" && baselineValue > 0) {
      return ((desiredValue - baselineValue) / baselineValue) * 100;
    }
    return 0;
  }, [baselineValue, desiredValue, showsPercent]);

  const handleSelectParameter = (param: ParameterOptionItem) => {
    setSelectedParameterId(param.athleticismParameterId);
    setDescription(param.name);
    setUnit(param.unit);
    // Starts with the main measure; per side with the LSI (numbers) / both sides
    const full = athleticismParameters.find((p) => p.id === param.athleticismParameterId);
    setMeasureId(undefined);
    const sd = defaultSide(full, undefined);
    setSide(sd);
    // Baseline = the athlete's most recent value of this measure (decimal comma or point)
    fillBaseline(param.athleticismParameterId, undefined, sd);
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
    // Name and unit follow the measure / side: "30 m Sprint · Pain" in /10, "Single-leg hop · LSI" in %
    const measureFields = {
      measureId: measureId && measureId !== "main" ? measureId : undefined,
      side,
      phaseNote: phaseNote.trim() || undefined,
    };
    const name = selectedParam ? goalDescription(selectedParam, measureFields) : description;
    const goalUnitText = selectedParam ? goalUnit(measure, side, selectedParam.unit ?? unit) : unit;

    if (editGoal && onEditGoal) {
      onEditGoal({
        ...editGoal,
        description: name,
        baselineValue: typeof baselineValue === "number" ? baselineValue : 0,
        desiredValue: typeof desiredValue === "number" ? desiredValue : 0,
        unit: goalUnitText,
        percentChange,
        linkedParameterId: selectedParameterId || undefined,
        ...measureFields,
      });
    } else {
      onAddGoal({
        description: name,
        baselineValue: typeof baselineValue === "number" ? baselineValue : 0,
        desiredValue: typeof desiredValue === "number" ? desiredValue : 0,
        unit: goalUnitText,
        percentChange,
        linkedParameterId: selectedParameterId || undefined,
        ...measureFields,
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

          {/* Measure of the parameter (time, pain, quality …) — only when it has several */}
          {selectedParam && hasCustomMeasures(selectedParam) && (
            <div className="space-y-2">
              <Label>Measure</Label>
              <div className="flex flex-wrap gap-1.5">
                {parameterMeasures(selectedParam).map((m) => {
                  const on = (measureId ?? "main") === m.id;
                  return (
                    <Button key={m.id} type="button" size="sm" variant={on ? "default" : "outline"} className="h-8"
                      onClick={() => { const sd = defaultSide(selectedParam, m.id); setMeasureId(m.id); setSide(sd); fillBaseline(selectedParam.id, m.id, sd); }}>
                      {m.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Side — parameters recorded per side */}
          {selectedParam?.perSide && (
            <div className="space-y-2">
              <Label>Side</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(GOAL_SIDE_LABELS) as GoalSide[])
                  .filter((sd) => sd !== "lsi" || kind === "number")
                  .map((sd) => (
                    <Button key={sd} type="button" size="sm" variant={side === sd ? "default" : "outline"} className="h-8"
                      onClick={() => { setSide(sd); fillBaseline(selectedParam.id, measureId, sd); }}>
                      {GOAL_SIDE_LABELS[sd]}
                    </Button>
                  ))}
              </div>
              {side === "lsi" && <p className="text-xs text-muted-foreground">Limb symmetry index: smaller ÷ larger side × 100 %, e.g. target 90 %.</p>}
              {(side === "both" || side === "weaker") && <p className="text-xs text-muted-foreground">The baseline is the weaker side; the target applies to {side === "both" ? "both sides" : "the weaker side"}.</p>}
            </div>
          )}

          {/* Baseline & target — the input matches the measure */}
          {(kind === "number" || side === "lsi") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="baseline">Baseline Value</Label>
                <Input id="baseline" type="number" step="0.01" value={baselineValue}
                  onChange={(e) => setBaselineValue(e.target.value ? parseFloat(e.target.value) : "")} placeholder="Current value" className="flex-1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">Target Value</Label>
                <Input id="target" type="number" step="0.01" value={desiredValue}
                  onChange={(e) => setDesiredValue(e.target.value ? parseFloat(e.target.value) : "")} placeholder="Goal value" />
              </div>
            </div>
          )}
          {kind === "scale" && side !== "lsi" && measure && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseline">Now ({measure.scaleMin ?? 0}–{measure.scaleMax ?? 10})</Label>
                  <Input id="baseline" type="number" min={measure.scaleMin ?? 0} max={measure.scaleMax ?? 10} value={baselineValue}
                    onChange={(e) => setBaselineValue(e.target.value ? parseFloat(e.target.value) : "")} placeholder="Current value" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target ({measure.betterWhen === "higher" ? "at least" : "at most"})</Label>
                  <Input id="target" type="number" min={measure.scaleMin ?? 0} max={measure.scaleMax ?? 10} value={desiredValue}
                    onChange={(e) => setDesiredValue(e.target.value ? parseFloat(e.target.value) : "")} placeholder="Goal value" />
                </div>
              </div>
              {measure.betterWhen !== "higher" && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setDesiredValue(measure.scaleMin ?? 0)}>
                  Target: {measure.scaleMin ?? 0}{measure.scaleMinLabel ? ` (${measure.scaleMinLabel})` : ""}
                </Button>
              )}
              {(measure.scaleMinLabel || measure.scaleMaxLabel) && (
                <p className="text-xs text-muted-foreground">
                  {measure.scaleMin ?? 0} = {measure.scaleMinLabel || "—"} · {measure.scaleMax ?? 10} = {measure.scaleMaxLabel || "—"}
                </p>
              )}
            </div>
          )}
          {kind === "levels" && side !== "lsi" && measure && (
            <div className="grid grid-cols-2 gap-4">
              {([["Now", baselineValue, setBaselineValue], ["Target level", desiredValue, setDesiredValue]] as const).map(([label, value, set]) => (
                <div key={label} className="space-y-2">
                  <Label>{label}</Label>
                  <Select value={value === "" ? undefined : String(value)} onValueChange={(v) => set(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Pick a level" /></SelectTrigger>
                    <SelectContent>
                      {(measure.levels ?? []).map((l, i) => <SelectItem key={i} value={String(i)}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          {kind === "passFail" && side !== "lsi" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Now</Label>
                <Select value={String(baselineValue === "" ? 0 : baselineValue)} onValueChange={(v) => setBaselineValue(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Not passed</SelectItem>
                    <SelectItem value="1">Passed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <p className="h-10 flex items-center text-sm">Passed</p>
              </div>
            </div>
          )}

          {/* Unit display and percent change */}
          {(kind === "number" || side === "lsi") && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{side === "lsi" ? "Unit: % (LSI)" : unit ? `Unit: ${unit}` : ""}</span>
              {percentChange !== 0 && (
                <Badge variant={percentChange < 0 ? "destructive" : "default"}>
                  {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
                </Badge>
              )}
            </div>
          )}

          {/* When in the plan */}
          {selectedParameterId && (
            <div className="space-y-2">
              <Label htmlFor="phase-note">When in the plan <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="phase-note" value={phaseNote} onChange={(e) => setPhaseNote(e.target.value)}
                placeholder="e.g. Phase 1–2, before returning to sprinting" />
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
