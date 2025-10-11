import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, Target, AlertTriangle, Info, Copy, ChevronDown, Columns, ChevronRight, X, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseSelection } from '@/types/microcycle-planning';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { TrainingCalendarView } from '@/components/microcycle-planning';

interface ExerciseDistribution {
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
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
  const [clearMesocycleDialogOpen, setClearMesocycleDialogOpen] = useState(false);
  const [clearMicrocycleDialog, setClearMicrocycleDialog] = useState<{
    isOpen: boolean;
    microcycleId: string;
    microcycleName: string;
  }>({
    isOpen: false,
    microcycleId: '',
    microcycleName: ''
  });

  const totalSteps = 2; // Step 1: Exercise Distribution, Step 2: Training Calendar

  // Load data from localStorage
  useEffect(() => {
    const savedMacrocycleData = localStorage.getItem('macrocycleData');
    const savedMesocycleData = localStorage.getItem('mesocycleData');
    const savedParameters = localStorage.getItem('parameterValues');
    const savedTrainingDays = localStorage.getItem('trainingDays');

    if (savedMacrocycleData) {
      setMacrocycleData(JSON.parse(savedMacrocycleData));
    }

    if (savedMesocycleData) {
      const data = JSON.parse(savedMesocycleData);
      setMesocycles(data.mesocycles || []);
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

    // Load from Step 6 (Exercise Selection) - this is the source of truth
    const savedMicrocyclePlanningState = localStorage.getItem('microcyclePlanningState');
    if (savedMicrocyclePlanningState) {
      const planningState = JSON.parse(savedMicrocyclePlanningState);
      console.log('[MicrocyclePlanningPage] Loaded microcyclePlanningState:', planningState);
      
      // Use cellData from Step 6 as the source of truth
      setExerciseSelectionData(planningState.cellData || {});
      setSplitStates(planningState.splitStates || {});
    } else {
      // Fallback to legacy key if microcyclePlanningState doesn't exist
      const savedExerciseSelection = localStorage.getItem('exerciseSelectionData');
      if (savedExerciseSelection) {
        setExerciseSelectionData(JSON.parse(savedExerciseSelection));
      }
      console.log('[MicrocyclePlanningPage] No microcyclePlanningState found, using legacy exerciseSelectionData');
    }
  }, []);

  // Validate and clean up exercise selection data on load
  useEffect(() => {
    if (Object.keys(exerciseSelectionData).length === 0 || mesocycles.length === 0) {
      return;
    }

    const validMesocycleIds = new Set(mesocycles.map(m => m.id));
    const validMicrocycleIds = new Set(
      mesocycles.flatMap(m => m.microcycles.map(mc => mc.id))
    );

    let hasInvalidData = false;
    const cleanedData: Record<string, CellData> = {};

    Object.entries(exerciseSelectionData).forEach(([cellId, cellData]) => {
      // Check if mesocycle is valid
      if (!validMesocycleIds.has(cellData.mesocycleId)) {
        hasInvalidData = true;
        console.log('[Step1] Removed invalid cell - mesocycle not found:', cellId);
        return;
      }

      // Check if microcycle is valid (if specified)
      if (cellData.microcycleId && !validMicrocycleIds.has(cellData.microcycleId)) {
        hasInvalidData = true;
        console.log('[Step1] Removed invalid cell - microcycle not found:', cellId);
        return;
      }

      // Cell is valid, keep it
      cleanedData[cellId] = cellData;
    });

    if (hasInvalidData) {
      setExerciseSelectionData(cleanedData);
      
      // Update localStorage
      const savedPlanningState = localStorage.getItem('microcyclePlanningState');
      if (savedPlanningState) {
        try {
          const planningState = JSON.parse(savedPlanningState);
          planningState.cellData = cleanedData;
          localStorage.setItem('microcyclePlanningState', JSON.stringify(planningState));
        } catch (error) {
          console.error('Failed to update planning state:', error);
        }
      }

      toast({
        title: "Data cleaned up",
        description: "Removed invalid exercise allocations from previous planning sessions.",
      });
    }
  }, [exerciseSelectionData, mesocycles, toast]);

  // Save exercise distribution to localStorage
  useEffect(() => {
    localStorage.setItem('exerciseDistribution', JSON.stringify(exerciseDistribution));
    console.log('[MicrocyclePlanningPage] Saved exerciseDistribution:', exerciseDistribution.length, 'exercises');
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
  
  // Helper functions for canonical group keys
  const parseMethod = (fullMethodId: string): { methodMain: string; subCategory: string } => {
    const parts = fullMethodId.split(/\s*-\s*/);
    return {
      methodMain: (parts[0] || '').trim(),
      subCategory: (parts[1] || '').trim()
    };
  };

  const normalizeKey = (s: string): string => {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const methodGroupKey = (fullMethodId: string): string => {
    const { methodMain, subCategory } = parseMethod(fullMethodId);
    return `${normalizeKey(methodMain)}|${normalizeKey(subCategory)}`;
  };

  // Track method groups (methodMain + subCategory) that have microcycle-specific allocations in the CURRENT mesocycle
  const groupsWithMicrocycleAllocations = useMemo(() => {
    if (!currentMesocycle) return new Set<string>();
    
    const groups = new Set<string>();
    Object.values(exerciseSelectionData).forEach(cellData => {
      // Only consider cells for the current mesocycle that have microcycle-specific allocations
      if (cellData.mesocycleId === currentMesocycle.id && cellData.microcycleId) {
        const groupKey = methodGroupKey(cellData.methodId);
        groups.add(groupKey);
      }
    });
    
    console.log('[Step1] Groups with microcycle allocations:', Array.from(groups));
    return groups;
  }, [currentMesocycle, exerciseSelectionData]);

  // Get exercises allocated to current mesocycle from Step 6, de-duplicated and with proper hierarchy
  const allocatedExercises = useMemo(() => {
    if (!currentMesocycle) return [];

    // First pass: collect all exercises with their data
    const exerciseMap = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      library: string;
      methodId: string; // Full methodId from Step 6
      methodMain: string; // Parsed main method
      subCategory: string; // Parsed sub-category
      categoryName: string;
      microcycleIds: Set<string>;
    }>();

    // For each cell in exerciseSelectionData for this mesocycle
    Object.values(exerciseSelectionData).forEach(cellData => {
      if (cellData.mesocycleId !== currentMesocycle.id) return;
      
      const isMesocycleLevel = !cellData.microcycleId;
      const fullMethodId = cellData.methodId; // e.g., "Lower Body Resistance Training - Strength"
      const groupKey = methodGroupKey(fullMethodId);
      
      // Skip mesocycle-level if this method group has ANY microcycle-specific allocations
      if (isMesocycleLevel && groupsWithMicrocycleAllocations.has(groupKey)) {
        console.log('[Step1] Suppressed meso-level cell:', { methodId: fullMethodId, groupKey });
        return;
      }
      
      // Parse methodId into methodMain and subCategory
      const methodParts = fullMethodId.split(' - ');
      const methodMain = methodParts[0] || fullMethodId;
      const subCategory = methodParts[1] || '';
      
      // Sanitize categoryName - remove fake categories like "meso", numeric strings, or current microcycle IDs
      let sanitizedCategoryName = cellData.categoryName || '';
      const microcycleIds = currentMesocycle.microcycles.map(m => m.id);
      if (
        !sanitizedCategoryName ||
        sanitizedCategoryName.toLowerCase() === 'main' ||
        sanitizedCategoryName.toLowerCase() === 'meso' ||
        /^\d+$/.test(sanitizedCategoryName) ||
        microcycleIds.includes(sanitizedCategoryName)
      ) {
        sanitizedCategoryName = '';
      }
      
      cellData.exercises.forEach(exercise => {
        // Create unique key for de-duplication
        const key = `${fullMethodId}|${sanitizedCategoryName}|${exercise.exerciseId}|${exercise.library}`;
        
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            library: exercise.library,
            methodId: fullMethodId,
            methodMain,
            subCategory,
            categoryName: sanitizedCategoryName,
            microcycleIds: new Set()
          });
        }
        
        // Merge microcycle IDs
        const entry = exerciseMap.get(key)!;
        if (cellData.microcycleId) {
          entry.microcycleIds.add(cellData.microcycleId);
        } else {
          // Mesocycle-level: add all microcycles
          currentMesocycle.microcycles.forEach(m => entry.microcycleIds.add(m.id));
        }
      });
    });

    // Convert to array with microcycleIds as array
    return Array.from(exerciseMap.values()).map(ex => ({
      ...ex,
      microcycleIds: Array.from(ex.microcycleIds)
    }));
  }, [currentMesocycle, exerciseSelectionData, groupsWithMicrocycleAllocations]);

