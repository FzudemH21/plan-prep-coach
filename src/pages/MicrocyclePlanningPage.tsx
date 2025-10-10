import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Target, AlertTriangle } from 'lucide-react';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseSelection } from '@/types/microcycle-planning';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  dayDate: string;
  sessionIndex: number;
}

interface FrequencyWarning {
  methodId: string;
  methodName: string;
  microcycleId: string;
  microcycleName: string;
  expected: number;
  actual: number;
  type: 'over' | 'under';
}

export default function MicrocyclePlanningPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentMesocycleIndex, setCurrentMesocycleIndex] = useState(0);
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [macrocycleData, setMacrocycleData] = useState<any>(null);
  const [exerciseSelectionData, setExerciseSelectionData] = useState<Record<string, CellData>>({});
  const [exerciseDistribution, setExerciseDistribution] = useState<ExerciseDistribution[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({});
  const [dailyIntensityData, setDailyIntensityData] = useState<any[]>([]);
  const { data: athleticismData } = useAthleticismData();

  const totalSteps = 1; // Currently only Step 1: Exercise Distribution

  // Load data from localStorage
  useEffect(() => {
    const savedMacrocycleData = localStorage.getItem('macrocycleData');
    const savedMesocycleData = localStorage.getItem('mesocycleData');
    const savedExerciseSelection = localStorage.getItem('exerciseSelectionData');
    const savedParameters = localStorage.getItem('parameterValues');
    const savedTrainingDays = localStorage.getItem('trainingDays');

    if (savedMacrocycleData) {
      setMacrocycleData(JSON.parse(savedMacrocycleData));
    }

    if (savedMesocycleData) {
      const data = JSON.parse(savedMesocycleData);
      setMesocycles(data.mesocycles || []);
    }

    if (savedExerciseSelection) {
      setExerciseSelectionData(JSON.parse(savedExerciseSelection));
    }

    if (savedParameters) {
      setParameterValues(JSON.parse(savedParameters));
    }

    if (savedTrainingDays) {
      setTrainingDays(JSON.parse(savedTrainingDays));
    }

    const savedDailyIntensity = localStorage.getItem('dailyIntensityData');
    if (savedDailyIntensity) {
      setDailyIntensityData(JSON.parse(savedDailyIntensity));
    }

    // Load saved exercise distribution
    const savedDistribution = localStorage.getItem('exerciseDistribution');
    if (savedDistribution) {
      setExerciseDistribution(JSON.parse(savedDistribution));
    }
  }, []);

  // Save exercise distribution to localStorage
  useEffect(() => {
    if (exerciseDistribution.length > 0) {
      localStorage.setItem('exerciseDistribution', JSON.stringify(exerciseDistribution));
    }
  }, [exerciseDistribution]);

  const currentMesocycle = mesocycles[currentMesocycleIndex];

  // Get training days for current mesocycle
  const currentMesocycleDays = useMemo(() => {
    if (!currentMesocycle) return [];
    return trainingDays.filter(day => day.mesocycleId === currentMesocycle.id);
  }, [currentMesocycle, trainingDays]);

  // Group days by microcycle
  const daysByMicrocycle = useMemo(() => {
    const grouped: Record<string, TrainingDay[]> = {};
    currentMesocycleDays.forEach(day => {
      if (!grouped[day.microcycleId]) {
        grouped[day.microcycleId] = [];
      }
      grouped[day.microcycleId].push(day);
    });
    return grouped;
  }, [currentMesocycleDays]);

  // Get exercises allocated to current mesocycle from Step 6
  const allocatedExercises = useMemo(() => {
    if (!currentMesocycle) return [];

    // Use Map to consolidate exercises (avoid duplicates)
    const exerciseMap = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      library: string;
      methodId: string;
      categoryName: string;
      microcycleIds: string[];
    }>();

    // Iterate through exercise selection data
    Object.entries(exerciseSelectionData).forEach(([cellId, cellData]) => {
      if (cellData.mesocycleId !== currentMesocycle.id) return;

      cellData.exercises.forEach(exercise => {
        const key = `${exercise.exerciseId}-${cellData.methodId}-${cellData.categoryName}`;
        
        // Determine which microcycles this exercise applies to
        let microcycleIds: string[] = [];
        
        if (cellData.microcycleId) {
          // Exercise allocated to specific microcycle
          microcycleIds = [cellData.microcycleId];
        } else {
          // Exercise allocated to entire mesocycle (applies to all microcycles)
          microcycleIds = currentMesocycle.microcycles.map(m => m.id);
        }

        if (exerciseMap.has(key)) {
          // Merge microcycle IDs (avoid duplicates)
          const existing = exerciseMap.get(key)!;
          const combinedIds = [...new Set([...existing.microcycleIds, ...microcycleIds])];
          exerciseMap.set(key, {
            ...existing,
            microcycleIds: combinedIds
          });
        } else {
          // Create new entry
          exerciseMap.set(key, {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            library: exercise.library,
            methodId: cellData.methodId,
            categoryName: cellData.categoryName || '',
            microcycleIds
          });
        }
      });
    });

    return Array.from(exerciseMap.values());
  }, [currentMesocycle, exerciseSelectionData]);

  // Group exercises by method and category - hierarchical structure
  const exercisesByMethod = useMemo(() => {
    const grouped: Record<string, {
      methodId: string;
      categories: Record<string, typeof allocatedExercises>;
    }> = {};
    
    allocatedExercises.forEach(exercise => {
      if (!grouped[exercise.methodId]) {
        grouped[exercise.methodId] = {
          methodId: exercise.methodId,
          categories: {}
        };
      }
      if (!grouped[exercise.methodId].categories[exercise.categoryName]) {
        grouped[exercise.methodId].categories[exercise.categoryName] = [];
      }
      grouped[exercise.methodId].categories[exercise.categoryName].push(exercise);
    });

    return grouped;
  }, [allocatedExercises]);

  // Calculate frequency for each method/microcycle
  const getMethodFrequency = (methodId: string, microcycleId: string): number => {
    if (!currentMesocycle) return 1;
    
    const microcycleIndex = currentMesocycle.microcycles.findIndex(m => m.id === microcycleId);
    if (microcycleIndex === -1) return 1;

    const cellData = parameterValues[currentMesocycle.id]?.[microcycleIndex]?.[methodId]?.[0] || {};
    const frequencyKey = Object.keys(cellData).find(key => key.toLowerCase().includes('frequency'));
    
    if (!frequencyKey) return 1;
    
    const frequencyValue = cellData[frequencyKey];
    if (!frequencyValue) return 1;
    
    // Parse frequency from various formats like "2", "2/wk", "1-2", "1-2/wk"
    const freqStr = frequencyValue.toString().toLowerCase();
    const match = freqStr.match(/(\d+)(?:-(\d+))?/);
    if (match) {
      // If range like "1-2", use the higher number
      return parseInt(match[2] || match[1]);
    }
    
    return 1;
  };

  // Calculate actual frequency (number of sessions per microcycle)
  const calculateActualFrequency = (methodId: string, microcycleId: string): number => {
    if (!currentMesocycle) return 0;

    const microcycleDays = daysByMicrocycle[microcycleId] || [];
    const daysWithMethod = new Set<string>();

    microcycleDays.forEach(day => {
      const dayExercises = exerciseDistribution.filter(
        ex => ex.methodId === methodId && ex.dayDate === day.date
      );
      
      if (dayExercises.length > 0) {
        // Count unique session combinations (day + sessionIndex)
        dayExercises.forEach(ex => {
          daysWithMethod.add(`${day.date}-${ex.sessionIndex}`);
        });
      }
    });

    return daysWithMethod.size;
  };

  // Calculate frequency warnings
  const frequencyWarnings = useMemo((): FrequencyWarning[] => {
    if (!currentMesocycle) return [];

    const warnings: FrequencyWarning[] = [];
    const processedMethods = new Set<string>();

    currentMesocycle.microcycles.forEach(microcycle => {
      // Get all unique methods for this microcycle
      const methodsInMicrocycle = new Set<string>();
      allocatedExercises.forEach(exercise => {
        if (exercise.microcycleIds.includes(microcycle.id)) {
          methodsInMicrocycle.add(exercise.methodId);
        }
      });

      methodsInMicrocycle.forEach(methodId => {
        const key = `${methodId}-${microcycle.id}`;
        if (processedMethods.has(key)) return;
        processedMethods.add(key);

        const expected = getMethodFrequency(methodId, microcycle.id);
        const actual = calculateActualFrequency(methodId, microcycle.id);

        if (actual !== expected) {
          warnings.push({
            methodId,
            methodName: methodId,
            microcycleId: microcycle.id,
            microcycleName: microcycle.name,
            expected,
            actual,
            type: actual > expected ? 'over' : 'under'
          });
        }
      });
    });

    return warnings;
  }, [currentMesocycle, allocatedExercises, exerciseDistribution, parameterValues, daysByMicrocycle]);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, exercise: typeof allocatedExercises[0]) => {
    e.dataTransfer.setData('application/json', JSON.stringify(exercise));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, dayDate: string, sessionIndex: number, methodId: string, categoryName: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    const exercise = JSON.parse(data);

    // Check if exercise matches the target method/category
    if (exercise.methodId !== methodId || exercise.categoryName !== categoryName) {
      return; // Don't allow dropping in wrong category
    }

    // Add exercise to distribution
    setExerciseDistribution(prev => {
      // Check if already exists
      const exists = prev.some(
        ex => 
          ex.exerciseId === exercise.exerciseId && 
          ex.dayDate === dayDate && 
          ex.sessionIndex === sessionIndex &&
          ex.methodId === methodId &&
          ex.categoryName === categoryName
      );

      if (exists) return prev;

      return [
        ...prev,
        {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          methodId: exercise.methodId,
          categoryName: exercise.categoryName,
          dayDate,
          sessionIndex
        }
      ];
    });
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Remove exercise from distribution
  const removeExercise = (index: number) => {
    setExerciseDistribution(prev => prev.filter((_, i) => i !== index));
  };

  // Get exercises for a specific day/session/method/category
  const getExercisesForCell = (dayDate: string, sessionIndex: number, methodId: string, categoryName: string) => {
    return exerciseDistribution.filter(
      ex => 
        ex.dayDate === dayDate && 
        ex.sessionIndex === sessionIndex &&
        ex.methodId === methodId &&
        ex.categoryName === categoryName
    );
  };

  // Get intensity color
  const getIntensityColor = (intensity: string) => {
    const colors: Record<string, string> = {
      'off': 'bg-intensity-off text-foreground',
      'deload': 'bg-intensity-deload text-foreground',
      'easy': 'bg-intensity-easy text-foreground',
      'easy-moderate': 'bg-intensity-easy-moderate text-foreground',
      'moderate': 'bg-intensity-moderate text-foreground',
      'moderate-hard': 'bg-intensity-moderate-hard text-foreground',
      'hard': 'bg-intensity-hard text-foreground',
      'extremely-hard': 'bg-intensity-extremely-hard text-foreground',
    };
    return colors[intensity] || 'bg-muted text-muted-foreground';
  };

  const NavigationButtons = () => (
    <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full">
      <Button 
        onClick={() => {
          if (currentStep <= 1) {
            localStorage.setItem('mesocycleStep', '6');
            navigate('/mesocycle');
          } else {
            setCurrentStep(Math.max(1, currentStep - 1));
          }
        }}
        variant="outline"
        className="w-full md:w-auto"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {currentStep <= 1 ? "Back to Mesocycle Planning" : "Previous"}
      </Button>
      <Button 
        onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
        disabled={currentStep >= totalSteps}
        className="w-full md:w-auto"
      >
        Next
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderTrainingPlanOverview = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Training Plan Overview</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <p><strong>Goal:</strong> {macrocycleData?.smartGoal?.goal || 'Not set'}</p>
          <p><strong>Total Mesocycles:</strong> {mesocycles.length}</p>
          <p><strong>Current Mesocycle:</strong> {currentMesocycle?.name || 'N/A'}</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderMesocycleNavigation = () => (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        onClick={() => setCurrentMesocycleIndex(Math.max(0, currentMesocycleIndex - 1))}
        disabled={currentMesocycleIndex === 0}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Previous Mesocycle
      </Button>
      <span className="text-sm font-medium">
        Mesocycle {currentMesocycleIndex + 1} of {mesocycles.length}
      </span>
      <Button
        variant="outline"
        onClick={() => setCurrentMesocycleIndex(Math.min(mesocycles.length - 1, currentMesocycleIndex + 1))}
        disabled={currentMesocycleIndex === mesocycles.length - 1}
      >
        Next Mesocycle
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderFrequencyWarnings = () => {
    if (frequencyWarnings.length === 0) return null;

    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-semibold">Frequency Warnings:</p>
            {frequencyWarnings.map((warning, idx) => (
              <p key={idx} className="text-sm">
                <strong>{warning.methodName}</strong> in <strong>{warning.microcycleName}</strong>: 
                {' '}{warning.actual} session{warning.actual !== 1 ? 's' : ''} assigned, 
                but frequency is set to {warning.expected}
                {' '}({warning.type === 'over' ? 'over' : 'under'}-frequency)
              </p>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  const renderExerciseDistribution = () => {
    if (!currentMesocycle) {
      return (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No mesocycle data available
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Step 1: Exercise Distribution - {currentMesocycle.name}</span>
          </CardTitle>
          <CardDescription>
            Drag and drop exercises to specific training days. Each exercise can be used multiple times.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Three-level headers */}
              <div className="border rounded-lg mb-4">
                {/* Level 1: Mesocycle */}
                <div className={cn("p-2 text-center font-semibold border-b", getIntensityColor(currentMesocycle.intensity))}>
                  {currentMesocycle.name}
                </div>
                
                {/* Level 2: Microcycles */}
                <div className="flex border-b">
                  <div className="w-64 shrink-0 border-r p-2 font-semibold bg-muted">
                    Training Methods
                  </div>
                  {currentMesocycle.microcycles.map(microcycle => {
                    const dayCount = daysByMicrocycle[microcycle.id]?.length || 0;
                    return (
                      <div 
                        key={microcycle.id}
                        className={cn("flex-1 text-center p-2 font-semibold border-r last:border-r-0", getIntensityColor(microcycle.intensity))}
                        style={{ minWidth: `${dayCount * 120}px` }}
                      >
                        {microcycle.name}
                      </div>
                    );
                  })}
                </div>

                {/* Level 3: Days */}
                <div className="flex border-b">
                  <div className="w-64 shrink-0 border-r p-2 text-sm bg-muted">
                    Exercise Category
                  </div>
                  {currentMesocycle.microcycles.map(microcycle => {
                      const days = daysByMicrocycle[microcycle.id] || [];
                      return (
                        <div key={microcycle.id} className="flex flex-1 border-r last:border-r-0">
                          {days.map(day => {
                            const dailyIntensityRecord = dailyIntensityData.find(di => di.date === day.date);
                            const dailyIntensity = dailyIntensityRecord?.intensity || 'off';
                            return (
                              <div 
                                key={day.date}
                                className={cn("w-[120px] p-1 text-xs text-center border-r last:border-r-0", getIntensityColor(dailyIntensity))}
                              >
                                <div className="font-semibold">{day.dayName}</div>
                                <div>{format(new Date(day.date), 'MMM d')}</div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exercise rows - grouped by method */}
              <div className="space-y-4">
                {Object.keys(exercisesByMethod).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    No exercises allocated in Step 6 of Mesocycle Planning
                  </div>
                ) : (
                  Object.entries(exercisesByMethod).map(([methodId, methodData]) => {
                    return (
                      <div key={methodId} className="border rounded-lg overflow-hidden">
                        {/* Method header */}
                        <div className="bg-muted/70 px-4 py-2 font-semibold text-sm border-b">
                          {methodId}
                        </div>
                        
                        {/* Category rows */}
                        <div className="space-y-0">
                          {Object.entries(methodData.categories).map(([categoryName, exercises]) => (
                            <div key={`${methodId}-${categoryName}`} className="border-b last:border-b-0">
                              <div className="flex">
                                {/* Left sidebar: Category and Exercises */}
                                <div className="w-64 shrink-0 border-r px-3 py-2 bg-muted/30">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    {categoryName}
                                  </div>
                                  <div className="space-y-1">
                                    {exercises.map((exercise, idx) => {
                                      const microcycleNames = exercise.microcycleIds
                                        .map(id => currentMesocycle.microcycles.find(m => m.id === id)?.name)
                                        .filter(Boolean);
                                      
                                      return (
                                        <div
                                          key={`${exercise.exerciseId}-${idx}`}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, exercise)}
                                          className="group px-2 py-1 bg-background border rounded cursor-move hover:border-primary transition-colors"
                                        >
                                          <div className="text-xs font-medium">{exercise.exerciseName}</div>
                                          <div className="flex flex-wrap gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {microcycleNames.map((name, i) => (
                                              <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0">
                                                {name}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Day columns */}
                                <div className="flex flex-1">
                                  {currentMesocycle.microcycles.map(microcycle => {
                                    const days = daysByMicrocycle[microcycle.id] || [];
                                    return (
                                      <div key={microcycle.id} className="flex flex-1 border-r last:border-r-0">
                                        {days.map(day => (
                                          <div 
                                            key={day.date}
                                            className="w-[120px] p-2 border-r last:border-r-0 min-h-[100px]"
                                            onDrop={(e) => handleDrop(e, day.date, 0, methodId, categoryName)}
                                            onDragOver={handleDragOver}
                                          >
                                            <div className="space-y-1">
                                              {getExercisesForCell(day.date, 0, methodId, categoryName).map((ex, idx) => (
                                                <div
                                                  key={idx}
                                                  className="text-[10px] p-1 bg-primary/10 border border-primary/20 rounded group relative"
                                                >
                                                  <div className="pr-4">{ex.exerciseName}</div>
                                                  <button
                                                    onClick={() => {
                                                      const index = exerciseDistribution.findIndex(
                                                        e => 
                                                          e.exerciseId === ex.exerciseId && 
                                                          e.dayDate === ex.dayDate && 
                                                          e.sessionIndex === ex.sessionIndex &&
                                                          e.methodId === ex.methodId &&
                                                          e.categoryName === ex.categoryName
                                                      );
                                                      if (index !== -1) removeExercise(index);
                                                    }}
                                                    className="absolute top-0 right-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    ×
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto py-6 space-y-6 px-4 w-full max-w-[98vw]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Microcycle Planning</h1>
      </div>

      <NavigationButtons />

      {renderTrainingPlanOverview()}
      {renderMesocycleNavigation()}
      {renderFrequencyWarnings()}
      {currentStep === 1 && renderExerciseDistribution()}

      <NavigationButtons />
    </div>
  );
}
