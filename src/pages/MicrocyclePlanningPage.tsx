import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { ArrowLeft, ArrowRight, Target, AlertTriangle, Info, Copy, ChevronDown, Columns, ChevronRight, X, Trash2, Trophy, Calendar, Check, FileText } from 'lucide-react';
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
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
import { ExportPDFButton } from '@/components/pdf/ExportPDFButton';
import { useWizardData } from '@/contexts/WizardDataContext';
import { WizardAIAssistant, FocusedSessionContext } from '@/components/wizard/WizardAIAssistant';
import { useRAGRetrieval } from '@/hooks/useRAGRetrieval';
import { useGlobalAIContext } from '@/hooks/useGlobalAIContext';
import { useCoachMemory } from '@/hooks/useCoachMemory';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';

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
  const { macrocycleData, setMacrocycleData, trainingDays, setTrainingDays } = useWizardData();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentMesocycleIndex, setCurrentMesocycleIndex] = useState(0);
  const [currentMicrocycleIndex, setCurrentMicrocycleIndex] = useState(0);
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [exerciseSelectionData, setExerciseSelectionData] = useState<Record<string, CellData>>({});
  const [exerciseDistribution, setExerciseDistribution] = useState<ExerciseDistribution[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({});
  const [dailyIntensityData, setDailyIntensityData] = useState<any[]>([]);
  const [daySplitStates, setDaySplitStates] = useState<Record<string, number>>({});
  const [splitStates, setSplitStates] = useState<Record<string, boolean>>({});
  const { data: toolboxData } = useToolboxData();
  const { athletes, athletePerformanceParameters } = useAthletes();
  const { saveCurrentSession } = useTrainingPrograms();
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  const { coachMemoryContext } = useCoachMemory({ currentMethods: macrocycleData?.selectedMethods ?? [] });
  const [aiOpenTrigger, setAiOpenTrigger] = useState(0);
  const [focusedSessionCtx, setFocusedSessionCtx] = useState<FocusedSessionContext | undefined>(undefined);
  const [paramRefreshTrigger, setParamRefreshTrigger] = useState(0);
  const [pdfExportProgram, setPdfExportProgram] = useState<TrainingProgram | null>(null);
  const [pdfExportOpen, setPdfExportOpen] = useState(false);
  const { libraries } = useCustomLibraries();

  // Resolve athlete name from selectedAthleteId
  const selectedAthleteId = macrocycleData?.selectedAthleteId;
  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);
  const athleteName = selectedAthlete ? getAthleteDisplayName(selectedAthlete) : undefined;
  
  // Filter athlete performance parameters for the selected athlete
  const selectedAthletePerformanceParameters = useMemo(() => {
    if (!selectedAthleteId) return [];
    return athletePerformanceParameters.filter(pp => pp.athleteId === selectedAthleteId);
  }, [athletePerformanceParameters, selectedAthleteId]);
  // RAG retrieval — refresh when selected methods or mesocycles change
  useEffect(() => {
    const methodNames = (macrocycleData?.selectedMethods ?? []).join(', ');
    const query = methodNames || 'session architecture exercise selection microcycle';
    ragRetrieve(query).then(setRagContext);
  }, [ragRetrieve, macrocycleData?.selectedMethods]);

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
  const [sessionCommentsRefreshKey, setSessionCommentsRefreshKey] = useState(0);

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
    const savedMesocycleData = localStorage.getItem('mesocycleData');
    const savedParameters = localStorage.getItem('parameterValues');
    const savedTrainingDays = localStorage.getItem('trainingDays');
    const savedMicrocycleStep = localStorage.getItem('microcycleStep');

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

    const parsedParams: Record<string, Record<number, Record<string, any>>> =
      savedParameters ? JSON.parse(savedParameters) : {};
    if (savedParameters) {
      setParameterValues(parsedParams);
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

    // Load method allocations (written by MesocyclePage, read-only here).
    // Validate against parameterValues: a method is only truly allocated to a mesocycle
    // if it has at least one entry in the periodization table for that mesocycle.
    // This removes stale entries that accumulated from old sessions or plan loads.
    const savedMethodAllocations = localStorage.getItem('methodAllocations');
    if (savedMethodAllocations) {
      try {
        const rawAllocations: Record<string, string[]> = JSON.parse(savedMethodAllocations);
        const validatedAllocations: Record<string, string[]> = {};
        Object.entries(rawAllocations).forEach(([methodId, mesoIds]) => {
          const validIds = mesoIds.filter(mesoId => {
            const mesoData = parsedParams[mesoId];
            if (!mesoData) return false;
            // Keep if this method appears in at least one microcycle slot of the meso
            return Object.values(mesoData).some(
              (microData: any) => microData && methodId in microData
            );
          });
          if (validIds.length > 0) validatedAllocations[methodId] = validIds;
        });
        setMethodAllocations(validatedAllocations);
      } catch { /* ignore */ }
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

    // Build an authoritative intensity map from dailyIntensityData
    // (more reliable than trainingDays which may carry stale intensity values)
    const intensityMapInit: Record<string, string> = {};
    if (savedDailyIntensity) {
      try {
        (JSON.parse(savedDailyIntensity) as Array<{ date: string; intensity: string }>)
          .forEach(di => { intensityMapInit[di.date] = di.intensity; });
      } catch { /* ignore */ }
    }

    // Load saved day split states and backfill any missing entries from trainingDays
    const savedDaySplitStates = localStorage.getItem('daySplitStates');
    const parsedSplitStates: Record<string, number> = savedDaySplitStates
      ? JSON.parse(savedDaySplitStates)
      : {};

    if (savedTrainingDays) {
      const loadedDays: any[] = JSON.parse(savedTrainingDays);
      loadedDays.forEach((day: any) => {
        const actualIntensity = intensityMapInit[day.date] ?? day.intensity;
        if (parsedSplitStates[day.date] === undefined) {
          // New entry: default to 0 for off days, 1 otherwise
          parsedSplitStates[day.date] = actualIntensity === 'off' ? 0 : (day.sessions ?? 1);
        } else if (actualIntensity === 'off' && parsedSplitStates[day.date] === 1) {
          // Existing auto-default of 1 on an off day — correct it to 0.
          // Values > 1 are treated as intentional manual overrides and left alone.
          parsedSplitStates[day.date] = 0;
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

      // Also sync daySplitStates: off days → 0 sessions, non-off days that
      // were 0 (because they were previously off) → 1 session.
      setDaySplitStates(prev => {
        const next = { ...prev };
        let changed = false;
        trainingDays.forEach(day => {
          const correctIntensity = intensityMap.get(day.date);
          if (correctIntensity && day.intensity !== correctIntensity) {
            if (correctIntensity === 'off') {
              next[day.date] = 0;
              changed = true;
            } else if (day.intensity === 'off' && (prev[day.date] ?? 0) === 0) {
              next[day.date] = 1;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
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

  // Auto-save to Supabase — debounced 3 s after any structural change so
  // navigating away mid-session never loses work (localStorage is always
  // up-to-date; this keeps Supabase in sync too)
  useEffect(() => {
    const timer = setTimeout(() => { saveCurrentSession(); }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseDistribution, sessionSections, supersets, dayMethodAssignments]);

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

    // Helper: normalize any date string (ISO or yyyy-MM-dd) to local yyyy-MM-dd.
    // Using local Date components avoids the UTC-midnight off-by-one that
    // d.split('T')[0] causes in UTC+ timezones.
    const toDateKey = (d: string): string => {
      if (!d) return d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const dt = new Date(d);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const testMap = new Map<string, string[]>();
    // Primary SMART goal tests
    (macrocycleData.smartGoals || []).forEach((sg: any) => {
      const name = sg.description || 'Test';
      (sg.testDates || []).forEach((dateStr: string) => {
        const key = toDateKey(dateStr);
        const existing = testMap.get(key) || [];
        if (!existing.includes(name)) testMap.set(key, [...existing, name]);
      });
    });
    // Sub-goal tests
    (macrocycleData.subGoals || []).forEach((sg: any) => {
      const name = sg.testMethod || sg.name || sg.testName || sg.method || sg.description || 'Test';
      (sg.testDates || []).forEach((dateStr: string) => {
        const key = toDateKey(dateStr);
        const existing = testMap.get(key) || [];
        if (!existing.includes(name)) testMap.set(key, [...existing, name]);
      });
    });
    // Include athlete's existing tests from calendar assignments
    (macrocycleData.athleteExistingTests || []).forEach((t: any) => {
      const name = t.testMethod || 'Test';
      (t.testDates || []).forEach((dateStr: string) => {
        const key = toDateKey(dateStr);
        const existing = testMap.get(key) || [];
        if (!existing.includes(name)) testMap.set(key, [...existing, name]);
      });
    });

    const eventMap = new Map<string, string[]>();
    (macrocycleData.events || []).forEach((e: any) => {
      const name = e.name || e.eventName || e.title || e.description || 'Event';
      (e.eventDates || []).forEach((dateStr: string) => {
        const key = toDateKey(dateStr);
        const existing = eventMap.get(key) || [];
        if (!existing.includes(name)) eventMap.set(key, [...existing, name]);
      });
    });
    // Include athlete's existing events from calendar assignments
    (macrocycleData.athleteExistingEvents || []).forEach((e: any) => {
      const name = e.name || 'Event';
      (e.eventDates || []).forEach((dateStr: string) => {
        const key = toDateKey(dateStr);
        const existing = eventMap.get(key) || [];
        if (!existing.includes(name)) eventMap.set(key, [...existing, name]);
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

  // Derive method → exercise-categories map from toolbox database definitions.
  // Keyed by BASE method name (no :: suffix), split-state-independent.
  // Uses toolboxData (same source as MesocyclePage's getMethodExerciseCategories) so categories
  // are always available regardless of whether exercises have been selected in step 6.
  const methodExerciseCategories = useMemo((): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    const entries = toolboxData?.entries ?? [];
    entries.forEach(entry => {
      if (!entry.exerciseCategories || entry.exerciseCategories.length === 0) return;
      const methodKey = entry.subCategory
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      result[methodKey] = [...new Set([...(result[methodKey] ?? []), ...entry.exerciseCategories])];
    });
    return result;
  }, [toolboxData]);

  // Resolved method allocations: normalise split keys AND supplement from parameterValues.
  // This guarantees the left panel shows base method names (e.g. "Strength") even when the
  // periodization table is in split mode (where parameterValues stores "Strength::Squat" etc.).
  const resolvedMethodAllocations = useMemo((): Record<string, string[]> => {
    const result: Record<string, string[]> = {};

    // 1. Normalise existing methodAllocations (strip any accidental ::category suffix)
    Object.entries(methodAllocations).forEach(([key, mesoIds]) => {
      const base = key.split('::')[0];
      result[base] = [...new Set([...(result[base] ?? []), ...mesoIds])];
    });

    // 2. Supplement from parameterValues – handles the case where methodAllocations is stale
    //    or empty but parameterValues already has method keys for specific mesocycles.
    mesocycles.forEach(meso => {
      const mesoData = parameterValues[meso.id];
      if (!mesoData) return;
      Object.values(mesoData).forEach(microData => {
        if (!microData || typeof microData !== 'object') return;
        Object.keys(microData).forEach(methodKey => {
          const base = methodKey.split('::')[0];
          if (!result[base]) result[base] = [];
          if (!result[base].includes(meso.id)) result[base].push(meso.id);
        });
      });
    });

    return result;
  }, [methodAllocations, parameterValues, mesocycles]);

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

    if (!trainingDays.some(d => d.date === targetDate)) {
      toast({ title: "Cannot paste outside plan date range", variant: "destructive" });
      return;
    }
    
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

    // Reject if any target date falls outside the plan's date range
    const planDates = new Set(trainingDays.map(d => d.date));
    const sourceDates = Object.keys(copiedWeek.sessionStructure);
    const allTargetDatesInPlan = sourceDates.every(srcDate =>
      planDates.has(format(addDays(parseISO(srcDate), dayOffset), 'yyyy-MM-dd'))
    );
    if (!allTargetDatesInPlan) {
      toast({ title: "Cannot paste outside plan date range", variant: "destructive" });
      return;
    }
    
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
              testDates: (sg.testDates || []).filter((date: string) => date.split('T')[0] !== dayDate)
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
              eventDates: (e.eventDates || []).filter((date: string) => date.split('T')[0] !== dayDate)
            };
          }
          return e;
        });
      }
      
      setMacrocycleData(updatedMacrocycle);
    }

    toast({
      title: `${type === 'test' ? 'Test' : 'Event'} deleted`,
      description: `${name} removed from ${format(parseISO(dayDate), 'PPP')}`,
    });
  };

  // Handle update test comment
  const handleUpdateTestComment = (testId: string, comments: string) => {
    if (macrocycleData) {
      try {
        const data = { ...macrocycleData };
        const updatedSubGoals = (data.subGoals || []).map((sg: any) =>
          sg.id === testId ? { ...sg, comments } : sg
        );
        data.subGoals = updatedSubGoals;

        // Update context state (context setter writes to localStorage)
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
    if (macrocycleData) {
      try {
        const data = { ...macrocycleData };
        const updatedSubGoals = (data.subGoals || []).map((sg: any) =>
          sg.id === testId ? { ...sg, ...updates } : sg
        );
        data.subGoals = updatedSubGoals;
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
    if (macrocycleData) {
      try {
        const data = { ...macrocycleData };
        const updatedEvents = (data.events || []).map((ev: any) =>
          ev.id === eventId ? { ...ev, comments } : ev
        );
        data.events = updatedEvents;

        // Update context state (context setter writes to localStorage)
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

    // Also update trainingDays so it stays in sync with dailyIntensityData
    // (prevents stale intensity in localStorage.trainingDays on next reload)
    setTrainingDays(prev =>
      prev.map(td => td.date === date ? { ...td, intensity } : td)
    );

    // For single-session days, also sync the session intensity
    const day = trainingDays.find(d => d.date === date);
    const sessionCount = day?.sessions ?? 1;
    if (sessionCount === 1 && currentMesocycle) {
      const sessionKey = `sessionIntensity_${currentMesocycle.id}_${date}_0`;
      localStorage.setItem(sessionKey, intensity);
    }

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

  const stepLabels: Record<number, string> = {
    1: 'Step 1 of 3 — Method Distribution',
    2: 'Step 2 of 3 — Exercise Distribution',
    3: 'Step 3 of 3 — Training Calendar',
  };

  const goToStep = (step: number) => {
    const clamped = Math.min(totalSteps, Math.max(1, step));
    setCurrentStep(clamped);
    localStorage.setItem('microcycleStep', String(clamped));
    localStorage.setItem('microcyclePlanningVersion', '2');
  };

  const NavigationButtons = () => {
    const isLastStep = currentStep >= totalSteps;

    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground text-center font-medium">
          {stepLabels[currentStep]}
        </p>
        <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full">
          <Button
            onClick={() => {
              if (currentStep <= 1) {
                localStorage.setItem('mesocycleStep', '5');
                navigate('/mesocycle');
              } else {
                goToStep(currentStep - 1);
              }
            }}
            variant="outline"
            className="w-full md:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {currentStep <= 1 ? "Back to Mesocycle Planning" : "Previous"}
          </Button>

          {isLastStep ? (
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={async () => {
                  const program = await saveCurrentSession();
                  setPdfExportProgram(program);
                  setPdfExportOpen(true);
                }}
                className="w-full md:w-auto"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
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
            </div>
          ) : (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              className="w-full md:w-auto"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
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
          setMacrocycleData({ ...macrocycleData, planNotes: notes });
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
              onClick={() => { setCurrentMesocycleIndex(index); setCurrentMicrocycleIndex(0); }}
              className="min-w-[100px] shrink-0"
            >
              {meso.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMicrocycleNavigation = () => {
    const microcycles = currentMesocycle?.microcycles ?? [];
    if (microcycles.length <= 1) return null;
    return (
      <div className="flex items-center justify-center mb-4">
        <div className="overflow-x-auto scrollbar-thin max-w-full">
          <div className="flex items-center justify-center gap-2 px-2">
            {microcycles.map((micro, index) => (
              <Button
                key={micro.id}
                variant={index === currentMicrocycleIndex ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentMicrocycleIndex(index)}
                className="min-w-[90px] shrink-0"
              >
                {micro.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
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
          selectedMicrocycleIndex={currentMicrocycleIndex}
          onSelectedMicrocycleIndexChange={setCurrentMicrocycleIndex}
          methodAllocations={methodAllocations}
          methodExerciseCategories={methodExerciseCategories}
          sessionCommentsRefreshKey={sessionCommentsRefreshKey}
        />
      </div>
    );
  };

  // ── AI Assistant ────────────────────────────────────────────────────────────
  const microStepLabels = [
    "Method Distribution to Training Days",
    "Exercise Distribution",
    "Training Calendar",
  ];
  const microStepLabel = microStepLabels[currentStep - 1] ?? `Step ${currentStep}`;

  const microWizardContext = useMemo(() => {
    const athleteStr = athleteName ? `Athlete: ${athleteName}` : "No athlete selected";
    const planStr = macrocycleData?.planName ? `Plan: ${macrocycleData.planName}` : "";
    const goalStr = macrocycleData?.smartGoals?.[0]?.description
      ? `Primary goal: ${macrocycleData.smartGoals[0].description}`
      : "";
    const mesoCount = mesocycles.length;
    const mesoStr = mesoCount > 0
      ? `Mesocycles: ${mesoCount} (${mesocycles.map((m: { name: string }) => m.name).join(", ")})`
      : "No mesocycles";
    const currentMeso = mesocycles[currentMesocycleIndex];
    const currentMesoStr = currentMeso ? `Current mesocycle: ${currentMeso.name}` : "";
    const viewedMicro = (currentMeso?.microcycles?.[currentMicrocycleIndex] as { id: string; name?: string } | undefined);
    const currentMicroStr = viewedMicro
      ? `Current microcycle being viewed: ${viewedMicro.name ?? `Microcycle ${currentMicrocycleIndex + 1}`} (${currentMicrocycleIndex + 1} of ${currentMeso?.microcycles?.length ?? 1} in this mesocycle)`
      : "";
    const assignedDays = Object.keys(dayMethodAssignments).filter(
      (d) => dayMethodAssignments[d]?.length > 0
    ).length;
    const dayStr = assignedDays > 0
      ? `Training days with methods assigned: ${assignedDays}`
      : "No method-day assignments yet";
    const availableMethods = Object.keys(resolvedMethodAllocations).filter(
      (m) => resolvedMethodAllocations[m]?.length > 0
    );
    const methodsStr = availableMethods.length
      ? `Training methods in this plan (use these EXACT names in assign_methods_to_days):\n${availableMethods.map((m) => {
          const cats = methodExerciseCategories[m];
          if (cats && cats.length > 0) {
            return `- ${m} [split into categories: ${cats.join(', ')}] → assign each as "${m}::CategoryName" (e.g. "${m}::${cats[0]}")`;
          }
          return `- ${m}`;
        }).join("\n")}`
      : "";
    const offDays = trainingDays
      .filter(d => d.intensity === 'off')
      .map(d => format(parseISO(d.date), 'EEEE'))
      .filter((v, i, a) => a.indexOf(v) === i);
    const offDaysStr = offDays.length ? `Rest days (off): ${offDays.join(", ")}` : "";
    const stepHint = currentStep === 1
      ? `Goal: assign methods to training days. Do NOT assign methods to rest/off days (${offDays.join(", ") || "none"}).`
      : currentStep === 2
      ? "Goal: assign exercises from the exercise library to specific training day sessions. Use the distribute_exercises action to assign exercises directly to dates — you have the full schedule with exact dates above. Do NOT say this is impossible."
      : "Goal: review, refine, and manipulate the final training calendar. Available actions: set_day_intensity, set_session_intensity, set_exercise_params, rename_session, delete_session, create_section, delete_section, rename_section, set_note, add_exercise, add_circuit, create_superset, break_superset, move_exercise, move_exercises, copy_session, copy_section, copy_week, clear_week. Use exact IDs and dates from the Training Calendar below.";

    // All steps: method parameter values from the periodization table (all microcycles of current meso)
    let parameterTableStr = '';
    if (currentMeso) {
      const mesoParams = parameterValues[currentMeso.id] ?? {};
      const tableLines: string[] = [`Method parameters for ${currentMeso.name} (from periodization table — Sets, Reps, Intensity per microcycle/session):`];
      const micros = (currentMeso.microcycles ?? []) as Array<{ id: string; name?: string }>;
      micros.forEach((micro, mIdx) => {
        const slotData = mesoParams[mIdx] as Record<string, Record<number, Record<string, string | number>>> | undefined;
        if (!slotData || Object.keys(slotData).length === 0) return;
        const microLabel = micro.name ?? `Microcycle ${mIdx + 1}`;
        const methodLines: string[] = [];
        Object.entries(slotData).forEach(([methodId, sessions]) => {
          const sessionEntries = Object.entries(sessions as Record<number, Record<string, string | number>>)
            .sort(([a], [b]) => Number(a) - Number(b));
          sessionEntries.forEach(([sIdx, params]) => {
            const paramStr = Object.entries(params)
              .filter(([k]) => !k.endsWith('_unit'))
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (paramStr) {
              const sessionLabel = sessionEntries.length > 1 ? ` session ${Number(sIdx) + 1}` : '';
              methodLines.push(`    ${methodId}${sessionLabel}: ${paramStr}`);
            }
          });
        });
        if (methodLines.length) tableLines.push(`  ${microLabel}:\n${methodLines.join('\n')}`);
      });
      if (tableLines.length > 1) parameterTableStr = tableLines.join('\n');
    }

    // Steps 2 & 3: build available exercises + circuits (always available for add_exercise/add_circuit)
    let exercisesStr = '';
    let circuitsStr = '';
    if ((currentStep === 2 || currentStep === 3) && currentMeso) {
      // Available exercises per method/category from Step 5 selections (current meso)
      const exByMethod: Record<string, Record<string, Array<{ exerciseId: string; exerciseName: string }>>> = {};
      Object.values(exerciseSelectionData).forEach(cell => {
        if (cell.mesocycleId !== currentMeso.id) return;
        const method = cell.methodId;
        const cat = cell.categoryName || '';
        if (!exByMethod[method]) exByMethod[method] = {};
        if (!exByMethod[method][cat]) exByMethod[method][cat] = [];
        cell.exercises.forEach(ex => {
          if (!exByMethod[method][cat].find((e: { exerciseId: string }) => e.exerciseId === ex.exerciseId)) {
            exByMethod[method][cat].push({ exerciseId: ex.exerciseId, exerciseName: ex.exerciseName });
          }
        });
      });
      if (Object.keys(exByMethod).length > 0) {
        const lines = [`Available exercises for ${currentMeso.name}:`];
        Object.entries(exByMethod).forEach(([method, cats]) => {
          lines.push(`  Method: "${method}"`);
          Object.entries(cats).forEach(([cat, exs]) => {
            const catLabel = cat ? `Category: "${cat}"` : '(no category)';
            const exList = exs.map(e => `${e.exerciseName} (id: ${e.exerciseId})`).join(', ');
            lines.push(`    ${catLabel}: ${exList}`);
          });
        });
        exercisesStr = lines.join('\n');
      }

      // Available circuits from all exercise libraries
      const allCircuits = libraries.flatMap(lib =>
        (lib.circuits ?? []).map(c => ({ lib, circuit: c }))
      );
      if (allCircuits.length > 0) {
        const circuitLines = [`Available circuits:`];
        allCircuits.forEach(({ lib, circuit }) => {
          const exList = circuit.exercises.map((e: { name: string }) => e.name).join(', ');
          circuitLines.push(`  "${circuit.name}" (circuitId: ${circuit.id}, libraryId: ${lib.id}) — exercises: ${exList || '(none)'}`);
        });
        circuitsStr = circuitLines.join('\n');
      }
    }

    // Step 2: current-microcycle schedule + distributed exercises
    let scheduleStr = '';
    if (currentStep === 2 && currentMeso) {
      const currentMicro = currentMeso.microcycles?.[currentMicrocycleIndex] as { id: string; name?: string } | undefined;
      const microDays = currentMicro
        ? trainingDays.filter(d => d.microcycleId === currentMicro.id)
        : [];
      if (microDays.length > 0) {
        const firstDate = microDays[0].date;
        const lastDate = microDays[microDays.length - 1].date;
        const scheduleLines = [
          `Training schedule — ${currentMicro?.name ?? 'current microcycle'} (${firstDate} to ${lastDate}). Use these exact YYYY-MM-DD dates in distribute_exercises:`
        ];
        microDays.forEach(day => {
          const label = format(new Date(day.date + 'T12:00:00'), 'EEE dd MMM');
          if (day.intensity === 'off') {
            scheduleLines.push(`  ${day.date} (${label}): REST`);
          } else {
            const sessionCount = day.sessions ?? 1;
            const sessionParts: string[] = [];
            for (let s = 0; s < sessionCount; s++) {
              const key = `${day.date}_${s}`;
              const methods = dayMethodAssignments[key] ?? [];
              const sessionName = day.sessionNames?.[s] ?? `Session ${s + 1}`;
              sessionParts.push(`session ${s} "${sessionName}": [${methods.join(', ') || 'no method assigned'}]`);
            }
            scheduleLines.push(`  ${day.date} (${label}): ${sessionParts.join(' | ')}`);
          }
        });
        scheduleStr = scheduleLines.join('\n');
      }

      // Distributed exercises — what's already on each day/session
      const microDates2 = new Set(
        currentMicro
          ? trainingDays.filter(d => d.microcycleId === currentMicro.id).map(d => d.date)
          : []
      );
      const distributed = exerciseDistribution.filter(e => microDates2.has(e.dayDate));
      if (distributed.length > 0) {
        const bySlot: Record<string, Array<{ id: string; name: string; methodId: string; sectionName?: string }>> = {};
        distributed.forEach(e => {
          const key = `${e.dayDate}_${e.sessionIndex ?? 0}`;
          if (!bySlot[key]) bySlot[key] = [];
          const sectionName = e.sectionId
            ? sessionSections.find(s => s.id === e.sectionId)?.name
            : undefined;
          bySlot[key].push({ id: e.id, name: e.exerciseName, methodId: e.methodId, sectionName });
        });
        const distLines = [`Exercises already distributed in current microcycle (use these exact entry ids for move_exercise, create_superset, set_note):`];
        Object.entries(bySlot).sort().forEach(([key, exs]) => {
          const [date, si] = key.split('_');
          const sessionIdx = Number(si);
          const sectionNames = sessionSections
            .filter(s => s.dayDate === date && s.sessionIndex === sessionIdx)
            .sort((a, b) => a.order - b.order)
            .map(s => s.name);
          const sectionInfo = sectionNames.length ? ` [sections: ${sectionNames.join(', ')}]` : '';
          distLines.push(`  ${date} session ${sessionIdx}${sectionInfo}: ${exs.map(e => `${e.name} (id: ${e.id}, method: ${e.methodId}${e.sectionName ? `, section: ${e.sectionName}` : ''})`).join(', ')}`);
        });
        scheduleStr = scheduleStr ? scheduleStr + '\n\n' + distLines.join('\n') : distLines.join('\n');
      }
    }

    // Step 3: full training calendar across ALL mesocycles / microcycles
    let calendarStr = '';
    if (currentStep === 3) {
      const calLines = ['## Full Training Calendar (use exact dates, ids, and names for all actions)'];
      mesocycles.forEach(meso => {
        calLines.push(`\n### ${meso.name}`);
        const micros = (meso.microcycles ?? []) as Array<{ id: string; name?: string }>;
        micros.forEach((micro, mIdx) => {
          const microDays = trainingDays.filter(d => d.microcycleId === micro.id);
          if (microDays.length === 0) return;
          const firstDate = microDays[0].date;
          const lastDate = microDays[microDays.length - 1].date;
          calLines.push(`\n#### ${micro.name ?? `Microcycle ${mIdx + 1}`} (${firstDate} → ${lastDate})`);
          microDays.forEach(day => {
            const label = format(new Date(day.date + 'T12:00:00'), 'EEE dd MMM');
            if (day.intensity === 'off') {
              calLines.push(`  ${day.date} (${label}): REST`);
              return;
            }
            calLines.push(`  ${day.date} (${label}) [day intensity: ${day.intensity}]`);
            const sessionCount = day.sessions ?? 1;
            for (let s = 0; s < sessionCount; s++) {
              const slotKey = `${day.date}_${s}`;
              const methods = dayMethodAssignments[slotKey] ?? [];
              const sessionName = day.sessionNames?.[s] ?? `Session ${s + 1}`;
              // Read session intensity from localStorage
              const siKey = `sessionIntensity_${meso.id}_${day.date}_${s}`;
              const sessionIntensity = localStorage.getItem(siKey);
              const intensityNote = sessionIntensity ? ` [session intensity: ${sessionIntensity}]` : '';
              // Read session comment from localStorage
              const wsKey = `workoutSessions_${meso.id}_${day.date}_${s}`;
              let sessionComment = '';
              try {
                const ws = JSON.parse(localStorage.getItem(wsKey) ?? '{}');
                if (ws.comments) sessionComment = ` [note: "${ws.comments}"]`;
              } catch { /* ignore */ }
              calLines.push(`    Session ${s} "${sessionName}" [methods: ${methods.join(', ') || 'none'}]${intensityNote}${sessionComment}`);
              // Sections in this session
              const sections = sessionSections
                .filter(sec => sec.dayDate === day.date && sec.sessionIndex === s)
                .sort((a, b) => a.order - b.order);
              // Exercises in this session grouped by section
              const sessionExercises = exerciseDistribution.filter(
                e => e.dayDate === day.date && (e.sessionIndex ?? 0) === s
              );
              if (sections.length > 0) {
                sections.forEach(sec => {
                  const secNote = sec.comments ? ` [note: "${sec.comments}"]` : '';
                  calLines.push(`      Section: "${sec.name}"${secNote} (sectionId: ${sec.id})`);
                  const secExs = sessionExercises.filter(e => e.sectionId === sec.id);
                  secExs.forEach(e => {
                    const exNote = e.notes ? ` [note: "${e.notes}"]` : '';
                    calLines.push(`        - ${e.exerciseName} (id: ${e.id}, method: ${e.methodId})${exNote}`);
                  });
                });
                // Exercises not in any section
                const unsectioned = sessionExercises.filter(e => !e.sectionId || !sections.find(sec => sec.id === e.sectionId));
                unsectioned.forEach(e => {
                  const exNote = e.notes ? ` [note: "${e.notes}"]` : '';
                  calLines.push(`      - ${e.exerciseName} (id: ${e.id}, method: ${e.methodId}) [no section]${exNote}`);
                });
              } else if (sessionExercises.length > 0) {
                sessionExercises.forEach(e => {
                  const exNote = e.notes ? ` [note: "${e.notes}"]` : '';
                  calLines.push(`      - ${e.exerciseName} (id: ${e.id}, method: ${e.methodId})${exNote}`);
                });
              } else {
                calLines.push(`      (no exercises yet)`);
              }
            }
          });
        });
      });
      calendarStr = calLines.join('\n');
    }

    // Step 2: prepend a hard override so the AI doesn't fall back to "hierarchy" explanation
    const step2Override = currentStep === 2
      ? `⚠️ CAPABILITY OVERRIDE — READ THIS FIRST:
You are in Exercise Distribution (Phase 3 Step 2). You HAVE the ability to assign exercises to specific calendar dates using the distribute_exercises action. This is a direct date placement feature — it works even if a day shows "no method assigned".
When the coach says "assign X to [date]" or "put X on [date]" — immediately produce [[APPLY: {"type":"distribute_exercises","replace":false,"entries":[{"exerciseId":"<id from Available exercises below>","exerciseName":"<name>","methodId":"<method from Available exercises below>","dayDate":"YYYY-MM-DD","sessionIndex":0}]}]].
Do NOT explain the hierarchy. Do NOT say this is impossible. Use the exact YYYY-MM-DD dates from the training schedule below.`
      : '';

    return [
      step2Override,
      `Current step: ${microStepLabel}`,
      athleteStr,
      planStr,
      goalStr,
      mesoStr,
      currentMesoStr,
      currentMicroStr,
      methodsStr,
      dayStr,
      offDaysStr,
      exercisesStr,
      circuitsStr,
      parameterTableStr,
      scheduleStr,
      calendarStr,
      stepHint,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [currentStep, athleteName, macrocycleData, mesocycles, currentMesocycleIndex, currentMicrocycleIndex, dayMethodAssignments, resolvedMethodAllocations, trainingDays, microStepLabel, exerciseSelectionData, exerciseDistribution, sessionSections, libraries, parameterValues]);

  const handleMicroAIApply = useCallback((action: import("@/components/wizard/WizardAIAssistant").ApplySuggestion) => {
    if (action.type === "assign_methods_to_days") {
      const dayNameMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      };
      const currentMeso = mesocycles[currentMesocycleIndex];
      if (!currentMeso) return;

      const targetDays = trainingDays.filter(d => {
        if (d.intensity === 'off') return false;
        if (action.microcycleIndex != null) {
          const micro = currentMeso.microcycles?.[action.microcycleIndex - 1];
          if (!micro || d.microcycleId !== micro.id) return false;
        } else {
          if (!currentMeso.microcycles?.some((m: { id: string }) => m.id === d.microcycleId)) return false;
        }
        return true;
      });

      const newAssignments = { ...dayMethodAssignments };
      action.weekPattern.forEach(({ method, days }) => {
        const dayNums = days.map(d => dayNameMap[d]).filter(n => n != null);
        targetDays.forEach(day => {
          const date = new Date(day.date + 'T00:00:00');
          if (!dayNums.includes(date.getDay())) return;
          const key = `${day.date}_0`;
          const current = newAssignments[key] ?? [];
          if (!current.includes(method)) {
            newAssignments[key] = [...current, method];
          }
        });
      });
      setDayMethodAssignments(newAssignments);
      localStorage.setItem('dayMethodAssignments', JSON.stringify(newAssignments));
    } else if (action.type === "distribute_exercises") {
      const currentMeso = mesocycles[currentMesocycleIndex];
      if (!currentMeso) return;

      // Build set of valid dates for the current mesocycle
      const mesoDateSet = new Set(
        trainingDays
          .filter(d => currentMeso.microcycles?.some((m: { id: string }) => m.id === d.microcycleId))
          .map(d => d.date)
      );

      // Optionally clear existing distribution for this mesocycle first
      const base = action.replace
        ? exerciseDistribution.filter(e => !mesoDateSet.has(e.dayDate))
        : [...exerciseDistribution];

      // Track next order per day/session slot
      const orderCounters: Record<string, number> = {};
      base.forEach(e => {
        const k = `${e.dayDate}_${e.sessionIndex}`;
        orderCounters[k] = Math.max(orderCounters[k] ?? 0, e.order + 1);
      });

      const skippedDates: string[] = [];
      const methodMismatches: string[] = [];

      const newEntries: ExerciseDistribution[] = action.entries
        .filter(e => {
          if (!mesoDateSet.has(e.dayDate)) {
            skippedDates.push(`${e.exerciseName} (${e.dayDate} not in mesocycle)`);
            return false;
          }
          return true;
        })
        .map(e => {
          const sessionIndex = e.sessionIndex ?? 0;
          const sessionKey = `${e.dayDate}_${sessionIndex}`;
          const assignedMethods = dayMethodAssignments[sessionKey] ?? [];
          // Check: is this exercise's method (or its base without ::Category) assigned to this day/session?
          const baseMethodId = e.methodId.includes('::') ? e.methodId.split('::')[0] : e.methodId;
          const methodOnDay = assignedMethods.some(m =>
            m === e.methodId || m === baseMethodId || e.methodId.startsWith(m + '::')
          );
          if (!methodOnDay && assignedMethods.length > 0) {
            methodMismatches.push(
              `"${e.exerciseName}" → ${e.dayDate} session ${sessionIndex}: method "${baseMethodId}" not assigned (assigned: ${assignedMethods.join(', ')})`
            );
          }
          const k = `${e.dayDate}_${sessionIndex}`;
          const order = orderCounters[k] ?? 0;
          orderCounters[k] = order + 1;
          return {
            id: `dist-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            methodId: e.methodId,
            categoryName: e.categoryName ?? '',
            dayDate: e.dayDate,
            sessionIndex,
            order,
          };
        });

      if (skippedDates.length > 0) {
        toast({
          title: `${skippedDates.length} exercise${skippedDates.length > 1 ? 's' : ''} skipped`,
          description: skippedDates.slice(0, 3).join('\n') + (skippedDates.length > 3 ? `\n…and ${skippedDates.length - 3} more` : ''),
          variant: 'destructive',
        });
      }
      if (methodMismatches.length > 0) {
        toast({
          title: `Method mismatch on ${methodMismatches.length} exercise${methodMismatches.length > 1 ? 's' : ''}`,
          description: methodMismatches.slice(0, 2).join('\n') + (methodMismatches.length > 2 ? `\n…and ${methodMismatches.length - 2} more` : ''),
          variant: 'destructive',
        });
      }

      if (newEntries.length > 0) {
        const updated = [...base, ...newEntries];
        setExerciseDistribution(updated);
        localStorage.setItem('exerciseDistribution', JSON.stringify(updated));
        if (skippedDates.length === 0 && methodMismatches.length === 0) {
          toast({
            title: `${newEntries.length} exercise${newEntries.length > 1 ? 's' : ''} distributed`,
            description: `Added to ${[...new Set(newEntries.map(e => e.dayDate))].length} training day${[...new Set(newEntries.map(e => e.dayDate))].length > 1 ? 's' : ''}.`,
          });
        }
      }
    } else if (action.type === "create_section") {
      const { dayDate, sessionIndex, name, note } = action;
      const existingForSlot = sessionSections.filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex);
      const maxOrder = existingForSlot.reduce((m, s) => Math.max(m, s.order), -1);
      const newSection: SessionSection = {
        id: `section-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dayDate,
        sessionIndex,
        name,
        order: maxOrder + 1,
        ...(note ? { comments: note } : {}),
      };
      const updatedSections = [...sessionSections, newSection];
      setSessionSections(updatedSections);
      localStorage.setItem('sessionSections', JSON.stringify(updatedSections));
      toast({ title: `Section "${name}" created` });

    } else if (action.type === "delete_section") {
      const { dayDate, sessionIndex, sectionName } = action;
      const targetSection = sessionSections.find(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex && s.name === sectionName
      );
      const updatedSections = sessionSections.filter(s => s !== targetSection);
      setSessionSections(updatedSections);
      localStorage.setItem('sessionSections', JSON.stringify(updatedSections));
      // Also remove all exercises belonging to this section
      if (targetSection) {
        setExerciseDistribution(prev => {
          const u = prev.filter(e => e.sectionId !== targetSection.id);
          localStorage.setItem('exerciseDistribution', JSON.stringify(u));
          return u;
        });
        setSupersets(prev => {
          const next = prev ? JSON.parse(JSON.stringify(prev)) : {};
          if (next[dayDate]?.[sessionIndex]?.[targetSection.id]) {
            delete next[dayDate][sessionIndex][targetSection.id];
          }
          localStorage.setItem('supersets', JSON.stringify(next));
          return next;
        });
      }
      toast({ title: `Section "${sectionName}" and its exercises deleted` });

    } else if (action.type === "rename_section") {
      const { dayDate, sessionIndex, sectionName, newName } = action;
      const updatedSections = sessionSections.map(s =>
        s.dayDate === dayDate && s.sessionIndex === sessionIndex && s.name === sectionName
          ? { ...s, name: newName }
          : s
      );
      setSessionSections(updatedSections);
      localStorage.setItem('sessionSections', JSON.stringify(updatedSections));
      toast({ title: `Section renamed to "${newName}"` });

    } else if (action.type === "set_note") {
      const { target, dayDate, sessionIndex, note } = action;
      if (target === "exercise" && action.exerciseId) {
        const updatedDist = exerciseDistribution.map(e =>
          e.id === action.exerciseId && e.dayDate === dayDate && e.sessionIndex === sessionIndex
            ? { ...e, notes: note }
            : e
        );
        setExerciseDistribution(updatedDist);
        localStorage.setItem('exerciseDistribution', JSON.stringify(updatedDist));
        toast({ title: "Exercise note updated" });
      } else if (target === "section" && action.sectionName) {
        const updatedSections = sessionSections.map(s =>
          s.dayDate === dayDate && s.sessionIndex === sessionIndex && s.name === action.sectionName
            ? { ...s, comments: note }
            : s
        );
        setSessionSections(updatedSections);
        localStorage.setItem('sessionSections', JSON.stringify(updatedSections));
        toast({ title: "Section note updated" });
      } else if (target === "session") {
        const currentMeso = mesocycles[currentMesocycleIndex];
        if (currentMeso) {
          const wsKey = `workoutSessions_${currentMeso.id}_${dayDate}_${sessionIndex}`;
          let existing: Record<string, unknown> = {};
          try { existing = JSON.parse(localStorage.getItem(wsKey) ?? '{}'); } catch {}
          localStorage.setItem(wsKey, JSON.stringify({ ...existing, comments: note }));
          setSessionCommentsRefreshKey(k => k + 1);
          toast({ title: "Session note updated" });
        }
      }

    } else if (action.type === "create_superset") {
      const { dayDate, sessionIndex, exerciseIds } = action;
      if (exerciseIds.length < 2) return;
      const next: SupersetMapping = supersets ? JSON.parse(JSON.stringify(supersets)) : {};
      if (!next[dayDate]) next[dayDate] = {};
      if (!next[dayDate][sessionIndex]) next[dayDate][sessionIndex] = {};
      const sectionKey = '__unsectioned__';
      if (!next[dayDate][sessionIndex][sectionKey]) next[dayDate][sessionIndex][sectionKey] = {};
      const sectionMap = next[dayDate][sessionIndex][sectionKey];
      // Remove target exercises from any existing supersets in this session
      Object.keys(sectionMap).forEach(ssId => {
        sectionMap[ssId] = sectionMap[ssId].filter((id: string) => !exerciseIds.includes(id));
        if (sectionMap[ssId].length < 2) delete sectionMap[ssId];
      });
      const newSsId = `ss-ai-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      sectionMap[newSsId] = [...exerciseIds];
      setSupersets(next);
      localStorage.setItem('supersets', JSON.stringify(next));
      toast({ title: `Superset created with ${exerciseIds.length} exercises` });

    } else if (action.type === "break_superset") {
      const { dayDate, sessionIndex, exerciseId } = action;
      const next: SupersetMapping = supersets ? JSON.parse(JSON.stringify(supersets)) : {};
      const daySessionMap = next[dayDate]?.[sessionIndex];
      if (daySessionMap) {
        Object.keys(daySessionMap).forEach(sectionKey => {
          Object.keys(daySessionMap[sectionKey]).forEach(ssId => {
            const idx = daySessionMap[sectionKey][ssId].indexOf(exerciseId);
            if (idx !== -1) {
              daySessionMap[sectionKey][ssId].splice(idx, 1);
              if (daySessionMap[sectionKey][ssId].length < 2) delete daySessionMap[sectionKey][ssId];
            }
          });
        });
        setSupersets(next);
        localStorage.setItem('supersets', JSON.stringify(next));
        toast({ title: "Exercise removed from superset" });
      }

    } else if (action.type === "move_exercise") {
      const { exerciseId, targetDayDate, targetSessionIndex, targetSectionName } = action;
      // Read entry for toast label and superset cleanup — safe to read from closure
      const entry = exerciseDistribution.find(e => e.id === exerciseId);
      if (!entry) { toast({ title: "Exercise not found", variant: "destructive" }); return; }

      const targetSectionId = targetSectionName
        ? sessionSections.find(s => s.dayDate === targetDayDate && s.sessionIndex === targetSessionIndex && s.name === targetSectionName)?.id
        : undefined;

      // Use functional updaters so rapid back-to-back Assign clicks compose
      // correctly instead of each overwriting the previous with stale state
      setExerciseDistribution(prev => {
        const targetExs = prev.filter(
          e => e.dayDate === targetDayDate && e.sessionIndex === targetSessionIndex &&
            (targetSectionId ? e.sectionId === targetSectionId : !e.sectionId)
        );
        const newOrder = targetExs.length > 0 ? Math.max(...targetExs.map(e => e.order)) + 1 : 0;
        const updated = prev.map(e =>
          e.id === exerciseId
            ? { ...e, dayDate: targetDayDate, sessionIndex: targetSessionIndex, sectionId: targetSectionId, order: newOrder }
            : e
        );
        localStorage.setItem('exerciseDistribution', JSON.stringify(updated));
        return updated;
      });

      setSupersets(prev => {
        const next: SupersetMapping = prev ? JSON.parse(JSON.stringify(prev)) : {};
        const srcSectionKey = entry.sectionId || '__unsectioned__';
        const srcSupersetMap = next[entry.dayDate]?.[entry.sessionIndex]?.[srcSectionKey];
        if (srcSupersetMap) {
          Object.keys(srcSupersetMap).forEach(ssId => {
            srcSupersetMap[ssId] = (srcSupersetMap[ssId] as string[]).filter((id: string) => id !== exerciseId);
            if (srcSupersetMap[ssId].length < 2) delete srcSupersetMap[ssId];
          });
        }
        localStorage.setItem('supersets', JSON.stringify(next));
        return next;
      });

      toast({ title: `${entry.exerciseName} moved to ${targetDayDate} session ${targetSessionIndex + 1}${targetSectionName ? ` / ${targetSectionName}` : ''}` });

    } else if (action.type === "move_exercises") {
      const { exerciseIds, targetDayDate, targetSessionIndex, targetSectionName } = action;
      if (!exerciseIds.length) return;

      const targetSectionId = targetSectionName
        ? sessionSections.find(s => s.dayDate === targetDayDate && s.sessionIndex === targetSessionIndex && s.name === targetSectionName)?.id
        : undefined;

      // Capture source entries for superset cleanup before the state update
      const sourceEntries = exerciseIds.map(id => exerciseDistribution.find(e => e.id === id)).filter(Boolean);

      setExerciseDistribution(prev => {
        const idSet = new Set(exerciseIds);
        // Compute base order: end of existing exercises in the target slot (excluding the ones being moved)
        const targetExs = prev.filter(
          e => !idSet.has(e.id) && e.dayDate === targetDayDate && e.sessionIndex === targetSessionIndex &&
            (targetSectionId ? e.sectionId === targetSectionId : !e.sectionId)
        );
        let nextOrder = targetExs.length > 0 ? Math.max(...targetExs.map(e => e.order)) + 1 : 0;
        const updated = prev.map(e => {
          if (!idSet.has(e.id)) return e;
          return { ...e, dayDate: targetDayDate, sessionIndex: targetSessionIndex, sectionId: targetSectionId, order: nextOrder++ };
        });
        localStorage.setItem('exerciseDistribution', JSON.stringify(updated));
        return updated;
      });

      setSupersets(prev => {
        const next: SupersetMapping = prev ? JSON.parse(JSON.stringify(prev)) : {};
        const idSet = new Set(exerciseIds);
        const targetSectionKey = targetSectionId || '__unsectioned__';
        // Collect superset groups where ALL members are being moved together
        const groupsToPreserve: string[][] = [];
        const seenSsIds = new Set<string>();
        for (const entry of sourceEntries) {
          if (!entry) continue;
          const srcSectionKey = entry.sectionId || '__unsectioned__';
          const srcMap = next[entry.dayDate]?.[entry.sessionIndex]?.[srcSectionKey];
          if (!srcMap) continue;
          Object.keys(srcMap).forEach(ssId => {
            if (seenSsIds.has(ssId)) return;
            seenSsIds.add(ssId);
            const members: string[] = srcMap[ssId];
            if (members.every((id: string) => idSet.has(id))) {
              groupsToPreserve.push([...members]);
            }
            // Clean up source regardless
            srcMap[ssId] = members.filter((id: string) => !idSet.has(id));
            if (srcMap[ssId].length < 2) delete srcMap[ssId];
          });
        }
        // Recreate intact superset groups at the target
        if (groupsToPreserve.length > 0) {
          if (!next[targetDayDate]) next[targetDayDate] = {};
          if (!next[targetDayDate][targetSessionIndex]) next[targetDayDate][targetSessionIndex] = {};
          if (!next[targetDayDate][targetSessionIndex][targetSectionKey]) next[targetDayDate][targetSessionIndex][targetSectionKey] = {};
          const targetMap = next[targetDayDate][targetSessionIndex][targetSectionKey];
          groupsToPreserve.forEach(group => {
            const newSsId = `ss-moved-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            targetMap[newSsId] = group;
          });
        }
        localStorage.setItem('supersets', JSON.stringify(next));
        return next;
      });

      toast({ title: `${exerciseIds.length} exercises moved to ${targetDayDate} session ${targetSessionIndex + 1}${targetSectionName ? ` / ${targetSectionName}` : ''}` });

    } else if (action.type === "copy_session") {
      const { sourceDayDate, sourceSessionIndex, targetDayDate } = action;
      if (!trainingDays.some(d => d.date === targetDayDate)) {
        toast({ title: "Cannot copy session outside plan date range", variant: "destructive" }); return;
      }
      const srcExercises = exerciseDistribution.filter(e => e.dayDate === sourceDayDate && e.sessionIndex === sourceSessionIndex);
      const srcSections = sessionSections.filter(s => s.dayDate === sourceDayDate && s.sessionIndex === sourceSessionIndex);
      if (srcExercises.length === 0) { toast({ title: "Source session has no exercises", variant: "destructive" }); return; }

      // Assign new session index at end of target day
      const maxSi = exerciseDistribution.filter(e => e.dayDate === targetDayDate).reduce((m, e) => Math.max(m, e.sessionIndex), -1);
      const newSi = maxSi + 1;

      // Remap IDs
      const sectionIdMap = new Map<string, string>();
      srcSections.forEach(s => sectionIdMap.set(s.id, `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`));
      const exIdMap: Record<string, string> = {};
      const newExercises = srcExercises.map(e => {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        exIdMap[e.id] = newId;
        return { ...e, id: newId, dayDate: targetDayDate, sessionIndex: newSi, sectionId: e.sectionId ? sectionIdMap.get(e.sectionId) : undefined };
      });
      const newSections = srcSections.map((s, idx) => ({ ...s, id: sectionIdMap.get(s.id)!, dayDate: targetDayDate, sessionIndex: newSi, order: idx }));

      // Copy supersets
      const srcSupersets = supersets[sourceDayDate]?.[sourceSessionIndex];
      const nextSupersets: SupersetMapping = supersets ? JSON.parse(JSON.stringify(supersets)) : {};
      if (srcSupersets) {
        if (!nextSupersets[targetDayDate]) nextSupersets[targetDayDate] = {};
        nextSupersets[targetDayDate][newSi] = {};
        Object.entries(srcSupersets).forEach(([sectionKey, ssMap]) => {
          const newKey = sectionKey === '__unsectioned__' ? '__unsectioned__' : (sectionIdMap.get(sectionKey) ?? sectionKey);
          nextSupersets[targetDayDate][newSi][newKey] = {};
          Object.entries(ssMap).forEach(([ssId, ids]) => {
            const mapped = (ids as string[]).map(id => exIdMap[id]).filter(Boolean);
            if (mapped.length > 1) nextSupersets[targetDayDate][newSi][newKey][ssId] = mapped;
          });
        });
      }

      // Copy method assignments from source session to new target slot
      const srcMethods = dayMethodAssignments[`${sourceDayDate}_${sourceSessionIndex}`] ?? [];
      const newAssignments = { ...dayMethodAssignments, [`${targetDayDate}_${newSi}`]: [...srcMethods] };
      setDayMethodAssignments(newAssignments);
      localStorage.setItem('dayMethodAssignments', JSON.stringify(newAssignments));

      // If target day is a rest day, activate it using the source day's intensity
      const targetDay = trainingDays.find(d => d.date === targetDayDate);
      const srcIntensity = (trainingDays.find(d => d.date === sourceDayDate)?.intensity ?? 'moderate') as IntensityLevel;
      if (targetDay?.intensity === 'off') {
        setTrainingDays(prev => prev.map(d => d.date === targetDayDate ? { ...d, intensity: srcIntensity } : d));
        setDailyIntensityData(prev => {
          const u = prev.map(di => di.date === targetDayDate ? { ...di, intensity: srcIntensity } : di);
          localStorage.setItem('dailyIntensityData', JSON.stringify(u));
          return u;
        });
      }

      setExerciseDistribution(prev => { const u = [...prev, ...newExercises]; localStorage.setItem('exerciseDistribution', JSON.stringify(u)); return u; });
      setSessionSections(prev => { const u = [...prev, ...newSections]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
      setSupersets(nextSupersets);
      localStorage.setItem('supersets', JSON.stringify(nextSupersets));
      setDaySplitStates(prev => ({ ...prev, [targetDayDate]: Math.max(prev[targetDayDate] ?? 1, newSi + 1) }));
      setTrainingDays(prev => prev.map(day => {
        if (day.date !== targetDayDate) return day;
        const sessionNames = [...(day.sessionNames || [])];
        while (sessionNames.length <= newSi) sessionNames.push(`Session ${sessionNames.length + 1}`);
        return { ...day, sessions: newSi + 1, sessionNames, intensity: day.intensity === 'off' ? srcIntensity : day.intensity };
      }));

      toast({
        title: `Session copied to ${targetDayDate}`,
      });

    } else if (action.type === "copy_section") {
      const { sourceDayDate, sourceSessionIndex, sourceSectionName, targetDayDate, targetSessionIndex } = action;
      const srcSection = sessionSections.find(s => s.dayDate === sourceDayDate && s.sessionIndex === sourceSessionIndex && s.name === sourceSectionName);
      if (!srcSection) { toast({ title: `Section "${sourceSectionName}" not found`, variant: "destructive" }); return; }
      const srcExercises = exerciseDistribution.filter(e => e.sectionId === srcSection.id);
      if (srcExercises.length === 0) { toast({ title: "Source section has no exercises", variant: "destructive" }); return; }

      const newSectionId = `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const maxSectionOrder = sessionSections.filter(s => s.dayDate === targetDayDate && s.sessionIndex === targetSessionIndex).reduce((m, s) => Math.max(m, s.order), -1);
      const newSection: SessionSection = { ...srcSection, id: newSectionId, dayDate: targetDayDate, sessionIndex: targetSessionIndex, order: maxSectionOrder + 1 };

      const exIdMap: Record<string, string> = {};
      const newExercises = srcExercises.map(e => {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        exIdMap[e.id] = newId;
        return { ...e, id: newId, dayDate: targetDayDate, sessionIndex: targetSessionIndex, sectionId: newSectionId };
      });

      // Copy supersets that live in the source section
      const srcSectionSupersets = supersets[sourceDayDate]?.[sourceSessionIndex]?.[srcSection.id];
      const nextSupersets: SupersetMapping = supersets ? JSON.parse(JSON.stringify(supersets)) : {};
      if (srcSectionSupersets && Object.keys(srcSectionSupersets).length > 0) {
        if (!nextSupersets[targetDayDate]) nextSupersets[targetDayDate] = {};
        if (!nextSupersets[targetDayDate][targetSessionIndex]) nextSupersets[targetDayDate][targetSessionIndex] = {};
        nextSupersets[targetDayDate][targetSessionIndex][newSectionId] = {};
        Object.entries(srcSectionSupersets).forEach(([ssId, ids]) => {
          const mapped = (ids as string[]).map(id => exIdMap[id]).filter(Boolean);
          if (mapped.length > 1) nextSupersets[targetDayDate][targetSessionIndex][newSectionId][ssId] = mapped;
        });
      }

      // Use the source session's method assignments (already in display-name format)
      // rather than e.methodId fields which may be stored as slugified IDs
      const srcSlotMethods = dayMethodAssignments[`${sourceDayDate}_${sourceSessionIndex}`] ?? [];
      const tSlotKey = `${targetDayDate}_${targetSessionIndex}`;
      const existingTMethods = dayMethodAssignments[tSlotKey] ?? [];
      const mergedMethods = [...new Set([...existingTMethods, ...srcSlotMethods])];
      const newAssignmentsSec = { ...dayMethodAssignments, [tSlotKey]: mergedMethods };
      setDayMethodAssignments(newAssignmentsSec);
      localStorage.setItem('dayMethodAssignments', JSON.stringify(newAssignmentsSec));

      // If target day is a rest day, activate it using the source day's intensity
      const targetDaySec = trainingDays.find(d => d.date === targetDayDate);
      const srcIntensitySec = (trainingDays.find(d => d.date === sourceDayDate)?.intensity ?? 'moderate') as IntensityLevel;
      if (targetDaySec?.intensity === 'off') {
        setTrainingDays(prev => prev.map(d => d.date === targetDayDate ? { ...d, intensity: srcIntensitySec } : d));
        setDailyIntensityData(prev => {
          const u = prev.map(di => di.date === targetDayDate ? { ...di, intensity: srcIntensitySec } : di);
          localStorage.setItem('dailyIntensityData', JSON.stringify(u));
          return u;
        });
        setDaySplitStates(prev => ({ ...prev, [targetDayDate]: Math.max(prev[targetDayDate] ?? 0, 1) }));
      }

      setExerciseDistribution(prev => { const u = [...prev, ...newExercises]; localStorage.setItem('exerciseDistribution', JSON.stringify(u)); return u; });
      setSessionSections(prev => { const u = [...prev, newSection]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
      if (srcSectionSupersets && Object.keys(srcSectionSupersets).length > 0) {
        setSupersets(nextSupersets);
        localStorage.setItem('supersets', JSON.stringify(nextSupersets));
      }

      toast({
        title: `Section "${sourceSectionName}" copied to ${targetDayDate} session ${targetSessionIndex + 1}`,
      });

    } else if (action.type === "add_exercise") {
      const { exerciseId, exerciseName, libraryId, methodId, dayDate, sessionIndex, sectionName } = action;
      const currentMeso = mesocycles[currentMesocycleIndex];
      if (!currentMeso) return;

      // Resolve target section — exercises must ALWAYS live inside a section
      const slotSections = sessionSections
        .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
        .sort((a, b) => a.order - b.order);

      let targetSectionId: string | undefined;

      if (sectionName) {
        // Find by name, or create if missing
        const existing = slotSections.find(s => s.name === sectionName);
        if (existing) {
          targetSectionId = existing.id;
        } else {
          const maxOrder = slotSections.reduce((m, s) => Math.max(m, s.order), -1);
          const newSection: SessionSection = {
            id: `section-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dayDate, sessionIndex, name: sectionName, order: maxOrder + 1,
          };
          setSessionSections(prev => { const u = [...prev, newSection]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
          targetSectionId = newSection.id;
        }
      } else if (slotSections.length > 0) {
        // No section specified — use the first existing one
        targetSectionId = slotSections[0].id;
      } else {
        // No sections at all — auto-create "Section 1"
        const newSection: SessionSection = {
          id: `section-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dayDate, sessionIndex, name: 'Section 1', order: 0,
        };
        setSessionSections(prev => { const u = [...prev, newSection]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
        targetSectionId = newSection.id;
      }

      const baseOrder = exerciseDistribution.filter(e =>
        e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === targetSectionId
      ).length;

      // Split "Method::Category" format (from dayMethodAssignments) into base method + category
      const splitIdx = methodId.indexOf('::');
      const baseMethodId = splitIdx !== -1 ? methodId.slice(0, splitIdx) : methodId;
      const methodCategory = splitIdx !== -1 ? methodId.slice(splitIdx + 2) : '';

      const newEntry: ExerciseDistribution = {
        id: `ex-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        exerciseId, exerciseName,
        methodId: baseMethodId,
        categoryName: methodCategory,
        dayDate, sessionIndex, order: baseOrder,
        ...(targetSectionId ? { sectionId: targetSectionId } : {}),
      };

      setExerciseDistribution(prev => { const u = [...prev, newEntry]; localStorage.setItem('exerciseDistribution', JSON.stringify(u)); return u; });

      // Retroactively register in exerciseSelectionData for Step 5.
      // Match on base method + category to avoid creating a duplicate split-key cell.
      setExerciseSelectionData(prev => {
        const updated = { ...prev };
        const existingEntry = Object.entries(updated).find(([, cell]) =>
          cell.mesocycleId === currentMeso.id &&
          (cell.methodId === baseMethodId || cell.methodId === methodId) &&
          (cell.categoryName ?? '') === methodCategory
        );
        const newExSel: ExerciseSelection = { id: `exsel-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, exerciseId, exerciseName, library: libraryId };
        if (existingEntry) {
          const [cellKey, cellData] = existingEntry;
          if (!cellData.exercises.find(e => e.exerciseId === exerciseId)) {
            updated[cellKey] = { ...cellData, exercises: [...cellData.exercises, newExSel] };
          }
        } else {
          const newKey = `${baseMethodId}${methodCategory ? `::${methodCategory}` : ''}::::${currentMeso.id}`;
          updated[newKey] = { methodId: baseMethodId, categoryName: methodCategory, mesocycleId: currentMeso.id, exercises: [newExSel] };
        }
        const state = JSON.parse(localStorage.getItem('microcyclePlanningState') ?? '{}');
        localStorage.setItem('microcyclePlanningState', JSON.stringify({ ...state, cellData: updated }));
        return updated;
      });

      // Add method to dayMethodAssignments if missing
      const slotKey = `${dayDate}_${sessionIndex}`;
      // Add to dayMethodAssignments using the original methodId (split format preserved for Step 1 consistency)
      const existingMethods = dayMethodAssignments[slotKey] ?? [];
      if (!existingMethods.includes(methodId) && !existingMethods.includes(baseMethodId)) {
        const newAssignments = { ...dayMethodAssignments, [slotKey]: [...existingMethods, methodId] };
        setDayMethodAssignments(newAssignments);
        localStorage.setItem('dayMethodAssignments', JSON.stringify(newAssignments));
      }

      toast({ title: `"${exerciseName}" added to ${dayDate} session ${sessionIndex + 1}${sectionName ? ` / ${sectionName}` : ''}` });

    } else if (action.type === "add_circuit") {
      const { circuitId, circuitName, libraryId, dayDate, sessionIndex, sectionName } = action;

      // Resolve target section — circuits must always live inside a section
      const slotSectionsCi = sessionSections
        .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
        .sort((a, b) => a.order - b.order);

      let targetSectionId: string | undefined;

      if (sectionName) {
        const existing = slotSectionsCi.find(s => s.name === sectionName);
        if (existing) {
          targetSectionId = existing.id;
        } else {
          const maxOrder = slotSectionsCi.reduce((m, s) => Math.max(m, s.order), -1);
          const newSection: SessionSection = {
            id: `section-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dayDate, sessionIndex, name: sectionName, order: maxOrder + 1,
          };
          setSessionSections(prev => { const u = [...prev, newSection]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
          targetSectionId = newSection.id;
        }
      } else if (slotSectionsCi.length > 0) {
        targetSectionId = slotSectionsCi[0].id;
      } else {
        const newSection: SessionSection = {
          id: `section-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dayDate, sessionIndex, name: 'Section 1', order: 0,
        };
        setSessionSections(prev => { const u = [...prev, newSection]; localStorage.setItem('sessionSections', JSON.stringify(u)); return u; });
        targetSectionId = newSection.id;
      }

      // Find the full circuit from libraries for its exercise list and rest settings
      const lib = libraries.find(l => l.id === libraryId);
      const circuit = lib?.circuits?.find(c => c.id === circuitId);

      const baseOrder = exerciseDistribution.filter(e =>
        e.dayDate === dayDate && e.sessionIndex === sessionIndex && e.sectionId === targetSectionId
      ).length;

      const newEntry: ExerciseDistribution = {
        id: `circuit-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        exerciseId: circuitId, exerciseName: circuitName,
        methodId: '', categoryName: '',
        dayDate, sessionIndex, order: baseOrder,
        isCircuit: true, circuitId, circuitLibraryId: libraryId,
        ...(circuit ? {
          circuitExercises: circuit.exercises,
          circuitRestBetweenRounds: circuit.restBetweenRounds,
          circuitRestBetweenExercises: circuit.restBetweenExercises,
          circuitComments: circuit.comments,
        } : {}),
        ...(targetSectionId ? { sectionId: targetSectionId } : {}),
      };

      setExerciseDistribution(prev => { const u = [...prev, newEntry]; localStorage.setItem('exerciseDistribution', JSON.stringify(u)); return u; });
      toast({ title: `Circuit "${circuitName}" added to ${dayDate} session ${sessionIndex + 1}${sectionName ? ` / ${sectionName}` : ''}` });

    } else if (action.type === "rename_session") {
      const { dayDate, sessionIndex, newName } = action;
      handleRenameSession(dayDate, sessionIndex, newName);
      toast({ title: `Session renamed to "${newName}"` });

    } else if (action.type === "delete_session") {
      const { dayDate, sessionIndex } = action;
      handleRemoveSession(dayDate, sessionIndex);
      toast({ title: `Session ${sessionIndex + 1} on ${dayDate} deleted` });

    } else if (action.type === "set_day_intensity") {
      const { dayDate, intensity } = action;
      const level = intensity as IntensityLevel;
      setTrainingDays(prev => prev.map(d => d.date === dayDate ? { ...d, intensity: level } : d));
      setDailyIntensityData(prev => {
        const updated = prev.map(di => di.date === dayDate ? { ...di, intensity: level } : di);
        localStorage.setItem('dailyIntensityData', JSON.stringify(updated));
        return updated;
      });
      toast({ title: `Day intensity set to ${intensity} for ${dayDate}` });

    } else if (action.type === "set_session_intensity") {
      const { dayDate, sessionIndex, intensity } = action;
      handleSessionIntensityChange(dayDate, sessionIndex, intensity as IntensityLevel);
      toast({ title: `Session ${sessionIndex + 1} intensity set to ${intensity}` });

    } else if (action.type === "set_exercise_params") {
      const { dayDate, sessionIndex, methodId, params } = action;
      const targetMeso = mesocycles.find(m =>
        (m.microcycles ?? []).some(mc => trainingDays.some(d => d.date === dayDate && d.microcycleId === mc.id))
      );
      if (!targetMeso) { toast({ title: "Could not find mesocycle for that date", variant: "destructive" }); return; }
      const mcIndex = (targetMeso.microcycles ?? []).findIndex(mc =>
        trainingDays.some(d => d.date === dayDate && d.microcycleId === mc.id)
      );
      if (mcIndex === -1) { toast({ title: "Could not find microcycle index", variant: "destructive" }); return; }

      // Compute the method-chronological session index (how many times this method appeared
      // in earlier day/session slots within the same microcycle) rather than using the raw
      // day-session index, which is what WorkoutSessionSheet reads via getMethodSessionIndex.
      const targetMicro = (targetMeso.microcycles ?? [])[mcIndex] as { id: string } | undefined;
      const microDates = targetMicro
        ? trainingDays.filter(d => d.microcycleId === targetMicro.id).map(d => d.date)
        : [];
      const methodExercisesInMicro = exerciseDistribution
        .filter(e => e.methodId === methodId && microDates.includes(e.dayDate))
        .sort((a, b) => a.dayDate.localeCompare(b.dayDate) || a.sessionIndex - b.sessionIndex || (a.order ?? 0) - (b.order ?? 0));
      // Get unique day+session slots in chronological order
      const slots: Array<{ dayDate: string; sessionIndex: number }> = [];
      methodExercisesInMicro.forEach(e => {
        if (!slots.some(s => s.dayDate === e.dayDate && s.sessionIndex === e.sessionIndex)) {
          slots.push({ dayDate: e.dayDate, sessionIndex: e.sessionIndex });
        }
      });
      const methodSessionIdx = Math.max(0, slots.findIndex(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex));

      setParameterValues(prev => {
        const updated = JSON.parse(JSON.stringify(prev));
        if (!updated[targetMeso.id]) updated[targetMeso.id] = {};
        if (!updated[targetMeso.id][mcIndex]) updated[targetMeso.id][mcIndex] = {};
        if (!updated[targetMeso.id][mcIndex][methodId]) updated[targetMeso.id][mcIndex][methodId] = {};
        if (!updated[targetMeso.id][mcIndex][methodId][methodSessionIdx]) updated[targetMeso.id][mcIndex][methodId][methodSessionIdx] = {};
        Object.entries(params).forEach(([k, v]) => {
          updated[targetMeso.id][mcIndex][methodId][methodSessionIdx][k] = v;
        });
        localStorage.setItem('parameterValues', JSON.stringify(updated));
        return updated;
      });
      // Trigger WorkoutSessionSheet to rebuild from fresh parameterValues
      setParamRefreshTrigger(c => c + 1);
      toast({ title: `Parameters updated for [${methodId}] on ${dayDate} session ${sessionIndex + 1}` });

    } else if (action.type === "copy_week") {
      const { sourceMicrocycleName, targetMicrocycleName } = action;
      // Find source and target microcycles across all mesocycles
      let srcMesoId: string | undefined, srcMcIdx = -1, tgtMesoId: string | undefined, tgtMcIdx = -1;
      for (const meso of mesocycles) {
        (meso.microcycles ?? []).forEach((mc: { id: string; name?: string }, idx: number) => {
          if ((mc.name ?? `Microcycle ${idx + 1}`) === sourceMicrocycleName) { srcMesoId = meso.id; srcMcIdx = idx; }
          if ((mc.name ?? `Microcycle ${idx + 1}`) === targetMicrocycleName) { tgtMesoId = meso.id; tgtMcIdx = idx; }
        });
      }
      if (!srcMesoId || srcMcIdx === -1 || !tgtMesoId || tgtMcIdx === -1) {
        toast({ title: "Microcycle not found — check exact names", variant: "destructive" }); return;
      }
      const srcMicro = mesocycles.find(m => m.id === srcMesoId)?.microcycles?.[srcMcIdx] as { id: string } | undefined;
      const tgtMicro = mesocycles.find(m => m.id === tgtMesoId)?.microcycles?.[tgtMcIdx] as { id: string } | undefined;
      if (!srcMicro || !tgtMicro) return;
      const srcDates = new Set(trainingDays.filter(d => d.microcycleId === srcMicro.id).map(d => d.date));
      const tgtDays = trainingDays.filter(d => d.microcycleId === tgtMicro.id);
      if (srcDates.size === 0 || tgtDays.length === 0) {
        toast({ title: "No training days in source or target week", variant: "destructive" }); return;
      }
      // Map source days (by position) to target days
      const srcDaysSorted = trainingDays.filter(d => d.microcycleId === srcMicro.id).sort((a, b) => a.date.localeCompare(b.date));
      const tgtDaysSorted = tgtDays.sort((a, b) => a.date.localeCompare(b.date));
      const dateMap = new Map<string, string>(); // srcDate → tgtDate
      srcDaysSorted.forEach((d, i) => { if (tgtDaysSorted[i]) dateMap.set(d.date, tgtDaysSorted[i].date); });

      // Build new sections and exercise distribution for target
      const sectionIdMap = new Map<string, string>();
      const newSections = sessionSections
        .filter(s => srcDates.has(s.dayDate) && dateMap.has(s.dayDate))
        .map(s => {
          const newId = `section-cw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          sectionIdMap.set(s.id, newId);
          return { ...s, id: newId, dayDate: dateMap.get(s.dayDate)! };
        });
      const exIdMap: Record<string, string> = {};
      const newExercises = exerciseDistribution
        .filter(e => srcDates.has(e.dayDate) && dateMap.has(e.dayDate))
        .map(e => {
          const newId = `ex-cw-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          exIdMap[e.id] = newId;
          return { ...e, id: newId, dayDate: dateMap.get(e.dayDate)!, sectionId: e.sectionId ? sectionIdMap.get(e.sectionId) : undefined };
        });

      // Remap supersets
      const nextSupersets: SupersetMapping = supersets ? JSON.parse(JSON.stringify(supersets)) : {};
      // Clear target week supersets first
      tgtDaysSorted.forEach(d => { delete nextSupersets[d.date]; });
      // Copy source supersets
      srcDaysSorted.forEach(d => {
        const tgtDate = dateMap.get(d.date);
        if (!tgtDate || !nextSupersets[d.date]) return;
        nextSupersets[tgtDate] = {};
        Object.entries(nextSupersets[d.date]).forEach(([si, secMap]) => {
          nextSupersets[tgtDate][Number(si)] = {};
          Object.entries(secMap).forEach(([secKey, ssMap]) => {
            const newSecKey = secKey === '__unsectioned__' ? '__unsectioned__' : (sectionIdMap.get(secKey) ?? secKey);
            nextSupersets[tgtDate][Number(si)][newSecKey] = {};
            Object.entries(ssMap).forEach(([ssId, ids]) => {
              const mapped = (ids as string[]).map(id => exIdMap[id]).filter(Boolean);
              if (mapped.length > 1) nextSupersets[tgtDate][Number(si)][newSecKey][ssId] = mapped;
            });
          });
        });
      });

      // Remap method assignments
      const newAssignments = { ...dayMethodAssignments };
      srcDaysSorted.forEach(srcDay => {
        const tgtDate = dateMap.get(srcDay.date);
        if (!tgtDate) return;
        const srcDay2 = trainingDays.find(d => d.date === srcDay.date);
        const sessCount = srcDay2?.sessions ?? 1;
        for (let s = 0; s < sessCount; s++) {
          const methods = dayMethodAssignments[`${srcDay.date}_${s}`] ?? [];
          newAssignments[`${tgtDate}_${s}`] = [...methods];
        }
      });

      // Remove old target content and add new
      setExerciseDistribution(prev => {
        const tgtDateSet = new Set(tgtDaysSorted.map(d => d.date));
        const filtered = prev.filter(e => !tgtDateSet.has(e.dayDate));
        const u = [...filtered, ...newExercises];
        localStorage.setItem('exerciseDistribution', JSON.stringify(u));
        return u;
      });
      setSessionSections(prev => {
        const tgtDateSet = new Set(tgtDaysSorted.map(d => d.date));
        const filtered = prev.filter(s => !tgtDateSet.has(s.dayDate));
        const u = [...filtered, ...newSections];
        localStorage.setItem('sessionSections', JSON.stringify(u));
        return u;
      });
      setSupersets(nextSupersets);
      localStorage.setItem('supersets', JSON.stringify(nextSupersets));
      setDayMethodAssignments(newAssignments);
      localStorage.setItem('dayMethodAssignments', JSON.stringify(newAssignments));
      // Sync day intensities and session counts
      setTrainingDays(prev => prev.map(d => {
        const tgtDate = tgtDaysSorted.find(td => td.date === d.date)?.date;
        if (!tgtDate) return d;
        const posIdx = tgtDaysSorted.findIndex(td => td.date === d.date);
        const srcDay = srcDaysSorted[posIdx];
        if (!srcDay) return d;
        const srcTrainingDay = prev.find(td => td.date === srcDay.date);
        if (!srcTrainingDay) return d;
        return { ...d, intensity: srcTrainingDay.intensity, sessions: srcTrainingDay.sessions, sessionNames: srcTrainingDay.sessionNames };
      }));
      toast({ title: `Week "${sourceMicrocycleName}" copied to "${targetMicrocycleName}"` });

    } else if (action.type === "clear_week") {
      const { microcycleName } = action;
      let targetMesoId: string | undefined, targetMcObj: { id: string } | undefined;
      for (const meso of mesocycles) {
        (meso.microcycles ?? []).forEach((mc: { id: string; name?: string }, idx: number) => {
          if ((mc.name ?? `Microcycle ${idx + 1}`) === microcycleName) { targetMesoId = meso.id; targetMcObj = mc; }
        });
      }
      if (!targetMesoId || !targetMcObj) {
        toast({ title: `Microcycle "${microcycleName}" not found`, variant: "destructive" }); return;
      }
      const tgtDates = new Set(trainingDays.filter(d => d.microcycleId === targetMcObj!.id).map(d => d.date));
      setExerciseDistribution(prev => {
        const u = prev.filter(e => !tgtDates.has(e.dayDate));
        localStorage.setItem('exerciseDistribution', JSON.stringify(u));
        return u;
      });
      setSessionSections(prev => {
        const u = prev.filter(s => !tgtDates.has(s.dayDate));
        localStorage.setItem('sessionSections', JSON.stringify(u));
        return u;
      });
      setSupersets(prev => {
        const next: SupersetMapping = prev ? JSON.parse(JSON.stringify(prev)) : {};
        tgtDates.forEach(date => { delete next[date]; });
        localStorage.setItem('supersets', JSON.stringify(next));
        return next;
      });
      // Also clear session-level localStorage entries
      tgtDates.forEach(date => {
        const day = trainingDays.find(d => d.date === date);
        const sessCount = day?.sessions ?? 1;
        for (let s = 0; s < sessCount; s++) {
          localStorage.removeItem(`sessionIntensity_${targetMesoId}_${date}_${s}`);
          localStorage.removeItem(`workoutSessions_${targetMesoId}_${date}_${s}`);
        }
      });
      toast({ title: `All sessions cleared from "${microcycleName}"` });
    }
  }, [mesocycles, currentMesocycleIndex, trainingDays, dayMethodAssignments, exerciseDistribution, sessionSections, supersets, exerciseSelectionData, libraries, parameterValues, toast]);

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
      
      {currentStep === 1 && mesocycles.length > 1 && renderMesocycleNavigation()}
      {currentStep === 1 && renderMicrocycleNavigation()}

      {currentStep === 1 && (
        currentMesocycle ? (
          <MethodSessionArchitecture
            mesocycle={currentMesocycle}
            allMesocycles={mesocycles}
            trainingDays={trainingDays}
            methodAllocations={resolvedMethodAllocations}
            methodExerciseCategories={methodExerciseCategories}
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
            getMethodFrequencyTarget={getMethodFrequency}
            selectedMicrocycleIndex={currentMicrocycleIndex}
            onSelectedMicrocycleIndexChange={setCurrentMicrocycleIndex}
          />
        ) : (
          <div className="p-8 text-center text-muted-foreground">No mesocycle data available</div>
        )
      )}

      {currentStep === 2 && renderMesocycleNavigation()}
      {currentStep === 2 && renderMicrocycleNavigation()}

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
              onDeleteTestEvent={handleDeleteTestEvent}
              onOpenAIAssistant={(ctx) => { setFocusedSessionCtx(ctx); setAiOpenTrigger(c => c + 1); }}
              forceParamRefresh={paramRefreshTrigger}
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

      {/* PDF Export Dialog */}
      {pdfExportProgram && (
        <ExportPDFButton
          program={pdfExportProgram}
          open={pdfExportOpen}
          onOpenChange={(v) => { setPdfExportOpen(v); if (!v) setPdfExportProgram(null); }}
        />
      )}

      {/* AI Assistant */}
      <WizardAIAssistant
        stepLabel={microStepLabel}
        wizardContext={microWizardContext}
        onApplySuggestion={handleMicroAIApply}
        ragContext={ragContext}
        globalContext={globalAIContext}
        coachMemoryContext={coachMemoryContext}
        forceOpen={aiOpenTrigger}
        focusedSessionContext={focusedSessionCtx}
      />
    </div>
  );
}
