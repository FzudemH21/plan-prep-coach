import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dumbbell, Trophy, Calendar as CalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
}

interface TrainingDay {
  date: string;
  dayOfWeek: number;
  dayName: string;
  mesocycleId: string;
  microcycleId: string;
  isTestDay: boolean;
  isEventDay: boolean;
  isTrainingDay: boolean;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  trainingDay?: TrainingDay;
  sessions: {
    sessionIndex: number;
    exercises: ExerciseDistribution[];
    methods: string[];
  }[];
  totalExercises: number;
}

interface DayExercisesDialogProps {
  day: CalendarDay;
  isOpen: boolean;
  onClose: () => void;
}

export function DayExercisesDialog({ day, isOpen, onClose }: DayExercisesDialogProps) {
  if (!day) return null;

  const isTestDay = day.trainingDay?.isTestDay;
  const isEventDay = day.trainingDay?.isEventDay;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{format(day.date, 'EEEE, MMMM d, yyyy')}</span>
            {isTestDay && (
              <Badge variant="secondary" className="ml-2">
                <Trophy className="h-3 w-3 mr-1" />
                Test Day
              </Badge>
            )}
            {isEventDay && (
              <Badge variant="secondary" className="ml-2">
                <CalendarIcon className="h-3 w-3 mr-1" />
                Event Day
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {day.sessions.length} {day.sessions.length === 1 ? 'session' : 'sessions'} • {day.totalExercises} total exercises
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {day.sessions.map((session) => {
              // Group exercises by method and category
              const groupedExercises: Record<string, Record<string, ExerciseDistribution[]>> = {};
              
              session.exercises.forEach(ex => {
                const method = ex.methodId;
                // Use empty string for methods without categories
                const category = ex.categoryName || '';
                
                if (!groupedExercises[method]) {
                  groupedExercises[method] = {};
                }
                if (!groupedExercises[method][category]) {
                  groupedExercises[method][category] = [];
                }
                groupedExercises[method][category].push(ex);
              });

              return (
                <div key={session.sessionIndex} className="space-y-4">
                  {/* Session Header */}
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-lg">
                      Session {session.sessionIndex + 1}
                    </h3>
                    <Badge variant="outline" className="ml-auto">
                      {session.exercises.length} exercises
                    </Badge>
                  </div>

                  {/* Methods and Exercises */}
                  {Object.entries(groupedExercises).map(([method, categories]) => (
                    <div key={method} className="space-y-3">
                      {/* Method Header */}
                      <div className="bg-muted/50 px-3 py-2 rounded-md">
                        <h4 className="font-medium text-sm">{method}</h4>
                      </div>

                      {/* Categories and Exercises */}
                      {Object.entries(categories).map(([category, exercises]) => (
                        <div key={category} className="ml-4 space-y-2">
                          {category && category !== 'Uncategorized' && category !== '' && (
                            <p className="text-sm font-medium text-muted-foreground">
                              {category}
                            </p>
                          )}
                          
                          <ul className="space-y-1 ml-4">
                            {exercises.map((exercise, idx) => (
                              <li
                                key={`${exercise.exerciseId}-${idx}`}
                                className="text-sm flex items-center gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                <span>{exercise.exerciseName}</span>
                                {exercise.subCategory && (
                                  <Badge variant="secondary" className="text-xs">
                                    {exercise.subCategory}
                                  </Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
