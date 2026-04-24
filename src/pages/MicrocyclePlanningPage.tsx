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
import { ArrowLeft, ArrowRight, Target, AlertTriangle, Info, Copy, ChevronDown, Columns, ChevronRight, X, Trash2, Trophy, Calendar, Check } from 'lucide-react';
import { ResourcesButton } from '@/components/programs/ResourcesButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAthletes } from '@/hooks/useAthletes';
import { getAthleteDisplayName } from '@/types/athlete';
import { TrainingPlanOverview } from '@/components/shared/TrainingPlanOverview';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseSelection, SessionSection, SupersetMapping, ExerciseDistribution } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { useToolboxData } from '@/hooks/useToolboxData';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { TrainingCalendarView, EnhancedExerciseDistribution, MethodSessionArchitecture } from '@/components/microcycle-planning';
import { DropResult } from '@hello-pangea/dnd';
import { SaveProgramButton } from '@/components/programs/SaveProgramButton';
import { useTrainingPrograms } from '@/hooks/useTrainingPrograms';

// Using ExerciseDistribution, SessionSection, and SupersetMapping from types file

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
  const { data: toolboxData } = useToolboxData();
  const { athletes, athletePerformanceParameters } = useAthletes();
  const { saveCurrentSession } = useTrainingPrograms();
  
  // Resolve athlete name from selectedAthleteId
  const selectedAthleteId = macrocycleData?.selectedAthleteId;
  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);
  const athleteName = selectedAthlete ? getAthleteDisplayName(selectedAthlete) : undefined;
  
  // Filter athlete performance parameters for the selected athlete
  const selectedAthletePerformanceParameters = useMemo(() => {
    if (!selectedAthleteId) return [];
    return athletePerformanceParameters.filter(pp => pp.athleteId === selectedAthleteId);
  }, [athletePerformanceParameters, selectedAthleteId]);
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
    sections: SessionSection[];
    supersets: SupersetMapping;
    sessionStructure: Record<string, number[]>;
    weekStartDate: string;
  } | null>(null);
  const [copiedDay, setCopiedDay] = useState<{
    exercises: ExerciseDistribution[];
    sections: SessionSection[];
    supersets: { [sessionIndex: number]: { [sectionId: string]: { [supersetId: string]: string[] } } };
    sourceDate: string;
    intensity?: IntensityLevel;
    testNames?: string[];
    eventNames?: string[];
    splitState?: number;
  } | null>(null);
  const [copiedSection, setCopiedSection] = useState<{
    exercises: ExerciseDistribution[];
    sections: SessionSection[];
    sourceSectionId: string;
    sourceDayDate: string;
    sourceSessionIndex: number;
  } | null>(null);
  
  // New state for enhanced exercise distribution
  const [sessionSections, setSessionSections] = useState<SessionSection[]>([]);
  const [supersets, setSupersets] = useState<SupersetMapping>({});

  // Step 1 state: method-to-day assignments and available method allocations
  const [dayMethodAssignments, setDayMethodAssignments] = useState<Record<string, string[]>>({});
  const [methodAllocations, setMethodAllocations] = useState<Record<string, string[]>>({});

  const totalSteps = 3; // Step 1: Method & Session Architecture, Step 2: Exercise Distribution, Step 3: Training Calendar

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
      // Convert date strings back to Date objects (localStorage serializes dates as strings)
      const mesocyclesWithDates = (data.mesocycles || []).map((meso: any) => ({
        ...meso,
        startDate: meso.startDate ? new Date(meso.startDate) : new Date(),
        endDate: meso.endDate ? new Date(meso.endDate) : new Date(),
      }));
      setMesocycles(mesocyclesWithDates);
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

    // v1→v2 migration: a new Step 1 was inserted, so old step indices shift by +1.
    // Guard with 'microcyclePlanningVersion' so migration only runs once.
    if (savedMicrocycleStep) {
      const parsedStep = parseInt(savedMicrocycleStep, 10);
      if (!isNaN(parsedStep)) {
        const savedVersion = localStorage.getItem('microcyclePlanningVersion');
        if (!savedVersion) {
          // Migrate: shift old step up by 1 (old 1→new 2, old 2→new 3), clamp to [1,3]
          const migratedStep = Math.min(3, Math.max(1, parsedStep + 1));
          setCurrentStep(migratedStep);
          localStorage.setItem('microcyclePlanningVersion', '2');
        } else {
          setCurrentStep(Math.min(3, Math.max(1, parsedStep)));
        }
      }
    }

    // Load day→method assignments (written by Step 1)
    const savedDayMethodAssignments = localStorage.getItem('dayMethodAssignments');
    if (savedDayMethodAssignments) {
      try { setDayMethodAssignments(JSON.parse(savedDayMethodAssignments)); } catch { /* ignore */ }
    }

    // Load method allocations (written by MesocyclePage, read-only here)
    const savedMethodAllocations = localStorage.getItem('methodAllocations');
    if (savedMethodAllocations) {
      try { setMethodAllocations(JSON.parse(savedMethodAllocations)); } catch { /* ignore */ }
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

    // Load saved day split states and backfill any missing entries from trainingDays
    const savedDaySplitStates = localStorage.getItem('daySplitStates');
    const parsedSplitStates: Record<string, number> = savedDaySplitStates
      ? JSON.parse(savedDaySplitStates)
      : {};

    // For every training day that has no explicit split state yet,
    // derive the default from day.sessions or the intensity heuristic.
    // This ensures Step 2 shows sessions even for days that were never
    // manually touched (copy/paste/add-session) in Step 1.
    if (savedTrainingDays) {
      const loadedDays: any[] = JSON.parse(savedTrainingDays);
      loadedDays.forEach((day: any) => {
        if (parsedSplitStates[day.date] === undefined) {
          const defaultSessions =
            day.sessions !== undefined
              ? day.sessions
              : day.intensity === 'off'
              ? 0
              : 1;
          parsedSplitStates[day.date] = defaultSessions;
        }
      });
    }

    setDaySplitStates(parsedSplitStates);

    // Load saved session sections
    const savedSessionSections = localStorage.getItem('sessionSections');
    if (savedSessionSections) {
      const parsed = JSON.parse(savedSessionSections);
      setSessionSections(Array.isArray(parsed) ? parsed : []);
    }

    // Load saved supersets
    const savedSupersets = localStorage.getItem('supersets');
    if (savedSupersets) {
      setSupersets(JSON.parse(savedSupersets));
    }

    // Helper to detect and clean corrupted category names
    const isCorruptedCategoryName = (name: string | undefined): boolean => {
      if (!name || name === '') return false; // Empty is valid (means no category)
      if (name.length <= 2) return true; // "1", "me" etc are corrupted
      if (/^(meso|micro|main|undefined|null)\d*$/i.test(name)) return true;
      return false;
    };

    // Load from Step 6 (Exercise Selection) - this is the source of truth
    const savedMicrocyclePlanningState = localStorage.getItem('microcyclePlanningState');
    if (savedMicrocyclePlanningState) {
      const planningState = JSON.parse(savedMicrocyclePlanningState);
      // Clean corrupted categoryName values from cellData
      const cleanedCellData: Record<string, CellData> = {};
      let hasCorruption = false;
      
      Object.entries(planningState.cellData || {}).forEach(([cellId, cellData]: [string, any]) => {
        if (isCorruptedCategoryName(cellData.categoryName)) {
          hasCorruption = true;
          cleanedCellData[cellId] = { ...cellData, categoryName: undefined };
        } else {
          cleanedCellData[cellId] = cellData;
        }
      });
      
      // If we cleaned data, save it back to localStorage
      if (hasCorruption) {
        const updatedPlanningState = { ...planningState, cellData: cleanedCellData };
        localStorage.setItem('microcyclePlanningState', JSON.stringify(updatedPlanningState));
      }
      
      // Use cellData from Step 6 as the source of truth
      setExerciseSelectionData(cleanedCellData);
      setSplitStates(planningState.splitStates || {});
    } else {
      // Fallback to legacy key if microcyclePlanningState doesn't exist
      const savedExerciseSelection = localStorage.getItem('exerciseSelectionData');
      if (savedExerciseSelection) {
        setExerciseSelectionData(JSON.parse(savedExerciseSelection));
      }
    }
  }, []);

  // Sync dailyIntensityData into trainingDays on load
  useEffect(() => {
    if (dailyIntensityData.length === 0 || trainingDays.length === 0) return;
    
    // Create a map of date -> intensity from dailyIntensityData
    const intensityMap = new Map<string, IntensityLevel>();
    dailyIntensityData.forEach(di => {
      intensityMap.set(di.date, di.intensity);
    });
    
    // Check if any trainingDays need intensity updates
    const needsUpdate = trainingDays.some(td => {
      const correctIntensity = intensityMap.get(td.date);
      return correctIntensity && td.intensity !== correctIntensity;
    });
    
    if (needsUpdate) {
      setTrainingDays(prev => 
        prev.map(day => {
          const correctIntensity = intensityMap.get(day.date);
          if (correctIntensity && day.intensity !== correctIntensity) {
            return { ...day, intensity: correctIntensity };
          }
          return day;
        })
      );
    }
  }, [dailyIntensityData, trainingDays]);

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
        return;
      }

      // Check if microcycle is valid (if specified)
      if (cellData.microcycleId && !validMicrocycleIds.has(cellData.microcycleId)) {
        hasInvalidData = true;
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
  }, [exerciseDistribution]);

  // Save day split states to localStorage
  useEffect(() => {
    localStorage.setItem('daySplitStates', JSON.stringify(daySplitStates));
  }, [daySplitStates]);

  // Save session sections to localStorage
  useEffect(() => {
    localStorage.setItem('sessionSections', JSON.stringify(sessionSections));
  }, [sessionSections]);

  // Save supersets to localStorage
  useEffect(() => {
    localStorage.setItem('supersets', JSON.stringify(supersets));
  }, [supersets]);

  // Save day→method assignments to localStorage
  useEffect(() => {
    localStorage.setItem('dayMethodAssignments', JSON.stringify(dayMethodAssignments));
  }, [dayMethodAssignments]);

  // Sync day split states to trainingDays
  useEffect(() => {
    setTrainingDays(prev => 
      prev.map(day => {
        // If there's a saved split state, use it
        if (daySplitStates[day.date] !== undefined) {
          return { ...day, sessions: daySplitStates[day.date] };
        }
        // Otherwise, default to 0 if intensity is "off", else 1
        const defaultSessions = day.intensity === 'off' ? 0 : 1;
        return { ...day, sessions: defaultSessions };
      })
    );
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
    // Include athlete's existing tests from calendar assignments
    // Normalize ISO strings (yyyy-MM-ddT...) to yyyy-MM-dd to match trainingDay.date format
    (macrocycleData.athleteExistingTests || []).forEach((t: any) => {
      const name = t.testMethod || 'Test';
      (t.testDates || []).forEach((dateStr: string) => {
        const normalized = dateStr.split('T')[0];
        const existing = testMap.get(normalized) || [];
        if (!existing.includes(name)) testMap.set(normalized, [...existing, name]);
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
    // Include athlete's existing events from calendar assignments
    // Normalize ISO strings (yyyy-MM-ddT...) to yyyy-MM-dd to match trainingDay.date format
    (macrocycleData.athleteExistingEvents || []).forEach((e: any) => {
      const name = e.name || 'Event';
      (e.eventDates || []).forEach((dateStr: string) => {
        const normalized = dateStr.split('T')[0];
        const existing = eventMap.get(normalized) || [];
        if (!existing.includes(name)) eventMap.set(normalized, [...existing, name]);
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
    const methodEntries = (toolboxData?.entries || []).filter(
      entry => `${entry.category} → ${entry.subCategory}` === methodId
    );
    
    // Find the parameter marked as frequency parameter
    const frequencyParam = methodEntries.find(entry => entry.isFrequencyParameter);
    
    // Fallback to old string-based detection if no flag is set
    const frequencyKey = frequencyParam 
      ? frequencyParam.parameterName 
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
        
        // Add to target with new structure
        const maxOrder = filtered
          .filter(ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex)
          .reduce((max, ex) => Math.max(max, ex.order), -1);

        return [
          ...filtered,
          {
            id: `ex-${Date.now()}-${Math.random()}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            methodId: exercise.methodId,
            categoryName: exercise.categoryName,
            subCategory: exercise.subCategory,
            dayDate,
            sessionIndex,
            order: maxOrder + 1,
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

        // Calculate the next order for the session
        const maxOrder = prev
          .filter(ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex)
          .reduce((max, ex) => Math.max(max, ex.order), -1);

        return [
          ...prev,
          {
            id: `ex-${Date.now()}-${Math.random()}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            methodId: exercise.methodId,
            categoryName: exercise.categoryName,
            subCategory: exercise.subCategory,
            dayDate,
            sessionIndex,
            order: maxOrder + 1,
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

  // Handle adding a session to a day
  const handleAddSession = (dayDate: string) => {
    setDaySplitStates(prev => {
      const currentSessions = prev[dayDate] ?? 1;
      return {
        ...prev,
        [dayDate]: currentSessions + 1
      };
    });
  };

  // Handle removing a session from a day
  const handleRemoveSession = (dayDate: string, sessionIndex: number) => {
    const currentSessions = daySplitStates[dayDate] ?? 1;
    
    // Check if this is the last session
    const isLastSession = currentSessions <= 1;
    
    if (isLastSession) {
      // Remove all exercises from this day
      setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== dayDate));
      
      // Remove all sections from this day
      setSessionSections(prev => prev.filter(section => section.dayDate !== dayDate));
      
      // Remove all supersets from this day
      setSupersets(prev => {
        const newSupersets = { ...prev };
        delete newSupersets[dayDate];
        return newSupersets;
      });
      
      // Set day intensity to "off"
      setDailyIntensityData(prev => {
        const updated = prev.map(di => {
          if (di.date === dayDate) {
            return { ...di, intensity: 'off' as IntensityLevel };
          }
          return di;
        });
        localStorage.setItem('dailyIntensityData', JSON.stringify(updated));
        return updated;
      });
      
      // Update trainingDays
      setTrainingDays(prev => 
        prev.map(day => {
          if (day.date === dayDate) {
            return { 
              ...day, 
              intensity: 'off' as IntensityLevel,
              sessions: 0,
              sessionNames: []
            };
          }
          return day;
        })
      );
      
      // Remove session intensity from localStorage
      const mesocycleId = currentMesocycle?.id;
      if (mesocycleId) {
        const sessionIntensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
        localStorage.removeItem(sessionIntensityKey);
      }

      // Update split state to 0
      setDaySplitStates(prev => ({
        ...prev,
        [dayDate]: 0
      }));
      
      toast({
        title: "Last session deleted",
        description: "Day intensity set to 'off'. You can add a new session anytime.",
      });
      
      return;
    }
    
    // Not the last session - DELETE exercises from the removed session, shift higher sessions down
    setExerciseDistribution(prev => 
      prev.filter(ex => !(ex.dayDate === dayDate && ex.sessionIndex === sessionIndex))
        .map(ex => {
          if (ex.dayDate === dayDate && ex.sessionIndex > sessionIndex) {
            return { ...ex, sessionIndex: ex.sessionIndex - 1 };
          }
          return ex;
        })
    );
    
    // DELETE sections from removed session, shift higher sessions down
    setSessionSections(prev =>
      prev.filter(section => !(section.dayDate === dayDate && section.sessionIndex === sessionIndex))
        .map(section => {
          if (section.dayDate === dayDate && section.sessionIndex > sessionIndex) {
            return { ...section, sessionIndex: section.sessionIndex - 1 };
          }
          return section;
        })
    );
    
    // Update supersets
    setSupersets(prev => {
      const newSupersets = { ...prev };
      if (newSupersets[dayDate]) {
        const daySupersets = { ...newSupersets[dayDate] };
        
        // Move supersets from removed session to previous session
        if (daySupersets[sessionIndex]) {
          const targetSession = Math.max(0, sessionIndex - 1);
          daySupersets[targetSession] = {
            ...daySupersets[targetSession],
            ...daySupersets[sessionIndex]
          };
          delete daySupersets[sessionIndex];
        }
        
        // Shift down all supersets after the removed session
        const updatedSupersets: Record<number, Record<string, Record<string, string[]>>> = {};
        Object.entries(daySupersets).forEach(([idx, value]) => {
          const numIdx = Number(idx);
          if (numIdx > sessionIndex) {
            updatedSupersets[numIdx - 1] = value;
          } else {
            updatedSupersets[numIdx] = value;
          }
        });
        
        newSupersets[dayDate] = updatedSupersets;
      }
      return newSupersets;
    });
    
    // Update split state
    setDaySplitStates(prev => ({
      ...prev,
      [dayDate]: currentSessions - 1
    }));
    
    // Clean up session intensity from localStorage
    const mesocycleId = currentMesocycle?.id;
    if (mesocycleId) {
      const sessionIntensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
      localStorage.removeItem(sessionIntensityKey);
    }

    toast({
      title: "Session deleted",
      description: "The session has been removed successfully",
    });
  };

  // Handle renaming a session
  const handleRenameSession = (dayDate: string, sessionIndex: number, newName: string) => {
    setTrainingDays(prev => 
      prev.map(day => {
        if (day.date === dayDate) {
          const sessionNames = [...(day.sessionNames || [])];
          // Ensure array is large enough
          while (sessionNames.length <= sessionIndex) {
            sessionNames.push(`Session ${sessionNames.length + 1}`);
          }
          sessionNames[sessionIndex] = newName;
          
          return {
            ...day,
            sessionNames
          };
        }
        return day;
      })
    );
    
    toast({
      title: "Session renamed",
      description: `Session renamed to "${newName}"`,
    });
  };

  // Handle clearing all data for a microcycle
  const handleClearMicrocycleData = (microcycleId: string) => {
    if (!mesocycles[currentMesocycleIndex]) return;
    const microcycle = mesocycles[currentMesocycleIndex].microcycles.find(m => m.id === microcycleId);
    if (!microcycle) return;
    
    // Get all days for this microcycle
    const microcycleDays = trainingDays.filter(d => d.microcycleId === microcycleId);
    const dayDates = microcycleDays.map(d => d.date);
    
    // Reset daySplitStates for these days to 0
    setDaySplitStates(prev => {
      const newStates = { ...prev };
      dayDates.forEach(date => {
        newStates[date] = 0;
      });
      return newStates;
    });
    
    // Clear sessionNames from TrainingDay objects
    setTrainingDays(prev =>
      prev.map(day => {
        if (dayDates.includes(day.date)) {
          return {
            ...day,
            sessions: 0,
            sessionNames: []
          };
        }
        return day;
      })
    );
  };

  // Handle clearing all data for an entire mesocycle
  const handleClearMesocycleData = (mesocycleId: string) => {
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return;
    
    // Get ALL days for ALL microcycles in this mesocycle
    const mesocycleDays = trainingDays.filter(d => 
      mesocycle.microcycles.some(micro => micro.id === d.microcycleId)
    );
    const dayDates = mesocycleDays.map(d => d.date);
    
    // Reset daySplitStates for these days to 0
    setDaySplitStates(prev => {
      const newStates = { ...prev };
      dayDates.forEach(date => {
        newStates[date] = 0;
      });
      return newStates;
    });
    
    // Clear sessionNames from TrainingDay objects
    // IMPORTANT: Do NOT touch day.intensity!
    setTrainingDays(prev =>
      prev.map(day => {
        if (dayDates.includes(day.date)) {
          return {
            ...day,
            sessions: 0,
            sessionNames: [],
            // intensity is intentionally NOT modified here
          };
        }
        return day;
      })
    );
  };

  // Handle changing session intensity
  const handleSessionIntensityChange = (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
    if (!currentMesocycle) return;
    const mesocycleId = currentMesocycle.id;
    
    // Store session-specific intensity in localStorage
    const sessionIntensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_${sessionIndex}`;
    localStorage.setItem(sessionIntensityKey, intensity);
    
    // Count total sessions for this day from trainingDays (source of truth)
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionCount = day?.sessions ?? 1;
    const isSingleSession = sessionCount === 1;
    
    // If single session day, bidirectionally sync with day intensity
    if (isSingleSession) {
      setTrainingDays(prev => 
        prev.map(day => {
          if (day.date === dayDate) {
            return { ...day, intensity };
          }
          return day;
        })
      );
      
      // Also update dailyIntensityData for Step 3 sync
      setDailyIntensityData(prev =>
        prev.map(di => {
          if (di.date === dayDate) {
            return { ...di, intensity };
          }
          return di;
        })
      );
    }
    
    toast({
      title: "Session intensity updated",
      description: `Set to "${intensity.replace('-', ' ')}"${isSingleSession ? ' (day intensity also updated)' : ''}`,
    });
  };

  // Handle changing day intensity (only for single-session days)
  const handleDayIntensityChange = (dayDate: string, intensity: IntensityLevel) => {
    if (!currentMesocycle) return;
    const mesocycleId = currentMesocycle.id;
    
    // Update day intensity in trainingDays (syncs with calendar view)
    setTrainingDays(prev => 
      prev.map(day => {
        if (day.date === dayDate) {
          return { ...day, intensity };
        }
        return day;
      })
    );
    
    // Update dailyIntensityData for Step 3 sync
    setDailyIntensityData(prev => {
      const updated = prev.map(di => {
        if (di.date === dayDate) {
          return { ...di, intensity };
        }
        return di;
      });
      
      // Save to localStorage for persistence across pages
      localStorage.setItem('dailyIntensityData', JSON.stringify(updated));
      
      return updated;
    });
    
    // Count sessions for this day from trainingDays (source of truth)
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionCount = day?.sessions ?? 1;
    
    // For single-session days, also sync the session intensity
    if (sessionCount === 1) {
      const sessionIntensityKey = `sessionIntensity_${mesocycleId}_${dayDate}_0`;
      localStorage.setItem(sessionIntensityKey, intensity);
    }
    
    toast({
      title: "Day intensity updated",
      description: `Set to "${intensity.replace('-', ' ')}"${sessionCount === 1 ? ' (session intensity also updated)' : ''}`,
    });
  };

  // Handle updating training day structure (sessions, sessionNames)
  const handleUpdateTrainingDay = (dayDate: string, updates: Partial<TrainingDay>) => {
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== dayDate) return day;
        return { ...day, ...updates };
      })
    );
    
    // Also update daySplitStates if sessions is being updated
    if (updates.sessions !== undefined) {
      setDaySplitStates(prev => ({
        ...prev,
        [dayDate]: updates.sessions!
      }));
    }
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

  // Handle copy session
  const handleCopySession = (dayDate: string, sessionIndex: number) => {
    const sessionExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate && ex.sessionIndex === sessionIndex
    );
    
    const sessionSectionsForSession = sessionSections.filter(
      s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
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
      sections: sessionSectionsForSession,
      sourceDate: dayDate,
      sessionIndex: sessionIndex
    } as any);
    
    const sectionCount = sessionSectionsForSession.length;
    toast({
      title: "Session copied",
      description: `${sessionExercises.length} exercise(s) ${sectionCount > 0 ? `in ${sectionCount} section(s)` : ''} copied to clipboard`,
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
    
    // Determine the next session index for this day
    const targetDayExercises = exerciseDistribution.filter(ex => ex.dayDate === targetDate);
    const maxSessionIndex = targetDayExercises.length > 0
      ? Math.max(...targetDayExercises.map(ex => ex.sessionIndex))
      : -1;
    const newSessionIndex = maxSessionIndex + 1;
    
    // Update daySplitStates to ensure the new session is rendered
    setDaySplitStates(prev => {
      const current = prev[targetDate] ?? 1;
      const needed = newSessionIndex + 1;
      return { ...prev, [targetDate]: Math.max(current, needed) };
    });
    
    // Create mapping from old section IDs to new section IDs
    const sectionIdMapping = new Map<string, string>();
    const copiedSections = (copiedSession as any).sections || [];
    copiedSections.forEach((section: SessionSection) => {
      const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sectionIdMapping.set(section.id, newSectionId);
    });
    
    // Create new sections with updated date and session index
    const pastedSections = copiedSections.map((section: SessionSection) => ({
      ...section,
      id: sectionIdMapping.get(section.id)!,
      dayDate: targetDate,
      sessionIndex: newSessionIndex
    }));
    
    // Create mapping from old exercise IDs to new exercise IDs (for superset mapping)
    const oldToNewExerciseId: Record<string, string> = {};
    
    // Create new exercises with updated date, session index, and remapped section IDs
    const pastedExercises = copiedSession.exercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      oldToNewExerciseId[ex.id] = newId;
      return {
        ...ex,
        id: newId,
        dayDate: targetDate,
        sessionIndex: newSessionIndex,
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined
      };
    });
    
    // Copy supersets from the source session to the target session
    const sourceSuperset = supersets[copiedSession.sourceDate]?.[copiedSession.sessionIndex];
    if (sourceSuperset) {
      const newSupersets = { ...supersets };
      if (!newSupersets[targetDate]) {
        newSupersets[targetDate] = {};
      }
      newSupersets[targetDate][newSessionIndex] = {};
      
      Object.entries(sourceSuperset).forEach(([sectionKey, supersetMap]) => {
        // Remap section key
        const destSectionKey = sectionKey === '__unsectioned__' 
          ? '__unsectioned__' 
          : (sectionIdMapping.get(sectionKey) || sectionKey);
        
        if (!newSupersets[targetDate][newSessionIndex][destSectionKey]) {
          newSupersets[targetDate][newSessionIndex][destSectionKey] = {};
        }
        
        // Remap exercise IDs in each superset
        Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
          const mappedIds = (exerciseIds as string[])
            .map(id => oldToNewExerciseId[id])
            .filter(Boolean) as string[];
          
          if (mappedIds.length > 0) {
            newSupersets[targetDate][newSessionIndex][destSectionKey][supersetId] = mappedIds;
          }
        });
      });
      
      setSupersets(newSupersets);
      localStorage.setItem('supersets', JSON.stringify(newSupersets));
    }
    
    // Update exercise distribution and session sections
    const updatedExerciseDistribution = [...exerciseDistribution, ...pastedExercises];
    const updatedSessionSections = [...sessionSections, ...pastedSections];
    
    setExerciseDistribution(updatedExerciseDistribution);
    setSessionSections(updatedSessionSections);
    
    // Save to localStorage
    localStorage.setItem('exerciseDistribution', JSON.stringify(updatedExerciseDistribution));
    localStorage.setItem('sessionSections', JSON.stringify(updatedSessionSections));
    
    // Update trainingDays to include the new session count
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== targetDate) return day;
        const sessionNames = [...(day.sessionNames || [])];
        while (sessionNames.length <= newSessionIndex) {
          sessionNames.push(`Session ${sessionNames.length + 1}`);
        }
        return {
          ...day,
          sessions: newSessionIndex + 1,
          sessionNames
        };
      })
    );
    
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
    
    // Get all sections in this week
    const weekSections = sessionSections.filter(s => {
      const sDate = parseISO(s.dayDate);
      return sDate >= weekStart && sDate <= weekEnd;
    });
    
    // Get all supersets for this week
    const weekSupersets: SupersetMapping = {};
    Object.entries(supersets).forEach(([dayDate, daySupersets]) => {
      const sDate = parseISO(dayDate);
      if (sDate >= weekStart && sDate <= weekEnd) {
        weekSupersets[dayDate] = daySupersets;
      }
    });
    
    // Build session structure (which days have which sessions)
    const sessionStructure: Record<string, number[]> = {};
    weekExercises.forEach(ex => {
      if (!sessionStructure[ex.dayDate]) {
        sessionStructure[ex.dayDate] = [];
      }
      if (!sessionStructure[ex.dayDate].includes(ex.sessionIndex)) {
        sessionStructure[ex.dayDate].push(ex.sessionIndex);
      }
    });
    
    setCopiedWeek({
      exercises: weekExercises,
      sections: weekSections,
      supersets: weekSupersets,
      sessionStructure,
      weekStartDate
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
    
    // Get all dates in this week that have sessions
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = format(addDays(weekStart, i), 'yyyy-MM-dd');
      weekDates.push(date);
    }
    
    // Count sessions before clearing
    const weekExercises = exerciseDistribution.filter(ex => weekDates.includes(ex.dayDate));
    const weekSections = sessionSections.filter(s => weekDates.includes(s.dayDate));
    
    const hasContent = weekExercises.length > 0 || weekSections.length > 0 || 
      weekDates.some(date => (daySplitStates[date] || 0) > 0);
    
    if (!hasContent) {
      toast({
        title: "Nothing to clear",
        description: "This week has no sessions",
      });
      return;
    }
    
    const uniqueSessions = new Set([
      ...weekExercises.map(ex => `${ex.dayDate}-${ex.sessionIndex}`),
      ...weekSections.map(s => `${s.dayDate}-${s.sessionIndex}`)
    ]).size;
    
    // 1. Remove all exercises from this week
    const updatedExerciseDistribution = exerciseDistribution.filter(ex => !weekDates.includes(ex.dayDate));
    setExerciseDistribution(updatedExerciseDistribution);
    localStorage.setItem('exerciseDistribution', JSON.stringify(updatedExerciseDistribution));
    
    // 2. Remove all sections from this week
    const updatedSessionSections = sessionSections.filter(s => !weekDates.includes(s.dayDate));
    setSessionSections(updatedSessionSections);
    localStorage.setItem('sessionSections', JSON.stringify(updatedSessionSections));
    
    // 3. Remove supersets for this week
    const newSupersets = { ...supersets };
    weekDates.forEach(date => {
      delete newSupersets[date];
    });
    setSupersets(newSupersets);
    localStorage.setItem('supersets', JSON.stringify(newSupersets));
    
    // 4. Reset daySplitStates for these days
    const newDaySplitStates = { ...daySplitStates };
    weekDates.forEach(date => {
      newDaySplitStates[date] = 0;
    });
    setDaySplitStates(newDaySplitStates);
    localStorage.setItem('daySplitStates', JSON.stringify(newDaySplitStates));
    
    // 5. Update trainingDays to clear sessions
    setTrainingDays(prev =>
      prev.map(day => {
        if (!weekDates.includes(day.date)) return day;
        return {
          ...day,
          sessions: 0,
          sessionNames: []
        };
      })
    );
    
    // 6. Clear session comments from localStorage
    weekDates.forEach(date => {
      const maxSessions = daySplitStates[date] || 1;
      for (let sessionIdx = 0; sessionIdx < maxSessions; sessionIdx++) {
        // Find the mesocycle for this date
        const meso = mesocycles.find(m => {
          const start = new Date(m.startDate);
          const end = new Date(m.endDate);
          const d = parseISO(date);
          return d >= start && d <= end;
        });
        if (meso) {
          localStorage.removeItem(`workoutSessions_${meso.id}_${date}_${sessionIdx}`);
        }
      }
    });
    
    toast({
      title: "Week cleared",
      description: `${uniqueSessions} session(s) completely removed from this week`,
    });
  };

  // Handle paste week (Option B: Add as new sessions)
  const handlePasteWeek = (targetWeekStartDate: string) => {
    if (!copiedWeek) return;
    
    const sourceWeekStart = parseISO(copiedWeek.weekStartDate);
    const targetWeekStart = parseISO(targetWeekStartDate);
    const dayOffset = differenceInDays(targetWeekStart, sourceWeekStart);
    
    // Calculate session index offsets for each target day based on existing sessions
    const sessionOffsets: Record<string, number> = {};
    Object.entries(copiedWeek.sessionStructure).forEach(([sourceDayDate]) => {
      const sourceDate = parseISO(sourceDayDate);
      const targetDate = format(addDays(sourceDate, dayOffset), 'yyyy-MM-dd');
      // Offset = existing session count on target day
      sessionOffsets[targetDate] = daySplitStates[targetDate] || 0;
    });
    
    // 1. Create mapping from old section IDs to new section IDs
    const sectionIdMapping = new Map<string, string>();
    copiedWeek.sections.forEach(section => {
      const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sectionIdMapping.set(section.id, newSectionId);
    });
    
    // 2. Create new sections with adjusted dates AND shifted session indices
    const pastedSections = copiedWeek.sections.map(section => {
      const originalDate = parseISO(section.dayDate);
      const newDate = addDays(originalDate, dayOffset);
      const targetDateStr = format(newDate, 'yyyy-MM-dd');
      const sessionOffset = sessionOffsets[targetDateStr] || 0;
      return {
        ...section,
        id: sectionIdMapping.get(section.id)!,
        dayDate: targetDateStr,
        sessionIndex: section.sessionIndex + sessionOffset // Shift session index
      };
    });
    
    // 3. Create mapping from old exercise IDs to new exercise IDs
    const exerciseIdMapping = new Map<string, string>();
    
    // 4. Create new exercises with new IDs, adjusted dates, remapped section IDs, AND shifted session indices
    const pastedExercises = copiedWeek.exercises.map(ex => {
      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      exerciseIdMapping.set(ex.id, newId);
      const originalDate = parseISO(ex.dayDate);
      const newDate = addDays(originalDate, dayOffset);
      const targetDateStr = format(newDate, 'yyyy-MM-dd');
      const sessionOffset = sessionOffsets[targetDateStr] || 0;
      return {
        ...ex,
        id: newId,
        dayDate: targetDateStr,
        sessionIndex: ex.sessionIndex + sessionOffset, // Shift session index
        sectionId: ex.sectionId ? sectionIdMapping.get(ex.sectionId) : undefined
      };
    });
    
    // 5. Copy supersets with remapped IDs AND shifted session indices
    const newSupersets = { ...supersets };
    
    Object.entries(copiedWeek.supersets).forEach(([sourceDayDate, daySupersets]) => {
      const sourceDate = parseISO(sourceDayDate);
      const targetDate = format(addDays(sourceDate, dayOffset), 'yyyy-MM-dd');
      const sessionOffset = sessionOffsets[targetDate] || 0;
      
      if (!newSupersets[targetDate]) {
        newSupersets[targetDate] = {};
      }
      
      Object.entries(daySupersets).forEach(([sessionIdx, sessionSupersets]) => {
        const originalSessionIndex = parseInt(sessionIdx);
        const shiftedSessionIndex = originalSessionIndex + sessionOffset; // Shift session index
        
        if (!newSupersets[targetDate][shiftedSessionIndex]) {
          newSupersets[targetDate][shiftedSessionIndex] = {};
        }
        
        Object.entries(sessionSupersets).forEach(([sectionKey, supersetMap]) => {
          const destSectionKey = sectionKey === '__unsectioned__' 
            ? '__unsectioned__' 
            : (sectionIdMapping.get(sectionKey) || sectionKey);
          
          if (!newSupersets[targetDate][shiftedSessionIndex][destSectionKey]) {
            newSupersets[targetDate][shiftedSessionIndex][destSectionKey] = {};
          }
          
          Object.entries(supersetMap).forEach(([supersetId, exerciseIds]) => {
            const mappedIds = (exerciseIds as string[])
              .map(id => exerciseIdMapping.get(id))
              .filter(Boolean) as string[];
            
            if (mappedIds.length >= 2) {
              const newSupersetId = `superset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              newSupersets[targetDate][shiftedSessionIndex][destSectionKey][newSupersetId] = mappedIds;
            }
          });
        });
      });
    });
    
    setSupersets(newSupersets);
    localStorage.setItem('supersets', JSON.stringify(newSupersets));
    
    // 6. Update state
    const updatedExerciseDistribution = [...exerciseDistribution, ...pastedExercises];
    const updatedSessionSections = [...sessionSections, ...pastedSections];
    
    setExerciseDistribution(updatedExerciseDistribution);
    setSessionSections(updatedSessionSections);
    
    localStorage.setItem('exerciseDistribution', JSON.stringify(updatedExerciseDistribution));
    localStorage.setItem('sessionSections', JSON.stringify(updatedSessionSections));
    
    // 7. Update daySplitStates: existing count + max pasted session index + 1
    const newDaySplitStates = { ...daySplitStates };
    
    Object.entries(copiedWeek.sessionStructure).forEach(([sourceDayDate, sessionIndices]) => {
      const sourceDate = parseISO(sourceDayDate);
      const targetDate = format(addDays(sourceDate, dayOffset), 'yyyy-MM-dd');
      const existingCount = daySplitStates[targetDate] || 0;
      const pastedSessionCount = Math.max(...sessionIndices) + 1; // Number of sessions being pasted
      newDaySplitStates[targetDate] = existingCount + pastedSessionCount;
    });
    
    setDaySplitStates(newDaySplitStates);
    localStorage.setItem('daySplitStates', JSON.stringify(newDaySplitStates));
    
    // 8. Update trainingDays with new session counts and names
    setTrainingDays(prev =>
      prev.map(day => {
        const newSessionCount = newDaySplitStates[day.date];
        if (!newSessionCount || newSessionCount <= (day.sessions || 0)) return day;
        
        const sessionNames = [...(day.sessionNames || [])];
        while (sessionNames.length < newSessionCount) {
          sessionNames.push(`Session ${sessionNames.length + 1}`);
        }
        
        return {
          ...day,
          sessions: newSessionCount,
          sessionNames
        };
      })
    );
    
    // 9. Toast and cleanup
    const pastedSessionCount = new Set(pastedExercises.map(ex => `${ex.dayDate}-${ex.sessionIndex}`)).size;
    
    toast({
      title: "Week pasted",
      description: `${pastedSessionCount} session(s) with ${pastedExercises.length} exercise(s) added as new sessions`,
    });
    
    setCopiedWeek(null);
  };

  // Handle copy section
  const handleCopySection = (sectionId: string) => {
    // Find the section
    const section = sessionSections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Get exercises in this section
    const sectionExercises = exerciseDistribution.filter(
      ex => ex.sectionId === sectionId
    );
    
    if (sectionExercises.length === 0) {
      toast({
        title: "Cannot copy",
        description: "This section has no exercises",
        variant: "destructive"
      });
      return;
    }
    
    setCopiedSection({
      exercises: sectionExercises,
      sections: [section],
      sourceSectionId: sectionId,
      sourceDayDate: section.dayDate,
      sourceSessionIndex: section.sessionIndex
    });
    
    toast({
      title: "Section copied",
      description: `Section "${section.name}" with ${sectionExercises.length} exercise(s) copied to clipboard`,
    });
  };

  // Handle paste section
  const handlePasteSection = (targetDayDate: string, targetSessionIndex: number) => {
    if (!copiedSection) return;
    
    // Generate new section ID
    const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine the highest order for sections in target session
    const targetSessionSections = sessionSections.filter(
      s => s.dayDate === targetDayDate && s.sessionIndex === targetSessionIndex
    );
    const maxOrder = targetSessionSections.length > 0
      ? Math.max(...targetSessionSections.map(s => s.order))
      : -1;
    const newOrder = maxOrder + 1;
    
    // Create new section
    const pastedSection: SessionSection = {
      ...copiedSection.sections[0],
      id: newSectionId,
      dayDate: targetDayDate,
      sessionIndex: targetSessionIndex,
      order: newOrder
    };
    
    // Create new exercises with updated IDs, date, session index, and section ID
    const pastedExercises = copiedSection.exercises.map(ex => ({
      ...ex,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      dayDate: targetDayDate,
      sessionIndex: targetSessionIndex,
      sectionId: newSectionId
    }));
    
    setSessionSections(prev => [...prev, pastedSection]);
    setExerciseDistribution(prev => [...prev, ...pastedExercises]);
    
    // Save to localStorage
    localStorage.setItem('sessionSections', JSON.stringify([...sessionSections, pastedSection]));
    localStorage.setItem('exerciseDistribution', JSON.stringify([...exerciseDistribution, ...pastedExercises]));
    
    toast({
      title: "Section pasted",
      description: `Section "${pastedSection.name}" with ${pastedExercises.length} exercise(s) pasted successfully`,
    });
    
    setCopiedSection(null);
  };

  // Handle copy day
  const handleCopyDay = (dayDate: string) => {
    // Get exercises for this day
    const dayExercises = exerciseDistribution.filter(
      ex => ex.dayDate === dayDate
    );
    
    // Get sections for this day
    const daySections = sessionSections.filter(s => s.dayDate === dayDate);
    
    // Get supersets for this day
    const daySupersets = supersets[dayDate] || {};
    
    // Get intensity for this day
    const dayIntensity = dailyIntensityData.find(di => di.date === dayDate);
    
    // Get tests/events for this day
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    
    // Get split state for this day
    const splitState = daySplitStates[dayDate];
    
    // Always allow copying (every day has at least intensity)
    setCopiedDay({
      exercises: dayExercises,
      sections: daySections,
      supersets: daySupersets,
      sourceDate: dayDate,
      intensity: dayIntensity?.intensity,
      testNames: trainingDay?.testNames,
      eventNames: trainingDay?.eventNames,
      splitState: splitState
    });
    
    // Build descriptive toast message
    const parts = [];
    if (dayExercises.length > 0) parts.push(`${dayExercises.length} exercise(s)`);
    if (daySections.length > 0) parts.push(`${daySections.length} section(s)`);
    if (dayIntensity) parts.push(`intensity: ${dayIntensity.intensity}`);
    if (trainingDay?.testNames?.length) parts.push(`${trainingDay.testNames.length} test(s)`);
    if (trainingDay?.eventNames?.length) parts.push(`${trainingDay.eventNames.length} event(s)`);
    
    toast({
      title: "Day copied",
      description: parts.length > 0 ? parts.join(', ') : "Day data copied to clipboard",
    });
  };

  // Handle paste day - OVERWRITE behavior (clears target day first)
  const handlePasteDay = (targetDate: string) => {
    if (!copiedDay) return;
    
    // Create ID mappings for sections (old -> new)
    const sectionIdMapping = new Map<string, string>();
    copiedDay.sections.forEach(section => {
      const newId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sectionIdMapping.set(section.id, newId);
    });
    
    // Create ID mappings for exercises (old -> new)
    const exerciseIdMapping = new Map<string, string>();
    copiedDay.exercises.forEach(ex => {
      const newId = `dist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 5)}`;
      exerciseIdMapping.set(ex.id, newId);
    });
    
    // 1. Clear and paste sections
    setSessionSections(prev => {
      // Remove existing sections from target day
      const filteredPrev = prev.filter(s => s.dayDate !== targetDate);
      
      // Create pasted sections with new IDs and target date
      const pastedSections = copiedDay.sections.map(section => ({
        ...section,
        id: sectionIdMapping.get(section.id) || section.id,
        dayDate: targetDate
      }));
      
      return [...filteredPrev, ...pastedSections];
    });
    
    // 2. Clear and paste supersets with remapped exercise IDs
    setSupersets(prev => {
      const newSupersets = { ...prev };
      delete newSupersets[targetDate];
      
      // Remap supersets if any exist
      const sourceSupersets = copiedDay.supersets;
      if (Object.keys(sourceSupersets).length > 0) {
        const targetDaySupersets: SupersetMapping[string] = {};
        
        for (const sessionIndex in sourceSupersets) {
          targetDaySupersets[sessionIndex] = {};
          for (const sectionId in sourceSupersets[sessionIndex]) {
            // Remap section ID
            const newSectionId = sectionIdMapping.get(sectionId) || sectionId;
            targetDaySupersets[sessionIndex][newSectionId] = {};
            
            for (const supersetId in sourceSupersets[sessionIndex][sectionId]) {
              const exerciseIds = sourceSupersets[sessionIndex][sectionId][supersetId];
              // Remap exercise IDs
              const newExerciseIds = exerciseIds.map(exId => exerciseIdMapping.get(exId) || exId);
              // Generate new superset ID
              const newSupersetId = `superset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              targetDaySupersets[sessionIndex][newSectionId][newSupersetId] = newExerciseIds;
            }
          }
        }
        
        newSupersets[targetDate] = targetDaySupersets;
      }
      
      return newSupersets;
    });
    
    // 3. Reset daySplitStates for target day (will be set from copied data or 0)
    setDaySplitStates(prev => ({
      ...prev,
      [targetDate]: copiedDay.splitState ?? 0
    }));
    
    // 4. Paste exercises with new IDs and remapped section IDs
    setExerciseDistribution(prev => {
      // Remove all existing exercises from target day
      const filteredPrev = prev.filter(ex => ex.dayDate !== targetDate);
      
      // If there are exercises to copy
      if (copiedDay.exercises.length > 0) {
        // Create new exercises with updated IDs, date, and remapped section IDs
        const pastedExercises = copiedDay.exercises.map(ex => ({
          ...ex,
          id: exerciseIdMapping.get(ex.id) || ex.id,
          dayDate: targetDate,
          sectionId: ex.sectionId ? (sectionIdMapping.get(ex.sectionId) || ex.sectionId) : ex.sectionId
        }));
        
        return [...filteredPrev, ...pastedExercises];
      }
      
      return filteredPrev;
    });
    
    // 5. Paste intensity
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
    
    // 6. Paste tests/events
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
    
    // 7. Update trainingDays session info
    setTrainingDays(prev =>
      prev.map(day => {
        if (day.date !== targetDate) return day;
        const sessionCount = copiedDay.splitState ?? 0;
        const sessionNames: string[] = [];
        for (let i = 0; i < sessionCount; i++) {
          sessionNames.push(`Session ${i + 1}`);
        }
        return {
          ...day,
          sessions: sessionCount,
          sessionNames
        };
      })
    );
    
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

  // Handle clear day - clears ALL session data (exercises, sections, supersets)
  const handleClearDay = (dayDate: string) => {
    const dayExercises = exerciseDistribution.filter(ex => ex.dayDate === dayDate);
    const trainingDay = trainingDays.find(td => td.date === dayDate);
    const hasTestsEvents = (trainingDay?.testNames?.length || 0) + (trainingDay?.eventNames?.length || 0) > 0;
    const hasSessions = (daySplitStates[dayDate] ?? 0) > 0;
    
    // Allow clearing if there are exercises, sessions, OR tests/events
    if (dayExercises.length === 0 && !hasTestsEvents && !hasSessions) {
      toast({
        title: "Nothing to clear",
        description: "This day has no sessions or events",
        variant: "destructive"
      });
      return;
    }
    
    // Clear exercises
    setExerciseDistribution(prev => prev.filter(ex => ex.dayDate !== dayDate));
    
    // Clear sections
    setSessionSections(prev => prev.filter(s => s.dayDate !== dayDate));
    
    // Clear supersets
    setSupersets(prev => {
      const newSupersets = { ...prev };
      delete newSupersets[dayDate];
      return newSupersets;
    });
    
    // Reset split state to 0
    setDaySplitStates(prev => ({
      ...prev,
      [dayDate]: 0
    }));
    
    // Clear tests/events and session info from trainingDays
    setTrainingDays(prev => {
      const updated = prev.map(td => {
        if (td.date === dayDate) {
          return {
            ...td,
            isTestDay: false,
            isEventDay: false,
            testNames: undefined,
            eventNames: undefined,
            sessions: 0,
            sessionNames: []
          };
        }
        return td;
      });
      
      localStorage.setItem('trainingDays', JSON.stringify(updated));
      return updated;
    });
    
    // Clean up session intensity and comments from localStorage
    const mesocycleId = currentMesocycle?.id;
    const maxSessions = daySplitStates[dayDate] ?? 0;
    if (mesocycleId) {
      for (let i = 0; i < maxSessions; i++) {
        localStorage.removeItem(`sessionIntensity_${mesocycleId}_${dayDate}_${i}`);
        localStorage.removeItem(`workoutSessions_${mesocycleId}_${dayDate}_${i}`);
      }
    }
    
    const parts = [];
    if (dayExercises.length > 0) parts.push(`${dayExercises.length} exercise(s)`);
    if (hasSessions) parts.push(`${daySplitStates[dayDate]} session(s)`);
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
    isNew: boolean,
    comments?: string
  ) => {
    // Update trainingDays
    setTrainingDays(prev => {
      const existingDayIndex = prev.findIndex(td => td.date === dayDate);
      
      let updated: TrainingDay[];
      
      if (existingDayIndex >= 0) {
        // Day exists - update it
        updated = prev.map(td => {
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
      } else {
        // Day doesn't exist - create new TrainingDay
        const dateObj = parseISO(dayDate);
        const dayOfWeek = dateObj.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Find which microcycle this date belongs to based on date position
        let targetMicrocycleId = '';
        if (currentMesocycle && currentMesocycle.microcycles.length > 0) {
          // Calculate which microcycle based on weeks since mesocycle start
          const mesoStart = new Date(currentMesocycle.startDate);
          const daysSinceStart = Math.floor((dateObj.getTime() - mesoStart.getTime()) / (1000 * 60 * 60 * 24));
          
          // Find microcycle by accumulating durations
          let accumulatedDays = 0;
          for (const micro of currentMesocycle.microcycles) {
            accumulatedDays += micro.duration;
            if (daysSinceStart < accumulatedDays) {
              targetMicrocycleId = micro.id;
              break;
            }
          }
          // Fallback to first microcycle if not found
          if (!targetMicrocycleId) {
            targetMicrocycleId = currentMesocycle.microcycles[0].id;
          }
        }
        
        const newDay: TrainingDay = {
          date: dayDate,
          dayOfWeek,
          dayName: dayNames[dayOfWeek],
          mesocycleId: currentMesocycle?.id || '',
          microcycleId: targetMicrocycleId,
          isTestDay: type === 'test',
          isEventDay: type === 'event',
          isTrainingDay: true,
          testNames: type === 'test' ? [testEventName] : undefined,
          eventNames: type === 'event' ? [testEventName] : undefined,
          intensity: 'moderate',
          sessions: 1,
          sessionNames: ['Session 1']
        };
        
        updated = [...prev, newDay];
      }
      
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
            testDates: [dayDate],
            comments: comments || ''
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
            eventDates: [dayDate],
            comments: comments || ''
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
  const handleDeleteTestEvent = (dayDate: string, type: 'test' | 'event', name: string) => {
    // Update trainingDays
    setTrainingDays(prev => {
      const updated = prev.map(td => {
        if (td.date === dayDate) {
          if (type === 'test') {
            const updatedTestNames = (td.testNames || []).filter(t => t !== name);
            return {
              ...td,
              testNames: updatedTestNames.length > 0 ? updatedTestNames : undefined,
              isTestDay: updatedTestNames.length > 0
            };
          } else {
            const updatedEventNames = (td.eventNames || []).filter(e => e !== name);
            return {
              ...td,
              eventNames: updatedEventNames.length > 0 ? updatedEventNames : undefined,
              isEventDay: updatedEventNames.length > 0
            };
          }
        }
        return td;
      });
      localStorage.setItem('trainingDays', JSON.stringify(updated));
      return updated;
    });
    
    // Sync to macrocycleData - remove the date from the specific test/event
    if (macrocycleData) {
      const updatedMacrocycle = { ...macrocycleData };
      
      if (type === 'test') {
        // Find the specific test by name and remove this date
        updatedMacrocycle.subGoals = (updatedMacrocycle.subGoals || []).map((sg: any) => {
          const testName = sg.testMethod || sg.name || sg.testName || sg.method || sg.description || 'Test';
          if (testName === name) {
            return {
              ...sg,
              testDates: (sg.testDates || []).filter((date: string) => date !== dayDate)
            };
          }
          return sg;
        });
      } else {
        // Find the specific event by name and remove this date
        updatedMacrocycle.events = (updatedMacrocycle.events || []).map((e: any) => {
          const eventName = e.name || e.eventName || e.title || e.description || 'Event';
          if (eventName === name) {
            return {
              ...e,
              eventDates: (e.eventDates || []).filter((date: string) => date !== dayDate)
            };
          }
          return e;
        });
      }
      
      setMacrocycleData(updatedMacrocycle);
      localStorage.setItem('macrocycleData', JSON.stringify(updatedMacrocycle));
    }
    
    toast({
      title: `${type === 'test' ? 'Test' : 'Event'} deleted`,
      description: `${name} removed from ${format(parseISO(dayDate), 'PPP')}`,
    });
  };

  // Handle update test comment
  const handleUpdateTestComment = (testId: string, comments: string) => {
    const savedData = localStorage.getItem('macrocycleData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const updatedSubGoals = (data.subGoals || []).map((sg: any) =>
          sg.id === testId ? { ...sg, comments } : sg
        );
        data.subGoals = updatedSubGoals;
        localStorage.setItem('macrocycleData', JSON.stringify(data));
        
        // Update local state
        setMacrocycleData(data);
        
        // Trigger re-fetch of data
        const event = new Event('macrocycle-data-updated');
        window.dispatchEvent(event);
        
        toast({
          title: "Comment updated",
          description: "Test comment has been saved",
        });
      } catch (error) {
        console.error('Error updating test comment:', error);
        toast({
          title: "Error",
          description: "Failed to update test comment",
          variant: "destructive",
        });
      }
    }
  };

  // Handle update test values (baseline, goal, comments)
  const handleUpdateTestValues = (testId: string, updates: { preTestValue?: number; goalValue?: number; comments?: string }) => {
    const savedData = localStorage.getItem('macrocycleData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const updatedSubGoals = (data.subGoals || []).map((sg: any) =>
          sg.id === testId ? { ...sg, ...updates } : sg
        );
        data.subGoals = updatedSubGoals;
        localStorage.setItem('macrocycleData', JSON.stringify(data));
        setMacrocycleData(data);
        const event = new Event('macrocycle-data-updated');
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Error updating test values:', error);
      }
    }
  };

  // Handle update event comment
  const handleUpdateEventComment = (eventId: string, comments: string) => {
    const savedData = localStorage.getItem('macrocycleData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        const updatedEvents = (data.events || []).map((ev: any) =>
          ev.id === eventId ? { ...ev, comments } : ev
        );
        data.events = updatedEvents;
        localStorage.setItem('macrocycleData', JSON.stringify(data));
        
        // Update local state
        setMacrocycleData(data);
        
        // Trigger re-fetch of data
        const event = new Event('macrocycle-data-updated');
        window.dispatchEvent(event);
        
        toast({
          title: "Comment updated",
          description: "Event comment has been saved",
        });
      } catch (error) {
        console.error('Error updating event comment:', error);
        toast({
          title: "Error",
          description: "Failed to update event comment",
          variant: "destructive",
        });
      }
    }
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
      return;
    }

    return handleMoveSessionToDay(
      sourceDateString, 
      destDateString, 
      draggedSessionIndex, 
      destination.index
    );
  };

  // Reorder sessions within the same day - comprehensive update
  const handleReorderSessionsInDay = (
    dayDate: string, 
    fromIndex: number, 
    toIndex: number
  ) => {
    // Get session count from trainingDays, not exerciseDistribution
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionsCount = day?.sessions ?? 1;
    
    // Guard: clamp indices and early return if no-op
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || 
        fromIndex >= sessionsCount || toIndex >= sessionsCount) {
      return;
    }
    
    // Build positions array and reorder to create index mapping
    const positions = Array.from({ length: sessionsCount }, (_, i) => i);
    const [moved] = positions.splice(fromIndex, 1);
    positions.splice(toIndex, 0, moved);
    
    // Create oldIndex -> newIndex map
    const indexMap = new Map<number, number>();
    positions.forEach((oldIdx, newIdx) => {
      indexMap.set(oldIdx, newIdx);
    });
    
    // 1. Update exerciseDistribution
    setExerciseDistribution(prev => 
      prev.map(ex => 
        ex.dayDate === dayDate && indexMap.has(ex.sessionIndex)
          ? { ...ex, sessionIndex: indexMap.get(ex.sessionIndex)! }
          : ex
      )
    );
    
    // 2. Update sessionSections
    setSessionSections(prev => 
      prev.map(s => 
        s.dayDate === dayDate && indexMap.has(s.sessionIndex)
          ? { ...s, sessionIndex: indexMap.get(s.sessionIndex)! }
          : s
      )
    );
    
    // 3. Update supersets
    setSupersets(prev => {
      const copy = { ...prev };
      const dayMap = prev[dayDate];
      if (!dayMap) return copy;
      
      const remapped: Record<number, Record<string, Record<string, string[]>>> = {};
      Object.entries(dayMap).forEach(([sessionIdxStr, sectionMap]) => {
        const oldIdx = Number(sessionIdxStr);
        const newIdx = indexMap.get(oldIdx);
        if (newIdx !== undefined) {
          remapped[newIdx] = sectionMap as Record<string, Record<string, string[]>>;
        }
      });
      copy[dayDate] = remapped as any;
      return copy;
    });
    
    // 4. Update trainingDays.sessionNames
    setTrainingDays(prev => 
      prev.map(day => {
        if (day.date !== dayDate) return day;
        
        // Ensure sessionNames array exists and has correct length
        const names = [...(day.sessionNames ?? Array.from({ length: sessionsCount }, (_, i) => `Session ${i + 1}`))];
        while (names.length < sessionsCount) {
          names.push(`Session ${names.length + 1}`);
        }
        
        // Reorder based on positions mapping
        const reorderedNames = positions.map(oldIdx => names[oldIdx] ?? `Session ${positions.indexOf(oldIdx) + 1}`);
        
        return { ...day, sessionNames: reorderedNames };
      })
    );
    
    // 5. Remap localStorage keys for intensity and comments
    if (currentMesocycle?.id) {
      const mesoId = currentMesocycle.id;
      
      // Read all old values
      const oldIntensities: Record<number, string> = {};
      const oldComments: Record<number, string> = {};
      
      for (let i = 0; i < sessionsCount; i++) {
        const iKey = `sessionIntensity_${mesoId}_${dayDate}_${i}`;
        const cKey = `sessionComments_${mesoId}_${dayDate}_${i}`;
        
        const iVal = localStorage.getItem(iKey);
        if (iVal !== null) oldIntensities[i] = iVal;
        
        const cVal = localStorage.getItem(cKey);
        if (cVal !== null) oldComments[i] = cVal;
        
        // Remove old keys to prevent collisions
        localStorage.removeItem(iKey);
        localStorage.removeItem(cKey);
      }
      
      // Write new keys based on index mapping
      positions.forEach((oldIdx, newIdx) => {
        const iVal = oldIntensities[oldIdx];
        if (iVal !== undefined) {
          localStorage.setItem(`sessionIntensity_${mesoId}_${dayDate}_${newIdx}`, iVal);
        }
        
        const cVal = oldComments[oldIdx];
        if (cVal !== undefined) {
          localStorage.setItem(`sessionComments_${mesoId}_${dayDate}_${newIdx}`, cVal);
        }
      });
    }
    
    toast({
      title: "Session reordered",
      description: "Session order updated successfully",
    });
  };

  // Move session up within the same day
  const handleMoveSessionUp = (dayDate: string, sessionIndex: number) => {
    // Use trainingDays to get actual session count
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionsCount = day?.sessions ?? 1;
    
    // Can only move up if not already at the top
    if (sessionIndex > 0) {
      handleReorderSessionsInDay(dayDate, sessionIndex, sessionIndex - 1);
    }
  };

  // Move session down within the same day
  const handleMoveSessionDown = (dayDate: string, sessionIndex: number) => {
    // Use trainingDays to get actual session count
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionsCount = day?.sessions ?? 1;
    
    // Can only move down if not already at the bottom
    if (sessionIndex < sessionsCount - 1) {
      handleReorderSessionsInDay(dayDate, sessionIndex, sessionIndex + 1);
    }
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

  const NavigationButtons = () => {
    const isLastStep = currentStep >= totalSteps;
    
    return (
      <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full">
        <Button 
          onClick={() => {
            if (currentStep <= 1) {
              localStorage.setItem('mesocycleStep', '5');
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
        
        {isLastStep ? (
          <Button 
            onClick={() => {
              saveCurrentSession();
              toast({
                title: "Program saved",
                description: "Your training program has been saved.",
              });
              navigate("/templates/programs");
            }}
            className="w-full md:w-auto"
          >
            <Check className="mr-2 h-4 w-4" />
            Save & Finish
          </Button>
        ) : (
          <Button 
            onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
            className="w-full md:w-auto"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  const renderTrainingPlanOverview = () => {
    const primaryGoal = macrocycleData?.smartGoal?.description || 
                        macrocycleData?.smartGoal?.goal ||
                        macrocycleData?.smartGoal?.specific;
    
    const startDate = macrocycleData?.planDuration?.startDate || macrocycleData?.smartGoal?.startDate;
    const endDate = macrocycleData?.planDuration?.endDate || macrocycleData?.smartGoal?.endDate;
    
    return (
      <TrainingPlanOverview
        athleteName={athleteName}
        planName={macrocycleData?.planName}
        startDate={startDate}
        endDate={endDate}
        totalWeeks={macrocycleData?.planDuration?.totalWeeks || macrocycleData?.smartGoal?.totalWeeks}
        totalDays={macrocycleData?.planDuration?.totalDays}
        totalMesocycles={mesocycles.length}
        primaryGoal={primaryGoal}
        subGoals={(macrocycleData?.subGoals || []).map((sg: any) => ({
          id: sg.id,
          description: sg.description || sg.name || 'Unknown'
        }))}
        notes={macrocycleData?.planNotes}
        onNotesChange={(notes) => {
          const updated = { ...macrocycleData, planNotes: notes };
          setMacrocycleData(updated);
          localStorage.setItem('macrocycleData', JSON.stringify(updated));
        }}
      />
    );
  };

  const renderMesocycleNavigation = () => (
    <div className="flex items-center justify-center mb-4">
      <div className="overflow-x-auto scrollbar-thin max-w-full">
        <div className="flex items-center justify-center gap-2 px-2">
          {mesocycles.map((meso, index) => (
            <Button
              key={meso.id}
              variant={index === currentMesocycleIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentMesocycleIndex(index)}
              className="min-w-[100px] shrink-0"
            >
              {meso.name}
            </Button>
          ))}
        </div>
      </div>
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
      <div className="min-h-[400px] max-h-[calc(100vh-200px)] overflow-y-auto">
        <EnhancedExerciseDistribution
          mesocycle={currentMesocycle}
          allMesocycles={mesocycles}
          trainingDays={trainingDays}
          exerciseSelectionData={exerciseSelectionData}
          exerciseDistribution={exerciseDistribution}
          sessionSections={sessionSections}
          supersets={supersets}
          onDistributionChange={setExerciseDistribution}
          onSectionsChange={setSessionSections}
          onSupersetsChange={setSupersets}
          getIntensityColor={getIntensityColor}
          onAddSession={handleAddSession}
          onRemoveSession={handleRemoveSession}
          onRenameSession={handleRenameSession}
          onSessionIntensityChange={handleSessionIntensityChange}
          onDayIntensityChange={handleDayIntensityChange}
          intensityLevels={intensityLevels}
          onClearMicrocycle={handleClearMicrocycleData}
          onClearMesocycle={handleClearMesocycleData}
          copiedSection={copiedSection}
          onCopySection={handleCopySection}
          onPasteSection={handlePasteSection}
          copiedSession={copiedSession}
          onCopySession={handleCopySession}
          onPasteSession={handlePasteSession}
          onMoveSessionUp={handleMoveSessionUp}
          onMoveSessionDown={handleMoveSessionDown}
          onUpdateTrainingDay={handleUpdateTrainingDay}
          dayMethodAssignments={dayMethodAssignments}
          onExerciseSelectionDataChange={(data) => {
            setExerciseSelectionData(data);
            const existing = localStorage.getItem('microcyclePlanningState');
            const parsed = existing ? JSON.parse(existing) : {};
            localStorage.setItem('microcyclePlanningState', JSON.stringify({ ...parsed, cellData: data }));
          }}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto py-6 space-y-6 px-4 w-full max-w-[98vw]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Microcycle Planning</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              saveCurrentSession();
              navigate("/templates/programs");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
          <SaveProgramButton />
          <ResourcesButton />
          <PlanningNavigationMenu currentPage="microcycle" currentPageStep={currentStep} onChangeCurrentPageStep={setCurrentStep} />
        </div>
      </div>

      <NavigationButtons />

      {renderTrainingPlanOverview()}
      
      {currentStep === 1 && (
        currentMesocycle ? (
          <MethodSessionArchitecture
            mesocycle={currentMesocycle}
            allMesocycles={mesocycles}
            trainingDays={trainingDays}
            methodAllocations={methodAllocations}
            dayMethodAssignments={dayMethodAssignments}
            onDayMethodAssignmentsChange={setDayMethodAssignments}
            sessionSections={sessionSections}
            onSectionsChange={setSessionSections}
            exerciseDistribution={exerciseDistribution}
            daySplitStates={daySplitStates}
            onDayIntensityChange={handleDayIntensityChange}
            onSessionIntensityChange={handleSessionIntensityChange}
            onAddSession={handleAddSession}
            onRemoveSession={handleRemoveSession}
            onRenameSession={handleRenameSession}
            intensityLevels={intensityLevels}
            getIntensityColor={getIntensityColor}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">No mesocycle data available</div>
        )
      )}

      {currentStep === 2 && renderMesocycleNavigation()}

      {currentStep === 2 && renderExerciseDistribution()}

      {currentStep === 3 && currentMesocycle && (
        <>
          <TrainingCalendarView
              exerciseDistribution={exerciseDistribution}
              trainingDays={currentMesocycleDays}
              currentMesocycle={currentMesocycle}
              mesocycles={mesocycles}
              onSessionDragEnd={handleSessionDragEnd}
              onDeleteSession={handleRemoveSession}
              onCopySession={handleCopySession}
              onPasteSession={handlePasteSession}
              copiedSession={copiedSession}
              onCopyWeek={handleCopyWeek}
              onClearWeek={handleClearWeek}
              onPasteWeek={handlePasteWeek}
              copiedWeek={copiedWeek}
              onCopyDay={handleCopyDay}
              onClearDay={handleClearDay}
              copiedDay={copiedDay}
              dailyIntensityData={dailyIntensityData}
              onIntensityChange={handleIntensityChange}
              onSessionIntensityChange={handleSessionIntensityChange}
              getIntensityColor={getIntensityColor}
              intensityLevels={intensityLevels}
              parameterValues={parameterValues}
              onSaveParameters={handleSaveParameters}
              onUpdateTestComment={handleUpdateTestComment}
              onUpdateTestValues={handleUpdateTestValues}
              onUpdateEventComment={handleUpdateEventComment}
              copiedSection={copiedSection}
              onCopySection={handleCopySection}
              onPasteSection={handlePasteSection}
              onMoveSessionUp={handleMoveSessionUp}
              onMoveSessionDown={handleMoveSessionDown}
              onRenameSession={handleRenameSession}
              sessionSections={sessionSections}
              supersets={supersets}
              onSectionsChange={setSessionSections}
              onSupersetsChange={setSupersets}
              onDistributionChange={(dist) => setExerciseDistribution(dist as ExerciseDistribution[])}
              onAddSession={handleAddSession}
              daySplitStates={daySplitStates}
              selectedAthleteId={selectedAthleteId}
              athletePerformanceParameters={selectedAthletePerformanceParameters}
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
