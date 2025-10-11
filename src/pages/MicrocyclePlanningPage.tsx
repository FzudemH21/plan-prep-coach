import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, ArrowRight, Target, AlertTriangle, Info, Copy, ChevronDown, Columns } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseSelection } from '@/types/microcycle-planning';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";

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

interface AllocationWarning {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  microcycleId: string;
  microcycleName: string;
  type: 'not-allocated';
}

export default function MicrocyclePlanningPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentMesocycleIndex, setCurrentMesocycleIndex] = useState(0);
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [macrocycleData, setMacrocycleData] = useState<any>(null);
  const [exerciseSelectionData, setExerciseSelectionData] = useState<Record<string, CellData>>({});
  const [exerciseDistribution, setExerciseDistribution] = useState<ExerciseDistribution[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({});
  const [dailyIntensityData, setDailyIntensityData] = useState<any[]>([]);
  const [daySplitStates, setDaySplitStates] = useState<Record<string, number>>({});
  const [splitStates, setSplitStates] = useState<Record<string, boolean>>({});
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

    // Load saved day split states
    const savedDaySplitStates = localStorage.getItem('daySplitStates');
    if (savedDaySplitStates) {
      setDaySplitStates(JSON.parse(savedDaySplitStates));
    }

    // Load split states from Step 6 (Exercise Selection)
    const savedMicrocyclePlanningState = localStorage.getItem('microcyclePlanningState');
    if (savedMicrocyclePlanningState) {
      const planningState = JSON.parse(savedMicrocyclePlanningState);
      console.log('[MicrocyclePlanningPage] Loaded microcyclePlanningState.splitStates:', planningState.splitStates);
      setSplitStates(planningState.splitStates || {});
    } else {
      console.log('[MicrocyclePlanningPage] No microcyclePlanningState found in localStorage');
    }
  }, []);

  // Save exercise distribution to localStorage
  useEffect(() => {
    if (exerciseDistribution.length > 0) {
      localStorage.setItem('exerciseDistribution', JSON.stringify(exerciseDistribution));
    }
  }, [exerciseDistribution]);

  // Save day split states to localStorage
  useEffect(() => {
    localStorage.setItem('daySplitStates', JSON.stringify(daySplitStates));
  }, [daySplitStates]);

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

    // Check if this mesocycle is split
    const isSplit = !!splitStates[currentMesocycle.id];
    console.log('[allocatedExercises] compute start', { mesocycleId: currentMesocycle.id, isSplit, splitStates });

    // Step 1: Separate microcycle-specific and mesocycle-level allocations
    const microcycleSpecific = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      library: string;
      methodId: string;
      categoryName: string;
      microcycleId: string;
    }[]>();

    const mesocycleLevel = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      library: string;
      methodId: string;
      categoryName: string;
    }[]>();

    // Track methods that have any microcycle-specific allocations (method-level override)
    const methodsWithSpecific = new Set<string>();

    // Step 2: Iterate through exercise selection data and categorize
    Object.entries(exerciseSelectionData).forEach(([cellId, cellData]) => {
      if (cellData.mesocycleId !== currentMesocycle.id) return;

      cellData.exercises.forEach(exercise => {
        if (cellData.microcycleId) {
          // Microcycle-specific allocation
          const key = `${cellData.methodId}-${cellData.categoryName}-${cellData.microcycleId}`;
          if (!microcycleSpecific.has(key)) {
            microcycleSpecific.set(key, []);
          }
          microcycleSpecific.get(key)!.push({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            library: exercise.library,
            methodId: cellData.methodId,
            categoryName: cellData.categoryName || '',
            microcycleId: cellData.microcycleId
          });
          // Mark method as having microcycle-specific allocations
          methodsWithSpecific.add(cellData.methodId);
        } else {
          // Mesocycle-level allocation
          const key = `${cellData.methodId}-${cellData.categoryName}`;
          if (!mesocycleLevel.has(key)) {
            mesocycleLevel.set(key, []);
          }
          mesocycleLevel.get(key)!.push({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            library: exercise.library,
            methodId: cellData.methodId,
            categoryName: cellData.categoryName || ''
          });
        }
      });
    });

    // Log categorized counts before building result
    const microcycleSpecificCount = Array.from(microcycleSpecific.values()).reduce((acc, arr) => acc + arr.length, 0);
    const mesocycleLevelCount = Array.from(mesocycleLevel.values()).reduce((acc, arr) => acc + arr.length, 0);
    console.log('[allocatedExercises] categorized', { microcycleSpecificKeys: microcycleSpecific.size, microcycleSpecificCount, mesocycleLevelKeys: mesocycleLevel.size, mesocycleLevelCount });

    // Step 3: Build final result with priority logic
    const exerciseMap = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      library: string;
      methodId: string;
      categoryName: string;
      microcycleIds: string[];
    }>();

    // New override logic: microcycle-specific overrides mesocycle-level per method across the whole mesocycle
    console.log('[allocatedExercises] override methods', { methodsWithSpecific: Array.from(methodsWithSpecific) });

    // Process each microcycle: always add microcycle-specific; add mesocycle-level only when no specific exists anywhere
    currentMesocycle.microcycles.forEach(microcycle => {
      // Add microcycle-specific allocations for this microcycle
      microcycleSpecific.forEach((exercises, key) => {
        if (key.endsWith(`-${microcycle.id}`)) {
          exercises.forEach(exercise => {
            const exerciseKey = `${exercise.exerciseId}-${exercise.methodId}-${exercise.categoryName}`;
            if (exerciseMap.has(exerciseKey)) {
              const existing = exerciseMap.get(exerciseKey)!;
              exerciseMap.set(exerciseKey, { ...existing, microcycleIds: [...existing.microcycleIds, microcycle.id] });
            } else {
              exerciseMap.set(exerciseKey, { ...exercise, microcycleIds: [microcycle.id] });
            }
          });
        }
      });

      // Add mesocycle-level allocations only if there is no microcycle-specific anywhere for that method
      mesocycleLevel.forEach((exercises, methodCategoryKey) => {
        const methodId = methodCategoryKey.split('-')[0];
        if (!methodsWithSpecific.has(methodId)) {
          exercises.forEach(exercise => {
            const exerciseKey = `${exercise.exerciseId}-${exercise.methodId}-${exercise.categoryName}`;
            if (exerciseMap.has(exerciseKey)) {
              const existing = exerciseMap.get(exerciseKey)!;
              exerciseMap.set(exerciseKey, { ...existing, microcycleIds: [...existing.microcycleIds, microcycle.id] });
            } else {
              exerciseMap.set(exerciseKey, { ...exercise, microcycleIds: [microcycle.id] });
            }
          });
        }
      });
    });

    const result = Array.from(exerciseMap.values());
    console.log('[allocatedExercises] result', { mesocycleId: currentMesocycle.id, isSplit, resultCount: result.length, result });
    return result;
  }, [currentMesocycle, exerciseSelectionData, splitStates]);

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

  // Calculate allocation warnings
  const allocationWarnings = useMemo((): AllocationWarning[] => {
    if (!currentMesocycle) return [];
    
    const warnings: AllocationWarning[] = [];
    const processedExercises = new Set<string>();
    
    // For each exercise in distribution
    exerciseDistribution.forEach(distEx => {
      // Find which microcycle this day belongs to
      const microcycle = currentMesocycle.microcycles.find(m => 
        daysByMicrocycle[m.id]?.some(day => day.date === distEx.dayDate)
      );
      
      if (!microcycle) return;
      
      // Find if this exercise was allocated to this microcycle in Step 6
      const wasAllocated = allocatedExercises.some(allocEx => 
        allocEx.exerciseId === distEx.exerciseId &&
        allocEx.methodId === distEx.methodId &&
        allocEx.categoryName === distEx.categoryName &&
        allocEx.microcycleIds.includes(microcycle.id)
      );
      
      if (!wasAllocated) {
        const key = `${distEx.exerciseId}-${distEx.methodId}-${microcycle.id}`;
        if (!processedExercises.has(key)) {
          processedExercises.add(key);
          warnings.push({
            exerciseId: distEx.exerciseId,
            exerciseName: distEx.exerciseName,
            methodId: distEx.methodId,
            microcycleId: microcycle.id,
            microcycleName: microcycle.name,
            type: 'not-allocated'
          });
        }
      }
    });
    
    return warnings;
  }, [currentMesocycle, exerciseDistribution, allocatedExercises, daysByMicrocycle]);

  // Get warnings for a specific microcycle
  const getWarningsForMicrocycle = (microcycleId: string) => {
    const freqWarnings = frequencyWarnings.filter(w => w.microcycleId === microcycleId);
    const allocWarnings = allocationWarnings.filter(w => w.microcycleId === microcycleId);
    return { 
      frequencyWarnings: freqWarnings, 
      allocationWarnings: allocWarnings, 
      hasWarnings: freqWarnings.length > 0 || allocWarnings.length > 0 
    };
  };

  // Get periodization parameters for a specific microcycle
  const getPeriodizationForMicrocycle = (microcycleId: string) => {
    if (!currentMesocycle) return [];
    
    const microcycleIndex = currentMesocycle.microcycles.findIndex(m => m.id === microcycleId);
    if (microcycleIndex === -1) return [];
    
    const methodData = parameterValues[currentMesocycle.id]?.[microcycleIndex];
    if (!methodData) return [];
    
    const periodization: Array<{
      methodName: string;
      parameters: Array<{ name: string; value: string | number }>;
    }> = [];
    
    // Iterate through all methods allocated to this microcycle
    Object.entries(methodData).forEach(([methodName, sessions]) => {
      // Get parameters from first session (session 0) as representative
      const sessionParams = sessions[0];
      if (!sessionParams) return;
      
      const parameters = Object.entries(sessionParams).map(([paramName, paramValue]) => ({
        name: paramName,
        value: paramValue
      }));
      
      if (parameters.length > 0) {
        periodization.push({
          methodName,
          parameters
        });
      }
    });
    
    return periodization;
  };

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

  // Handle splitting a day into multiple sessions
  const handleSplitDay = (dayDate: string, numberOfSessions: number) => {
    setDaySplitStates(prev => ({ ...prev, [dayDate]: numberOfSessions }));
  };

  // Handle collapsing a day back to single session
  const handleCollapseDay = (dayDate: string) => {
    // Consolidate all exercises from multiple sessions into session 0
    setExerciseDistribution(prev => prev.map(ex => 
      ex.dayDate === dayDate ? { ...ex, sessionIndex: 0 } : ex
    ));
    
    // Reset split state
    setDaySplitStates(prev => {
      const newState = { ...prev };
      delete newState[dayDate];
      return newState;
    });
  };

  // Copy exercises from previous microcycle
  const handleCopyFromPreviousMicrocycle = (targetMicrocycleId: string) => {
    if (!currentMesocycle) return;
    
    const targetIndex = currentMesocycle.microcycles.findIndex(m => m.id === targetMicrocycleId);
    if (targetIndex <= 0) return; // No previous microcycle
    
    const previousMicrocycle = currentMesocycle.microcycles[targetIndex - 1];
    const targetMicrocycle = currentMesocycle.microcycles[targetIndex];
    
    const previousDays = daysByMicrocycle[previousMicrocycle.id] || [];
    const targetDays = daysByMicrocycle[targetMicrocycle.id] || [];
    
    // Validate matching duration
    if (previousDays.length !== targetDays.length) {
      toast({
        title: "Cannot Copy",
        description: "Microcycles have different durations (number of days)",
        variant: "destructive"
      });
      return;
    }
    
    // Get all exercises from previous microcycle
    const previousExercises = exerciseDistribution.filter(ex => 
      previousDays.some(day => day.date === ex.dayDate)
    );
    
    // Map to target microcycle (by day position)
    const newExercises = previousExercises.map(ex => {
      const previousDayIndex = previousDays.findIndex(d => d.date === ex.dayDate);
      const targetDay = targetDays[previousDayIndex];
      
      if (!targetDay) return null;
      
      return {
        ...ex,
        dayDate: targetDay.date
      };
    }).filter(Boolean) as ExerciseDistribution[];
    
    // Also copy split states from previous microcycle days to target days
    const newSplitStates = { ...daySplitStates };
    previousDays.forEach((prevDay, idx) => {
      const targetDay = targetDays[idx];
      if (targetDay && daySplitStates[prevDay.date]) {
        newSplitStates[targetDay.date] = daySplitStates[prevDay.date];
      }
    });
    setDaySplitStates(newSplitStates);
    
    // Replace target microcycle's exercises completely (overwrite)
    setExerciseDistribution(prev => {
      // Step 1: Remove ALL exercises from the target microcycle
      const filteredPrev = prev.filter(ex => 
        !targetDays.some(day => day.date === ex.dayDate)
      );
      
      // Step 2: Add ALL exercises from the source microcycle (mapped to target days)
      return [...filteredPrev, ...newExercises];
    });
    
    // Show success toast
    toast({
      title: "Exercises Copied",
      description: `Copied ${newExercises.length} exercise${newExercises.length !== 1 ? 's' : ''} from ${previousMicrocycle.name} to ${targetMicrocycle.name}`
    });
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
          <div className="overflow-x-auto relative">
            <div className="min-w-max">
              {/* Three-level headers */}
              <div className="border rounded-lg mb-4">
                {/* Level 1: Mesocycle */}
                <div className={cn("p-2 text-center font-semibold border-b", getIntensityColor(currentMesocycle.intensity))}>
                  {currentMesocycle.name}
                </div>
                
                {/* Level 2: Microcycles */}
                <TooltipProvider>
                  <div className="flex border-b">
                    <div className="w-64 shrink-0 border-r p-2 font-semibold bg-muted sticky left-0 z-20">
                      Training Methods
                    </div>
                    {currentMesocycle.microcycles.map((microcycle, microcycleIndex) => {
                      const dayCount = daysByMicrocycle[microcycle.id]?.length || 0;
                      
                      // Check if copy button should be shown and enabled
                      let hasMatchingDuration = false;
                      let previousMicrocycle = null;
                      if (microcycleIndex > 0) {
                        previousMicrocycle = currentMesocycle.microcycles[microcycleIndex - 1];
                        const currentDays = daysByMicrocycle[microcycle.id] || [];
                        const previousDays = daysByMicrocycle[previousMicrocycle.id] || [];
                        hasMatchingDuration = currentDays.length === previousDays.length;
                      }
                      
                      return (
                        <div 
                          key={microcycle.id}
                          className={cn("flex-1 border-r last:border-r-0", getIntensityColor(microcycle.intensity))}
                          style={{ minWidth: `${dayCount * 120}px` }}
                        >
                          <div className="flex items-center justify-center p-2 relative gap-1">
                            <span className="font-semibold">{microcycle.name}</span>
                            
                            {/* Info icon for periodization */}
                            {(() => {
                              const periodization = getPeriodizationForMicrocycle(microcycle.id);
                              
                              if (periodization.length === 0) return null;
                              
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="text-blue-600 hover:text-blue-700 transition-colors">
                                      <Info className="h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-96" align="start">
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm border-b pb-2">
                                        Periodization for {microcycle.name}
                                      </h4>
                                      
                                      <div className="space-y-3 max-h-80 overflow-y-auto">
                                        {periodization.map((method, idx) => (
                                          <div key={idx} className="space-y-1">
                                            <h5 className="text-xs font-semibold text-blue-700">
                                              {method.methodName}
                                            </h5>
                                            <div className="pl-2 space-y-0.5">
                                              {method.parameters.map((param, pIdx) => (
                                                <p key={pIdx} className="text-xs text-gray-700">
                                                  <span className="font-medium">{param.name}:</span>{' '}
                                                  {param.value}
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                            
                            {/* Warning indicator */}
                            {(() => {
                              const { frequencyWarnings: micFreqWarnings, allocationWarnings: micAllocWarnings, hasWarnings } = getWarningsForMicrocycle(microcycle.id);
                              
                              if (!hasWarnings) return null;
                              
                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="text-amber-600 hover:text-amber-700 transition-colors">
                                      <AlertTriangle className="h-4 w-4" fill="currentColor" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" align="start">
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-sm">Warnings for {microcycle.name}</h4>
                                      
                                      {micFreqWarnings.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-medium text-muted-foreground mb-1">Frequency Mismatches:</h5>
                                          <ul className="text-xs space-y-1">
                                            {micFreqWarnings.map((warning, idx) => (
                                              <li key={idx} className="flex items-start gap-1">
                                                <span className="text-amber-600">•</span>
                                                <span>
                                                  {warning.methodName}: Expected {warning.expected}×, but has {warning.actual}×
                                                  {warning.type === 'over' ? ' (too many)' : ' (too few)'}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {micAllocWarnings.length > 0 && (
                                        <div>
                                          <h5 className="text-xs font-medium text-muted-foreground mb-1">Unallocated Exercises:</h5>
                                          <ul className="text-xs space-y-1">
                                            {micAllocWarnings.map((warning, idx) => (
                                              <li key={idx} className="flex items-start gap-1">
                                                <span className="text-amber-600">•</span>
                                                <span>
                                                  {warning.exerciseName} ({warning.methodId}) was not allocated in Step 6
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                            
                            {microcycleIndex > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleCopyFromPreviousMicrocycle(microcycle.id)}
                                    disabled={!hasMatchingDuration}
                                    className="h-6 w-6 p-0 absolute right-1"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasMatchingDuration 
                                    ? `Copy exercises from ${previousMicrocycle?.name}`
                                    : "Cannot copy - microcycles have different durations"
                                  }
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TooltipProvider>

                {/* Level 3: Days */}
                <div className="flex border-b">
                  <div className="w-64 shrink-0 border-r p-2 text-sm bg-muted sticky left-0 z-20">
                    Exercise Category
                  </div>
                  {currentMesocycle.microcycles.map(microcycle => {
                      const days = daysByMicrocycle[microcycle.id] || [];
                      return (
                        <div key={microcycle.id} className="flex flex-1 border-r last:border-r-0">
                          {days.map(day => {
                            const dailyIntensityRecord = dailyIntensityData.find(di => di.date === day.date);
                            const dailyIntensity = dailyIntensityRecord?.intensity || 'off';
                            const numberOfSessions = daySplitStates[day.date] || 1;
                            const isSplit = numberOfSessions > 1;
                            
                            return (
                              <div 
                                key={day.date}
                                className="flex flex-col border-r last:border-r-0"
                                style={{ width: isSplit ? `${numberOfSessions * 120}px` : '120px' }}
                              >
                                {/* Day header */}
                                <div className={cn("p-1 text-xs text-center border-b", getIntensityColor(dailyIntensity))}>
                                  <div className="font-semibold">{day.dayName}</div>
                                  <div>{format(new Date(day.date), 'MMM d')}</div>
                                  
                                  {/* Split/Collapse buttons */}
                                  <div className="mt-1 flex justify-center gap-1">
                                    {isSplit ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleCollapseDay(day.date)}
                                        className="h-5 px-2 text-[10px]"
                                      >
                                        Collapse
                                      </Button>
                                    ) : (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 px-2 text-[10px]"
                                          >
                                            Split <ChevronDown className="ml-1 h-3 w-3" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center" className="z-50">
                                          {[2, 3, 4, 5].map(n => (
                                            <DropdownMenuItem 
                                              key={n}
                                              onClick={() => handleSplitDay(day.date, n)}
                                            >
                                              {n} sessions
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Session sub-headers */}
                                {isSplit && (
                                  <div className="flex">
                                    {Array.from({ length: numberOfSessions }, (_, sessionIdx) => (
                                      <div 
                                        key={sessionIdx}
                                        className="w-[120px] p-1 text-[10px] text-center border-r last:border-r-0 bg-muted/50"
                                      >
                                        Session {sessionIdx + 1}
                                      </div>
                                    ))}
                                  </div>
                                )}
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
                      <div key={methodId} className="border rounded-lg">
                        {/* Method header */}
                        <div className="flex border-b">
                          <div className="w-64 shrink-0 sticky left-0 z-30 bg-background px-4 py-2 font-semibold text-sm border-r shadow-sm">
                            {methodId}
                          </div>
                          <div className="flex-1" />
                        </div>
                        
                        {/* Category rows */}
                        <div className="space-y-0">
                          {Object.entries(methodData.categories).map(([categoryName, exercises]) => (
                            <div key={`${methodId}-${categoryName}`} className="border-b last:border-b-0">
                              <div className="flex">
                                {/* Left sidebar: Category and Exercises */}
                                <div className="w-64 shrink-0 border-r px-3 py-2 bg-background sticky left-0 z-20">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    {categoryName}
                                  </div>
                                  <div className="space-y-0.5">
                                    {exercises.map((exercise, idx) => {
                                      const microcycleNames = exercise.microcycleIds
                                        .map(id => currentMesocycle.microcycles.find(m => m.id === id)?.name)
                                        .filter(Boolean);
                                      
                                      return (
                                        <div
                                          key={`${exercise.exerciseId}-${idx}`}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, exercise)}
                                          className="px-2 py-0.5 bg-background border rounded cursor-move hover:border-primary transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-1">
                                            <div className="text-xs font-medium leading-tight flex-1">{exercise.exerciseName}</div>
                                            {microcycleNames.length > 0 && (
                                              <TooltipProvider>
                                                <Tooltip delayDuration={200}>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-4 w-4 p-0 shrink-0"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      <Info className="h-3 w-3" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="z-50 bg-popover">
                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                      {microcycleNames.map((name, i) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 leading-none">
                                                          {name}
                                                        </Badge>
                                                      ))}
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            )}
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
                                        {days.map(day => {
                                          const numberOfSessions = daySplitStates[day.date] || 1;
                                          const isSplit = numberOfSessions > 1;
                                          
                                          return (
                                            <div key={day.date} className="flex border-r last:border-r-0">
                                              {Array.from({ length: numberOfSessions }, (_, sessionIdx) => (
                                                <div
                                                  key={sessionIdx}
                                                  className="w-[120px] p-2 border-r last:border-r-0 min-h-[100px]"
                                                  onDrop={(e) => handleDrop(e, day.date, sessionIdx, methodId, categoryName)}
                                                  onDragOver={handleDragOver}
                                                >
                                                  <div className="space-y-1">
                                                    {getExercisesForCell(day.date, sessionIdx, methodId, categoryName).map((ex, idx) => (
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
        <PlanningNavigationMenu currentPage="microcycle" currentPageStep={currentStep} />
      </div>

      <NavigationButtons />

      {renderTrainingPlanOverview()}
      {renderMesocycleNavigation()}
      {currentStep === 1 && renderExerciseDistribution()}

      <NavigationButtons />
    </div>
  );
}
