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
import { Plus, Calculator, AlertCircle } from 'lucide-react';
import { ToolboxEntry } from '@/types/toolbox';
import { DraggableParameterList } from './DraggableParameterList';
import { DraggableExerciseCategoryList } from './DraggableExerciseCategoryList';
import { QuantitativeParameterInput, QualitativeParameterInput } from '@/components/ui/parameter-input';
import { validateFormula, extractParameterNames } from '@/utils/formulaEvaluator';

// Predefined units for quantitative parameters
const PREDEFINED_UNITS = [
  { value: '#', label: '# (count)' },
  { value: 'm', label: 'm (meters)' },
  { value: 'km', label: 'km (kilometers)' },
  { value: 'cm', label: 'cm (centimeters)' },
  { value: 'ft', label: 'ft (feet)' },
  { value: 'yd', label: 'yd (yards)' },
  { value: 's', label: 's (seconds)' },
  { value: 'min', label: 'min (minutes)' },
  { value: 'h', label: 'h (hours)' },
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'lbs', label: 'lbs (pounds)' },
  { value: '%', label: '% (percentage)' },
  { value: '%1RM', label: '%1RM (% of 1 Rep Max)' },
  { value: 'RPE', label: 'RPE (Rate of Perceived Exertion)' },
  { value: 'RiR', label: 'RiR (Reps in Reserve)' },
  { value: 'm/s', label: 'm/s (velocity)' },
  { value: '%maxV', label: '%maxV (% of peak velocity)' },
  { value: 'bpm', label: 'bpm (heart rate)' },
  { value: '%maxHR', label: '%maxHR (% of max heart rate)' },
  { value: 'kcal', label: 'kcal (calories)' },
  { value: 'W', label: 'W (watts)' },
  { value: 'W/kg', label: 'W/kg (watts per kg bodyweight)' },
  { value: 'rpm', label: 'rpm (revolutions per minute)' },
  { value: 'steps/min', label: 'steps/min (cadence)' },
];

interface ParameterManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  subCategory: string;
  parameters: ToolboxEntry[];
  onUpdateParameters: (parameters: ToolboxEntry[]) => void;
}

