import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { GripVertical, MoreVertical, Link2, Copy, Trash2 } from 'lucide-react';
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
  const methodParams = getParametersForMethod(exercise.methodId);

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

          {/* Parameters Grid */}
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
        </div>
      </div>
    </Card>
  );
}
