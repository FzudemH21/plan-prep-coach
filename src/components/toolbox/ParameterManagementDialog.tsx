import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calculator, AlertCircle, ChevronDown, Pencil, Check, X } from 'lucide-react';
import { ToolboxEntry } from '@/types/toolbox';
import { DraggableParameterList } from './DraggableParameterList';
import { DraggableExerciseCategoryList } from './DraggableExerciseCategoryList';
import { QuantitativeParameterInput, QualitativeParameterInput } from '@/components/ui/parameter-input';
import { validateFormula, extractParameterNames } from '@/utils/formulaEvaluator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

// Predefined units for quantitative parameters — no custom units allowed
const PREDEFINED_UNITS = [
  { value: '#', label: '# (count)' },
  { value: 's', label: 's (seconds)' },
  { value: 'min', label: 'min (minutes)' },
  { value: 'm', label: 'm (meters)' },
  { value: 'km', label: 'km (kilometers)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'lbs', label: 'lbs (pounds)' },
  { value: '%', label: '% (percentage)' },
  { value: '%1RM', label: '%1RM (% of 1 Rep Max)' },
  { value: '%BW', label: '%BW (% of body weight)' },
  { value: 'RPE', label: 'RPE (Rate of Perceived Exertion)' },
  { value: 'RiR', label: 'RiR (Reps in Reserve)' },
  { value: 'm/s', label: 'm/s (velocity)' },
  { value: '%maxV', label: '%maxV (% of peak velocity)' },
  { value: 'bpm', label: 'bpm (heart rate)' },
  { value: '%maxHR', label: '%maxHR (% of max heart rate)' },
  { value: 'W', label: 'W (watts)' },
  { value: 'W/kg', label: 'W/kg (watts per kg bodyweight)' },
  { value: 'rpm', label: 'rpm (revolutions per minute)' },
  { value: 'steps/min', label: 'steps/min (cadence)' },
];

// ─── Formula token picker ───────────────────────────────────────────────────

type TokenGroup = 'Method parameters' | 'Body metrics' | 'Performance parameters' | 'Special';

interface FormulaToken {
  name: string;
  group: TokenGroup;
  unit?: string;
  sourceId?: string;   // method param ID → sourceParameterIds
  athleteRef?: string; // biometric/perf param ID or 'e1RM' → athleteDataRefs
}

interface FormulaTokenPickerProps {
  methodParams: Array<{ id: string; name: string }>;
  bodyMetrics: Array<{ id: string; name: string; unit?: string | null }>;
  perfParams: Array<{ id: string; name: string; unit?: string }>;
  onInsert: (token: FormulaToken) => void;
}

function FormulaTokenPicker({ methodParams, bodyMetrics, perfParams, onInsert }: FormulaTokenPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allTokens: FormulaToken[] = [
    ...methodParams.map(p => ({ name: p.name, group: 'Method parameters' as const, sourceId: p.id })),
    ...bodyMetrics.map(b => ({ name: b.name, group: 'Body metrics' as const, unit: b.unit ?? undefined, athleteRef: b.id })),
    ...perfParams.map(p => ({ name: p.name, group: 'Performance parameters' as const, unit: p.unit, athleteRef: p.id })),
    { name: 'e1RM', group: 'Special' as const, unit: 'kg / lb', athleteRef: 'e1RM' },
  ];

  const lowerSearch = search.toLowerCase();
  const filtered = search ? allTokens.filter(t => t.name.toLowerCase().includes(lowerSearch)) : allTokens;
  const groups: TokenGroup[] = ['Method parameters', 'Body metrics', 'Performance parameters', 'Special'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" className="w-full justify-between text-muted-foreground font-normal">
          Insert parameter…
          <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-1 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search parameters…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No parameters found.</CommandEmpty>
            {groups.map(group => {
              const tokens = filtered.filter(t => t.group === group);
              if (tokens.length === 0) return null;
              return (
                <CommandGroup key={group} heading={group}>
                  {tokens.map(token => (
                    <CommandItem
                      key={`${group}::${token.name}`}
                      value={`${group} ${token.name}`}
                      onSelect={() => {
                        onInsert(token);
                        setSearch('');
                        setOpen(false);
                      }}
                    >
                      <span className="flex-1">{token.name}</span>
                      {token.unit && <span className="text-xs text-muted-foreground ml-2">{token.unit}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

interface ParameterManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  subCategory: string;
  parameters: ToolboxEntry[];
  onUpdateParameters: (parameters: ToolboxEntry[]) => void;
  onSubCategoryChange?: (newName: string) => void;
  onCategoryChange?: (newCategory: string) => void;
}

export function ParameterManagementDialog({
  open,
  onOpenChange,
  category,
  subCategory,
  parameters,
  onUpdateParameters,
  onSubCategoryChange,
  onCategoryChange,
}: ParameterManagementDialogProps) {
  const [editingParameter, setEditingParameter] = useState<ToolboxEntry | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newParameter, setNewParameter] = useState({
    parameterName: '',
    parameterType: 'qualitative' as 'qualitative' | 'quantitative',
    options: [] as string[],
    isFrequencyParameter: false,
    isSetParameter: false,
    isRestParameter: false,
    showInGridByDefault: true,
    isCalculated: false,
    formula: '',
    sourceParameterIds: [] as string[],
    athleteDataRefs: [] as string[],
  });
  const [newExerciseCategory, setNewExerciseCategory] = useState('');

  const { biometricDefinitions } = useAthletes();
  const { data: paramsV2Data } = useParametersDataV2();
  const quantitativeBiometrics = useMemo(
    () => biometricDefinitions.filter(b => b.type === 'quantitative'),
    [biometricDefinitions],
  );
  const performanceParams = useMemo(() => paramsV2Data?.parameters ?? [], [paramsV2Data]);

  const handleReorderParameters = (reorderedParameters: ToolboxEntry[]) => {
    onUpdateParameters(reorderedParameters);
  };

  const handleEditParameter = (parameter: ToolboxEntry) => {
    setEditingParameter(parameter);
  };

  const handleSaveEditedParameter = () => {
    if (!editingParameter) return;

    const isStructural = editingParameter.isFrequencyParameter || editingParameter.isSetParameter || editingParameter.isRestParameter;
    const finalEntry: ToolboxEntry = {
      ...editingParameter,
      showInGridByDefault: isStructural ? false : editingParameter.showInGridByDefault,
    };

    let updatedParameters = parameters.map(p =>
      p.id === finalEntry.id ? finalEntry : p
    );

    // If this parameter is marked as frequency, unmark all others
    if (finalEntry.isFrequencyParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === finalEntry.id ? p : { ...p, isFrequencyParameter: false }
      );
    }

    // If this parameter is marked as set parameter, unmark all others
    if (finalEntry.isSetParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === finalEntry.id ? p : { ...p, isSetParameter: false }
      );
    }

    // If this parameter is marked as rest parameter, unmark all others
    if (finalEntry.isRestParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === finalEntry.id ? p : { ...p, isRestParameter: false }
      );
    }

    onUpdateParameters(updatedParameters);
    setEditingParameter(null);
  };

  const handleAddParameter = () => {
    const isStructural = newParameter.isFrequencyParameter || newParameter.isSetParameter || newParameter.isRestParameter;
    const parameter: ToolboxEntry = {
      id: Date.now().toString(),
      category,
      subCategory,
      parameterName: newParameter.parameterName,
      parameterType: newParameter.parameterType,
      options: newParameter.options,
      isFrequencyParameter: newParameter.isCalculated ? false : newParameter.isFrequencyParameter,
      isSetParameter: newParameter.isCalculated ? false : newParameter.isSetParameter,
      isRestParameter: newParameter.isCalculated ? false : newParameter.isRestParameter,
      showInGridByDefault: isStructural ? false : newParameter.showInGridByDefault,
      isCalculated: newParameter.isCalculated,
      formula: newParameter.isCalculated ? newParameter.formula : undefined,
      sourceParameterIds: newParameter.isCalculated ? newParameter.sourceParameterIds : undefined,
      athleteDataRefs: newParameter.isCalculated ? newParameter.athleteDataRefs : undefined,
    };

    let updatedParameters = [...parameters, parameter];

    // If this new parameter is marked as frequency, unmark all others
    if (newParameter.isFrequencyParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === parameter.id ? p : { ...p, isFrequencyParameter: false }
      );
    }

    // If this new parameter is marked as set parameter, unmark all others
    if (newParameter.isSetParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === parameter.id ? p : { ...p, isSetParameter: false }
      );
    }

    // If this new parameter is marked as rest parameter, unmark all others
    if (newParameter.isRestParameter) {
      updatedParameters = updatedParameters.map(p =>
        p.id === parameter.id ? p : { ...p, isRestParameter: false }
      );
    }

    onUpdateParameters(updatedParameters);
    setNewParameter({
      parameterName: '',
      parameterType: 'qualitative',
      options: [],
      isFrequencyParameter: false,
      isSetParameter: false,
      isRestParameter: false,
      showInGridByDefault: true,
      isCalculated: false,
      formula: '',
      sourceParameterIds: [],
      athleteDataRefs: [],
    });
    setShowAddDialog(false);
  };

  const handleDeleteParameter = (parameterId: string) => {
    const updatedParameters = parameters.filter(p => p.id !== parameterId);
    onUpdateParameters(updatedParameters);
  };

  const addOption = (option: string) => {
    if (!editingParameter) return;
    const options = editingParameter.options || [];
    if (!options.includes(option) && option.trim()) {
      setEditingParameter({
        ...editingParameter,
        options: [...options, option.trim()]
      });
    }
  };

  const removeOption = (option: string) => {
    if (!editingParameter) return;
    setEditingParameter({
      ...editingParameter,
      options: (editingParameter.options || []).filter(o => o !== option)
    });
  };

  const addNewParameterOption = (option: string) => {
    if (!newParameter.options.includes(option) && option.trim()) {
      setNewParameter({
        ...newParameter,
        options: [...newParameter.options, option.trim()]
      });
    }
  };

  const removeNewParameterOption = (option: string) => {
    setNewParameter({
      ...newParameter,
      options: newParameter.options.filter(o => o !== option)
    });
  };

  // Exercise category management functions
  const handleReorderExerciseCategories = (reorderedCategories: string[]) => {
    // Update all parameters for this sub-category with new exercise categories
    const updatedParameters = parameters.map(p => ({
      ...p,
      exerciseCategories: reorderedCategories
    }));
    onUpdateParameters(updatedParameters);
  };

  const handleAddExerciseCategory = () => {
    if (!newExerciseCategory.trim()) return;
    
    const currentCategories = parameters[0]?.exerciseCategories || [];
    const updatedCategories = [...currentCategories, newExerciseCategory.trim()];
    
    // Update all parameters for this sub-category
    const updatedParameters = parameters.map(p => ({
      ...p,
      exerciseCategories: updatedCategories
    }));
    
    onUpdateParameters(updatedParameters);
    setNewExerciseCategory('');
    setShowAddCategoryDialog(false);
  };

  const handleRenameExerciseCategory = (oldName: string, newName: string) => {
    const currentCategories = parameters[0]?.exerciseCategories || [];
    const updatedCategories = currentCategories.map(cat => cat === oldName ? newName : cat);
    const updatedParameters = parameters.map(p => ({ ...p, exerciseCategories: updatedCategories }));
    onUpdateParameters(updatedParameters);
  };

  const handleDeleteExerciseCategory = (categoryToDelete: string) => {
    const currentCategories = parameters[0]?.exerciseCategories || [];
    const updatedCategories = currentCategories.filter(cat => cat !== categoryToDelete);
    
    // Update all parameters for this sub-category
    const updatedParameters = parameters.map(p => ({
      ...p,
      exerciseCategories: updatedCategories
    }));
    
    onUpdateParameters(updatedParameters);
  };

  const exerciseCategories = parameters[0]?.exerciseCategories || [];

  // Check if another parameter already has frequency/set/rest flags
  const existingFrequencyParameterId = parameters.find(p => p.isFrequencyParameter)?.id;
  const existingSetParameterId = parameters.find(p => p.isSetParameter)?.id;
  const existingRestParameterId = parameters.find(p => p.isRestParameter)?.id;

  // Block save in Edit dialog if it would leave no frequency parameter
  const editSaveWouldRemoveFrequency =
    !!editingParameter &&
    editingParameter.id === existingFrequencyParameterId &&
    !editingParameter.isFrequencyParameter;
  const editHasNoFrequencyAtAll =
    !!editingParameter &&
    !parameters.some(p => p.isFrequencyParameter) &&
    !editingParameter.isFrequencyParameter;

  // Get available quantitative parameters for formula building (excluding calculated params and current param being edited)
  const availableSourceParameters = useMemo(() => {
    return parameters.filter(p => 
      p.parameterType === 'quantitative' && 
      !p.isCalculated &&
      p.id !== editingParameter?.id
    );
  }, [parameters, editingParameter?.id]);

  // All valid token names across all sources (method params + biometrics + perf params + e1RM)
  const allTokenNames = useMemo(() => [
    ...availableSourceParameters.map(p => p.parameterName),
    ...quantitativeBiometrics.map(b => b.name),
    ...performanceParams.map(p => p.name),
    'e1RM',
  ], [availableSourceParameters, quantitativeBiometrics, performanceParams]);

  // Validate formula for editing parameter
  const editingFormulaValidation = useMemo(() => {
    if (!editingParameter?.isCalculated || !editingParameter?.formula) {
      return { valid: true };
    }
    return validateFormula(editingParameter.formula, allTokenNames);
  }, [editingParameter?.isCalculated, editingParameter?.formula, allTokenNames]);

  // Validate formula for new parameter
  const newFormulaValidation = useMemo(() => {
    if (!newParameter.isCalculated || !newParameter.formula) {
      return { valid: true };
    }
    return validateFormula(newParameter.formula, allTokenNames);
  }, [newParameter.isCalculated, newParameter.formula, allTokenNames]);

  return (
    <>
      {/* Main Parameter Management Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle asChild>
              <div className="flex items-center gap-1 flex-wrap text-xl font-semibold">
                {/* Category */}
                <div className="flex items-center gap-1 group/cat">
                  {editingCategory ? (
                    <>
                      <Input
                        className="h-6 py-0 px-1 text-sm w-48"
                        value={categoryInput}
                        onChange={e => setCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && categoryInput.trim()) {
                            onCategoryChange?.(categoryInput.trim());
                            setEditingCategory(false);
                          } else if (e.key === 'Escape') {
                            setEditingCategory(false);
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                        if (categoryInput.trim()) onCategoryChange?.(categoryInput.trim());
                        setEditingCategory(false);
                      }}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingCategory(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{category}</span>
                      {onCategoryChange && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover/cat:opacity-100 transition-opacity"
                          onClick={() => { setCategoryInput(category); setEditingCategory(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <span className="text-muted-foreground">→</span>
                {/* Method name */}
                <div className="flex items-center gap-1 group/name">
                  {editingName ? (
                    <>
                      <Input
                        className="h-6 py-0 px-1 text-sm w-48"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && nameInput.trim()) {
                            onSubCategoryChange?.(nameInput.trim());
                            setEditingName(false);
                          } else if (e.key === 'Escape') {
                            setEditingName(false);
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                        if (nameInput.trim()) onSubCategoryChange?.(nameInput.trim());
                        setEditingName(false);
                      }}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingName(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{subCategory}</span>
                      {onSubCategoryChange && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover/name:opacity-100 transition-opacity"
                          onClick={() => { setNameInput(subCategory); setEditingName(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription>Manage Parameters</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warning Box for Missing Parameters */}
            {(!parameters.some(p => p.isFrequencyParameter) || !parameters.some(p => p.isSetParameter)) && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-md p-4">
                <div className="flex gap-3">
                  <span className="text-amber-600 dark:text-amber-400 text-lg flex-shrink-0">⚠️</span>
                  <div className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-semibold">Warning</p>
                    {!parameters.some(p => p.isFrequencyParameter) && (
                      <p>
                        • No parameter is marked as the Training Frequency parameter. The system needs this to determine how many sessions per microcycle this method requires.
                      </p>
                    )}
                    {!parameters.some(p => p.isSetParameter) && (
                      <p>
                        • No parameter is marked as the Set parameter. Without this, the exercise detail view will display a flat grid instead of a set-based table.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Parameters Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Parameters ({parameters.length})</h3>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>

              {parameters.length > 0 ? (
                <DraggableParameterList
                  parameters={parameters}
                  onReorder={handleReorderParameters}
                  onEditParameter={handleEditParameter}
                  onDeleteParameter={handleDeleteParameter}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No parameters yet. Click "Add Parameter" to get started.
                </div>
              )}
            </div>

            {/* Exercise Selection Categories Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Exercise Selection Categories ({exerciseCategories.length})</h3>
                <Button onClick={() => setShowAddCategoryDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>

              {exerciseCategories.length > 0 ? (
                <DraggableExerciseCategoryList
                  categories={exerciseCategories}
                  onReorder={handleReorderExerciseCategories}
                  onDeleteCategory={handleDeleteExerciseCategory}
                  onRenameCategory={handleRenameExerciseCategory}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No exercise categories yet. Click "Add Category" to get started.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Parameter Dialog */}
      <Dialog open={!!editingParameter} onOpenChange={(open) => !open && setEditingParameter(null)}>
        <DialogPortal>
          <DialogOverlay className="z-[150]" />
          <DialogContent className="z-[160]">
          <DialogHeader>
            <DialogTitle>Edit Parameter</DialogTitle>
          </DialogHeader>

          {editingParameter && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="parameterName">Parameter Name</Label>
                <Input
                  id="parameterName"
                  value={editingParameter.parameterName}
                  onChange={(e) => setEditingParameter({ ...editingParameter, parameterName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="parameterType">Parameter Type</Label>
                <Select
                  value={editingParameter.parameterType || 'qualitative'}
                  onValueChange={(value) => setEditingParameter({
                    ...editingParameter,
                    parameterType: value as 'qualitative' | 'quantitative',
                    // Auto-uncheck frequency and set flags if changing to qualitative
                    isFrequencyParameter: value === 'quantitative' ? editingParameter.isFrequencyParameter : false,
                    isSetParameter: value === 'quantitative' ? editingParameter.isSetParameter : false
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualitative">Qualitative</SelectItem>
                    <SelectItem value="quantitative">Quantitative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Units/Options section - only show when NOT calculated */}
              {!editingParameter.isCalculated && (
                <>
                  {editingParameter.parameterType === 'quantitative' ? (
                    <div>
                      <Label>Units</Label>
                      <div className="space-y-3">
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value && !(editingParameter.options || []).includes(value)) {
                              addOption(value);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a unit..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PREDEFINED_UNITS.filter(u => !(editingParameter.options || []).includes(u.value)).map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {(editingParameter.options || []).length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Selected units</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(editingParameter.options || []).map((option) => (
                                <Badge key={option} variant="secondary" className="cursor-pointer" onClick={() => removeOption(option)}>
                                  {option} ×
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label>Options</Label>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add option"
                            id="edit-qualitative-option-input"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addOption(e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById('edit-qualitative-option-input') as HTMLInputElement;
                              if (input?.value) {
                                addOption(input.value);
                                input.value = '';
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(editingParameter.options || []).map((option) => (
                            <Badge key={option} variant="secondary" className="cursor-pointer" onClick={() => removeOption(option)}>
                              {option} ×
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isFrequencyParameter"
                    checked={editingParameter.isFrequencyParameter || false}
                    disabled={
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isSetParameter ||
                      editingParameter.isRestParameter ||
                      editingParameter.isCalculated ||
                      (!!existingFrequencyParameterId && existingFrequencyParameterId !== editingParameter.id)
                    }
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        isFrequencyParameter: e.target.checked,
                        showInGridByDefault: e.target.checked ? false : editingParameter.showInGridByDefault,
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="isFrequencyParameter"
                    className={`text-sm font-medium ${
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isSetParameter ||
                      editingParameter.isRestParameter ||
                      editingParameter.isCalculated ||
                      (existingFrequencyParameterId && existingFrequencyParameterId !== editingParameter.id)
                        ? 'text-muted-foreground' : ''
                    }`}
                  >
                    Training Frequency Parameter
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingParameter.isCalculated
                    ? 'Calculated parameters cannot be frequency parameters'
                    : existingFrequencyParameterId && existingFrequencyParameterId !== editingParameter.id
                      ? 'Another parameter is already marked as the Training Frequency parameter'
                      : editingParameter.isSetParameter || editingParameter.isRestParameter
                        ? 'Cannot combine frequency with set or rest parameter'
                        : editingParameter.parameterType === 'quantitative'
                          ? 'Mark this parameter as the training frequency indicator (sessions per microcycle/week)'
                          : 'Only quantitative parameters can be used as frequency indicators'}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isSetParameter"
                    checked={editingParameter.isSetParameter || false}
                    disabled={
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isFrequencyParameter ||
                      editingParameter.isRestParameter ||
                      editingParameter.isCalculated ||
                      (!!existingSetParameterId && existingSetParameterId !== editingParameter.id)
                    }
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        isSetParameter: e.target.checked,
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="isSetParameter"
                    className={`text-sm font-medium ${
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isFrequencyParameter ||
                      editingParameter.isRestParameter ||
                      editingParameter.isCalculated ||
                      (existingSetParameterId && existingSetParameterId !== editingParameter.id)
                        ? 'text-muted-foreground' : ''
                    }`}
                  >
                    Set Parameter
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingParameter.isCalculated
                    ? 'Calculated parameters cannot be set parameters'
                    : existingSetParameterId && existingSetParameterId !== editingParameter.id
                      ? 'Another parameter is already marked as the Set parameter'
                      : editingParameter.isFrequencyParameter || editingParameter.isRestParameter
                        ? 'Cannot combine set with frequency or rest parameter'
                        : editingParameter.parameterType === 'quantitative'
                          ? 'Mark this parameter as the set parameter (determines number of rows in exercise detail view)'
                          : 'Only quantitative parameters can be used as set parameters'}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isRestParameter"
                    checked={editingParameter.isRestParameter || false}
                    disabled={
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isFrequencyParameter ||
                      editingParameter.isSetParameter ||
                      editingParameter.isCalculated ||
                      (!!existingRestParameterId && existingRestParameterId !== editingParameter.id)
                    }
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        isRestParameter: e.target.checked,
                        showInGridByDefault: e.target.checked ? false : editingParameter.showInGridByDefault,
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="isRestParameter"
                    className={`text-sm font-medium ${
                      editingParameter.parameterType !== 'quantitative' ||
                      editingParameter.isFrequencyParameter ||
                      editingParameter.isSetParameter ||
                      editingParameter.isCalculated ||
                      (existingRestParameterId && existingRestParameterId !== editingParameter.id)
                        ? 'text-muted-foreground' : ''
                    }`}
                  >
                    Rest / Pause Parameter
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingParameter.isCalculated
                    ? 'Calculated parameters cannot be rest parameters'
                    : existingRestParameterId && existingRestParameterId !== editingParameter.id
                      ? 'Another parameter is already marked as the Rest parameter'
                      : editingParameter.isFrequencyParameter || editingParameter.isSetParameter
                        ? 'Cannot combine rest with frequency or set parameter'
                        : editingParameter.parameterType === 'quantitative'
                          ? 'Mark this as the rest/pause duration parameter — drives the rest timer in the athlete app'
                          : 'Only quantitative parameters can be rest parameters'}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInGridByDefault"
                    checked={editingParameter.showInGridByDefault ?? true}
                    disabled={editingParameter.isFrequencyParameter || editingParameter.isSetParameter || editingParameter.isRestParameter}
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        showInGridByDefault: e.target.checked
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="showInGridByDefault"
                    className={`text-sm font-medium ${editingParameter.isFrequencyParameter || editingParameter.isSetParameter || editingParameter.isRestParameter ? 'text-muted-foreground' : ''}`}
                  >
                    Show in parameter grid by default
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingParameter.isFrequencyParameter || editingParameter.isSetParameter || editingParameter.isRestParameter
                    ? 'Structural parameters (frequency/set/rest) are not shown in the set grid'
                    : 'When disabled, this parameter will be shown as a label badge on the exercise instead of in the set grid. Users can still toggle visibility in workout views.'}
                </p>
              </div>

              {/* Calculated Parameter Section */}
              {editingParameter.parameterType === 'quantitative' && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editIsCalculated"
                      checked={editingParameter.isCalculated || false}
                      disabled={editingParameter.isFrequencyParameter || editingParameter.isSetParameter}
                      onChange={(e) => {
                        setEditingParameter({
                          ...editingParameter,
                          isCalculated: e.target.checked,
                          // Clear frequency/set flags if becoming calculated
                          isFrequencyParameter: e.target.checked ? false : editingParameter.isFrequencyParameter,
                          isSetParameter: e.target.checked ? false : editingParameter.isSetParameter,
                          formula: e.target.checked ? editingParameter.formula || '' : undefined,
                          sourceParameterIds: e.target.checked ? editingParameter.sourceParameterIds || [] : undefined,
                        });
                      }}
                      className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Label 
                      htmlFor="editIsCalculated" 
                      className={`text-sm font-medium flex items-center gap-2 ${
                        editingParameter.isFrequencyParameter || editingParameter.isSetParameter
                          ? 'text-muted-foreground' : ''
                      }`}
                    >
                      <Calculator className="h-4 w-4" />
                      This is a calculated parameter
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {editingParameter.isFrequencyParameter || editingParameter.isSetParameter
                      ? 'Frequency and Set parameters cannot be calculated'
                      : 'Calculated parameters derive their value from a formula using other parameters'}
                  </p>

                  {editingParameter.isCalculated && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-sm">Insert parameter into formula</Label>
                        <FormulaTokenPicker
                          methodParams={availableSourceParameters.map(p => ({ id: p.id, name: p.parameterName }))}
                          bodyMetrics={quantitativeBiometrics}
                          perfParams={performanceParams}
                          onInsert={(token) => {
                            const currentFormula = editingParameter.formula || '';
                            const newFormula = currentFormula ? `${currentFormula} ${token.name}` : token.name;
                            setEditingParameter({
                              ...editingParameter,
                              formula: newFormula,
                              sourceParameterIds: token.sourceId
                                ? [...new Set([...(editingParameter.sourceParameterIds || []), token.sourceId])]
                                : (editingParameter.sourceParameterIds || []),
                              athleteDataRefs: token.athleteRef
                                ? [...new Set([...(editingParameter.athleteDataRefs || []), token.athleteRef])]
                                : (editingParameter.athleteDataRefs || []),
                            });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Use: + - * / ( ) to combine tokens</p>
                      </div>

                      <div>
                        <Label htmlFor="editFormula">Formula</Label>
                        <Input
                          id="editFormula"
                          value={editingParameter.formula || ''}
                          onChange={(e) => {
                            const formula = e.target.value;
                            const referencedNames = extractParameterNames(formula, allTokenNames);
                            const referencedMethodIds = availableSourceParameters
                              .filter(p => referencedNames.includes(p.parameterName))
                              .map(p => p.id);
                            const referencedAthleteRefs = [
                              ...quantitativeBiometrics.filter(b => referencedNames.includes(b.name)).map(b => b.id),
                              ...performanceParams.filter(p => referencedNames.includes(p.name)).map(p => p.id),
                              ...(referencedNames.includes('e1RM') ? ['e1RM'] : []),
                            ];
                            setEditingParameter({
                              ...editingParameter,
                              formula,
                              sourceParameterIds: referencedMethodIds,
                              athleteDataRefs: referencedAthleteRefs,
                            });
                          }}
                          placeholder="e.g., Intensity * e1RM"
                          className="font-mono"
                        />
                        {!editingFormulaValidation.valid && editingParameter.formula && (
                          <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
                            <AlertCircle className="h-3 w-3" />
                            {editingFormulaValidation.error}
                          </div>
                        )}
                      </div>

                      {editingParameter.formula && editingFormulaValidation.valid && (
                        <div className="bg-muted rounded p-2">
                          <Label className="text-xs text-muted-foreground">Preview</Label>
                          <p className="font-mono text-sm">
                            {editingParameter.parameterName} = {editingParameter.formula}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label>Result Unit (optional)</Label>
                        <Select
                          value={(editingParameter.options || [])[0] || '__none__'}
                          onValueChange={(value) => setEditingParameter({
                            ...editingParameter,
                            options: value === '__none__' ? [] : [value],
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="No unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No unit</SelectItem>
                            {PREDEFINED_UNITS.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(editSaveWouldRemoveFrequency || editHasNoFrequencyAtAll) && !editingParameter.isFrequencyParameter && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
                  ⚠️ Every method must have a Training Frequency parameter. Please keep or reassign the frequency flag before saving.
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="destructive"
                  disabled={editingParameter.isFrequencyParameter}
                  title={editingParameter.isFrequencyParameter ? 'Cannot delete the frequency parameter — reassign the flag first' : undefined}
                  onClick={() => {
                    handleDeleteParameter(editingParameter.id);
                    setEditingParameter(null);
                  }}
                >
                  Delete Parameter
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => setEditingParameter(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEditedParameter}
                    disabled={editSaveWouldRemoveFrequency || editHasNoFrequencyAtAll}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Add Parameter Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogPortal>
          <DialogOverlay className="z-[150]" />
          <DialogContent className="z-[160]">
          <DialogHeader>
            <DialogTitle>Add New Parameter</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newParameterName">Parameter Name</Label>
              <Input
                id="newParameterName"
                value={newParameter.parameterName}
                onChange={(e) => setNewParameter({ ...newParameter, parameterName: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="newParameterType">Parameter Type</Label>
              <Select
                value={newParameter.parameterType}
                onValueChange={(value) => setNewParameter({
                  ...newParameter,
                  parameterType: value as 'qualitative' | 'quantitative',
                  // Auto-uncheck frequency and set flags if changing to qualitative
                  isFrequencyParameter: value === 'quantitative' ? newParameter.isFrequencyParameter : false,
                  isSetParameter: value === 'quantitative' ? newParameter.isSetParameter : false
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newIsFrequencyParameter"
                  checked={newParameter.isFrequencyParameter || false}
                  disabled={
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isSetParameter ||
                    newParameter.isRestParameter ||
                    newParameter.isCalculated ||
                    !!existingFrequencyParameterId
                  }
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      isFrequencyParameter: e.target.checked,
                      showInGridByDefault: e.target.checked ? false : newParameter.showInGridByDefault,
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newIsFrequencyParameter"
                  className={`text-sm font-medium ${
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isSetParameter ||
                    newParameter.isRestParameter ||
                    newParameter.isCalculated ||
                    existingFrequencyParameterId
                      ? 'text-muted-foreground' : ''
                  }`}
                >
                  Training Frequency Parameter
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newParameter.isCalculated
                  ? 'Calculated parameters cannot be frequency parameters'
                  : existingFrequencyParameterId
                    ? 'Another parameter is already marked as the Training Frequency parameter'
                    : newParameter.isSetParameter || newParameter.isRestParameter
                      ? 'Cannot combine frequency with set or rest parameter'
                      : newParameter.parameterType === 'quantitative'
                        ? 'Mark this parameter as the training frequency indicator (sessions per microcycle/week)'
                        : 'Only quantitative parameters can be used as frequency indicators'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newIsSetParameter"
                  checked={newParameter.isSetParameter || false}
                  disabled={
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isFrequencyParameter ||
                    newParameter.isRestParameter ||
                    newParameter.isCalculated ||
                    !!existingSetParameterId
                  }
                  onChange={(e) => {
                    setNewParameter({ ...newParameter, isSetParameter: e.target.checked });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newIsSetParameter"
                  className={`text-sm font-medium ${
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isFrequencyParameter ||
                    newParameter.isRestParameter ||
                    newParameter.isCalculated ||
                    existingSetParameterId
                      ? 'text-muted-foreground' : ''
                  }`}
                >
                  Set Parameter
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newParameter.isCalculated
                  ? 'Calculated parameters cannot be set parameters'
                  : existingSetParameterId
                    ? 'Another parameter is already marked as the Set parameter'
                    : newParameter.isFrequencyParameter || newParameter.isRestParameter
                      ? 'Cannot combine set with frequency or rest parameter'
                      : newParameter.parameterType === 'quantitative'
                        ? 'Mark this parameter as the set parameter (determines number of rows in exercise detail view)'
                        : 'Only quantitative parameters can be used as set parameters'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newIsRestParameter"
                  checked={newParameter.isRestParameter || false}
                  disabled={
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isFrequencyParameter ||
                    newParameter.isSetParameter ||
                    newParameter.isCalculated ||
                    !!existingRestParameterId
                  }
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      isRestParameter: e.target.checked,
                      showInGridByDefault: e.target.checked ? false : newParameter.showInGridByDefault,
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newIsRestParameter"
                  className={`text-sm font-medium ${
                    newParameter.parameterType !== 'quantitative' ||
                    newParameter.isFrequencyParameter ||
                    newParameter.isSetParameter ||
                    newParameter.isCalculated ||
                    existingRestParameterId
                      ? 'text-muted-foreground' : ''
                  }`}
                >
                  Rest / Pause Parameter
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newParameter.isCalculated
                  ? 'Calculated parameters cannot be rest parameters'
                  : existingRestParameterId
                    ? 'Another parameter is already marked as the Rest parameter'
                    : newParameter.isFrequencyParameter || newParameter.isSetParameter
                      ? 'Cannot combine rest with frequency or set parameter'
                      : newParameter.parameterType === 'quantitative'
                        ? 'Mark this as the rest/pause duration parameter — drives the rest timer in the athlete app'
                        : 'Only quantitative parameters can be rest parameters'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newShowInGridByDefault"
                  checked={newParameter.showInGridByDefault}
                  disabled={newParameter.isFrequencyParameter || newParameter.isSetParameter || newParameter.isRestParameter}
                  onChange={(e) => {
                    setNewParameter({ ...newParameter, showInGridByDefault: e.target.checked });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newShowInGridByDefault"
                  className={`text-sm font-medium ${newParameter.isFrequencyParameter || newParameter.isSetParameter || newParameter.isRestParameter ? 'text-muted-foreground' : ''}`}
                >
                  Show in parameter grid by default
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newParameter.isFrequencyParameter || newParameter.isSetParameter || newParameter.isRestParameter
                  ? 'Structural parameters (frequency/set/rest) are not shown in the set grid'
                  : 'When disabled, this parameter will be shown as a label badge on the exercise instead of in the set grid. Users can still toggle visibility in workout views.'}
              </p>
            </div>

            {/* Calculated Parameter Section */}
            {newParameter.parameterType === 'quantitative' && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="newIsCalculated"
                    checked={newParameter.isCalculated}
                    disabled={newParameter.isFrequencyParameter || newParameter.isSetParameter}
                    onChange={(e) => {
                      setNewParameter({
                        ...newParameter,
                        isCalculated: e.target.checked,
                        // Clear frequency/set flags if becoming calculated
                        isFrequencyParameter: e.target.checked ? false : newParameter.isFrequencyParameter,
                        isSetParameter: e.target.checked ? false : newParameter.isSetParameter,
                        formula: e.target.checked ? newParameter.formula : '',
                        sourceParameterIds: e.target.checked ? newParameter.sourceParameterIds : [],
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label 
                    htmlFor="newIsCalculated" 
                    className={`text-sm font-medium flex items-center gap-2 ${
                      newParameter.isFrequencyParameter || newParameter.isSetParameter
                        ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <Calculator className="h-4 w-4" />
                    This is a calculated parameter
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {newParameter.isFrequencyParameter || newParameter.isSetParameter
                    ? 'Frequency and Set parameters cannot be calculated'
                    : 'Calculated parameters derive their value from a formula using other parameters'}
                </p>

                {newParameter.isCalculated && (
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm">Insert parameter into formula</Label>
                      <FormulaTokenPicker
                        methodParams={availableSourceParameters.map(p => ({ id: p.id, name: p.parameterName }))}
                        bodyMetrics={quantitativeBiometrics}
                        perfParams={performanceParams}
                        onInsert={(token) => {
                          const currentFormula = newParameter.formula;
                          const newFormula = currentFormula ? `${currentFormula} ${token.name}` : token.name;
                          setNewParameter({
                            ...newParameter,
                            formula: newFormula,
                            sourceParameterIds: token.sourceId
                              ? [...new Set([...newParameter.sourceParameterIds, token.sourceId])]
                              : newParameter.sourceParameterIds,
                            athleteDataRefs: token.athleteRef
                              ? [...new Set([...newParameter.athleteDataRefs, token.athleteRef])]
                              : newParameter.athleteDataRefs,
                          });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Use: + - * / ( ) to combine tokens</p>
                    </div>

                    <div>
                      <Label htmlFor="newFormula">Formula</Label>
                      <Input
                        id="newFormula"
                        value={newParameter.formula}
                        onChange={(e) => {
                          const formula = e.target.value;
                          const referencedNames = extractParameterNames(formula, allTokenNames);
                          const referencedMethodIds = availableSourceParameters
                            .filter(p => referencedNames.includes(p.parameterName))
                            .map(p => p.id);
                          const referencedAthleteRefs = [
                            ...quantitativeBiometrics.filter(b => referencedNames.includes(b.name)).map(b => b.id),
                            ...performanceParams.filter(p => referencedNames.includes(p.name)).map(p => p.id),
                            ...(referencedNames.includes('e1RM') ? ['e1RM'] : []),
                          ];
                          setNewParameter({
                            ...newParameter,
                            formula,
                            sourceParameterIds: referencedMethodIds,
                            athleteDataRefs: referencedAthleteRefs,
                          });
                        }}
                        placeholder="e.g., Intensity * e1RM"
                        className="font-mono"
                      />
                      {!newFormulaValidation.valid && newParameter.formula && (
                        <div className="flex items-center gap-1 mt-1 text-destructive text-xs">
                          <AlertCircle className="h-3 w-3" />
                          {newFormulaValidation.error}
                        </div>
                      )}
                    </div>

                    {newParameter.formula && newFormulaValidation.valid && (
                      <div className="bg-muted rounded p-2">
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <p className="font-mono text-sm">
                          {newParameter.parameterName || 'Parameter'} = {newParameter.formula}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label>Result Unit (optional)</Label>
                      <Select
                        value={newParameter.options[0] || '__none__'}
                        onValueChange={(value) => setNewParameter({
                          ...newParameter,
                          options: value === '__none__' ? [] : [value],
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No unit</SelectItem>
                          {PREDEFINED_UNITS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Units/Options section - only show when NOT calculated */}
            {!newParameter.isCalculated && (
              <>
                {newParameter.parameterType === 'quantitative' ? (
                  <div>
                    <Label>Units</Label>
                    <div className="space-y-3">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (value && !newParameter.options.includes(value)) {
                            addNewParameterOption(value);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a unit..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_UNITS.filter(u => !newParameter.options.includes(u.value)).map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {newParameter.options.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Selected units</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {newParameter.options.map((option) => (
                              <Badge key={option} variant="secondary" className="cursor-pointer" onClick={() => removeNewParameterOption(option)}>
                                {option} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Options</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add option"
                          id="add-qualitative-option-input"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              addNewParameterOption(e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('add-qualitative-option-input') as HTMLInputElement;
                            if (input?.value) {
                              addNewParameterOption(input.value);
                              input.value = '';
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {newParameter.options.map((option) => (
                          <Badge key={option} variant="secondary" className="cursor-pointer" onClick={() => removeNewParameterOption(option)}>
                            {option} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddParameter}
                disabled={!newParameter.parameterName.trim()}
              >
                Add Parameter
              </Button>
            </div>
          </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Add Exercise Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogPortal>
          <DialogOverlay className="z-[150]" />
          <DialogContent className="z-[160]">
          <DialogHeader>
            <DialogTitle>Add Exercise Category</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newExerciseCategory">Category Name</Label>
              <Input
                id="newExerciseCategory"
                value={newExerciseCategory}
                onChange={(e) => setNewExerciseCategory(e.target.value)}
                placeholder="e.g., Squat, Hinge, Single Leg"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddExerciseCategory}
                disabled={!newExerciseCategory.trim()}
              >
                Add Category
              </Button>
            </div>
          </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}