export function ParameterManagementDialog({
  open,
  onOpenChange,
  category,
  subCategory,
  parameters,
  onUpdateParameters,
}: ParameterManagementDialogProps) {
  const [editingParameter, setEditingParameter] = useState<ToolboxEntry | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newParameter, setNewParameter] = useState({
    parameterName: '',
    parameterType: 'qualitative' as 'qualitative' | 'quantitative',
    options: [] as string[],
    isFrequencyParameter: false,
    isSetParameter: false,
    showInGridByDefault: true,
    showInAthleteApp: false,
    isCalculated: false,
    formula: '',
    sourceParameterIds: [] as string[],
  });
  const [newExerciseCategory, setNewExerciseCategory] = useState('');

  const handleReorderParameters = (reorderedParameters: ToolboxEntry[]) => {
    onUpdateParameters(reorderedParameters);
  };

  const handleEditParameter = (parameter: ToolboxEntry) => {
    setEditingParameter(parameter);
  };

  const handleSaveEditedParameter = () => {
    if (!editingParameter) return;

    let updatedParameters = parameters.map(p => 
      p.id === editingParameter.id ? editingParameter : p
    );

    // If this parameter is marked as frequency, unmark all others
    if (editingParameter.isFrequencyParameter) {
      updatedParameters = updatedParameters.map(p => 
        p.id === editingParameter.id 
          ? p 
          : { ...p, isFrequencyParameter: false }
      );
    }

    // If this parameter is marked as set parameter, unmark all others
    if (editingParameter.isSetParameter) {
      updatedParameters = updatedParameters.map(p => 
        p.id === editingParameter.id 
          ? p 
          : { ...p, isSetParameter: false }
      );
    }

    onUpdateParameters(updatedParameters);
    setEditingParameter(null);
  };

  const handleAddParameter = () => {
    const parameter: ToolboxEntry = {
      id: Date.now().toString(),
      category,
      subCategory,
      parameterName: newParameter.parameterName,
      parameterType: newParameter.parameterType,
      options: newParameter.isCalculated ? [] : newParameter.options,
      isFrequencyParameter: newParameter.isCalculated ? false : newParameter.isFrequencyParameter,
      isSetParameter: newParameter.isCalculated ? false : newParameter.isSetParameter,
      showInGridByDefault: newParameter.showInGridByDefault,
      showInAthleteApp: newParameter.showInAthleteApp,
      isCalculated: newParameter.isCalculated,
      formula: newParameter.isCalculated ? newParameter.formula : undefined,
      sourceParameterIds: newParameter.isCalculated ? newParameter.sourceParameterIds : undefined,
    };

    let updatedParameters = [...parameters, parameter];

    // If this new parameter is marked as frequency, unmark all others
    if (newParameter.isFrequencyParameter) {
      updatedParameters = updatedParameters.map(p => 
        p.id === parameter.id 
          ? p 
          : { ...p, isFrequencyParameter: false }
      );
    }

    // If this new parameter is marked as set parameter, unmark all others
    if (newParameter.isSetParameter) {
      updatedParameters = updatedParameters.map(p => 
        p.id === parameter.id 
          ? p 
          : { ...p, isSetParameter: false }
      );
    }

    onUpdateParameters(updatedParameters);
    setNewParameter({
      parameterName: '',
      parameterType: 'qualitative',
      options: [],
      isFrequencyParameter: false,
      isSetParameter: false,
      showInGridByDefault: true,
      showInAthleteApp: false,
      isCalculated: false,
      formula: '',
      sourceParameterIds: [],
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

  // Check if another parameter already has frequency/set flags
  const existingFrequencyParameterId = parameters.find(p => p.isFrequencyParameter)?.id;
  const existingSetParameterId = parameters.find(p => p.isSetParameter)?.id;

  // Get available quantitative parameters for formula building (excluding calculated params and current param being edited)
  const availableSourceParameters = useMemo(() => {
    return parameters.filter(p => 
      p.parameterType === 'quantitative' && 
      !p.isCalculated &&
      p.id !== editingParameter?.id
    );
  }, [parameters, editingParameter?.id]);

  // Validate formula for editing parameter
  const editingFormulaValidation = useMemo(() => {
    if (!editingParameter?.isCalculated || !editingParameter?.formula) {
      return { valid: true };
    }
    const availableNames = availableSourceParameters.map(p => p.parameterName);
    return validateFormula(editingParameter.formula, availableNames);
  }, [editingParameter?.isCalculated, editingParameter?.formula, availableSourceParameters]);

  // Validate formula for new parameter
  const newFormulaValidation = useMemo(() => {
    if (!newParameter.isCalculated || !newParameter.formula) {
      return { valid: true };
    }
    const availableNames = availableSourceParameters.map(p => p.parameterName);
    return validateFormula(newParameter.formula, availableNames);
  }, [newParameter.isCalculated, newParameter.formula, availableSourceParameters]);

  return (
    <>
      {/* Main Parameter Management Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Parameters</DialogTitle>
            <DialogDescription>
              {category} → {subCategory}
            </DialogDescription>
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
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Add custom field</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              placeholder="Custom unit..."
                              id="edit-custom-unit-input"
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
                                const input = document.getElementById('edit-custom-unit-input') as HTMLInputElement;
                                if (input?.value) {
                                  addOption(input.value);
                                  input.value = '';
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        
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
                      editingParameter.isCalculated ||
                      (!!existingFrequencyParameterId && existingFrequencyParameterId !== editingParameter.id)
                    }
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        isFrequencyParameter: e.target.checked,
                        // Frequency parameters should never show in grid
                        showInGridByDefault: e.target.checked ? false : editingParameter.showInGridByDefault
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label 
                    htmlFor="isFrequencyParameter" 
                    className={`text-sm font-medium ${
                      editingParameter.parameterType !== 'quantitative' || 
                      editingParameter.isSetParameter ||
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
                      : editingParameter.isSetParameter
                        ? 'Cannot be both frequency and set parameter'
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
                      editingParameter.isCalculated ||
                      (!!existingSetParameterId && existingSetParameterId !== editingParameter.id)
                    }
                    onChange={(e) => {
                      setNewParameter({
                        ...newParameter,
                        isSetParameter: e.target.checked
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label 
                    htmlFor="isSetParameter" 
                    className={`text-sm font-medium ${
                      editingParameter.parameterType !== 'quantitative' || 
                      editingParameter.isFrequencyParameter ||
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
                      : editingParameter.isFrequencyParameter
                        ? 'Cannot be both set and frequency parameter'
                        : editingParameter.parameterType === 'quantitative' 
                          ? 'Mark this parameter as the set parameter (determines number of rows in exercise detail view)'
                          : 'Only quantitative parameters can be used as set parameters'}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInGridByDefault"
                    checked={editingParameter.showInGridByDefault ?? true}
                    disabled={editingParameter.isFrequencyParameter || editingParameter.isSetParameter}
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
                    className={`text-sm font-medium ${editingParameter.isFrequencyParameter || editingParameter.isSetParameter ? 'text-muted-foreground' : ''}`}
                  >
                    Show in parameter grid by default
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {editingParameter.isFrequencyParameter || editingParameter.isSetParameter
                    ? 'Structural parameters (frequency/set) cannot be toggled for grid visibility'
                    : 'When disabled, this parameter will be shown as a label badge on the exercise instead of in the set grid. Users can still toggle visibility in workout views.'}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInAthleteApp"
                    checked={editingParameter.showInAthleteApp ?? false}
                    disabled={editingParameter.isFrequencyParameter || editingParameter.isSetParameter}
                    onChange={(e) => {
                      setEditingParameter({
                        ...editingParameter,
                        showInAthleteApp: e.target.checked
                      });
                    }}
                    className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="showInAthleteApp"
                    className={`text-sm font-medium ${editingParameter.isFrequencyParameter || editingParameter.isSetParameter ? 'text-muted-foreground' : ''}`}
                  >
                    Show in athlete app session grid
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, athletes will see this parameter as a column in their per-set logging table during a workout.
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
                      <div>
                        <Label className="text-sm">Available Parameters</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availableSourceParameters.length > 0 ? (
                            availableSourceParameters.map((p) => (
                              <Badge 
                                key={p.id} 
                                variant="outline" 
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => {
                                  const currentFormula = editingParameter.formula || '';
                                  const newFormula = currentFormula 
                                    ? `${currentFormula} ${p.parameterName}` 
                                    : p.parameterName;
                                  setEditingParameter({
                                    ...editingParameter,
                                    formula: newFormula,
                                    sourceParameterIds: [...new Set([...(editingParameter.sourceParameterIds || []), p.id])]
                                  });
                                }}
                              >
                                {p.parameterName}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No quantitative parameters available. Add other quantitative parameters first.
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click to add to formula. Use: + - * / ( )
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="editFormula">Formula</Label>
                        <Input
                          id="editFormula"
                          value={editingParameter.formula || ''}
                          onChange={(e) => {
                            const formula = e.target.value;
                            const referencedNames = extractParameterNames(formula, availableSourceParameters.map(p => p.parameterName));
                            const referencedIds = availableSourceParameters
                              .filter(p => referencedNames.includes(p.parameterName))
                              .map(p => p.id);
                            setEditingParameter({
                              ...editingParameter,
                              formula,
                              sourceParameterIds: referencedIds
                            });
                          }}
                          placeholder="e.g., Sets * Reps"
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
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button
                  variant="destructive"
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
                  <Button onClick={handleSaveEditedParameter}>
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
        <DialogContent>
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
                    newParameter.isCalculated ||
                    !!existingFrequencyParameterId
                  }
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      isFrequencyParameter: e.target.checked,
                      // Frequency parameters should never show in grid
                      showInGridByDefault: e.target.checked ? false : newParameter.showInGridByDefault
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label 
                  htmlFor="newIsFrequencyParameter" 
                  className={`text-sm font-medium ${
                    newParameter.parameterType !== 'quantitative' || 
                    newParameter.isSetParameter ||
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
                    : newParameter.isSetParameter
                      ? 'Cannot be both frequency and set parameter'
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
                    newParameter.isCalculated ||
                    !!existingSetParameterId
                  }
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      isSetParameter: e.target.checked
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label 
                  htmlFor="newIsSetParameter" 
                  className={`text-sm font-medium ${
                    newParameter.parameterType !== 'quantitative' || 
                    newParameter.isFrequencyParameter ||
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
                    : newParameter.isFrequencyParameter
                      ? 'Cannot be both set and frequency parameter'
                      : newParameter.parameterType === 'quantitative' 
                        ? 'Mark this parameter as the set parameter (determines number of rows in exercise detail view)'
                        : 'Only quantitative parameters can be used as set parameters'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newShowInGridByDefault"
                  checked={newParameter.showInGridByDefault}
                  disabled={newParameter.isFrequencyParameter || newParameter.isSetParameter}
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      showInGridByDefault: e.target.checked
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newShowInGridByDefault"
                  className={`text-sm font-medium ${newParameter.isFrequencyParameter || newParameter.isSetParameter ? 'text-muted-foreground' : ''}`}
                >
                  Show in parameter grid by default
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {newParameter.isFrequencyParameter || newParameter.isSetParameter
                  ? 'Structural parameters (frequency/set) cannot be toggled for grid visibility'
                  : 'When disabled, this parameter will be shown as a label badge on the exercise instead of in the set grid. Users can still toggle visibility in workout views.'}
              </p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newShowInAthleteApp"
                  checked={newParameter.showInAthleteApp}
                  disabled={newParameter.isFrequencyParameter || newParameter.isSetParameter}
                  onChange={(e) => {
                    setNewParameter({
                      ...newParameter,
                      showInAthleteApp: e.target.checked
                    });
                  }}
                  className="h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Label
                  htmlFor="newShowInAthleteApp"
                  className={`text-sm font-medium ${newParameter.isFrequencyParameter || newParameter.isSetParameter ? 'text-muted-foreground' : ''}`}
                >
                  Show in athlete app session grid
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, athletes will see this parameter as a column in their per-set logging table during a workout.
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
                    <div>
                      <Label className="text-sm">Available Parameters</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {availableSourceParameters.length > 0 ? (
                          availableSourceParameters.map((p) => (
                            <Badge 
                              key={p.id} 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => {
                                const currentFormula = newParameter.formula;
                                const newFormula = currentFormula 
                                  ? `${currentFormula} ${p.parameterName}` 
                                  : p.parameterName;
                                setNewParameter({
                                  ...newParameter,
                                  formula: newFormula,
                                  sourceParameterIds: [...new Set([...newParameter.sourceParameterIds, p.id])]
                                });
                              }}
                            >
                              {p.parameterName}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No quantitative parameters available. Add other quantitative parameters first.
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click to add to formula. Use: + - * / ( )
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="newFormula">Formula</Label>
                      <Input
                        id="newFormula"
                        value={newParameter.formula}
                        onChange={(e) => {
                          const formula = e.target.value;
                          const referencedNames = extractParameterNames(formula, availableSourceParameters.map(p => p.parameterName));
                          const referencedIds = availableSourceParameters
                            .filter(p => referencedNames.includes(p.parameterName))
                            .map(p => p.id);
                          setNewParameter({
                            ...newParameter,
                            formula,
                            sourceParameterIds: referencedIds
                          });
                        }}
                        placeholder="e.g., Sets * Reps"
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
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Add custom field</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            placeholder="Custom unit..."
                            id="add-custom-unit-input"
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
                              const input = document.getElementById('add-custom-unit-input') as HTMLInputElement;
                              if (input?.value) {
                                addNewParameterOption(input.value);
                                input.value = '';
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      
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
      </Dialog>

      {/* Add Exercise Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent>
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
      </Dialog>
    </>
  );
}