  // Group exercises by methodMain -> subCategory -> exerciseCategory hierarchy (mirror Step 6 structure)
  const exercisesByMethod = useMemo(() => {
    const grouped: Record<string, {
      methodMain: string;
      subCategories: Record<string, {
        subCategoryName: string;
        fullMethodId: string; // The complete methodId for this method+subCategory combo
        exerciseCategories: Record<string, typeof allocatedExercises>;
      }>;
    }> = {};
    
    allocatedExercises.forEach(exercise => {
      const methodMain = exercise.methodMain;
      const subCategory = exercise.subCategory || 'main';
      const exerciseCategory = exercise.categoryName || '';

      if (!grouped[methodMain]) {
        grouped[methodMain] = {
          methodMain,
          subCategories: {}
        };
      }

      if (!grouped[methodMain].subCategories[subCategory]) {
        grouped[methodMain].subCategories[subCategory] = {
          subCategoryName: subCategory,
          fullMethodId: exercise.methodId, // Store the full methodId for this combo
          exerciseCategories: {}
        };
      }

      if (!grouped[methodMain].subCategories[subCategory].exerciseCategories[exerciseCategory]) {
        grouped[methodMain].subCategories[subCategory].exerciseCategories[exerciseCategory] = [];
      }

      grouped[methodMain].subCategories[subCategory].exerciseCategories[exerciseCategory].push(exercise);
    });

    return grouped;
  }, [allocatedExercises]);

