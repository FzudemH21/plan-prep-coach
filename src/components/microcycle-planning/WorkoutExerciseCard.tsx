import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GripVertical, MoreVertical, Link2, Copy, Trash2, Plus } from 'lucide-react';
import { WorkoutExercise } from '@/types/workout';
import { ParameterInputField } from './ParameterInputField';
import { getParametersForMethod } from '@/data/methodParameters';

interface WorkoutExerciseCardProps {
  exercise: WorkoutExercise;
  isInSuperset: boolean;
  supersetLabel?: string;
  onParameterChange: (paramName: string, value: string | number) => void;
  onUnitChange: (paramName: string, unit: string) => void;
  onLinkSuperset: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dragHandleProps?: any;
}

export function WorkoutExerciseCard({
  exercise,
  isInSuperset,
  supersetLabel,
  onParameterChange,
  onUnitChange,
  onLinkSuperset,
  onDuplicate,
  onDelete,
  dragHandleProps
}: WorkoutExerciseCardProps) {
  // Get parameters with fallback: derive from exercise.parameters if dictionary is empty
  const methodParams = (() => {
    const defs = getParametersForMethod(exercise.methodId);
    if (defs && defs.length > 0) return defs;
    
    // Fallback: derive parameters from exercise.parameters
    const keys = Object.keys(exercise.parameters || {});
    const baseKeys = keys.filter(k => !k.endsWith('_unit') && !/_set\d+$/i.test(k));
    return baseKeys.map(name => {
      const raw = exercise.parameters[name];
      const isNumeric = typeof raw === 'number' || (!isNaN(Number(raw)) && raw !== '');
      return {
        name,
        type: isNumeric ? 'number' : 'text',
        unit: typeof exercise.parameters[`${name}_unit`] === 'string' 
          ? String(exercise.parameters[`${name}_unit`]) 
          : undefined,
        isSetParameter: /^sets?$/i.test(name),
        defaultValue: undefined
      } as const;
    });
  })();

  // Find the set parameter
  const setParam = methodParams.find(p => p.isSetParameter);
  const setCount = setParam 
    ? Number(exercise.parameters[setParam.name] || 3) // Default to 3 sets
    : 0;

  // Separate set parameter from other parameters (exclude Frequency)
  const otherParams = methodParams.filter(p => !p.isSetParameter && p.name !== 'Frequency');

  // Handle deleting a set
  const handleDeleteSet = (setNumber: number) => {
    if (setCount <= 1) return; // Don't delete if only one set remains
    
    // Decrease set count
    onParameterChange(setParam!.name, setCount - 1);
    
    // Reindex all sets after the deleted one
    otherParams.forEach(param => {
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
    otherParams.forEach(param => {
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
    <Card className={`p-4 ${isInSuperset ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div 
          {...dragHandleProps} 
          className="cursor-grab active:cursor-grabbing mt-1 hover:text-primary transition-colors"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        </div>

        {/* Exercise Content */}
        <div className="flex-1 space-y-3">
          {/* Exercise Header */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium">{exercise.exerciseName}</h4>
              <p className="text-sm text-muted-foreground">
                {exercise.methodId} {exercise.categoryName && `• ${exercise.categoryName}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isInSuperset && supersetLabel && (
                <Badge variant="outline" className="text-xs">
                  {supersetLabel}
                </Badge>
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
                  <DropdownMenuItem onClick={onLinkSuperset}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Link to Superset
                  </DropdownMenuItem>
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

          {/* Parameters Display */}
          {setParam && setCount > 0 ? (
            // TABLE LAYOUT (when set parameter exists)
            <div className="w-full space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Set</TableHead>
                    {otherParams.map(param => {
                      // Check if this parameter has a selected unit stored
                      const selectedUnit = exercise.parameters[`${param.name}_unit`];
                      
                      // Format the header with unit if it exists
                      const headerText = selectedUnit 
                        ? `${param.name} [${selectedUnit}]`
                        : param.name;
                      
                      return (
                        <TableHead key={param.name}>{headerText}</TableHead>
                      );
                    })}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: setCount }, (_, setIndex) => (
                    <TableRow key={setIndex}>
                      <TableCell className="font-medium">{setIndex + 1}</TableCell>
                      {otherParams.map(param => (
                        <TableCell key={param.name}>
                          <ParameterInputField
                            parameter={param}
                            value={exercise.parameters[`${param.name}_set${setIndex + 1}`] ?? param.defaultValue ?? ''}
                            unit={exercise.parameters[`${param.name}_unit`] as string}
                            onValueChange={(value) => onParameterChange(`${param.name}_set${setIndex + 1}`, value)}
                            onUnitChange={(unit) => onUnitChange(param.name, unit)}
                            showLabel={false}
                          />
                        </TableCell>
                      ))}
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
            // FALLBACK: Original grid layout if no set parameter is defined
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {methodParams.map((param) => (
                <ParameterInputField
                  key={param.name}
                  parameter={param}
                  value={exercise.parameters[param.name] ?? param.defaultValue ?? ''}
                  unit={exercise.parameters[`${param.name}_unit`] as string}
                  onValueChange={(value) => onParameterChange(param.name, value)}
                  onUnitChange={(unit) => onUnitChange(param.name, unit)}
                  showLabel={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
