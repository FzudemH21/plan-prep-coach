import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, Target, AlertTriangle, Info, Copy, ChevronDown, Columns, ChevronRight, X, Trash2, Trophy, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseSelection } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { useToolboxData } from '@/hooks/useToolboxData';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { TrainingCalendarView } from '@/components/microcycle-planning';
import { DropResult } from '@hello-pangea/dnd';

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
  const { data: toolboxData } = useToolboxData();
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
  const [copiedSession, setCopiedSession] = useState<{
    exercises: ExerciseDistribution[];
    sourceDate: string;
    sessionIndex: number;
  } | null>(null);
  const [copiedWeek, setCopiedWeek] = useState<{
    exercises: ExerciseDistribution[];
    weekStartDate: string;
  } | null>(null);
  const [copiedDay, setCopiedDay] = useState<{
    exercises: ExerciseDistribution[];
    sourceDate: string;
    intensity?: IntensityLevel;
    testNames?: string[];
    eventNames?: string[];
    splitState?: number;
  } | null>(null);

  const totalSteps = 2; // Step 1: Exercise Distribution, Step 2: Training Calendar

  // Define intensity levels and color function
  const intensityLevels: IntensityLevel[] = ["off", "deload", "easy", "easy-moderate", "moderate", "moderate-hard", "hard", "extremely-hard"];

  const getIntensityColor = (intensity: IntensityLevel) => {
    const colors = {
      "off": "bg-[hsl(var(--intensity-off))] text-black border-2",
      "deload": "bg-[hsl(var(--intensity-deload))] text-white",
      "easy": "bg-[hsl(var(--intensity-easy))] text-white", 
      "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate))] text-white",
      "moderate": "bg-[hsl(var(--intensity-moderate))] text-black",
      "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard))] text-white",
      "hard": "bg-[hsl(var(--intensity-hard))] text-white",
      "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard))] text-white"
    };
    return colors[intensity] || "bg-muted text-muted-foreground";
  };

  // Load data from localStorage
  useEffect(() => {
    const savedMacrocycleData = localStorage.getItem('macrocycleData');
    const savedMesocycleData = localStorage.getItem('mesocycleData');
    const savedParameters = localStorage.getItem('parameterValues');
    const savedTrainingDays = localStorage.getItem('trainingDays');
    const savedMicrocycleStep = localStorage.getItem('microcycleStep');

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
      const loadedDays = JSON.parse(savedTrainingDays);
      
      // Migrate old data format to new format (testName -> testNames, eventName -> eventNames)
      const migratedDays = loadedDays.map((td: any) => {
        const migrated = { ...td };
        
        // Migrate testName to testNames
        if ('testName' in td && td.testName) {
          migrated.testNames = [td.testName];
          delete migrated.testName;
        }
        
        // Migrate eventName to eventNames
        if ('eventName' in td && td.eventName) {
          migrated.eventNames = [td.eventName];
          delete migrated.eventName;
        }
        
        return migrated;
      });
      
      setTrainingDays(migratedDays);
    }

    if (savedMicrocycleStep) {
      setCurrentStep(parseInt(savedMicrocycleStep, 10));
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

  // Enrich trainingDays with test/event names from macrocycleData
  useEffect(() => {
    if (!macrocycleData || trainingDays.length === 0) return;

    const testMap = new Map<string, string[]>();
    (macrocycleData.subGoals || []).forEach((sg: any) => {
      const name = sg.testMethod || sg.name || sg.testName || sg.method || sg.description || 'Test';
      (sg.testDates || []).forEach((dateStr: string) => {
        const existing = testMap.get(dateStr) || [];
        testMap.set(dateStr, [...existing, name]);
      });
    });

    const eventMap = new Map<string, string[]>();
    (macrocycleData.events || []).forEach((e: any) => {
      const name = e.name || e.eventName || e.title || e.description || 'Event';
      (e.eventDates || []).forEach((dateStr: string) => {
        const existing = eventMap.get(dateStr) || [];
        eventMap.set(dateStr, [...existing, name]);
      });
    });

    const updated = trainingDays.map(td => {
      const existingTests = td.testNames || [];
      const existingEvents = td.eventNames || [];
      const testsFromMap = testMap.get(td.date) || [];
      const eventsFromMap = eventMap.get(td.date) || [];
      
      // Merge tests from map with existing, avoiding duplicates
      const updatedTests = [
        ...existingTests,
        ...testsFromMap.filter(t => !existingTests.includes(t))
      ];
      
      // Merge events from map with existing, avoiding duplicates
      const updatedEvents = [
        ...existingEvents,
        ...eventsFromMap.filter(e => !existingEvents.includes(e))
      ];
      
      return {
        ...td,
        testNames: updatedTests.length > 0 ? updatedTests : undefined,
        eventNames: updatedEvents.length > 0 ? updatedEvents : undefined,
        isTestDay: updatedTests.length > 0,
        isEventDay: updatedEvents.length > 0,
      };
    });

    const changed = updated.some((u, i) => {
      const oldTests = trainingDays[i].testNames || [];
      const newTests = u.testNames || [];
      const oldEvents = trainingDays[i].eventNames || [];
      const newEvents = u.eventNames || [];
      return (
        JSON.stringify(oldTests) !== JSON.stringify(newTests) ||
        JSON.stringify(oldEvents) !== JSON.stringify(newEvents) ||
        u.isTestDay !== trainingDays[i].isTestDay ||
        u.isEventDay !== trainingDays[i].isEventDay
      );
    });

    if (changed) {
      console.log('[Microcycle] Enriched trainingDays with test/event names.');
      setTrainingDays(updated);
      localStorage.setItem('trainingDays', JSON.stringify(updated));
    }
  }, [macrocycleData, trainingDays]);

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
    
    // Get the method's toolbox entries
    const methodEntries = toolboxData.entries.filter(
      entry => `${entry.category} → ${entry.subCategory}` === methodId
    );
    
    // Find the parameter marked as frequency parameter
    const frequencyParam = methodEntries.find(entry => entry.isFrequencyParameter);
    
    // Fallback to old string-based detection if no flag is set
    const frequencyKey = frequencyParam 
      ? frequencyParam.parameter 
      : Object.keys(cellData).find(key => key.toLowerCase().includes('frequency'));
    
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
    e.dataTransfer.effectAllowed = 'copyMove';
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

    // Handle reassignment of already-assigned exercise
    if (exercise.isAlreadyAssigned) {
      // Remove from source location and add to target location
      setExerciseDistribution(prev => {
        // Remove from source
        const filtered = prev.filter(ex => !(
          ex.exerciseId === exercise.exerciseId && 
          ex.dayDate === exercise.sourceDayDate && 
          ex.sessionIndex === exercise.sourceSessionIndex &&
          ex.methodId === exercise.sourceMethodId
        ));
        
        // Check if already exists in target
        const existsInTarget = filtered.some(ex => 
          ex.exerciseId === exercise.exerciseId && 
          ex.dayDate === dayDate && 
          ex.sessionIndex === sessionIndex &&
          ex.methodId === methodId
        );
        
        // If already exists in target, just return filtered (effectively removing from source)
        if (existsInTarget) return filtered;
        
        // Add to target
        return [
          ...filtered,
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
    } else {
      // Original behavior: Copy from portfolio
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
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const allowed = e.dataTransfer.effectAllowed || 'all';
    if (allowed === 'all' || allowed === 'uninitialized' || allowed.includes('copy')) {
      e.dataTransfer.dropEffect = 'copy';
    } else if (allowed.includes('move')) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
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

  // Get exercises for a specific day/session/method/category
  const getExercisesForCell = (dayDate: string, sessionIndex: number, methodId: string, categoryName: string = '') => {
    return exerciseDistribution.filter(
      ex => 
        ex.dayDate === dayDate && 
        ex.sessionIndex === sessionIndex &&
        ex.methodId === methodId &&
        ex.categoryName === categoryName
    );
  };

  // Handle session drag and drop
  // Handle save parameters from workout session
  const handleSaveParameters = (
    mesocycleId: string,
    microcycleIndex: number,
    methodId: string,
    sessionIndex: number,
    exerciseId: string,
    parameters: Record<string, string | number>
  ) => {
    setParameterValues(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      if (!updated[mesocycleId]) updated[mesocycleId] = {};
      if (!updated[mesocycleId][microcycleIndex]) updated[mesocycleId][microcycleIndex] = {};
      if (!updated[mesocycleId][microcycleIndex][methodId]) updated[mesocycleId][microcycleIndex][methodId] = {};
      if (!updated[mesocycleId][microcycleIndex][methodId][sessionIndex]) updated[mesocycleId][microcycleIndex][methodId][sessionIndex] = {};
      
      // Store each parameter as a separate key-value pair at method/session level (no exercise-specific prefix)
      Object.entries(parameters).forEach(([key, value]) => {
        updated[mesocycleId][microcycleIndex][methodId][sessionIndex][key] = value;
      });
      
      // Save to localStorage
      localStorage.setItem('parameterValues', JSON.stringify(updated));
      return updated;
    });
  };

  // Handle delete session
  const handleDeleteSession = (dayDate: string, sessionIndex: number) => {
    setExerciseDistribution(prev => {
      // Remove exercises from the target session
      const remaining = prev.filter(
        ex => !(ex.dayDate === dayDate && ex.sessionIndex === sessionIndex)
      );
      
      // Get remaining exercises for this day
      const dayExercises = remaining.filter(ex => ex.dayDate === dayDate);
      const otherExercises = remaining.filter(ex => ex.dayDate !== dayDate);
      
      // Renumber sessions sequentially (0, 1, 2, ...)
      const renumbered = dayExercises.map(ex => {
        if (ex.sessionIndex > sessionIndex) {
          return { ...ex, sessionIndex: ex.sessionIndex - 1 };
        }
        return ex;
      });
      
      return [...otherExercises, ...renumbered];
    });
    
    toast({
      title: "Session deleted",
      description: "The session has been removed successfully",
    });
  };

  // Handle copy session
  const handleCopySession = (dayDate: string, sessionIndex: number) => {
    const sessionExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
    );
    
    if (sessionExercises.length === 0) {
      toast({
        title: "Cannot copy",
        description: "This session has no exercises",
        variant: "destructive"
      });
      return;
    }
    
    setCopiedSession({
      exercises: sessionExercises,
      sourceDate: dayDate,
      sessionIndex: sessionIndex
    });
    
    toast({
      title: "Session copied",
      description: `${sessionExercises.length} exercise(s) copied to clipboard`,
    });
  };

  // Handle paste session (also handles day pasting)
  const handlePasteSession = (targetDate: string) => {
    // Prioritize day paste over session paste
    if (copiedDay) {
      handlePasteDay(targetDate);
      return;
    }
    
    if (!copiedSession) return;
    
    setExerciseDistribution(prev => {
      // Get exercises for target day
      const targetDayExercises = prev.filter(ex => ex.dayDate === targetDate);
      
      // Determine the next session index for this day
      const maxSessionIndex = targetDayExercises.length > 0
        ? Math.max(...targetDayExercises.map(ex => ex.sessionIndex))
        : -1;
      const newSessionIndex = maxSessionIndex + 1;
      
      // Create new exercises with updated date and session index
      const pastedExercises = copiedSession.exercises.map(ex => ({
        ...ex,
        dayDate: targetDate,
        sessionIndex: newSessionIndex
      }));
      
      return [...prev, ...pastedExercises];
    });
    
    toast({
      title: "Session pasted",
      description: `${copiedSession.exercises.length} exercise(s) pasted successfully`,
    });
    
    // Clear the copied session so paste button disappears
    setCopiedSession(null);
  };

  // Handle copy week
  const handleCopyWeek = (weekStartDate: string) => {
    const weekStart = parseISO(weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    
    // Get all exercises in this week
    const weekExercises = exerciseDistribution.filter(ex => {
      const exDate = parseISO(ex.dayDate);
      return exDate >= weekStart && exDate <= weekEnd;
    });
    
    if (weekExercises.length === 0) {
      toast({
        title: "Cannot copy",
        description: "This week has no sessions",
        variant: "destructive"
      });
      return;
    }
    
    setCopiedWeek({
      exercises: weekExercises,
      weekStartDate: weekStartDate
    });
    
    // Count unique sessions
    const uniqueSessions = new Set(weekExercises.map(ex => `${ex.dayDate}-${ex.sessionIndex}`)).size;
    
    toast({
      title: "Week copied",
      description: `${uniqueSessions} session(s) with ${weekExercises.length} exercise(s) copied`,
    });
  };

  // Handle clear week
  const handleClearWeek = (weekStartDate: string) => {
    const weekStart = parseISO(weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    
    // Count sessions before clearing
    const weekExercises = exerciseDistribution.filter(ex => {
      const exDate = parseISO(ex.dayDate);
      return exDate >= weekStart && exDate <= weekEnd;
    });
    
    if (weekExercises.length === 0) {
      toast({
        title: "Nothing to clear",
        description: "This week has no sessions",
      });
      return;
    }
    
    const uniqueSessions = new Set(weekExercises.map(ex => `${ex.dayDate}-${ex.sessionIndex}`)).size;
    
    // Remove all exercises from this week
    setExerciseDistribution(prev =>
      prev.filter(ex => {
        const exDate = parseISO(ex.dayDate);
        return !(exDate >= weekStart && exDate <= weekEnd);
      })
    );
    
    toast({
      title: "Week cleared",
      description: `${uniqueSessions} session(s) removed from this week`,
    });
  };

  // Handle paste week
  const handlePasteWeek = (targetWeekStartDate: string) => {
    if (!copiedWeek) return;
    
    const sourceWeekStart = parseISO(copiedWeek.weekStartDate);
    const targetWeekStart = parseISO(targetWeekStartDate);
    
    // Calculate day offset
    const dayOffset = differenceInDays(targetWeekStart, sourceWeekStart);
    
    // Create new exercises with adjusted dates
    const pastedExercises = copiedWeek.exercises.map(ex => {
      const originalDate = parseISO(ex.dayDate);
      const newDate = addDays(originalDate, dayOffset);
      return {
        ...ex,
        dayDate: format(newDate, 'yyyy-MM-dd')
      };
    });
    
    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    
    const uniqueSessions = new Set(pastedExercises.map(ex => `${ex.dayDate}-${ex.sessionIndex}`)).size;
    
    toast({
      title: "Week pasted",
      description: `${uniqueSessions} session(s) pasted to new week`,
    });
    
    setCopiedWeek(null);
  };

  // Handle copy day
  const handleCopyDay = (dayDate: string) => {
    // Get exercises for this day
    const dayExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate
    );
    
    // Get intensity for this day
    const dayIntensity = dailyIntensityData.find(di => di.date === dayDate);
    
    // Get tests/events for this day
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    
    // Get split state for this day
    const splitState = daySplitStates[dayDate];
    
    // Always allow copying (every day has at least intensity)
    setCopiedDay({
      exercises: dayExercises,
      sourceDate: dayDate,
      intensity: dayIntensity?.intensity,
      testNames: trainingDay?.testNames,
      eventNames: trainingDay?.eventNames,
      splitState: splitState
    });
    
    // Build descriptive toast message
    const parts = [];
    if (dayExercises.length > 0) parts.push(`${dayExercises.length} exercise(s)`);
    if (dayIntensity) parts.push(`intensity: ${dayIntensity.intensity}`);
    if (trainingDay?.testNames?.length) parts.push(`${trainingDay.testNames.length} test(s)`);
    if (trainingDay?.eventNames?.length) parts.push(`${trainingDay.eventNames.length} event(s)`);
    
    toast({
      title: "Day copied",
      description: parts.length > 0 ? parts.join(', ') : "Day data copied to clipboard",
    });
  };

  // Handle paste day
  const handlePasteDay = (targetDate: string) => {
    if (!copiedDay) return;
    
    // 1. Paste exercises
    setExerciseDistribution(prev => {
      // Remove all existing exercises from target day
      const filteredPrev = prev.filter(ex => ex.dayDate !== targetDate);
      
      // If there are exercises to copy
      if (copiedDay.exercises.length > 0) {
        // Get unique session indices from copied exercises
        const sessionIndices = [...new Set(copiedDay.exercises.map(ex => ex.sessionIndex))].sort((a, b) => a - b);
        
        // Create mapping from old session indices to new sequential indices
        const sessionMapping = new Map<number, number>();
        sessionIndices.forEach((oldIndex, newIndex) => {
          sessionMapping.set(oldIndex, newIndex);
        });
        
        // Create new exercises with updated date and remapped session indices
        const pastedExercises = copiedDay.exercises.map(ex => ({
          ...ex,
          dayDate: targetDate,
          sessionIndex: sessionMapping.get(ex.sessionIndex) || 0
        }));
        
        return [...filteredPrev, ...pastedExercises];
      }
      
      return filteredPrev;
    });
    
    // 2. Paste intensity
    if (copiedDay.intensity) {
      setDailyIntensityData(prev => {
        const updated = [...prev];
        const index = updated.findIndex(di => di.date === targetDate);
        
        if (index >= 0) {
          updated[index] = { ...updated[index], intensity: copiedDay.intensity! };
        } else {
          // Create new entry if doesn't exist
          const day = trainingDays.find(td => td.date === targetDate);
          if (day) {
            updated.push({
              date: targetDate,
              mesocycleId: day.mesocycleId,
              microcycleId: day.microcycleId,
              dayOfWeek: day.dayOfWeek,
              intensity: copiedDay.intensity!,
              isTestDay: day.isTestDay,
              isEventDay: day.isEventDay,
            });
          }
        }
        
        localStorage.setItem('dailyIntensityData', JSON.stringify(updated));
        return updated;
      });
    }
    
    // 3. Paste tests/events
    if (copiedDay.testNames || copiedDay.eventNames) {
      setTrainingDays(prev => {
        const updated = prev.map(td => {
          if (td.date === targetDate) {
            return {
              ...td,
              isTestDay: copiedDay.testNames && copiedDay.testNames.length > 0,
              isEventDay: copiedDay.eventNames && copiedDay.eventNames.length > 0,
              testNames: copiedDay.testNames,
              eventNames: copiedDay.eventNames
            };
          }
          return td;
        });
        
        localStorage.setItem('trainingDays', JSON.stringify(updated));
        return updated;
      });
    }
    
    // 4. Copy day split state if it exists
    if (copiedDay.splitState) {
      setDaySplitStates(prev => ({
        ...prev,
        [targetDate]: copiedDay.splitState!
      }));
    }
    
    // Build descriptive toast message
    const parts = [];
    if (copiedDay.exercises.length > 0) parts.push(`${copiedDay.exercises.length} exercise(s)`);
    if (copiedDay.intensity) parts.push(`intensity`);
    if (copiedDay.testNames?.length) parts.push(`${copiedDay.testNames.length} test(s)`);
    if (copiedDay.eventNames?.length) parts.push(`${copiedDay.eventNames.length} event(s)`);
    
    toast({
      title: "Day pasted",
      description: parts.length > 0 ? `Pasted: ${parts.join(', ')}` : "Day data pasted successfully",
    });
    
    // Clear the copied day so paste button disappears
    setCopiedDay(null);
  };

  // Handle clear day
  const handleClearDay = (dayDate: string) => {
    const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    const hasTestsEvents = (trainingDay?.testNames?.length || 0) + (trainingDay?.eventNames?.length || 0) > 0;
    
    // Allow clearing if there are exercises OR tests/events
    if (dayExercises.length === 0 && !hasTestsEvents) {
      toast({
        title: "Nothing to clear",
        description: "This day has no exercises or events",
        variant: "destructive"
      });
      return;
    }
    
    // Clear exercises
    setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== dayDate));
    
    // Clear tests/events
    setTrainingDays(prev => {
      const updated = prev.map(td => {
        if (td.date === dayDate) {
          return {
            ...td,
            isTestDay: false,
            isEventDay: false,
            testNames: undefined,
            eventNames: undefined
          };
        }
        return td;
      });
      
      localStorage.setItem('trainingDays', JSON.stringify(updated));
      return updated;
    });
    
    // Clear split state
    if (daySplitStates[dayDate]) {
      setDaySplitStates(prev => {
        const updated = { ...prev };
        delete updated[dayDate];
        return updated;
      });
    }
    
    const parts = [];
    if (dayExercises.length > 0) parts.push(`${dayExercises.length} exercise(s)`);
    if (hasTestsEvents) parts.push("tests/events");
    
    toast({
      title: "Day cleared",
      description: `Cleared: ${parts.join(', ')}`,
    });
  };

  // Handle add test/event with two-way sync
  const handleAddTestEvent = (
    dayDate: string, 
    type: 'test' | 'event', 
    testEventId: string, 
    testEventName: string, 
    isNew: boolean
  ) => {
    // Update trainingDays
    setTrainingDays(prev => {
      const updated = prev.map(td => {
        if (td.date === dayDate) {
          if (type === 'test') {
            const existingTests = td.testNames || [];
            return {
              ...td,
              isTestDay: true,
              testNames: [...existingTests, testEventName]
            };
          } else {
            const existingEvents = td.eventNames || [];
            return {
              ...td,
              isEventDay: true,
              eventNames: [...existingEvents, testEventName]
            };
          }
        }
        return td;
      });
      localStorage.setItem('trainingDays', JSON.stringify(updated));
      return updated;
    });
    
    // Sync to macrocycleData
    if (macrocycleData) {
      const updatedMacrocycle = { ...macrocycleData };
      
      if (type === 'test') {
        let targetSubGoal;
        
        if (isNew) {
          // Create new sub-goal
          targetSubGoal = {
            id: testEventId,
            description: testEventName,
            testMethod: testEventName,
            preTestValue: 0,
            goalValue: 0,
            unit: '',
            percentChange: 0,
            testDates: [dayDate]
          };
          updatedMacrocycle.subGoals = [...(updatedMacrocycle.subGoals || []), targetSubGoal];
        } else {
          // Find existing sub-goal and add date
          targetSubGoal = updatedMacrocycle.subGoals?.find((sg: any) => sg.id === testEventId);
          if (targetSubGoal && !targetSubGoal.testDates.includes(dayDate)) {
            targetSubGoal.testDates = [...(targetSubGoal.testDates || []), dayDate];
          }
        }
      } else {
        let targetEvent;
        
        if (isNew) {
          // Create new event
          targetEvent = {
            id: testEventId,
            name: testEventName,
            description: '',
            eventDates: [dayDate]
          };
          updatedMacrocycle.events = [...(updatedMacrocycle.events || []), targetEvent];
        } else {
          // Find existing event and add date
          targetEvent = updatedMacrocycle.events?.find((e: any) => e.id === testEventId);
          if (targetEvent && !targetEvent.eventDates.includes(dayDate)) {
            targetEvent.eventDates = [...(targetEvent.eventDates || []), dayDate];
          }
        }
      }
      
      setMacrocycleData(updatedMacrocycle);
      localStorage.setItem('macrocycleData', JSON.stringify(updatedMacrocycle));
    }
    
    toast({
      title: `${type === 'test' ? 'Test' : 'Event'} added`,
      description: `${testEventName} scheduled for ${format(parseISO(dayDate), 'PPP')}`,
    });
  };

  // Handle delete test/event with two-way sync
  const handleDeleteTestEvent = (dayDate: string, type: 'test' | 'event') => {
    // Update trainingDays
    setTrainingDays(prev => {
      const updated = prev.map(td => {
        if (td.date === dayDate) {
          if (type === 'test') {
            return {
              ...td,
              isTestDay: false,
              testNames: undefined
            };
          } else {
            return {
              ...td,
              isEventDay: false,
              eventNames: undefined
            };
          }
        }
        return td;
      });
      localStorage.setItem('trainingDays', JSON.stringify(updated));
      return updated;
    });
    
    // Sync to macrocycleData
    if (macrocycleData) {
      const updatedMacrocycle = { ...macrocycleData };
      
      if (type === 'test') {
        // Remove date from all sub-goals
        updatedMacrocycle.subGoals = (updatedMacrocycle.subGoals || []).map((sg: any) => ({
          ...sg,
          testDates: (sg.testDates || []).filter((date: string) => date !== dayDate)
        }));
      } else {
        // Remove date from all events
        updatedMacrocycle.events = (updatedMacrocycle.events || []).map((e: any) => ({
          ...e,
          eventDates: (e.eventDates || []).filter((date: string) => date !== dayDate)
        }));
      }
      
      setMacrocycleData(updatedMacrocycle);
      localStorage.setItem('macrocycleData', JSON.stringify(updatedMacrocycle));
    }
    
    toast({
      title: `${type === 'test' ? 'Tests' : 'Events'} deleted`,
      description: `All ${type === 'test' ? 'tests' : 'events'} removed from ${format(parseISO(dayDate), 'PPP')}`,
    });
  };

  // Handle intensity change from calendar view
  const handleIntensityChange = (date: string, intensity: IntensityLevel) => {
    setDailyIntensityData(prev => {
      const updated = [...prev];
      const index = updated.findIndex(di => di.date === date);
      
      if (index >= 0) {
        updated[index] = { ...updated[index], intensity };
      } else {
        // Create new entry if doesn't exist
        const day = trainingDays.find(td => td.date === date);
        if (day) {
          updated.push({
            date,
            mesocycleId: day.mesocycleId,
            microcycleId: day.microcycleId,
            dayOfWeek: day.dayOfWeek,
            intensity,
            isTestDay: day.isTestDay,
            isEventDay: day.isEventDay,
          });
        }
      }
      
      // Save to localStorage immediately
      localStorage.setItem('dailyIntensityData', JSON.stringify(updated));
      return updated;
    });
    
    toast({
      title: "Intensity updated",
      description: `Set to ${intensity.replace('-', ' ')}`,
    });
  };

  const handleSessionDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    console.log('[DnD] onDragEnd', { source, destination, draggableId });
    
    // If dropped outside a valid droppable or no movement, do nothing
    if (!destination || 
        (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }
    
    // Extract source and destination dates
    const sourceDateString = source.droppableId.replace('day-', '');
    const destDateString = destination.droppableId.replace('day-', '');

    // Map display position -> actual sessionIndex for the source day
    const getSessionIndexByPosition = (dayDate: string, position: number): number | null => {
      const indices = Array.from(
        new Set(
          exerciseDistribution
            .filter(ex => ex.dayDate === dayDate)
            .map(ex => ex.sessionIndex)
        )
      ).sort((a, b) => a - b);
      return typeof indices[position] === 'number' ? indices[position] : null;
    };
    
    // Case 1: Moving within the same day (reordering)
    if (sourceDateString === destDateString) {
      return handleReorderSessionsInDay(sourceDateString, source.index, destination.index);
    }
    
    // Case 2: Moving to a different day
    const draggedSessionIndex = getSessionIndexByPosition(sourceDateString, source.index);
    if (draggedSessionIndex == null) {
      console.warn('[DnD] Could not resolve dragged sessionIndex from source position.', {
        sourceDateString,
        sourceIndex: source.index
      });
      return;
    }

    return handleMoveSessionToDay(
      sourceDateString, 
      destDateString, 
      draggedSessionIndex, 
      destination.index
    );
  };

  // Reorder sessions within the same day
  const handleReorderSessionsInDay = (
    dayDate: string, 
    fromIndex: number, 
    toIndex: number
  ) => {
    console.log(`Reordering sessions in ${dayDate}: moving from index ${fromIndex} to ${toIndex}`);
    
    setExerciseDistribution(prev => {
      // Get all exercises for this day
      const dayExercises = prev.filter(ex => ex.dayDate === dayDate);
      const otherExercises = prev.filter(ex => ex.dayDate !== dayDate);
      
      // Group by session index
      const sessions = new Map<number, ExerciseDistribution[]>();
      dayExercises.forEach(ex => {
        if (!sessions.has(ex.sessionIndex)) {
          sessions.set(ex.sessionIndex, []);
        }
        sessions.get(ex.sessionIndex)!.push(ex);
      });
      
      // Get ordered session indices (sorted)
      const sessionIndices = Array.from(sessions.keys()).sort((a, b) => a - b);
      
      console.log('Session indices before reorder:', sessionIndices);
      
      // Reorder session indices
      const [movedSession] = sessionIndices.splice(fromIndex, 1);
      sessionIndices.splice(toIndex, 0, movedSession);
      
      console.log('Session indices after reorder:', sessionIndices);
      
      // Reassign session indices based on new order
      const reorderedExercises: ExerciseDistribution[] = [];
      sessionIndices.forEach((oldIndex, newIndex) => {
        const exercises = sessions.get(oldIndex)!;
        exercises.forEach(ex => {
          reorderedExercises.push({ ...ex, sessionIndex: newIndex });
        });
      });
      
      return [...otherExercises, ...reorderedExercises];
    });
    
    toast({
      title: "Session reordered",
      description: "Session order updated successfully",
    });
  };

  // Move session to a different day
  const handleMoveSessionToDay = (
    sourceDate: string,
    destDate: string,
    sessionIndex: number,
    destPosition: number
  ) => {
    setExerciseDistribution(prev => {
      // Get exercises from the moved session
      const movedExercises = prev.filter(
        ex => ex.dayDate === sourceDate && ex.sessionIndex === sessionIndex
      );
      
      if (movedExercises.length === 0) return prev;
      
      // Get remaining exercises from source day
      const sourceRemaining = prev.filter(
        ex => ex.dayDate === sourceDate && ex.sessionIndex !== sessionIndex
      );
      
      // Renumber remaining sessions in source day
      const renumberedSource = sourceRemaining.map(ex => {
        if (ex.sessionIndex > sessionIndex) {
          return { ...ex, sessionIndex: ex.sessionIndex - 1 };
        }
        return ex;
      });
      
      // Get destination day exercises
      const destExercises = prev.filter(ex => ex.dayDate === destDate);
      
      // Shift destination sessions to make room
      const shiftedDest = destExercises.map(ex => {
        if (ex.sessionIndex >= destPosition) {
          return { ...ex, sessionIndex: ex.sessionIndex + 1 };
        }
        return ex;
      });
      
      // Update moved exercises with new date and position
      const updatedMovedExercises = movedExercises.map(ex => ({
        ...ex,
        dayDate: destDate,
        sessionIndex: destPosition
      }));
      
      // Get all other exercises (not from source or dest day)
      const otherExercises = prev.filter(
        ex => ex.dayDate !== sourceDate && ex.dayDate !== destDate
      );
      
      return [
        ...otherExercises,
        ...renumberedSource,
        ...shiftedDest,
        ...updatedMovedExercises
      ];
    });
    
    // Update split states
    setDaySplitStates(prev => {
      const newState = { ...prev };
      
      // Check source day session count after move
      const sourceSessions = exerciseDistribution.filter(ex => 
        ex.dayDate === sourceDate && ex.sessionIndex !== sessionIndex
      );
      const uniqueSourceSessions = new Set(sourceSessions.map(ex => ex.sessionIndex)).size;
      
      if (uniqueSourceSessions <= 1) {
        // Remove split state if source day now has 1 or fewer sessions
        delete newState[sourceDate];
      } else {
        newState[sourceDate] = uniqueSourceSessions;
      }
      
      // Check destination day session count after move
      const destSessions = exerciseDistribution.filter(ex => ex.dayDate === destDate);
      const uniqueDestSessions = new Set(destSessions.map(ex => ex.sessionIndex)).size + 1;
      
      if (uniqueDestSessions > 1) {
        newState[destDate] = uniqueDestSessions;
      }
      
      return newState;
    });
    
    toast({
      title: "Session moved",
      description: `Moved session to ${format(new Date(destDate), 'MMM d')}`,
    });
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
                      
                      // Calculate total width including splits
                      const days = daysByMicrocycle[microcycle.id] || [];
                      const totalWidth = days.reduce((sum, day) => {
                        const numberOfSessions = daySplitStates[day.date] || 1;
                        return sum + (numberOfSessions * 140);
                      }, 0);
                      
                      return (
                        <div 
                          key={microcycle.id}
                          className={cn("border-r last:border-r-0", getIntensityColor(microcycle.intensity))}
                          style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, flexShrink: 0 }}
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
                      // Calculate total width including splits
                      const totalWidth = days.reduce((sum, day) => {
                        const numberOfSessions = daySplitStates[day.date] || 1;
                        return sum + (numberOfSessions * 140);
                      }, 0);
                      
                      return (
                        <div key={microcycle.id} className="flex border-r last:border-r-0" style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, flexShrink: 0 }}>
                          {days.map(day => {
                            const dailyIntensityRecord = dailyIntensityData.find(di => di.date === day.date);
                            const dailyIntensity = dailyIntensityRecord?.intensity || 'off';
                            const numberOfSessions = daySplitStates[day.date] || 1;
                            const isSplit = numberOfSessions > 1;
                            
                            return (
                              <div 
                                key={day.date}
                                className="flex flex-col border-r last:border-r-0"
                                style={{ width: isSplit ? `${numberOfSessions * 140}px` : '140px' }}
                              >
                                {/* Day header */}
                                <div className={cn("p-1 text-xs text-center border-b relative", getIntensityColor(dailyIntensity))}>
                                  {/* Status Icons - Top Right */}
                                  <div className="absolute top-1 right-1 flex gap-1">
                                    {day.testNames && day.testNames.length > 0 && (
                                      <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <div className="cursor-pointer">
                                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                              <Trophy className="h-2.5 w-2.5" />
                                            </Badge>
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-auto max-w-xs p-2 z-[200]" side="top">
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">
                                              {day.testNames.length > 1 ? 'Tests:' : 'Test:'}
                                            </p>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                              {day.testNames.map((testName, idx) => (
                                                <div key={idx}>• {testName}</div>
                                              ))}
                                            </div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                    
                                    {day.eventNames && day.eventNames.length > 0 && (
                                      <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <div className="cursor-pointer">
                                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                              <Calendar className="h-2.5 w-2.5" />
                                            </Badge>
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-auto max-w-xs p-2 z-[200]" side="top">
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">
                                              {day.eventNames.length > 1 ? 'Events:' : 'Event:'}
                                            </p>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                              {day.eventNames.map((eventName, idx) => (
                                                <div key={idx}>• {eventName}</div>
                                              ))}
                                            </div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                  </div>
                                  
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
                                        className="w-[140px] p-1 text-[10px] text-center border-r last:border-r-0 bg-muted/50"
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
                                                  onDragStart={(e) => handleDragStart(e, { ...exercise, methodId: fullMethodId })}
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
                                            const totalWidth = days.reduce((sum, day) => {
                                              const numberOfSessions = daySplitStates[day.date] || 1;
                                              return sum + (numberOfSessions * 140);
                                            }, 0);
                                            return (
                                              <div 
                                                key={microcycle.id} 
                                                className="flex border-r last:border-r-0"
                                                style={{ width: `${totalWidth}px`, minWidth: `${totalWidth}px`, flexShrink: 0 }}
                                              >
                                                {days.map(day => {
                                                  const numberOfSessions = daySplitStates[day.date] || 1;
                                                  const dayWidth = numberOfSessions * 140;
                                                  
                                                  return (
                                                    <div 
                                                      key={day.date} 
                                                      className="flex border-r last:border-r-0"
                                                      style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px`, flexShrink: 0 }}
                                                    >
                                                      {Array.from({ length: numberOfSessions }, (_, sessionIdx) => (
                                                        <div
                                                          key={sessionIdx}
                                                          className="w-[140px] p-2 border-r last:border-r-0 min-h-[100px]"
                                                          onDrop={(e) => handleDrop(e, day.date, sessionIdx, fullMethodId, categoryKey)}
                                                          onDragOver={handleDragOver}
                                                        >
                                                          <div className="space-y-1">
                                                            {getExercisesForCell(day.date, sessionIdx, fullMethodId, categoryKey).map((ex, idx) => (
                                                              <div
                                                                key={idx}
                                                                draggable={true}
                                                                onDragStart={(e) => {
                                                                  const dragData = {
                                                                    ...ex,
                                                                    isAlreadyAssigned: true,
                                                                    sourceDayDate: day.date,
                                                                    sourceSessionIndex: sessionIdx,
                                                                    sourceMethodId: fullMethodId,
                                                                    sourceCategoryName: categoryKey
                                                                  };
                                                                  e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                                                                  e.dataTransfer.effectAllowed = 'copyMove';
                                                                }}
                                                                className="text-[10px] p-1 bg-primary/10 border border-primary/20 rounded group relative cursor-move hover:bg-primary/20 transition-colors"
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
        <PlanningNavigationMenu currentPage="microcycle" currentPageStep={currentStep} onChangeCurrentPageStep={setCurrentStep} />
      </div>

      <NavigationButtons />

      {renderTrainingPlanOverview()}
      
      {currentStep === 1 && mesocycles.length > 1 && renderMesocycleNavigation()}
      
      {currentStep === 1 && renderExerciseDistribution()}
      
      {currentStep === 2 && currentMesocycle && (
        <>
          {console.log('[Step 2] Rendering calendar with', exerciseDistribution.length, 'exercises')}
            <TrainingCalendarView
              exerciseDistribution={exerciseDistribution}
              trainingDays={currentMesocycleDays}
              currentMesocycle={currentMesocycle}
              mesocycles={mesocycles}
              onSessionDragEnd={handleSessionDragEnd}
              onDeleteSession={handleDeleteSession}
              onCopySession={handleCopySession}
              onPasteSession={handlePasteSession}
              copiedSession={copiedSession}
              onCopyWeek={handleCopyWeek}
              onClearWeek={handleClearWeek}
              onPasteWeek={handlePasteWeek}
              copiedWeek={copiedWeek}
              onCopyDay={handleCopyDay}
              onClearDay={handleClearDay}
              onAddTestEvent={handleAddTestEvent}
              onDeleteTestEvent={handleDeleteTestEvent}
              copiedDay={copiedDay}
              availableTests={macrocycleData?.subGoals || []}
              availableEvents={macrocycleData?.events || []}
              dailyIntensityData={dailyIntensityData}
              onIntensityChange={handleIntensityChange}
              getIntensityColor={getIntensityColor}
              intensityLevels={intensityLevels}
              parameterValues={parameterValues}
              onSaveParameters={handleSaveParameters}
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