  // Calculate frequency for each method/microcycle
  const getMethodFrequency = (methodId: string, microcycleId: string, categoryName?: string): number => {
    if (!currentMesocycle) return 1;
    
    const microcycleIndex = currentMesocycle.microcycles.findIndex(m => m.id === microcycleId);
    if (microcycleIndex === -1) return 1;

    // Try both methodId and methodId::categoryName formats
    const methodKey = categoryName ? `${methodId}::${categoryName}` : methodId;
    let cellData = parameterValues[currentMesocycle.id]?.[microcycleIndex]?.[methodKey]?.[0];
    
    // If no data found with category suffix, try without it
    if (!cellData && categoryName) {
      cellData = parameterValues[currentMesocycle.id]?.[microcycleIndex]?.[methodId]?.[0];
    }
    
    if (!cellData) return 1;
    
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
    
    // Iterate through all methods allocated to this microcycle (including category-split methods)
    Object.entries(methodData).forEach(([methodName, sessions]) => {
      // Get parameters from first session (session 0) as representative
      const sessionParams = sessions[0];
      if (!sessionParams) return;
      
      const parameters = Object.entries(sessionParams).map(([paramName, paramValue]) => ({
        name: paramName,
        value: paramValue
      }));
      
      if (parameters.length > 0) {
        // Display full name including category if present (e.g., "Method - Category")
        const displayName = methodName.includes('::') 
          ? methodName.replace('::', ' - ') 
          : methodName;
        
        periodization.push({
          methodName: displayName,
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

    // Check if exercise matches the target method
    if (exercise.methodId !== methodId) {
      return; // Don't allow dropping in wrong method
    }

    // Add exercise to distribution
    setExerciseDistribution(prev => {
      // Check if already exists
      const exists = prev.some(
        ex => 
          ex.exerciseId === exercise.exerciseId && 
          ex.dayDate === dayDate && 
          ex.sessionIndex === sessionIndex &&
          ex.methodId === methodId
      );

      if (exists) return prev;

      return [
        ...prev,
        {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          methodId: exercise.methodId,
          categoryName: exercise.categoryName,
          subCategory: exercise.subCategory,
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

  // Delete an exercise from all cells in exerciseSelectionData
  const handleDeleteExercise = (exerciseId: string, library: string) => {
    let removedCount = 0;
    const updatedData: Record<string, CellData> = {};

    Object.entries(exerciseSelectionData).forEach(([cellId, cellData]) => {
      const filteredExercises = cellData.exercises.filter(
        ex => !(ex.exerciseId === exerciseId && ex.library === library)
      );

      if (filteredExercises.length < cellData.exercises.length) {
        removedCount++;
      }

      // Keep cell only if it still has exercises
      if (filteredExercises.length > 0) {
        updatedData[cellId] = {
          ...cellData,
          exercises: filteredExercises
        };
      }
    });

    if (removedCount > 0) {
      setExerciseSelectionData(updatedData);

      // Update localStorage
      const savedPlanningState = localStorage.getItem('microcyclePlanningState');
      if (savedPlanningState) {
        try {
          const planningState = JSON.parse(savedPlanningState);
          planningState.cellData = updatedData;
          localStorage.setItem('microcyclePlanningState', JSON.stringify(planningState));
        } catch (error) {
          console.error('Failed to update planning state:', error);
        }
      }

      toast({
        title: "Exercise removed",
        description: `Removed from ${removedCount} allocation${removedCount > 1 ? 's' : ''}.`,
      });
    }
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

  // Clear all exercises for the entire mesocycle
  const handleClearMesocycleExercises = () => {
    if (!currentMesocycle) return;
    
    // Get all microcycle IDs for this mesocycle
    const microcycleIds = currentMesocycle.microcycles.map(m => m.id);
    
    // Filter out exercises that belong to this mesocycle's microcycles
    const updatedDistribution = exerciseDistribution.filter(exercise => {
      const exerciseDay = trainingDays.find(d => d.date === exercise.dayDate);
      if (!exerciseDay) return true;
      return !microcycleIds.includes(exerciseDay.microcycleId);
    });
    
    setExerciseDistribution(updatedDistribution);
    setClearMesocycleDialogOpen(false);
    
    toast({
      title: "Mesocycle exercises cleared",
      description: `All exercises for ${currentMesocycle.name} have been removed.`,
    });
  };

  // Clear exercises for a specific microcycle only
  const handleClearMicrocycleExercises = (microcycleId: string) => {
    // Filter out exercises that belong to this specific microcycle
    const updatedDistribution = exerciseDistribution.filter(exercise => {
      const exerciseDay = trainingDays.find(d => d.date === exercise.dayDate);
      if (!exerciseDay) return true;
      return exerciseDay.microcycleId !== microcycleId;
    });
    
    setExerciseDistribution(updatedDistribution);
    setClearMicrocycleDialog({ isOpen: false, microcycleId: '', microcycleName: '' });
    
    const microcycleName = currentMesocycle?.microcycles.find(m => m.id === microcycleId)?.name;
    toast({
      title: "Microcycle exercises cleared",
      description: `All exercises for ${microcycleName} have been removed.`,
    });
  };

  // Get exercises for a specific day/session/method
  const getExercisesForCell = (dayDate: string, sessionIndex: number, methodId: string) => {
    return exerciseDistribution.filter(
      ex => 
        ex.dayDate === dayDate && 
        ex.sessionIndex === sessionIndex &&
        ex.methodId === methodId
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
                <div className={cn("p-2 text-center font-semibold border-b flex items-center justify-center gap-2", getIntensityColor(currentMesocycle.intensity))}>
                  <span>{currentMesocycle.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setClearMesocycleDialogOpen(true)}
                    className="h-7 px-3 text-foreground hover:bg-destructive/10 border border-destructive/20"
                    title="Clear all exercises for this mesocycle"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Clear Exercises
                  </Button>
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
                            
                            {/* Clear button for this microcycle */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setClearMicrocycleDialog({
                                    isOpen: true,
                                    microcycleId: microcycle.id,
                                    microcycleName: microcycle.name
                                  })}
                                  className="h-6 px-2 text-foreground hover:bg-destructive/10 border border-destructive/20"
                                  title="Clear exercises for this microcycle"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Clear all exercises for {microcycle.name}
                              </TooltipContent>
                            </Tooltip>
                            
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

              {/* Exercise rows - grouped by method -> subCategory -> exerciseCategory */}
              <div className="space-y-4">
                {Object.keys(exercisesByMethod).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    No exercises allocated in Step 6 of Mesocycle Planning
                  </div>
                ) : (
                Object.entries(exercisesByMethod).map(([methodMainKey, methodData]) => {
                    return (
                      <Collapsible key={methodMainKey} defaultOpen={true}>
                        <div className="border rounded-lg overflow-hidden">
                          {/* Method header */}
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center border-b hover:bg-muted/50 transition-colors">
                              <div className="w-64 shrink-0 sticky left-0 z-30 bg-background px-4 py-2 font-semibold text-sm border-r shadow-sm flex items-center gap-2">
                                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
                                {methodData.methodMain}
                              </div>
                              <div className="flex-1" />
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            {/* Sub-categories */}
                            {Object.entries(methodData.subCategories).map(([subCategoryKey, subCategoryData]) => (
                              <div key={subCategoryKey} className="border-b last:border-b-0">
                                {/* Sub-category header (only if not 'main') */}
                                {subCategoryKey !== 'main' && (
                                  <div className="flex bg-muted/30">
                                    <div className="w-64 shrink-0 sticky left-0 z-20 bg-muted/30 px-6 py-1 text-sm font-medium border-r">
                                      {subCategoryData.subCategoryName}
                                    </div>
                                    <div className="flex-1" />
                                  </div>
                                )}
                                
                                {/* Exercise Categories (if they exist) */}
                                {Object.entries(subCategoryData.exerciseCategories).map(([categoryKey, exercises]) => {
                                  const fullMethodId = subCategoryData.fullMethodId; // Get the full methodId for this subCategory
                                  
                                  return (
                                    <div key={categoryKey} className="border-b last:border-b-0">
                                      <div className="flex">
                                        {/* Left sidebar: Category and Exercises */}
                                        <div className="w-64 shrink-0 border-r px-3 py-2 bg-background sticky left-0 z-20">
                                          {categoryKey && (
                                            <div className="text-xs font-medium text-muted-foreground mb-2">
                                              {categoryKey}
                                            </div>
                                          )}
                                          <div className="space-y-0.5">
                                            {exercises.map((exercise, idx) => {
                                              const microcycleNames = exercise.microcycleIds
                                                .map(id => currentMesocycle.microcycles.find(m => m.id === id)?.name)
                                                .filter(Boolean) as string[];
                                              
                                              return (
                                                <div
                                                  key={`${exercise.exerciseId}-${idx}`}
                                                  draggable
                                                  onDragStart={(e) => handleDragStart(e, exercise)}
                                                  className="px-2 py-0.5 bg-background border rounded cursor-move hover:border-primary transition-colors group"
                                                >
                                                  <div className="flex items-start justify-between gap-1">
                                                    <div className="text-xs font-medium leading-tight flex-1">{exercise.exerciseName}</div>
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                      {microcycleNames.length > 0 && (
                                                        <TooltipProvider>
                                                          <Tooltip delayDuration={200}>
                                                            <TooltipTrigger asChild>
                                                              <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-4 w-4 p-0"
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
                                                      <TooltipProvider>
                                                        <Tooltip delayDuration={200}>
                                                          <TooltipTrigger asChild>
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteExercise(exercise.exerciseId, exercise.library);
                                                              }}
                                                              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                              <X className="h-3 w-3 text-destructive" />
                                                            </Button>
                                                          </TooltipTrigger>
                                                          <TooltipContent side="right">
                                                            Remove from all allocations
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    </div>
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
                                                  
                                                  return (
                                                    <div key={day.date} className="flex border-r last:border-r-0">
                                                      {Array.from({ length: numberOfSessions }, (_, sessionIdx) => (
                                                        <div
                                                          key={sessionIdx}
                                                          className="w-[120px] p-2 border-r last:border-r-0 min-h-[100px]"
                                                          onDrop={(e) => handleDrop(e, day.date, sessionIdx, fullMethodId, categoryKey)}
                                                          onDragOver={handleDragOver}
                                                        >
                                                          <div className="space-y-1">
                                                            {getExercisesForCell(day.date, sessionIdx, fullMethodId).map((ex, idx) => (
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
                                                                        e.methodId === ex.methodId
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
                                  );
                                })}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
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
      
      {currentStep === 1 && renderExerciseDistribution()}
      
      {currentStep === 2 && currentMesocycle && (
        <>
          {console.log('[Step 2] Rendering calendar with', exerciseDistribution.length, 'exercises')}
          <TrainingCalendarView
            exerciseDistribution={exerciseDistribution}
            trainingDays={currentMesocycleDays}
            currentMesocycle={currentMesocycle}
            mesocycles={mesocycles}
          />
        </>
      )}

      <NavigationButtons />

      {/* Clear Mesocycle Confirmation Dialog */}
      <AlertDialog open={clearMesocycleDialogOpen} onOpenChange={setClearMesocycleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all exercises for {currentMesocycle?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all distributed exercises for all microcycles in {currentMesocycle?.name}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearMesocycleExercises}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Exercises
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Microcycle Confirmation Dialog */}
      <AlertDialog 
        open={clearMicrocycleDialog.isOpen} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setClearMicrocycleDialog({ isOpen: false, microcycleId: '', microcycleName: '' });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear exercises for {clearMicrocycleDialog.microcycleName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all distributed exercises for {clearMicrocycleDialog.microcycleName} only.
              Exercises in other microcycles will remain intact. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClearMicrocycleExercises(clearMicrocycleDialog.microcycleId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Microcycle Exercises
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
