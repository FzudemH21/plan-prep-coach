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

  // Separate set parameter from other parameters
  const otherParams = methodParams.filter(p => !p.isSetParameter);

  return (
    <Card className={`p-4 ${isInSuperset ? 'border-l-4 border-l-primary' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing mt-1">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                    {otherParams.map(param => (
                      <TableHead key={param.name}>{param.name}</TableHead>
                    ))}
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
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Add Set Button */}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onParameterChange(setParam.name, setCount + 1)}
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
