import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { GripVertical, MoreVertical, Link2, Copy, Trash2, Plus, StickyNote, Calculator, ChevronDown, ChevronRight, RefreshCw, Recycle, History } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkoutExercise } from '@/types/workout';
import type { CircuitExercise } from '@/contexts/CustomLibrariesContext';

function formatCircuitExerciseParams(sub: CircuitExercise): string {
  const enabled = sub.enabledParams ?? ['reps'];
  const parts: string[] = [];
  if (enabled.includes('reps') && sub.reps) parts.push(`${sub.reps}×`);
  if (enabled.includes('time') && sub.time) parts.push(`${sub.time}s`);
  if (enabled.includes('distance') && sub.distance) parts.push(`${sub.distance}m`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
import { ParameterInputField } from './ParameterInputField';
import { getParametersForMethod } from '@/data/methodParameters';
import { ParameterVisibilityPopover, ParameterVisibilityOverrides, isParameterVisible } from './ParameterVisibilityPopover';
import { ToolboxEntry } from '@/types/toolbox';
import { useWorkoutSession } from './WorkoutSessionContext';
import { evaluateFormula } from '@/utils/formulaEvaluator';

interface WorkoutExerciseCardProps {
  exercise: WorkoutExercise;
  isInSuperset: boolean;
  supersetLabel?: string;
  onParameterChange: (paramName: string, value: string | number) => void;
  onUnitChange: (paramName: string, unit: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
  notes?: string;
  onNotesChange?: (notes: string) => void;
  eachSide?: boolean;
  onEachSideChange?: (value: boolean) => void;
  // Parameter visibility props
  toolboxParams?: ToolboxEntry[];
  visibilityOverrides?: ParameterVisibilityOverrides;
  onVisibilityChange?: (paramName: string, visible: boolean) => void;
  onShowAllParams?: () => void;
  onResetParamsToDefaults?: () => void;
  // Auto-calculation props
  autoCalculateWeight?: boolean;
  onAutoCalculateWeightChange?: (value: boolean) => void;
  autoCalculateTargetHR?: boolean;
  onAutoCalculateTargetHRChange?: (value: boolean) => void;
  // Collapse state
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // Exercise detail dialog
  onOpenDetail?: () => void;
  // Change exercise
  onChangeExercise?: (newExercise: { 
    exerciseId: string; 
    exerciseName: string; 
    libraryId: string;
    videoUrl?: string;
    description?: string;
  }) => void;
  // Open full library popup for change
  onOpenChangeLibrary?: () => void;
  // Open detail dialog for a circuit sub-exercise
  onOpenCircuitExerciseDetail?: (exerciseId: string, libraryId: string, exerciseName: string) => void;
  // Open exercise history sheet (only when an athlete connection is available)
  onOpenHistory?: () => void;
}

export const WorkoutExerciseCard = React.memo(function WorkoutExerciseCard({
  exercise,
  isInSuperset,
  supersetLabel,
  onParameterChange,
  onUnitChange,
  onDuplicate,
  onDelete,
  dragHandleProps,
  notes,
  onNotesChange,
  eachSide,
  onEachSideChange,
  toolboxParams,
  visibilityOverrides = {},
  onVisibilityChange,
  onShowAllParams,
  onResetParamsToDefaults,
  autoCalculateWeight,
  onAutoCalculateWeightChange,
  autoCalculateTargetHR,
  onAutoCalculateTargetHRChange,
  isCollapsed = false,
  onToggleCollapse,
  onOpenDetail,
  onChangeExercise,
  onOpenChangeLibrary,
  onOpenCircuitExerciseDetail,
  onOpenHistory,
}: WorkoutExerciseCardProps) {

  // ── Circuit rendering ───────────────────────────────────────────────────────
  if (exercise.isCircuit) {
    const subExercises = (exercise.circuitExercises ?? []).slice().sort((a, b) => a.order - b.order);
    return (
      <Card className="p-4 bg-primary/5 border-primary/30">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing mt-1 hover:text-primary transition-colors">
            <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>

          {/* Collapse Toggle */}
          {onToggleCollapse && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-0.5" onClick={onToggleCollapse}>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}

          <div className="flex-1 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-primary shrink-0" />
                <button
                  className={`font-medium text-sm text-left ${onOpenDetail ? 'hover:text-primary hover:underline cursor-pointer' : 'cursor-default'}`}
                  onClick={onOpenDetail}
                  disabled={!onOpenDetail}
                >
                  {exercise.exerciseName}
                </button>
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[60] bg-popover">
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Circuit info: rounds + rest */}
            {!isCollapsed && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">
                  {exercise.circuitRounds ?? '3'} rounds
                </span>
                &nbsp;·&nbsp;
                Rest between rounds:{' '}
                <span className="font-medium">
                  {exercise.circuitRestBetweenRounds ? `${exercise.circuitRestBetweenRounds}s` : '—'}
                </span>
                &nbsp;·&nbsp;
                Rest between exercises:{' '}
                <span className="font-medium">
                  {exercise.circuitRestBetweenExercises ? `${exercise.circuitRestBetweenExercises}s` : '—'}
                </span>
              </p>
            )}

            {/* Comments */}
            {!isCollapsed && exercise.circuitComments && (
              <p className="text-xs text-muted-foreground/80 italic">{exercise.circuitComments}</p>
            )}

            {/* Sub-exercise list */}
            {!isCollapsed && subExercises.length > 0 && (
              <div className="space-y-1 mt-1">
                {subExercises.map((sub, idx) => (
                  <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/70 border text-xs">
                    <span className="w-4 text-center font-semibold text-muted-foreground shrink-0">{idx + 1}</span>
                    <button
                      className={`flex-1 text-left font-medium min-w-0 truncate ${onOpenCircuitExerciseDetail ? 'text-primary hover:underline cursor-pointer' : ''}`}
                      onClick={() => onOpenCircuitExerciseDetail?.(sub.exerciseId, sub.libraryId, sub.exerciseName)}
                      disabled={!onOpenCircuitExerciseDetail}
                    >
                      {sub.exerciseName}
                    </button>
                    <span className="text-muted-foreground shrink-0">{formatCircuitExerciseParams(sub)}</span>
                  </div>
                ))}
              </div>
            )}

            {subExercises.length === 0 && !isCollapsed && (
              <p className="text-xs text-muted-foreground italic">No exercises in this circuit.</p>
            )}
          </div>
        </div>
      </Card>
    );
  }
  // Get parameters: FIRST derive from exercise.parameters (from method periodization), THEN fallback to static dictionary
  const methodParams = (() => {
    // PRIMARY: Derive parameters from exercise.parameters (populated from method periodization grid)
    const keys = Object.keys(exercise.parameters || {});
    const baseKeys = keys.filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k));


    if (baseKeys.length > 0) {
      return baseKeys.map(name => {
        const raw = exercise.parameters[name];
        const isNumeric = typeof raw === 'number' || (!isNaN(Number(raw)) && raw !== '');
        // Find toolbox entry for this param to get flags
        const toolboxEntry = toolboxParams?.find(tp => 
          tp.parameterName === name
        );
        return {
          name,
          type: isNumeric ? 'number' : 'text',
          unit: typeof exercise.parameters[`${name}_unit`] === 'string' 
            ? String(exercise.parameters[`${name}_unit`]) 
            : undefined,
          isSetParameter: toolboxEntry?.isSetParameter || /^sets?$/i.test(name) || /ground contacts/i.test(name),
          isRestParameter: toolboxEntry?.isRestParameter || /rest|pause|recovery/i.test(name),
          isFrequencyParameter: toolboxEntry?.isFrequencyParameter || false,
          defaultValue: undefined,
          showInGridByDefault: toolboxEntry?.showInGridByDefault ?? true,
        } as const;
      });
    }
    
    // FALLBACK: Only use static dictionary if no parameters in exercise.parameters
    const defs = getParametersForMethod(exercise.methodId);
    return (defs || []).map(d => ({
      ...d,
      isFrequencyParameter: false,
      showInGridByDefault: true,
    }));
  })();

  // Find the set parameter (exclude rest params — rest is not a set-count driver)
  const setParam = methodParams.find(p => p.isSetParameter && !p.isRestParameter);
  const setCount = setParam
    ? Number(exercise.parameters[setParam.name] || 3) // Default to 3 sets
    : 0;

  // Separate set parameter from other parameters
  // EXCLUDE: true set parameters (but NOT rest params), frequency parameters
  const displayableParams = methodParams.filter(p =>
    (!p.isSetParameter || p.isRestParameter) && !p.isFrequencyParameter
  );
  
  // Split into visible and hidden params based on visibility
  const visibleParams = displayableParams.filter(p =>
    isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides)
  );
  const hiddenParams = displayableParams.filter(p =>
    !isParameterVisible(p.name, p.showInGridByDefault, visibilityOverrides)
  );


  // Detect %1RM and %maxHR parameters for auto-calculation toggles
  const autoCalcDetection = useMemo(() => {
    let has1RMParam = false;
    let hasMaxHRParam = false;
    let intensityParamName: string | null = null;
    let hrParamName: string | null = null;

    // Check stored units in exercise.parameters
    for (const param of displayableParams) {
      const unit = exercise.parameters[`${param.name}_unit`] as string | undefined;
      if (unit === '%1RM') {
        has1RMParam = true;
        intensityParamName = param.name;
      }
      if (unit === '%maxHR') {
        hasMaxHRParam = true;
        hrParamName = param.name;
      }
    }

    // Also check toolbox params for default units
    if (toolboxParams) {
      for (const tp of toolboxParams) {
        if (tp.parameterType === 'quantitative' && tp.options.includes('%1RM')) {
          const matchedParam = displayableParams.find(p => p.name === tp.parameterName);
          if (matchedParam) {
            const storedUnit = exercise.parameters[`${matchedParam.name}_unit`];
            if (!storedUnit || storedUnit === '%1RM') {
              has1RMParam = true;
              intensityParamName = matchedParam.name;
            }
          }
        }
        if (tp.parameterType === 'quantitative' && tp.options.includes('%maxHR')) {
          const matchedParam = displayableParams.find(p => p.name === tp.parameterName);
          if (matchedParam) {
            const storedUnit = exercise.parameters[`${matchedParam.name}_unit`];
            if (!storedUnit || storedUnit === '%maxHR') {
              hasMaxHRParam = true;
              hrParamName = matchedParam.name;
            }
          }
        }
      }
    }

    return { has1RMParam, hasMaxHRParam, intensityParamName, hrParamName };
  }, [displayableParams, exercise.parameters, toolboxParams]);

  const { resolveAthleteDataRefs } = useWorkoutSession();

  // Handle deleting a set
  const handleDeleteSet = (setNumber: number) => {
    if (setCount <= 1) return; // Don't delete if only one set remains
    
    // Decrease set count
    onParameterChange(setParam!.name, setCount - 1);
    
    // Reindex all sets after the deleted one
    displayableParams.forEach(param => {
      // Shift values up from deleted set onwards
      for (let i = setNumber; i < setCount; i++) {
        const currentKey = `${param.name}_set${i}`;
        const nextKey = `${param.name}_set${i + 1}`;
        const nextValue = exercise.parameters[nextKey];
        
        if (nextValue !== undefined) {
          onParameterChange(currentKey, nextValue);
        }
      }
      
      // Clear the last set's value (since we shifted everything up)
      onParameterChange(`${param.name}_set${setCount}`, '');
    });
  };

  // Handle adding a new set (copies values from the last set)
  const handleAddSet = () => {
    const newSetNumber = setCount + 1;
    const lastSetNumber = setCount;
    
    // Copy all parameter values from the last set to the new set
    displayableParams.forEach(param => {
      const lastSetKey = `${param.name}_set${lastSetNumber}`;
      const newSetKey = `${param.name}_set${newSetNumber}`;
      const lastSetValue = exercise.parameters[lastSetKey];
      
      // Copy the value if it exists
      if (lastSetValue !== undefined) {
        onParameterChange(newSetKey, lastSetValue);
      }
    });
    
    // Finally, increment the set count
    onParameterChange(setParam!.name, newSetNumber);
  };

  return (
    <Card className={`p-4 bg-muted/50 ${isInSuperset ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div 
          {...dragHandleProps} 
          className="cursor-grab active:cursor-grabbing mt-1 hover:text-primary transition-colors"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        </div>

        {/* Collapse Toggle */}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 mt-0.5"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}

        {/* Exercise Content */}
        <div className="flex-1 space-y-3">
          {/* Exercise Header */}
          <div className="flex items-start justify-between">
            <div>
              {/* Exercise name - click to view details */}
              <h4 
                className={`font-medium ${onOpenDetail ? 'text-primary hover:underline cursor-pointer' : ''}`}
                onClick={() => onOpenDetail?.()}
              >
                {exercise.exerciseName}
              </h4>
              {!isCollapsed && (
                <p className="text-sm text-muted-foreground">
                  {exercise.methodId} {exercise.categoryName && `• ${exercise.categoryName}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isInSuperset && supersetLabel && (
                <Badge variant="outline" className="text-xs">
                  {supersetLabel}
                </Badge>
              )}
              {/* Exercise history button — only when an athlete connection is available */}
              {onOpenHistory && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onOpenHistory(); }}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Exercise history</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Parameter Visibility Popover - only show when expanded */}
              {!isCollapsed && onVisibilityChange && displayableParams.length > 0 && (
                <ParameterVisibilityPopover
                  parameters={displayableParams.map(p => ({
                    name: p.name,
                    showInGridByDefault: p.showInGridByDefault
                  }))}
                  visibilityOverrides={visibilityOverrides}
                  onVisibilityChange={onVisibilityChange}
                  onShowAll={onShowAllParams || (() => {})}
                  onResetToDefaults={onResetParamsToDefaults || (() => {})}
                />
              )}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    aria-label="Open exercise actions"
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[60] bg-popover">
                  {onOpenChangeLibrary && (
                    <DropdownMenuItem onClick={onOpenChangeLibrary}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Change Exercise
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Hidden Parameters as Badges - show even when collapsed */}
          {hiddenParams.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hiddenParams.map(param => {
                const value = exercise.parameters[param.name];
                if (value === undefined || value === '') return null;
                return (
                  <Badge 
                    key={param.name} 
                    variant="secondary" 
                    className="text-xs font-normal"
                  >
                    {param.name}: {String(value)}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Collapsible Content */}
          {!isCollapsed && (
            <>

          {/* Auto-Calculation Toggles */}
          {(autoCalcDetection.has1RMParam || autoCalcDetection.hasMaxHRParam) && (
            <div className="flex flex-wrap items-center gap-4 p-2 bg-transparent rounded-md">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calculator className="h-3.5 w-3.5" />
                <span className="font-medium">Auto-calculate:</span>
              </div>
              
              {autoCalcDetection.has1RMParam && onAutoCalculateWeightChange && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-4">
                        <Switch
                          id={`calc-weight-${exercise.id}`}
                          checked={autoCalculateWeight || false}
                          onCheckedChange={onAutoCalculateWeightChange}
                          className="h-4 w-7"
                        />
                        <label
                          htmlFor={`calc-weight-${exercise.id}`}
                          className="text-xs cursor-pointer ml-1"
                        >
                          Weight [kg]
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Calculate weight from {autoCalcDetection.intensityParamName} × Athlete's 1RM</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {autoCalcDetection.hasMaxHRParam && onAutoCalculateTargetHRChange && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-4">
                        <Switch
                          id={`calc-hr-${exercise.id}`}
                          checked={autoCalculateTargetHR || false}
                          onCheckedChange={onAutoCalculateTargetHRChange}
                          className="h-4 w-7"
                        />
                        <label
                          htmlFor={`calc-hr-${exercise.id}`}
                          className="text-xs cursor-pointer ml-1"
                        >
                          Target HR [bpm]
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Calculate target HR from %maxHR × Athlete's Max HR</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          )}

          {/* Parameters Display - only render if there are visible params */}
          {visibleParams.length > 0 && (
            setParam && setCount > 0 ? (
              // TABLE LAYOUT (when set parameter exists and there are visible params)
              <div className="w-full space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{setParam?.name || 'Set'}</TableHead>
                      {visibleParams.map(param => {
                        // First try stored unit in exercise parameters
                        let unit = exercise.parameters[`${param.name}_unit`] as string | undefined;
                        
                        // If no unit stored, look up from toolbox (for quantitative params)
                        if (!unit && toolboxParams) {
                          const toolboxEntry = toolboxParams.find(tp => tp.parameterName === param.name);
                          if (toolboxEntry && toolboxEntry.parameterType === 'quantitative' && toolboxEntry.options.length > 0) {
                            // For quantitative params, first option is the default unit
                            unit = toolboxEntry.options[0];
                          }
                        }
                        
                        // Format the header with unit if it exists
                        const headerText = unit 
                          ? `${param.name} [${unit}]`
                          : param.name;
                        
                        // Rest parameters are always in seconds — lock the unit label
                        const displayHeader = param.isRestParameter
                          ? `${param.name} [s]`
                          : headerText;
                        return (
                          <TableHead key={param.name}>{displayHeader}</TableHead>
                        );
                      })}
                      {/* Auto-calculated Weight column */}
                      {autoCalculateWeight && autoCalcDetection.has1RMParam && (
                        <TableHead className="text-primary">
                          <div className="flex items-center gap-1">
                            <Calculator className="h-3 w-3" />
                            Weight [kg]
                          </div>
                        </TableHead>
                      )}
                      {/* Auto-calculated Target HR column */}
                      {autoCalculateTargetHR && autoCalcDetection.hasMaxHRParam && (
                        <TableHead className="text-primary">
                          <div className="flex items-center gap-1">
                            <Calculator className="h-3 w-3" />
                            Target HR [bpm]
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: setCount }, (_, setIndex) => (
                      <TableRow key={setIndex}>
                        <TableCell className="font-medium">{setIndex + 1}</TableCell>
                        {visibleParams.map(param => (
                          <TableCell key={param.name}>
                            <ParameterInputField
                              parameter={param}
                              value={
                                // Per-set key (ad-hoc) takes priority; fall back to plain key
                                // for periodization exercises (values stored as flat "Rest: 90").
                                (exercise.parameters[`${param.name}_set${setIndex + 1}`] as string | number | undefined)
                                  ?? exercise.parameters[param.name]
                                  ?? param.defaultValue
                                  ?? ''
                              }
                              unit={exercise.parameters[`${param.name}_unit`] as string}
                              onValueChange={(value) => onParameterChange(`${param.name}_set${setIndex + 1}`, value)}
                              onUnitChange={(unit) => onUnitChange(param.name, unit)}
                              showLabel={false}
                            />
                          </TableCell>
                        ))}
                        {/* Auto-calculated Weight cell */}
                        {autoCalculateWeight && autoCalcDetection.has1RMParam && (() => {
                          // Units that express a fraction: value stored as e.g. 80, meaning 0.80
                          const PCT_UNITS = new Set(['%', '%1RM', '%maxHR', '% 1RM', '% maxHR']);
                          const calcEntry = toolboxParams?.find(
                            tp => tp.isCalculated && tp.formula && tp.athleteDataRefs?.includes('e1RM')
                          );
                          let computed: number | undefined;
                          if (calcEntry && calcEntry.formula) {
                            // Build context: method params by ID; percentage units auto-scaled ÷100
                            const ctx: Record<string, number> = {};
                            for (const srcId of (calcEntry.sourceParameterIds ?? [])) {
                              const srcParam = toolboxParams?.find(p => p.id === srcId);
                              if (!srcParam) continue;
                              const raw = exercise.parameters[`${srcParam.parameterName}_set${setIndex + 1}`]
                                ?? exercise.parameters[srcParam.parameterName];
                              const unit = exercise.parameters[`${srcParam.parameterName}_unit`] as string | undefined;
                              let n = parseFloat(String(raw ?? ''));
                              if (!isNaN(n) && unit && PCT_UNITS.has(unit)) n = n / 100;
                              if (!isNaN(n)) ctx[srcParam.parameterName] = n;
                            }
                            const athleteData = resolveAthleteDataRefs(
                              calcEntry.athleteDataRefs ?? [], exercise.exerciseName
                            );
                            for (const [k, v] of Object.entries(athleteData)) {
                              if (v !== undefined) ctx[k] = v;
                            }
                            const result = evaluateFormula(calcEntry.formula, ctx);
                            if (result !== null) computed = Math.round(result * 2) / 2;
                          } else {
                            // Fallback when no isCalculated formula is defined
                            const intensityRaw =
                              exercise.parameters[`${autoCalcDetection.intensityParamName}_set${setIndex + 1}`] ??
                              exercise.parameters[autoCalcDetection.intensityParamName ?? ''] ?? '';
                            const intensity = parseFloat(String(intensityRaw));
                            const e1RMData = resolveAthleteDataRefs(['e1RM'], exercise.exerciseName);
                            const e1RM = e1RMData['e1RM'];
                            if (!isNaN(intensity) && intensity > 0 && e1RM !== undefined)
                              computed = Math.round(intensity / 100 * e1RM * 2) / 2;
                          }
                          return (
                            <TableCell>
                              {computed !== undefined ? (
                                <span className="text-sm font-medium text-primary">{computed} kg</span>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                                  <Calculator className="h-3 w-3 mr-1" />
                                  Auto
                                </Badge>
                              )}
                            </TableCell>
                          );
                        })()}
                        {/* Auto-calculated Target HR cell */}
                        {autoCalculateTargetHR && autoCalcDetection.hasMaxHRParam && (() => {
                          const PCT_UNITS = new Set(['%', '%1RM', '%maxHR', '% 1RM', '% maxHR']);
                          const calcEntry = toolboxParams?.find(
                            tp => tp.isCalculated && tp.formula &&
                              tp.athleteDataRefs?.some(r => r !== 'e1RM')
                          );
                          let computed: number | undefined;
                          if (calcEntry && calcEntry.formula) {
                            const ctx: Record<string, number> = {};
                            for (const srcId of (calcEntry.sourceParameterIds ?? [])) {
                              const srcParam = toolboxParams?.find(p => p.id === srcId);
                              if (!srcParam) continue;
                              const raw = exercise.parameters[`${srcParam.parameterName}_set${setIndex + 1}`]
                                ?? exercise.parameters[srcParam.parameterName];
                              const unit = exercise.parameters[`${srcParam.parameterName}_unit`] as string | undefined;
                              let n = parseFloat(String(raw ?? ''));
                              if (!isNaN(n) && unit && PCT_UNITS.has(unit)) n = n / 100;
                              if (!isNaN(n)) ctx[srcParam.parameterName] = n;
                            }
                            const athleteData = resolveAthleteDataRefs(
                              calcEntry.athleteDataRefs ?? [], exercise.exerciseName
                            );
                            for (const [k, v] of Object.entries(athleteData)) {
                              if (v !== undefined) ctx[k] = v;
                            }
                            const result = evaluateFormula(calcEntry.formula, ctx);
                            if (result !== null) computed = Math.round(result);
                          }
                          // No fallback for HR without isCalculated formula — biometric def ID unknown
                          return (
                            <TableCell>
                              {computed !== undefined ? (
                                <span className="text-sm font-medium text-primary">{computed} bpm</span>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                                  <Calculator className="h-3 w-3 mr-1" />
                                  Auto
                                </Badge>
                              )}
                            </TableCell>
                          );
                        })()}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteSet(setIndex + 1)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Add Set Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={handleAddSet}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Set
                </Button>
              </div>
            ) : (
              // FALLBACK: Grid layout for non-set-based exercises - use visibleParams
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleParams.map((param) => {
                  // Look up unit from toolbox if not in exercise parameters
                  let unit = exercise.parameters[`${param.name}_unit`] as string | undefined;
                  if (!unit && toolboxParams) {
                    const toolboxEntry = toolboxParams.find(tp => tp.parameterName === param.name);
                    if (toolboxEntry && toolboxEntry.parameterType === 'quantitative' && toolboxEntry.options.length > 0) {
                      unit = toolboxEntry.options[0];
                    }
                  }
                  
                  return (
                    <ParameterInputField
                      key={param.name}
                      parameter={param}
                      value={exercise.parameters[param.name] ?? param.defaultValue ?? ''}
                      unit={unit}
                      onValueChange={(value) => onParameterChange(param.name, value)}
                      onUnitChange={(unit) => onUnitChange(param.name, unit)}
                      showLabel={false}
                    />
                  );
                })}
                {/* Auto-calculated badges for grid layout */}
                {autoCalculateWeight && autoCalcDetection.has1RMParam && (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-primary/5 border-primary/20">
                    <Calculator className="h-4 w-4 text-primary" />
                    <div className="text-xs">
                      <div className="font-medium text-primary">Weight [kg]</div>
                      <div className="text-muted-foreground">Auto-calculated</div>
                    </div>
                  </div>
                )}
                {autoCalculateTargetHR && autoCalcDetection.hasMaxHRParam && (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-primary/5 border-primary/20">
                    <Calculator className="h-4 w-4 text-primary" />
                    <div className="text-xs">
                      <div className="font-medium text-primary">Target HR [bpm]</div>
                      <div className="text-muted-foreground">Auto-calculated</div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Each Side Toggle */}
          <div className="flex items-center gap-2 mt-2">
            <Checkbox 
              id={`each-side-${exercise.id}`}
              checked={eachSide || false}
              onCheckedChange={(checked) => onEachSideChange?.(!!checked)}
            />
            <label 
              htmlFor={`each-side-${exercise.id}`} 
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Each Side
            </label>
          </div>

          {/* Always visible notes section - only when expanded */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 mb-1">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="text-xs text-muted-foreground">Notes</label>
            </div>
            <Textarea
              value={notes || exercise.notes || ''}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder="Add exercise notes..."
              className="text-xs min-h-[60px] resize-none"
            />
          </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
});
