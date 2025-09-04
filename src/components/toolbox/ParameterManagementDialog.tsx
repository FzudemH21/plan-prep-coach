import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { ToolboxEntry } from '@/types/toolbox';
import { DraggableParameterList } from './DraggableParameterList';
import { DraggableExerciseCategoryList } from './DraggableExerciseCategoryList';
import { QuantitativeParameterInput, QualitativeParameterInput } from '@/components/ui/parameter-input';

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
    parameter: '',
    parameterName: '',
    parameterType: 'qualitative' as 'qualitative' | 'quantitative',
    options: [] as string[],
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

    const updatedParameters = parameters.map(p => 
      p.id === editingParameter.id ? editingParameter : p
    );
    onUpdateParameters(updatedParameters);
    setEditingParameter(null);
  };

  const handleAddParameter = () => {
    const parameter: ToolboxEntry = {
      id: Date.now().toString(),
      category,
      subCategory,
      parameter: newParameter.parameter,
      parameterName: newParameter.parameterName || newParameter.parameter,
      parameterType: newParameter.parameterType,
      options: newParameter.options,
    };

    onUpdateParameters([...parameters, parameter]);
    setNewParameter({
      parameter: '',
      parameterName: '',
      parameterType: 'qualitative',
      options: [],
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parameter</DialogTitle>
          </DialogHeader>

          {editingParameter && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="parameter">Parameter</Label>
                <Input
                  id="parameter"
                  value={editingParameter.parameter}
                  onChange={(e) => setEditingParameter({ ...editingParameter, parameter: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="parameterName">Parameter Name</Label>
                <Input
                  id="parameterName"
                  value={editingParameter.parameterName || ''}
                  onChange={(e) => setEditingParameter({ ...editingParameter, parameterName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="parameterType">Parameter Type</Label>
                <Select
                  value={editingParameter.parameterType || 'qualitative'}
                  onValueChange={(value) => setEditingParameter({
                    ...editingParameter,
                    parameterType: value as 'qualitative' | 'quantitative'
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
                <Label>Options</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add option"
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
                        const input = document.querySelector('input[placeholder="Add option"]') as HTMLInputElement;
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
      </Dialog>

      {/* Add Parameter Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Parameter</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newParameter">Parameter</Label>
              <Input
                id="newParameter"
                value={newParameter.parameter}
                onChange={(e) => setNewParameter({ ...newParameter, parameter: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="newParameterName">Parameter Name</Label>
              <Input
                id="newParameterName"
                value={newParameter.parameterName}
                onChange={(e) => setNewParameter({ ...newParameter, parameterName: e.target.value })}
                placeholder="Leave empty to use parameter value"
              />
            </div>

            <div>
              <Label htmlFor="newParameterType">Parameter Type</Label>
              <Select
                value={newParameter.parameterType}
                onValueChange={(value) => setNewParameter({
                  ...newParameter,
                  parameterType: value as 'qualitative' | 'quantitative'
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
              <Label>Options</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add option"
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
                      const input = document.querySelector('input[placeholder="Add option"]') as HTMLInputElement;
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

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddParameter}
                disabled={!newParameter.parameter.trim()}
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