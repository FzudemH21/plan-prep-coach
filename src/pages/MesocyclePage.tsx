import { MicrocyclePlanningTable, type MicrocyclePlanningTableHandle } from '@/components/microcycle-planning';
import { WizardAIAssistant } from '@/components/wizard/WizardAIAssistant';
import { cn } from '@/lib/utils';
import { evaluateFormula } from '@/utils/formulaEvaluator';
import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { useAthletes } from '@/hooks/useAthletes';
import { getAthleteDisplayName } from '@/types/athlete';
import { TrainingPlanOverview } from '@/components/shared/TrainingPlanOverview';
import { AddMethodDialog } from '@/components/ui/add-method-dialog';
import { MethodDeleteDialog } from '@/components/shared/MethodDeleteDialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Settings, SplitSquareHorizontal, Columns, MessageSquare, ChevronLeft, ChevronRight, GripVertical as GripVerticalIcon, SlidersHorizontal } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MesocycleCalendar from '@/components/mesocycle/MesocycleCalendar';
import MicrocycleIntensityPlanning from '@/components/mesocycle/MicrocycleIntensityPlanning';
import IntensityColumn from '@/components/mesocycle/IntensityColumn';
import IntensityScale from '@/components/mesocycle/IntensityScale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExtendedMesocycle, Mesocycle, Microcycle, Plan, Intensity } from '@/features/planner/types';
import { DailyIntensity, TrainingDay } from '@/types/daily-intensity';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useDragFill } from '@/hooks/useDragFill';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { QuantitativeParameterInput, QualitativeParameterInput } from '@/components/ui/parameter-input';
import { DebouncedTextInput } from '@/components/ui/debounced-input';
import { KeyboardShortcutsPanel } from '@/components/ui/keyboard-shortcuts-panel';
import { ParameterContextMenu } from '@/components/ui/parameter-context-menu';
import { ParameterFillControl } from '@/components/ui/parameter-fill-control';
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CrossMesocycleCopyDialog } from "@/components/ui/cross-mesocycle-copy-dialog";
import { CrossMesocycleMicrocycleCopyDialog } from "@/components/ui/cross-mesocycle-microcycle-copy-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays, Info, ChevronDown, Trash2, Copy, AlertCircle, Trophy, LayoutTemplate } from "lucide-react";
import { ResourcesButton } from "@/components/programs/ResourcesButton";
import { SaveProgramButton } from "@/components/programs/SaveProgramButton";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { format, addWeeks, differenceInWeeks, addDays, differenceInDays, parseISO } from "date-fns";
import { trainingData, getMethodsForQuality } from "@/data/trainingData";
import { IntensityLevel } from "@/types/training";
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useTemplates, type ProgramTemplate, type TemplateColumn } from '@/hooks/useTemplates';
import { LoadTemplateDialog, type MethodParam } from '@/components/mesocycle/LoadTemplateDialog';
import { useWizardData } from '@/contexts/WizardDataContext';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import { useRAGRetrieval } from '@/hooks/useRAGRetrieval';
import { useGlobalAIContext } from '@/hooks/useGlobalAIContext';

// Helper function for string normalization - robust canonicalization
const normalizeForComparison = (str: unknown): string => {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
};

export default function MesocyclePage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(() => {
    const savedStep = localStorage.getItem('mesocycleStep');
    return savedStep ? parseInt(savedStep) : 1;
  });
  const [isPending, startTransition] = useTransition();
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [planStartDate, setPlanStartDate] = useState<Date>(new Date());
  const [planEndDate, setPlanEndDate] = useState<Date>(new Date());
  const [totalWeeks, setTotalWeeks] = useState<number>(0);
  const [mesocycleLength, setMesocycleLength] = useState(4);
  const [uniformLength, setUniformLength] = useState(true);
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>>({});
  const [expandedSubGoals, setExpandedSubGoals] = useState<Record<string, Set<string>>>({});
  const [expandedMesocycles, setExpandedMesocycles] = useState<Set<string>>(new Set());
  const [globalMicrocycleSplitStates, setGlobalMicrocycleSplitStates] = useState<Record<string, boolean>>({});
  const [manuallyAddedMethods, setManuallyAddedMethods] = useState<string[]>([]);
  const [isAddMethodDialogOpen, setIsAddMethodDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [categorySplitStates, setCategorySplitStates] = useState<Record<string, boolean>>({});
  
  // Method allocation state - tracks which methods are allocated to which mesocycles
  // Key: methodName, Value: array of mesocycleIds
  const [methodAllocations, setMethodAllocations] = useState<Record<string, string[]>>({});
  const [isClearParametersDialogOpen, setIsClearParametersDialogOpen] = useState(false);
  const [isClearAllExercisesDialogOpen, setIsClearAllExercisesDialogOpen] = useState(false);
  const [loadTemplateDialog, setLoadTemplateDialog] = useState<{ open: boolean; methodName: string; lookupName: string }>({ open: false, methodName: '', lookupName: '' });
  
  // Daily intensity planning state — lifted to shared WizardDataContext
  const { macrocycleData, setMacrocycleData, trainingDays, setTrainingDays, dailyIntensityData, setDailyIntensityData } = useWizardData();
  const [isIntensityDataLoaded, setIsIntensityDataLoaded] = useState(false);
  
  // Cross-mesocycle copy dialog state
  const [crossCopyDialogOpen, setCrossCopyDialogOpen] = useState(false);
  const [targetMicrocycleForCopy, setTargetMicrocycleForCopy] = useState<{id: string, duration: number} | null>(null);
  
  // Mesocycle intensity copy dialog state (for step 2)
  const [mesocycleCopyDialogOpen, setMesocycleCopyDialogOpen] = useState(false);
  const [targetMesocycleForIntensityCopy, setTargetMesocycleForIntensityCopy] = useState<{mesocycleId: string, microcycleStructure: Array<{id: string, duration: number}>} | null>(null);
  const [mpTableKey, setMpTableKey] = useState(0);
  
  // Coach notes state for mesocycle characterization
  const [mesocycleNotes, setMesocycleNotes] = useState<Record<string, string>>({});
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedMesocycleForNotes, setSelectedMesocycleForNotes] = useState<ExtendedMesocycle | null>(null);
  
  // Step 2 (Daily Intensity Planning) mesocycle navigation state
  const [currentMesocycleIndexDailyPlanning, setCurrentMesocycleIndexDailyPlanning] = useState(0);
  
  // Step 3 mesocycle carousel navigation state
  const [mesocycleViewOffset, setMesocycleViewOffset] = useState(0);
  const MAX_VISIBLE_MESOCYCLES = 4;
  
  // Step 4 (Method Periodization) mesocycle navigation state - multi-select toggle
  const [visibleMesocycleIds, setVisibleMesocycleIds] = useState<Set<string>>(() => new Set());
  
  // Method category order state for Step 3/4 drag reordering
  const [methodCategoryOrder, setMethodCategoryOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('methodCategoryOrder');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Collapse/expand state for Step 4 (Method Periodization)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedMethods, setCollapsedMethods] = useState<Set<string>>(new Set());
  
  // Method parameter visibility overrides for Step 4
  // Key: methodName (or fullMethodName with category), Value: { parameterName: boolean }
  const [methodParameterVisibility, setMethodParameterVisibility] = useState<
    Record<string, Record<string, boolean>>
  >({});
  
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  const toggleMethodCollapse = (methodName: string) => {
    setCollapsedMethods(prev => {
      const next = new Set(prev);
      if (next.has(methodName)) {
        next.delete(methodName);
      } else {
        next.add(methodName);
      }
      return next;
    });
  };
  
  const { data: toolboxData } = useToolboxData();
  const { data: parametersDataV2 } = useParametersDataV2();
  const { libraries: exerciseLibraries } = useCustomLibraries();
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  const mpTableRef = React.useRef<MicrocyclePlanningTableHandle>(null);
  const [exerciseCellData, setExerciseCellData] = useState<Record<string, import('@/types/microcycle-planning').CellData>>({});
  // Re-sync from exerciseSelectionData (the dedicated step-5 key) whenever the user
  // arrives at step 5 or the table remounts — never rely solely on callback-driven updates.
  useEffect(() => {
    if (currentStep === 5) {
      try {
        const stored = localStorage.getItem('exerciseSelectionData');
        setExerciseCellData(stored ? JSON.parse(stored) : {});
      } catch { setExerciseCellData({}); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, mpTableKey]);
  const { dragState, startDrag, endDrag, addToSelection, clearSelection, fillCells } = useDragFill();
  const { toast } = useToast();
  const { athletes } = useAthletes();
  const { saveCurrentSession } = useTrainingPrograms();
  const { templates, addTemplate } = useTemplates();
  const { getEventsForAthlete } = useCalendarEvents();
  const athleteCalendarEvents = macrocycleData?.selectedAthleteId
    ? getEventsForAthlete(macrocycleData.selectedAthleteId)
    : [];

  // Resolve athlete name from selectedAthleteId
  const selectedAthlete = athletes.find(a => a.id === macrocycleData?.selectedAthleteId);
  const athleteName = selectedAthlete ? getAthleteDisplayName(selectedAthlete) : undefined;

  const totalSteps = 5;

  // Navigation component for top and bottom
  const NavigationButtons = () => (
    <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full max-w-full px-2 md:px-0 md:flex-nowrap">
      <Button 
        onClick={() => {
          if (currentStep <= 1) {
            // Smart navigation: go to last saved step in macrocycle (clamped to valid range 1-3)
            const savedStep = localStorage.getItem('macrocycleStep');
            const parsed = savedStep ? parseInt(savedStep) : 3;
            const targetStep = isNaN(parsed) ? 3 : Math.max(1, Math.min(3, parsed));
            localStorage.setItem('macrocycleStep', targetStep.toString());
            navigate('/macrocycle');
          } else {
            setCurrentStep(Math.max(1, currentStep - 1));
          }
        }}
        variant="outline"
        className="w-full md:w-auto min-w-0"
      >
        {currentStep <= 1 ? "Back to Macrocycle" : "Previous"}
      </Button>
      <Button
        disabled={currentStep === 1 && daysMismatch}
        onClick={() => {
          if (currentStep >= totalSteps) {
            // CRITICAL: Synchronously save parameterValues before navigating
            if (Object.keys(parameterValues).length > 0) {
              localStorage.setItem('parameterValues', JSON.stringify(parameterValues));
            }
            navigate('/microcycle');
          } else {
            setCurrentStep(Math.min(totalSteps, currentStep + 1));
          }
        }}
        className="w-full md:w-auto min-w-0"
      >
        {currentStep >= totalSteps ? "Continue to Microcycle Planning" : "Next"}
      </Button>
    </div>
  );
  const progress = (currentStep / totalSteps) * 100;

  // Load saved step from localStorage on mount
  useEffect(() => {
    const savedStep = localStorage.getItem('mesocycleStep');
    if (savedStep) {
      const step = parseInt(savedStep);
      if (!isNaN(step) && step >= 1 && step <= totalSteps) {
        setCurrentStep(step);
      }
      // Clear the saved step after loading
      localStorage.removeItem('mesocycleStep');
    }
  }, []);

  // Load macrocycle data on mount — macrocycleData comes from shared WizardDataContext
  useEffect(() => {
    const savedMesocycleData = localStorage.getItem('mesocycleData');

    const data = macrocycleData;

    if (data) {
      // Calculate total weeks from date range - prioritize planDuration over legacy smartGoal
      const rawStartDate = data.planDuration?.startDate || data.smartGoal?.startDate;
      const rawEndDate = data.planDuration?.endDate || data.smartGoal?.endDate;
      const rawTotalWeeks = data.planDuration?.totalWeeks || data.smartGoal?.totalWeeks;

      const startDate = rawStartDate ? new Date(rawStartDate) : new Date();
      const endDate = rawEndDate ? new Date(rawEndDate) : addWeeks(startDate, 12);
      const weeks = rawTotalWeeks ||
        (rawStartDate && rawEndDate
          ? Math.ceil((Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) / 7)
          : 12);
      setTotalWeeks(weeks);

      // Set plan dates
      setPlanStartDate(startDate);
      setPlanEndDate(endDate);

      // Check if we have saved mesocycle data with allocatedSubGoals
      if (savedMesocycleData) {
        try {
          const savedMesocycles = JSON.parse(savedMesocycleData);
          if (savedMesocycles.mesocycles && savedMesocycles.mesocycles.length > 0) {
            // Convert date strings back to Date objects (localStorage serializes dates as strings)
            const mesocyclesWithDates = savedMesocycles.mesocycles.map((meso: any) => ({
              ...meso,
              startDate: meso.startDate ? new Date(meso.startDate) : new Date(),
              endDate: meso.endDate ? new Date(meso.endDate) : new Date(),
            }));
            
            // Recalculate all dates based on microcycle durations to fix any stale endDate values
            let currentMesoStart = startDate;
            const recalculatedMesocycles = mesocyclesWithDates.map((meso: any) => {
              const totalDays = (meso.microcycles || []).reduce((sum: number, mc: any) => sum + (mc.duration || 7), 0);
              const mesoStartDate = currentMesoStart;
              const mesoEndDate = addDays(currentMesoStart, totalDays - 1);
              currentMesoStart = addDays(mesoEndDate, 1);
              return {
                ...meso,
                startDate: mesoStartDate,
                endDate: mesoEndDate,
                weeks: Math.ceil(totalDays / 7),
                duration: Math.ceil(totalDays / 7)
              };
            });
            
            setMesocycles(recalculatedMesocycles);
            setMesocycleLength(4);
            return; // Skip default mesocycle creation
          }
        } catch (e) {
          console.error('Failed to load saved mesocycles:', e);
        }
      }
      
      // Auto-calculate mesocycles using 4-week blocks as default
      const suggestedMesocycleCount = Math.ceil(weeks / 4);
      const suggestedLength = 4;
      
      setMesocycleLength(suggestedLength);
      
      // Create default mesocycles with 4-week blocks and auto-calculate microcycles
      const defaultMesocycles: ExtendedMesocycle[] = Array.from({ length: suggestedMesocycleCount }, (_, i) => {
        const isLastMesocycle = i === suggestedMesocycleCount - 1;
        const remainingWeeks = weeks - (i * 4);
        const mesocycleWeeks = Math.min(4, remainingWeeks);
        let currentStartDate = addWeeks(startDate, i * 4);
        let currentEndDate = addWeeks(currentStartDate, mesocycleWeeks);
        
        // Create default microcycles (4 for normal mesocycles, adjusted for last)
        const microcycleCount = isLastMesocycle ? remainingWeeks : 4;
        const microcycles: Microcycle[] = Array.from({ length: microcycleCount }, (_, j) => ({
          id: `micro-${i + 1}-${j + 1}`,
          name: `Microcycle ${j + 1}`,
          duration: 7, // 7 days default
          intensity: "moderate" as Intensity
        }));
        
        return {
          id: `meso-${i + 1}`,
          name: `Mesocycle ${i + 1}`,
          weeks: mesocycleWeeks,
          sessionsPerWeek: 3,
          sessionLength: 60,
          startDate: currentStartDate,
          endDate: currentEndDate,
          duration: mesocycleWeeks,
          intensity: i === suggestedMesocycleCount - 1 ? "deload" : "moderate" as IntensityLevel,
          trainingMethods: [],
          trainingQualities: [],
          microcycles
        };
      });
      
      setMesocycles(defaultMesocycles);
      
      // Load training methods from macrocycle data (no longer needed but kept for compatibility)
      // The methods will now be derived from toolbox data
    }
  }, []);

  // Load parameter values from localStorage on mount
  useEffect(() => {
    const savedParameterValues = localStorage.getItem('parameterValues');
    if (savedParameterValues) {
      try {
        const parsed = JSON.parse(savedParameterValues);
        setParameterValues(parsed);
      } catch (e) {
        console.error('Failed to load parameter values:', e);
      }
    }
  }, []);

  // Load manually added methods from localStorage on mount
  useEffect(() => {
    const savedMethods = localStorage.getItem('manuallyAddedMethods');
    if (savedMethods) {
      try {
        const parsed = JSON.parse(savedMethods);
        setManuallyAddedMethods(parsed);
      } catch (e) {
        console.error('Failed to load manually added methods:', e);
      }
    }
  }, []);

  // Load category split states from localStorage on mount
  useEffect(() => {
    const savedCategorySplitStates = localStorage.getItem('categorySplitStates');
    if (savedCategorySplitStates) {
      try {
        const parsed = JSON.parse(savedCategorySplitStates);
        setCategorySplitStates(parsed);
      } catch (e) {
        console.error('Failed to load category split states:', e);
      }
    }
  }, []);

  // Save category split states to localStorage
  useEffect(() => {
    if (Object.keys(categorySplitStates).length > 0) {
      localStorage.setItem('categorySplitStates', JSON.stringify(categorySplitStates));
    }
  }, [categorySplitStates]);

  // Load method allocations from localStorage on mount
  useEffect(() => {
    const savedMethodAllocations = localStorage.getItem('methodAllocations');
    if (savedMethodAllocations) {
      try {
        const parsed = JSON.parse(savedMethodAllocations);
        setMethodAllocations(parsed);
      } catch (e) {
        console.error('Failed to load method allocations:', e);
      }
    }
  }, []);

  // Save method allocations to localStorage
  useEffect(() => {
    if (Object.keys(methodAllocations).length > 0) {
      localStorage.setItem('methodAllocations', JSON.stringify(methodAllocations));
    }
  }, [methodAllocations]);

  // trainingDays and dailyIntensityData are now loaded from shared WizardDataContext on mount.
  // Mark intensity data as loaded once context is available (context initializes from localStorage).
  useEffect(() => {
    setIsIntensityDataLoaded(true);
  }, []);

  // Save mesocycle data to localStorage for microcycle planning
  useEffect(() => {
    if (mesocycles.length > 0) {
      localStorage.setItem('mesocycleData', JSON.stringify({ mesocycles }));
    }
  }, [mesocycles]);

  // Save parameter values to localStorage
  useEffect(() => {
    if (Object.keys(parameterValues).length > 0) {
      localStorage.setItem('parameterValues', JSON.stringify(parameterValues));
    }
  }, [parameterValues]);

  // trainingDays and dailyIntensityData persistence is handled by WizardDataContext setters.

  // Save current step to localStorage
  useEffect(() => {
    localStorage.setItem('mesocycleStep', currentStep.toString());
  }, [currentStep]);

  // Load mesocycle notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('mesocycleNotes');
    if (savedNotes) {
      try {
        setMesocycleNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error('Failed to load mesocycle notes:', e);
      }
    }
  }, []);

  // Save mesocycle notes to localStorage
  useEffect(() => {
    if (Object.keys(mesocycleNotes).length > 0) {
      localStorage.setItem('mesocycleNotes', JSON.stringify(mesocycleNotes));
    }
  }, [mesocycleNotes]);

  // Load method parameter visibility from localStorage on mount
  useEffect(() => {
    const savedVisibility = localStorage.getItem('methodParameterVisibility');
    if (savedVisibility) {
      try {
        setMethodParameterVisibility(JSON.parse(savedVisibility));
      } catch (e) {
        console.error('Failed to load method parameter visibility:', e);
      }
    }
  }, []);

  // Save method parameter visibility to localStorage
  useEffect(() => {
    if (Object.keys(methodParameterVisibility).length > 0) {
      localStorage.setItem('methodParameterVisibility', JSON.stringify(methodParameterVisibility));
    }
  }, [methodParameterVisibility]);

  // Helper function to check if a parameter is visible for a method
  const isParameterVisibleForMethod = (
    methodName: string, 
    paramName: string, 
    defaultVisible: boolean = true
  ): boolean => {
    const methodOverrides = methodParameterVisibility[methodName];
    if (methodOverrides && paramName in methodOverrides) {
      return methodOverrides[paramName];
    }
    return defaultVisible;
  };

  // Toggle parameter visibility for a method
  const toggleParameterVisibility = (methodName: string, paramName: string, visible: boolean) => {
    setMethodParameterVisibility(prev => ({
      ...prev,
      [methodName]: {
        ...prev[methodName],
        [paramName]: visible
      }
    }));
  };

  // Show all parameters for a method
  const showAllParametersForMethod = (methodName: string, parameters: { name: string }[]) => {
    const allVisible = parameters.reduce((acc, param) => {
      acc[param.name] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setMethodParameterVisibility(prev => ({
      ...prev,
      [methodName]: allVisible
    }));
  };

  // Reset parameter visibility for a method (remove all overrides)
  const resetParameterVisibilityForMethod = (methodName: string) => {
    setMethodParameterVisibility(prev => {
      const { [methodName]: _, ...rest } = prev;
      return rest;
    });
  };

  // Get rationale for a method based on selected goals
  const getMethodRationale = (methodName: string): { rationale: string; parameterName: string }[] => {
    if (!parametersDataV2?.parameterMethods) return [];
    
    // Get all parameter-method associations that match this method and have rationale
    const methodAssociations = parametersDataV2.parameterMethods.filter(
      pm => pm.methodId === methodName && pm.rationale
    );
    
    // For each association, find the parameter name
    return methodAssociations
      .map(pm => {
        const param = parametersDataV2.parameters.find(p => p.id === pm.parameterId);
        return {
          rationale: pm.rationale || '',
          parameterName: param?.name || 'Unknown'
        };
      })
      .filter(item => item.rationale);
  };

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

  // Helper to get subtle intensity-tinted background for Step 2 headers
  const getSubtleIntensityBg = (intensity: IntensityLevel): string => {
    const bgMappings: Record<IntensityLevel, string> = {
      "off": "bg-[hsl(var(--intensity-off)/0.15)]",
      "deload": "bg-[hsl(var(--intensity-deload)/0.15)]",
      "easy": "bg-[hsl(var(--intensity-easy)/0.15)]",
      "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate)/0.15)]",
      "moderate": "bg-[hsl(var(--intensity-moderate)/0.15)]",
      "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard)/0.15)]",
      "hard": "bg-[hsl(var(--intensity-hard)/0.15)]",
      "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard)/0.20)]"
    };
    return bgMappings[intensity] || "bg-muted/50";
  };

  const renderTrainingPlanOverview = () => {
    const primaryGoal = macrocycleData?.smartGoals?.[0]?.description || 
                        macrocycleData?.smartGoal?.description || 
                        macrocycleData?.smartGoal?.specific || 
                        macrocycleData?.smartGoal?.measurable || 
                        macrocycleData?.smartGoal?.realistic;
    
    // Use planDuration.totalDays if available, otherwise calculate
    const totalDays = macrocycleData?.planDuration?.totalDays || 
      (planStartDate && planEndDate
        ? Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined);
    
    return (
      <TrainingPlanOverview
        athleteName={athleteName}
        planName={macrocycleData?.planName}
        startDate={planStartDate}
        endDate={planEndDate}
        totalWeeks={totalWeeks}
        totalDays={totalDays}
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

  // Helper to count daily intensity distribution for a microcycle
  const getMicrocycleIntensityDistribution = (microcycleId: string): Record<IntensityLevel, number> => {
    const distribution: Record<IntensityLevel, number> = {
      "off": 0,
      "deload": 0,
      "easy": 0,
      "easy-moderate": 0,
      "moderate": 0,
      "moderate-hard": 0,
      "hard": 0,
      "extremely-hard": 0
    };
    
    dailyIntensityData
      .filter(day => day.microcycleId === microcycleId)
      .forEach(day => {
        if (distribution.hasOwnProperty(day.intensity)) {
          distribution[day.intensity]++;
        }
      });
    
    return distribution;
  };

  // Calculate microcycle date ranges for event/test checking
  const calculateMicrocycleDates = useMemo(() => {
    let currentDate = new Date(planStartDate);
    const microcycleDates: Map<string, { start: Date; end: Date }> = new Map();
    
    mesocycles.forEach(meso => {
      (meso.microcycles || []).forEach(micro => {
        const startDate = new Date(currentDate);
        const endDate = addDays(currentDate, micro.duration - 1);
        microcycleDates.set(micro.id, { start: startDate, end: endDate });
        currentDate = addDays(endDate, 1);
      });
    });
    
    return microcycleDates;
  }, [mesocycles, planStartDate]);

  // RAG retrieval — refresh when mesocycle structure or allocated methods change
  useEffect(() => {
    const methodNames = (macrocycleData?.selectedMethods ?? []).join(', ');
    const mesoNames = mesocycles.map(m => m.name).join(', ');
    const query = [methodNames, mesoNames].filter(Boolean).join('; ') || 'mesocycle periodization training methods';
    ragRetrieve(query).then(setRagContext);
  }, [ragRetrieve, macrocycleData?.selectedMethods, mesocycles]);

  // Interface for test/event details with dates
  interface TestDetail {
    name: string;
    goal?: string;
    dates: Date[];
  }
  
  interface EventDetail {
    name: string;
    dates: Date[];
  }

  // Get tests in date range — combines calendarEvents (athlete-bound) + plan-state (wizard-assigned)
  const getTestsInRange = (start: Date, end: Date): TestDetail[] => {
    const testMap = new Map<string, Date[]>();
    const addTest = (name: string, d: Date) => {
      const existing = testMap.get(name);
      if (existing) existing.push(d);
      else testMap.set(name, [d]);
    };
    // Source 1: calendarEvents (athlete-bound)
    athleteCalendarEvents
      .filter(e => e.type === 'test')
      .forEach(e => {
        const d = parseISO(e.date);
        if (d >= start && d <= end) addTest(e.title, d);
      });
    // Source 2: plan-state (wizard-assigned sub-goal tests)
    macrocycleData?.subGoals?.forEach((sg: any) => {
      const name = sg.testMethod || sg.description || 'Test';
      sg.testDates?.forEach((td: string) => {
        const d = parseISO(td);
        if (d >= start && d <= end) addTest(name, d);
      });
    });
    // Source 3: plan-state primary SMART goal tests
    macrocycleData?.smartGoals?.forEach((sg: any) => {
      const name = sg.description || 'Test';
      sg.testDates?.forEach((td: string) => {
        const d = parseISO(td);
        if (d >= start && d <= end) addTest(name, d);
      });
    });
    return Array.from(testMap.entries()).map(([name, dates]) => ({
      name,
      dates: dates.sort((a, b) => a.getTime() - b.getTime()),
    }));
  };

  // Get events in date range — combines calendarEvents (athlete-bound) + plan-state (wizard-assigned)
  const getEventsInRange = (start: Date, end: Date): EventDetail[] => {
    const eventMap = new Map<string, Date[]>();
    const addEvent = (name: string, d: Date) => {
      const existing = eventMap.get(name);
      if (existing) existing.push(d);
      else eventMap.set(name, [d]);
    };
    // Source 1: calendarEvents (athlete-bound)
    athleteCalendarEvents
      .filter(e => e.type === 'event')
      .forEach(e => {
        const d = parseISO(e.date);
        if (d >= start && d <= end) addEvent(e.title, d);
      });
    // Source 2: plan-state (wizard-assigned events)
    macrocycleData?.events?.forEach((e: any) => {
      const name = e.name || 'Event';
      e.eventDates?.forEach((ed: string) => {
        const d = parseISO(ed);
        if (d >= start && d <= end) addEvent(name, d);
      });
    });
    return Array.from(eventMap.entries()).map(([name, dates]) => ({
      name,
      dates: dates.sort((a, b) => a.getTime() - b.getTime()),
    }));
  };

  // Calculate total mesocycle days from microcycles
  const totalMesocycleDays = mesocycles.reduce((sum, meso) =>
    sum + meso.microcycles.reduce((mesoSum, micro) => mesoSum + micro.duration, 0), 0
  );
  const expectedTotalDays = planStartDate && planEndDate && planEndDate > planStartDate
    ? differenceInDays(planEndDate, planStartDate) + 1
    : totalWeeks * 7;
  const daysMismatch = expectedTotalDays > 0 && totalMesocycleDays !== expectedTotalDays;

  // Helper functions for microcycle management
  const toggleMesocycleExpansion = (mesocycleId: string) => {
    const newExpanded = new Set(expandedMesocycles);
    if (newExpanded.has(mesocycleId)) {
      newExpanded.delete(mesocycleId);
    } else {
      newExpanded.add(mesocycleId);
    }
    setExpandedMesocycles(newExpanded);
  };

  // Helper to recalculate all mesocycle dates based on microcycle durations
  const recalculateAllMesocycleDates = (mesocyclesArray: ExtendedMesocycle[], startDate: Date): ExtendedMesocycle[] => {
    let currentDate = startDate;
    return mesocyclesArray.map(meso => {
      const totalDays = meso.microcycles.reduce((sum, mc) => sum + mc.duration, 0);
      const mesoStartDate = currentDate;
      const mesoEndDate = addDays(currentDate, totalDays - 1);
      currentDate = addDays(mesoEndDate, 1); // Next mesocycle starts day after
      return {
        ...meso,
        startDate: mesoStartDate,
        endDate: mesoEndDate,
        weeks: Math.ceil(totalDays / 7),
        duration: Math.ceil(totalDays / 7)
      };
    });
  };

  const addMicrocycle = (mesocycleIndex: number) => {
    const updated = [...mesocycles];
    const mesocycle = updated[mesocycleIndex];
    const newMicrocycle: Microcycle = {
      id: `micro-${mesocycleIndex + 1}-${mesocycle.microcycles.length + 1}`,
      name: `Microcycle ${mesocycle.microcycles.length + 1}`,
      duration: 7,
      intensity: "moderate"
    };
    mesocycle.microcycles.push(newMicrocycle);
    
    // Recalculate all mesocycle dates
    const recalculated = recalculateAllMesocycleDates(updated, planStartDate);
    setMesocycles(recalculated);
  };

  const removeMicrocycle = (mesocycleIndex: number, microcycleIndex: number) => {
    const updated = [...mesocycles];
    updated[mesocycleIndex].microcycles.splice(microcycleIndex, 1);
    
    // Recalculate all mesocycle dates
    const recalculated = recalculateAllMesocycleDates(updated, planStartDate);
    setMesocycles(recalculated);
  };

  const updateMicrocycle = (mesocycleIndex: number, microcycleIndex: number, field: keyof Microcycle, value: any) => {
    const updated = [...mesocycles];
    (updated[mesocycleIndex].microcycles[microcycleIndex] as any)[field] = value;
    
    // Recalculate all mesocycle dates when duration changes
    if (field === 'duration') {
      const recalculated = recalculateAllMesocycleDates(updated, planStartDate);
      setMesocycles(recalculated);
    } else {
      setMesocycles(updated);
    }
  };

  const renderMesocycleSetup = () => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Mesocycle Setup</span>
            </CardTitle>
            <CardDescription>
              Configure the structure and duration of your mesocycles.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 max-w-full">
        {/* Duration Validation Error */}
        {daysMismatch && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-destructive">
                <Info className="h-4 w-4" />
                <span className="font-medium">Duration Mismatch — Cannot proceed</span>
              </div>
              <button
                className="text-xs font-medium bg-destructive text-destructive-foreground px-3 py-1 rounded hover:bg-destructive/90 transition-colors"
                onClick={() => {
                  if (mesocycles.length === 0) return;
                  let remaining = expectedTotalDays - totalMesocycleDays;
                  if (remaining === 0) return;
                  const updated = mesocycles.map(m => ({
                    ...m,
                    microcycles: m.microcycles.map(mc => ({ ...mc }))
                  }));
                  if (remaining > 0) {
                    // Add all extra days to last microcycle
                    const lastMeso = updated[updated.length - 1];
                    if (lastMeso.microcycles.length > 0) {
                      lastMeso.microcycles[lastMeso.microcycles.length - 1].duration += remaining;
                    }
                  } else {
                    // Cascade removal backwards through microcycles
                    for (let mi = updated.length - 1; mi >= 0 && remaining < 0; mi--) {
                      const meso = updated[mi];
                      for (let mci = meso.microcycles.length - 1; mci >= 0 && remaining < 0; mci--) {
                        const canRemove = meso.microcycles[mci].duration - 1;
                        if (canRemove > 0) {
                          const toRemove = Math.min(canRemove, -remaining);
                          meso.microcycles[mci].duration -= toRemove;
                          remaining += toRemove;
                        }
                      }
                    }
                  }
                  setMesocycles(recalculateAllMesocycleDates(updated, planStartDate));
                }}
              >
                Auto-fix
              </button>
            </div>
            <p className="text-sm text-destructive/80 mt-1">
              Your microcycles total <strong>{totalMesocycleDays} days</strong> but the plan is <strong>{expectedTotalDays} days</strong>.{' '}
              {totalMesocycleDays < expectedTotalDays
                ? `Add ${expectedTotalDays - totalMesocycleDays} day(s) to your microcycles.`
                : `Remove ${totalMesocycleDays - expectedTotalDays} day(s) from your microcycles.`}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="numMesocycles">Number of Mesocycles</Label>
            <Input
              id="numMesocycles"
              type="number"
              min="1"
              max="12"
              placeholder=""
              autoComplete="off"
              value={mesocycles.length === 0 ? '' : mesocycles.length}
            onChange={(e) => {
              const inputValue = e.target.value;
              
              // Allow empty input (user is typing)
              if (inputValue === '') {
                setMesocycles([]);
                return;
              }
              
              const count = parseInt(inputValue);
              
              // Validate the parsed number
              if (isNaN(count) || count < 1 || count > 12) {
                return;
              }
              
              const newMesocycles: ExtendedMesocycle[] = Array.from({ length: count }, (_, i) => {
                // Calculate microcycles for each mesocycle
                const isLastMesocycle = i === count - 1;
                const baseWeeks = Math.floor(totalWeeks / count);
                const extraWeeks = totalWeeks % count;
                const mesocycleWeeks = baseWeeks + (i < extraWeeks ? 1 : 0);
                
                const microcycles: Microcycle[] = Array.from({ length: mesocycleWeeks }, (_, j) => ({
                  id: `micro-${i + 1}-${j + 1}`,
                  name: `Microcycle ${j + 1}`,
                  duration: 7,
                  intensity: "moderate" as Intensity
                }));

                return {
                  id: `meso-${i + 1}`,
                  name: `Mesocycle ${i + 1}`,
                  weeks: mesocycleWeeks,
                  sessionsPerWeek: 3,
                  sessionLength: 60,
                  startDate: new Date(),
                  endDate: new Date(),
                  duration: mesocycleWeeks,
                  intensity: "moderate" as IntensityLevel,
                  trainingMethods: [],
                  trainingQualities: [],
                  microcycles
                };
              });
              setMesocycles(newMesocycles);
            }}
          />
        </div>

        {mesocycles.length > 0 && (
          <>
            <div className="space-y-4 max-w-full overflow-x-auto">
              <h4 className="font-semibold">Mesocycle Configuration</h4>
              <div className="grid grid-cols-1 gap-4">
                {mesocycles.map((meso, index) => (
                  <div key={meso.id} className="border rounded-lg">
                    {/* Mesocycle Header - Clickable */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b"
                      onClick={() => toggleMesocycleExpansion(meso.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform ${
                              expandedMesocycles.has(meso.id) ? 'rotate-180' : ''
                            }`} 
                          />
                          <Input
                            value={meso.name}
                            onChange={(e) => {
                              e.stopPropagation();
                              const updated = [...mesocycles];
                              updated[index].name = e.target.value;
                              setMesocycles(updated);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium flex-1"
                          />
                          <div className="flex items-center space-x-2">
                            <Label>Intensity:</Label>
                            <Select
                              value={meso.intensity}
                              onValueChange={(value: IntensityLevel) => {
                                const updated = [...mesocycles];
                                updated[index].intensity = value;
                                setMesocycles(updated);
                              }}
                            >
                              <SelectTrigger 
                                className="w-36"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`w-3 h-3 rounded ${getIntensityColor(meso.intensity)}`}></div>
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {intensityLevels.map((level) => (
                                  <SelectItem key={level} value={level}>
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 rounded ${getIntensityColor(level)}`}></div>
                                      <span className="capitalize">{level.replace("-", " ")}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {meso.microcycles?.length || 0} microcycles 
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Microcycles List - Expandable */}
                    {expandedMesocycles.has(meso.id) && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-sm">Microcycles</h5>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addMicrocycle(index)}
                          >
                            Add Microcycle
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          {meso.microcycles?.map((micro, microIndex) => (
                            <div key={micro.id} className="flex items-center space-x-3 p-3 border rounded-md bg-muted/20 w-fit">
                              <Input
                                value={micro.name}
                                onChange={(e) => updateMicrocycle(index, microIndex, 'name', e.target.value)}
                                className="flex-1 max-w-sm"
                                placeholder="Microcycle name"
                              />
                              <div className="flex items-center space-x-2">
                                <Label className="text-sm">Days:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="14"
                                  value={micro.duration}
                                  onChange={(e) => updateMicrocycle(index, microIndex, 'duration', parseInt(e.target.value))}
                                  className="w-16"
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeMicrocycle(index, microIndex)}
                                disabled={meso.microcycles.length <= 1}
                              >
                                Delete
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Total days: {meso.microcycles?.reduce((sum, micro) => sum + micro.duration, 0) || 0}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Microcycle Intensity Planning Chart */}
            <div className="mt-6">
              <h4 className="font-semibold mb-4">Microcycle Intensity Configuration</h4>
              <MicrocycleIntensityPlanning 
                mesocycles={mesocycles}
                intensityLevels={intensityLevels}
                getIntensityColor={getIntensityColor}
                onMicrocycleIntensityChange={handleMicrocycleIntensityChange}
                onMesocycleIntensityChange={(mesocycleId, intensity) => {
                  const mesoIndex = mesocycles.findIndex(m => m.id === mesocycleId);
                  if (mesoIndex !== -1) {
                    const updated = [...mesocycles];
                    updated[mesoIndex] = { ...updated[mesoIndex], intensity };
                    setMesocycles(updated);
                  }
                }}
                onCopyMesocycle={copyMesocycleIntensity}
                subGoals={[
                  ...(macrocycleData?.subGoals || []),
                  ...(macrocycleData?.smartGoals || []).map((sg: any) => ({ testDates: sg.testDates || [], testMethod: sg.description || '', description: sg.description || '' })),
                  ...(macrocycleData?.athleteExistingTests || []).map((t: any) => ({ testDates: t.testDates, testMethod: t.testMethod })),
                ]}
                events={[...(macrocycleData?.events || []), ...(macrocycleData?.athleteExistingEvents || []).map((e: any) => ({ eventDates: e.eventDates, name: e.name }))]}
                planStartDate={planStartDate}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // Handler for microcycle intensity changes
  const handleMicrocycleIntensityChange = (mesocycleId: string, microcycleId: string, intensity: IntensityLevel) => {
    setMesocycles(prev => 
      prev.map(meso => {
        if (meso.id === mesocycleId) {
          return {
            ...meso,
            microcycles: meso.microcycles.map(micro => 
              micro.id === microcycleId ? { ...micro, intensity } : micro
            )
          };
        }
        return meso;
      })
    );
  };

  // Handle copying mesocycle intensity setup
  const copyMesocycleIntensity = (targetMesocycleId: string) => {
    const targetMesocycle = mesocycles.find(m => m.id === targetMesocycleId);
    
    if (!targetMesocycle || targetMesocycle.microcycles.length === 0) return;
    
    // Find the index of the target mesocycle
    const targetIndex = mesocycles.findIndex(m => m.id === targetMesocycleId);
    
    if (targetIndex <= 0) {
      toast({
        title: "No previous mesocycle",
        description: "This is the first mesocycle in your training plan."
      });
      return;
    }
    
    // Search backwards for a compatible mesocycle (same microcycle structure)
    let compatibleMesocycle = null;
    for (let i = targetIndex - 1; i >= 0; i--) {
      const candidate = mesocycles[i];
      
      // Check if microcycle structure matches (same number and durations)
      if (candidate.microcycles.length === targetMesocycle.microcycles.length) {
        const structureMatches = candidate.microcycles.every((micro, idx) => 
          micro.duration === targetMesocycle.microcycles[idx].duration
        );
        
        if (structureMatches) {
          compatibleMesocycle = candidate;
          break;
        }
      }
    }
    
    if (!compatibleMesocycle) {
      // Open dialog to select from other mesocycles
      setTargetMesocycleForIntensityCopy({
        mesocycleId: targetMesocycleId,
        microcycleStructure: targetMesocycle.microcycles.map(m => ({
          id: m.id,
          duration: m.duration
        }))
      });
      setMesocycleCopyDialogOpen(true);
      return;
    }
    
    // Copy intensities from all microcycles
    setMesocycles(prev => 
      prev.map(meso => {
        if (meso.id === targetMesocycleId) {
          return {
            ...meso,
            microcycles: meso.microcycles.map((micro, idx) => ({
              ...micro,
              intensity: compatibleMesocycle.microcycles[idx].intensity
            }))
          };
        }
        return meso;
      })
    );
    
    toast({
      title: "Mesocycle intensity copied",
      description: `Copied intensity setup from ${compatibleMesocycle.name}`
    });
  };

  // Handle cross-mesocycle intensity copy for Step 2
  const handleCrossMesocycleIntensityCopy = (sourceMesocycleId: string) => {
    if (!targetMesocycleForIntensityCopy) return;
    
    // Find source mesocycle in current mesocycles
    let sourceMesocycle = mesocycles.find(m => m.id === sourceMesocycleId);
    
    if (!sourceMesocycle) {
      // Try to find in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('macrocycleData')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.mesocycles) {
              sourceMesocycle = data.mesocycles.find((m: any) => m.id === sourceMesocycleId);
              if (sourceMesocycle) break;
            }
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
    }
    
    if (!sourceMesocycle || !sourceMesocycle.microcycles) return;
    
    // Copy intensities from all microcycles
    setMesocycles(prev => 
      prev.map(meso => {
        if (meso.id === targetMesocycleForIntensityCopy.mesocycleId) {
          return {
            ...meso,
            microcycles: meso.microcycles.map((micro, idx) => ({
              ...micro,
              intensity: sourceMesocycle.microcycles[idx]?.intensity || micro.intensity
            }))
          };
        }
        return meso;
      })
    );
    
    toast({
      title: "Mesocycle intensity copied",
      description: "Intensity setup has been copied successfully."
    });
  };



  // Helper functions for sub-goal and method management
  // v1 athleticism database removed - sub-goals come directly from macrocycle data
  const getSubGoalsFromAthleticismDB = useMemo(() => {
    return macrocycleData?.subGoals?.map((sg: any) => sg.description) || [];
  }, [macrocycleData]);

  const getMethodsForAllocatedSubGoals = useMemo(() => {
    if (!macrocycleData) return [];

    const methodsSet = new Set<string>();

    // Primary approach: Use directly selected methods from macrocycle if available
    if (macrocycleData.selectedMethods && Array.isArray(macrocycleData.selectedMethods)) {
      macrocycleData.selectedMethods.forEach((method: string) => methodsSet.add(method));
    }

    // Also check methodsByQuality for methods selected through the quality-based flow
    if (macrocycleData.methodsByQuality && typeof macrocycleData.methodsByQuality === 'object') {
      Object.values(macrocycleData.methodsByQuality).forEach((entry: any) => {
        if (entry?.list && Array.isArray(entry.list)) {
          entry.list.forEach((method: string) => methodsSet.add(method));
        }
      });
    }

    // Add manually added methods from macrocycle data (can be objects with methodId or strings)
    if (macrocycleData.manuallyAddedMethods && Array.isArray(macrocycleData.manuallyAddedMethods)) {
      macrocycleData.manuallyAddedMethods.forEach((method: any) => {
        if (typeof method === 'string') {
          methodsSet.add(method);
        } else if (method && typeof method === 'object' && method.methodId) {
          methodsSet.add(method.methodId);
        }
      });
    }

    // Add locally manually added methods (also can be objects or strings)
    manuallyAddedMethods.forEach((method: any) => {
      if (typeof method === 'string') {
        methodsSet.add(method);
      } else if (method && typeof method === 'object' && method.methodId) {
        methodsSet.add(method.methodId);
      }
    });

    return Array.from(methodsSet);
  }, [macrocycleData, manuallyAddedMethods]);

  const groupMethodsByToolboxCategory = useMemo(() => {
    // Filter to only valid string methods
    const methods = getMethodsForAllocatedSubGoals.filter(
      (m): m is string => typeof m === 'string' && m.trim() !== ''
    );
    const grouped: Record<string, Record<string, string[]>> = {};
    
    methods.forEach(method => {
      let category = 'General Training';
      let subCategory = 'General';
      
      // Parse "Category - SubCategory" format directly from the method name
      if (method.includes(' - ')) {
        const parts = method.split(' - ');
        category = parts[0];
        subCategory = parts.slice(1).join(' - ');
      } else {
        // Fallback for methods without the standard format
        category = method;
        subCategory = method;
      }
      
      if (!grouped[category]) grouped[category] = {};
      if (!grouped[category][subCategory]) grouped[category][subCategory] = [];
      
      grouped[category][subCategory].push(method);
    });
    
    return grouped;
  }, [getMethodsForAllocatedSubGoals, manuallyAddedMethods]);

  // Ordered grouped methods based on user-defined category order
  const orderedGroupedMethods = useMemo(() => {
    const grouped = groupMethodsByToolboxCategory;
    const categoryKeys = Object.keys(grouped);
    
    if (methodCategoryOrder.length > 0) {
      const ordered: Record<string, Record<string, string[]>> = {};
      
      // First add categories in the saved order
      methodCategoryOrder.forEach(cat => {
        if (grouped[cat]) ordered[cat] = grouped[cat];
      });
      
      // Then add any new categories that weren't in the saved order
      categoryKeys.forEach(cat => {
        if (!ordered[cat]) ordered[cat] = grouped[cat];
      });
      
      return ordered;
    }
    
    return grouped;
  }, [groupMethodsByToolboxCategory, methodCategoryOrder]);

  // Save method category order to localStorage
  useEffect(() => {
    if (methodCategoryOrder.length > 0) {
      localStorage.setItem('methodCategoryOrder', JSON.stringify(methodCategoryOrder));
    }
  }, [methodCategoryOrder]);

  // Handle category reorder from drag-and-drop
  const handleCategoryReorder = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const categories = Object.keys(orderedGroupedMethods);
    const newCategories = Array.from(categories);
    const [reorderedItem] = newCategories.splice(result.source.index, 1);
    newCategories.splice(result.destination.index, 0, reorderedItem);
    
    setMethodCategoryOrder(newCategories);
  }, [orderedGroupedMethods]);

  // Helper function to get methods with loading recommendations for a specific sub-goal
  // v1 athleticism database removed - always returns empty
  const getMethodsWithRecommendationsForSubGoal = useMemo(() => (_subGoal: string) => [], []);

  // Helper function to format loading recommendations into readable text
  const formatLoadingRecommendations = (recommendations: Record<string, any>): string => {
    if (!recommendations || Object.keys(recommendations).length === 0) {
      return "No specific recommendations available";
    }

    const formatValue = (key: string, value: any): string => {
      if (typeof value === 'object' && value !== null) {
        // Handle nested objects like 'Modes' in Isometrics
        if (key === 'Modes') {
          const modeStrings = Object.entries(value).map(([modeName, modeParams]: [string, any]) => {
            const modeParamStrings = Object.entries(modeParams).map(([paramKey, paramValue]) => 
              `${paramKey}: ${paramValue}`
            ).join(', ');
            return `${modeName} (${modeParamStrings})`;
          });
          return `${key}: ${modeStrings.join('; ')}`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    };

    return Object.entries(recommendations)
      .map(([key, value]) => formatValue(key, value))
      .join(', ');
  };

  // Helper function to toggle sub-goal expansion
  const toggleSubGoalExpansion = (mesocycleId: string, subGoal: string) => {
    setExpandedSubGoals(prev => {
      const mesocycleExpanded = prev[mesocycleId] || new Set();
      const newMesocycleExpanded = new Set(mesocycleExpanded);
      
      if (newMesocycleExpanded.has(subGoal)) {
        newMesocycleExpanded.delete(subGoal);
      } else {
        newMesocycleExpanded.add(subGoal);
      }
      
      return {
        ...prev,
        [mesocycleId]: newMesocycleExpanded
      };
    });
  };

  const getParametersForMethod = (method: string) => {
    // Determine method category and subcategory
    let category = 'General Training';
    let subCategory = 'General';
    
    if (method.toLowerCase().includes('sprint')) {
      category = 'Sprinting';
      if (method.toLowerCase().includes('acceleration')) subCategory = 'Acceleration';
      else if (method.toLowerCase().includes('resisted')) subCategory = 'Resisted Sprinting';
      else if (method.toLowerCase().includes('top speed')) subCategory = 'Top Speed';
    } else if (method.toLowerCase().includes('resistance') || method.toLowerCase().includes('strength')) {
      if (method.toLowerCase().includes('lower body')) {
        category = 'Lower Body Resistance Training';
        if (method.toLowerCase().includes('strength')) subCategory = 'Strength';
        else if (method.toLowerCase().includes('power')) subCategory = 'Power';
      }
    } else if (method.toLowerCase().includes('jump') || method.toLowerCase().includes('plyometric')) {
      category = 'Plyometrics';
      if (method.toLowerCase().includes('intensive')) subCategory = 'Intensive Jumps';
      else if (method.toLowerCase().includes('extensive')) subCategory = 'Extensive Jumps';
    }
    
    // Get parameters from toolbox data (using migrated parameterName)
    const parameters = toolboxData.entries
      .filter(entry => entry.category === category && entry.subCategory === subCategory)
      .map(entry => ({
        name: entry.parameterName,
        type: entry.parameterType === 'quantitative' ? 'number' : 
              (entry.options.length > 0 ? 'select' : 'text'),
        unit: entry.parameterType === 'quantitative' && entry.options.length > 0 ? entry.options[0] : '',
        options: entry.parameterType === 'qualitative' && entry.options.length > 0 ? entry.options : undefined
      }));
    
    return parameters;
  };

  // Helper function to get tests and events scheduled within a mesocycle's date range
  // Combines calendarEvents (athlete-bound) + plan-state (wizard-assigned smart goals, sub-goals, events)
  const getTestsAndEventsForMesocycle = useCallback((mesocycle: ExtendedMesocycle) => {
    const mesoStart = mesocycle.startDate;
    const mesoEnd = mesocycle.endDate;
    const testMap = new Map<string, Date[]>();
    const eventMap = new Map<string, Date[]>();
    const addTest = (name: string, d: Date) => {
      const ex = testMap.get(name); if (ex) ex.push(d); else testMap.set(name, [d]);
    };
    const addEvent = (name: string, d: Date) => {
      const ex = eventMap.get(name); if (ex) ex.push(d); else eventMap.set(name, [d]);
    };
    // Source 1: calendarEvents (athlete-bound)
    athleteCalendarEvents.forEach(e => {
      const d = parseISO(e.date);
      if (d >= mesoStart && d <= mesoEnd) {
        if (e.type === 'test') addTest(e.title, d);
        else addEvent(e.title, d);
      }
    });
    // Source 2: plan-state smart goal tests (scheduled directly on a SmartGoal)
    macrocycleData?.smartGoals?.forEach((sg: any) => {
      const name = sg.description || 'Test';
      sg.testDates?.forEach((td: string) => {
        const d = parseISO(td);
        if (d >= mesoStart && d <= mesoEnd) addTest(name, d);
      });
    });
    // Source 3: plan-state sub-goal tests
    macrocycleData?.subGoals?.forEach((sg: any) => {
      const name = sg.testMethod || sg.description || 'Test';
      sg.testDates?.forEach((td: string) => {
        const d = parseISO(td);
        if (d >= mesoStart && d <= mesoEnd) addTest(name, d);
      });
    });
    // Source 4: plan-state events
    macrocycleData?.events?.forEach((e: any) => {
      const name = e.name || 'Event';
      e.eventDates?.forEach((ed: string) => {
        const d = parseISO(ed);
        if (d >= mesoStart && d <= mesoEnd) addEvent(name, d);
      });
    });
    // Emit one entry per (name, date) so the tooltip groups all dates correctly
    const tests = Array.from(testMap.entries()).flatMap(([name, dates]) =>
      dates.map(date => ({ name, date }))
    );
    const events = Array.from(eventMap.entries()).flatMap(([name, dates]) =>
      dates.map(date => ({ name, date }))
    );
    return { tests, events };
  }, [athleteCalendarEvents, macrocycleData]);

  // Toggle method allocation for a specific mesocycle
  const toggleMethodAllocation = useCallback((methodName: string, mesocycleId: string) => {
    setMethodAllocations(prev => {
      const current = prev[methodName] || [];
      const isCurrentlyAllocated = current.includes(mesocycleId);
      
      if (isCurrentlyAllocated) {
        return {
          ...prev,
          [methodName]: current.filter(id => id !== mesocycleId)
        };
      } else {
        return {
          ...prev,
          [methodName]: [...current, mesocycleId]
        };
      }
    });
  }, []);

  // Bulk assign all methods to all mesocycles
  const bulkAssignAllMethods = useCallback(() => {
    const allMethods = getMethodsForAllocatedSubGoals;
    const allMesocycleIds = mesocycles.map(m => m.id);
    
    const newAllocations: Record<string, string[]> = {};
    allMethods.forEach(method => {
      newAllocations[method] = [...allMesocycleIds];
    });
    
    setMethodAllocations(newAllocations);
    toast({
      title: "Methods allocated",
      description: `All ${allMethods.length} methods assigned to all ${mesocycles.length} mesocycles`
    });
  }, [getMethodsForAllocatedSubGoals, mesocycles, toast]);

  // Clear all method allocations
  const clearAllMethodAllocations = useCallback(() => {
    const allMethods = getMethodsForAllocatedSubGoals;
    
    const newAllocations: Record<string, string[]> = {};
    allMethods.forEach(method => {
      newAllocations[method] = [];
    });
    
    setMethodAllocations(newAllocations);
    toast({
      title: "Allocations cleared",
      description: "All method allocations have been cleared"
    });
  }, [getMethodsForAllocatedSubGoals, toast]);

  // Auto-initialize method allocations when methods or mesocycles change
  useEffect(() => {
    const allMethods = getMethodsForAllocatedSubGoals;
    const allMesocycleIds = mesocycles.map(m => m.id);
    
    // Only auto-initialize if there are methods and mesocycles, but no allocations yet
    if (allMethods.length > 0 && allMesocycleIds.length > 0 && Object.keys(methodAllocations).length === 0) {
      // Default: assign all methods to all mesocycles
      const initialAllocations: Record<string, string[]> = {};
      allMethods.forEach(method => {
        initialAllocations[method] = [...allMesocycleIds];
      });
      setMethodAllocations(initialAllocations);
    }
  }, [getMethodsForAllocatedSubGoals, mesocycles]);

  // Carousel navigation computed values for Step 3
  const visibleMesocycles = useMemo(() => {
    return mesocycles.slice(mesocycleViewOffset, mesocycleViewOffset + MAX_VISIBLE_MESOCYCLES);
  }, [mesocycles, mesocycleViewOffset, MAX_VISIBLE_MESOCYCLES]);
  
  const hasMoreMesocycles = mesocycles.length > MAX_VISIBLE_MESOCYCLES;
  const canGoBackMesocycle = mesocycleViewOffset > 0;
  const canGoForwardMesocycle = mesocycleViewOffset + MAX_VISIBLE_MESOCYCLES < mesocycles.length;

  // Reset mesocycle offset if mesocycles are removed
  useEffect(() => {
    if (mesocycleViewOffset >= mesocycles.length && mesocycles.length > 0) {
      setMesocycleViewOffset(Math.max(0, mesocycles.length - MAX_VISIBLE_MESOCYCLES));
    }
  }, [mesocycles.length, mesocycleViewOffset]);

  const renderMethodAllocation = () => {
    const allMethods = getMethodsForAllocatedSubGoals;
    // Use orderedGroupedMethods to respect drag-and-drop order
    const groupedMethods = groupMethodsByToolboxCategory;
    
    // Check if all methods are allocated to all mesocycles
    const allAllocated = allMethods.length > 0 && allMethods.every(method => {
      const allocation = methodAllocations[method] || [];
      return mesocycles.every(meso => allocation.includes(meso.id));
    });

    return (
      <>
        <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Mesocycle Characterization</span>
              </CardTitle>
              <CardDescription>
                Define each mesocycle's purpose and assign training methods. Click the notes icon to add coach notes.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={allAllocated ? "outline" : "default"}
                size="sm"
                onClick={bulkAssignAllMethods}
              >
                Assign All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllMethodAllocations}
              >
                Clear All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {allMethods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No training methods available.</p>
              <p className="text-sm text-muted-foreground">Please select training methods in the Macrocycle Planning step first.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
              {/* Carousel Navigation */}
              {hasMoreMesocycles && (
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMesocycleViewOffset(prev => Math.max(0, prev - 1))}
                    disabled={!canGoBackMesocycle}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Mesocycles {mesocycleViewOffset + 1}-{Math.min(mesocycleViewOffset + MAX_VISIBLE_MESOCYCLES, mesocycles.length)} of {mesocycles.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMesocycleViewOffset(prev => 
                      Math.min(mesocycles.length - MAX_VISIBLE_MESOCYCLES, prev + 1)
                    )}
                    disabled={!canGoForwardMesocycle}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
              
              {/* Header Row */}
              <div className="grid bg-muted/50 border-b" style={{
                gridTemplateColumns: `300px repeat(${visibleMesocycles.length}, minmax(180px, 1fr))`
              }}>
                <div className="p-3 font-medium border-r sticky left-0 bg-muted/50 z-10">
                  Training Methods
                </div>
                {visibleMesocycles.map((meso) => {
                  const { tests, events } = getTestsAndEventsForMesocycle(meso);
                  
                  return (
                    <div key={meso.id} className="p-3 text-center border-r last:border-r-0">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded ${getIntensityColor(meso.intensity)}`}></div>
                        <span className="font-medium text-sm">{meso.name}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 p-0"
                                onClick={() => {
                                  setSelectedMesocycleForNotes(meso);
                                  setNotesDialogOpen(true);
                                }}
                              >
                                <MessageSquare className={`h-3.5 w-3.5 ${mesocycleNotes[meso.id] ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{mesocycleNotes[meso.id] ? 'Edit coach notes' : 'Add coach notes'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(meso.startDate, 'MMM d')} - {format(meso.endDate, 'MMM d')}
                      </div>
                      {/* Tests and Events - Centered below date */}
                      {(tests.length > 0 || events.length > 0) && (() => {
                        // Group tests by name
                        const groupedTests = tests.reduce((acc, test) => {
                          if (!acc[test.name]) acc[test.name] = { dates: [] };
                          acc[test.name].dates.push(test.date);
                          return acc;
                        }, {} as Record<string, { dates: Date[] }>);
                        
                        // Group events by name
                        const groupedEvents = events.reduce((acc, event) => {
                          if (!acc[event.name]) acc[event.name] = [];
                          acc[event.name].push(event.date);
                          return acc;
                        }, {} as Record<string, Date[]>);
                        
                        return (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            {Object.keys(groupedTests).length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-pointer">
                                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                        <Trophy className="h-3 w-3" />
                                      </Badge>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold">Tests:</p>
                                      {Object.entries(groupedTests).map(([name, data]) => (
                                        <div key={name} className="text-xs text-muted-foreground">
                                          <div>• {name}</div>
                                          <div className="pl-2 text-[10px]">
                                            {data.dates.sort((a, b) => a.getTime() - b.getTime()).map(d => format(d, 'MMM d')).join(', ')}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {Object.keys(groupedEvents).length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-pointer">
                                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                                        <CalendarDays className="h-3 w-3" />
                                      </Badge>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold">Events:</p>
                                      {Object.entries(groupedEvents).map(([name, dates]) => (
                                        <div key={name} className="text-xs text-muted-foreground">
                                          <div>• {name}</div>
                                          <div className="pl-2 text-[10px]">
                                            {dates.sort((a, b) => a.getTime() - b.getTime()).map(d => format(d, 'MMM d')).join(', ')}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Method Rows grouped by category - with drag-and-drop reordering */}
              <DragDropContext onDragEnd={handleCategoryReorder}>
                <Droppable droppableId="method-categories">
                  {(provided) => (
                    <div 
                      className="max-h-[500px] overflow-y-auto"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {Object.entries(orderedGroupedMethods).map(([category, subCategories], categoryIndex) => (
                        <Draggable key={category} draggableId={category} index={categoryIndex}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? 'shadow-lg bg-background rounded' : ''}
                            >
                              {/* Category Header */}
                              <div 
                                className="grid bg-muted/30 border-b border-t"
                                style={{
                                  gridTemplateColumns: `300px repeat(${visibleMesocycles.length}, minmax(180px, 1fr))`
                                }}
                              >
                                <div className="px-3 py-2 sticky left-0 bg-muted/30 z-10 flex items-center gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
                                  >
                                    <GripVerticalIcon className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <span className="font-semibold text-sm text-primary">{category}</span>
                                </div>
                                {visibleMesocycles.map((meso) => (
                                  <div key={meso.id} className="border-r last:border-r-0" />
                                ))}
                              </div>
                              
                              {/* Methods (subcategories) in this category */}
                              {Object.entries(subCategories).map(([subCategory, methods]) => 
                                methods.map((method) => {
                                  const allocation = methodAllocations[method] || [];
                                  const allMesosAllocated = mesocycles.every(m => allocation.includes(m.id));
                                  
                                  return (
                                    <div 
                                      key={method} 
                                      className="grid border-b group hover:bg-muted/20 transition-colors"
                                      style={{
                                        gridTemplateColumns: `300px repeat(${visibleMesocycles.length}, minmax(180px, 1fr))`
                                      }}
                                    >
                                      <div className="p-3 border-r flex items-center gap-2 pl-10 sticky left-0 bg-background z-10 group-hover:bg-muted/20">
                                        <input
                                          type="checkbox"
                                          checked={allMesosAllocated}
                                          onChange={() => {
                                            // Toggle all mesocycles for this method
                                            if (allMesosAllocated) {
                                              setMethodAllocations(prev => ({
                                                ...prev,
                                                [method]: []
                                              }));
                                            } else {
                                              setMethodAllocations(prev => ({
                                                ...prev,
                                                [method]: mesocycles.map(m => m.id)
                                              }));
                                            }
                                          }}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-sm truncate cursor-help">{subCategory}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-md">
                                              <p>{method}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                      
                                      {visibleMesocycles.map((meso) => {
                                        const isAllocated = allocation.includes(meso.id);
                                        
                                        return (
                                          <div 
                                            key={meso.id} 
                                            className="p-3 flex items-center justify-center border-r last:border-r-0"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isAllocated}
                                              onChange={() => toggleMethodAllocation(method, meso.id)}
                                              className="h-5 w-5 rounded border-gray-300 cursor-pointer"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              </div>
            </div>
          )}
          
          {/* Summary */}
          {allMethods.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>
                {allMethods.length} methods available
              </span>
              <span>
                {allMethods.filter(m => (methodAllocations[m] || []).length > 0).length} methods allocated to at least one mesocycle
              </span>
            </div>
          )}
          
          {/* Manual Method Selection */}
          <div className="border rounded-lg p-4 bg-muted/20 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-1">
                <h4 className="font-medium">Manual Method Selection</h4>
                <p className="text-sm text-muted-foreground">
                  Add training methods from the toolbox that are not covered by your selected sub-goals.
                </p>
              </div>
              <Button 
                onClick={() => setIsAddMethodDialogOpen(true)}
                variant="outline"
                className="shrink-0"
              >
                Add Method
              </Button>
            </div>
            
            {/* Show manually added methods */}
            {manuallyAddedMethods.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-sm font-medium">Manually Added Methods:</Label>
                <div className="flex flex-wrap gap-2">
                  {manuallyAddedMethods.map((method) => (
                    <Badge 
                      key={method} 
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <span className="text-xs">Manual:</span>
                      {method}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => handleRemoveMethod(method)}
                      >
                        ×
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      </>
    );
  };

  // Parameter value helpers (moved out to keep hooks stable)
  // Helper functions for category-based method names
  const getBaseMethodName = (fullMethodName: string): string => {
    return fullMethodName.split('::')[0];
  };

  const getCategoryFromMethodName = (fullMethodName: string): string | null => {
    const parts = fullMethodName.split('::');
    return parts.length > 1 ? parts[1] : null;
  };

  const getMethodExerciseCategories = useCallback((methodName: string): string[] => {
    if (!toolboxData.entries) return [];
    
    // Find all toolbox entries that match this method and have exercise categories
    const matchingEntries = toolboxData.entries.filter(entry => {
      const entryKey = `${entry.category}${entry.subCategory ? ` - ${entry.subCategory}` : ''}`;
      return normalizeForComparison(entryKey) === normalizeForComparison(methodName);
    });
    
    // Collect unique exercise categories
    const categories = new Set<string>();
    matchingEntries.forEach(entry => {
      if (entry.exerciseCategories && Array.isArray(entry.exerciseCategories)) {
        entry.exerciseCategories.forEach(cat => categories.add(cat));
      }
    });
    
    return Array.from(categories);
  }, [toolboxData.entries]);

  const hasExerciseCategories = useCallback((methodName: string): boolean => {
    const categories = getMethodExerciseCategories(methodName);
    return categories.length > 0;
  }, [getMethodExerciseCategories]);

  const updateParameterValue = useCallback((mesocycleId: string, microcycleIndex: number, methodName: string, parameterName: string, value: string | number, sessionIndex: number = 0) => {
    startTransition(() => {
      setParameterValues(prev => {
        const updated = { ...prev };
        if (!updated[mesocycleId]) updated[mesocycleId] = {};
        if (!updated[mesocycleId][microcycleIndex]) updated[mesocycleId][microcycleIndex] = {};
        if (!updated[mesocycleId][microcycleIndex][methodName]) updated[mesocycleId][microcycleIndex][methodName] = {};
        if (!updated[mesocycleId][microcycleIndex][methodName][sessionIndex]) updated[mesocycleId][microcycleIndex][methodName][sessionIndex] = {};
        updated[mesocycleId][microcycleIndex][methodName][sessionIndex][parameterName] = value;
        return updated;
      });
    });
  }, [startTransition]);

  const getParameterValue = useCallback((mesocycleId: string, microcycleIndex: number, methodName: string, parameterName: string, sessionIndex: number = 0) => {
    return parameterValues[mesocycleId]?.[microcycleIndex]?.[methodName]?.[sessionIndex]?.[parameterName] || '';
  }, [parameterValues]);

  // Helper function to check if a method should be shown for a mesocycle
  const isMethodAllocatedToMesocycle = useCallback((methodName: string, mesocycleId: string) => {
    // Handle both base method name and category-suffixed names
    const baseMethodName = getBaseMethodName(methodName);
    
    // Use direct method allocations if available
    const allocation = methodAllocations[baseMethodName];
    if (allocation !== undefined) {
      return allocation.includes(mesocycleId);
    }
    
    // Fallback: if no allocations defined yet, default to allocated (for backward compatibility)
    // This ensures methods show up until user explicitly manages allocations
    return true;
  }, [methodAllocations]);

  // Helper function to get cell-specific frequency from user input
  const getCellFrequency = (mesocycleId: string, microcycleIndex: number, methodName: string) => {
    // Handle both base method name and category-suffixed names
    const baseMethodName = getBaseMethodName(methodName);
    
    const cellData = parameterValues[mesocycleId]?.[microcycleIndex]?.[methodName]?.[0] || {};
    
    // Get the method's toolbox entries
    const methodEntries = toolboxData.entries.filter(
      entry => `${entry.category} → ${entry.subCategory}` === baseMethodName
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

  // Helper function to get microcycle split key (global across all methods)
  const getMicrocycleSplitKey = (mesocycleId: string, microcycleIndex: number) => {
    return `${mesocycleId}-${microcycleIndex}`;
  };

  // Helper function to toggle microcycle split (affects all methods in that microcycle)
  const toggleMicrocycleSplit = (mesocycleId: string, microcycleIndex: number) => {
    const key = getMicrocycleSplitKey(mesocycleId, microcycleIndex);
    setGlobalMicrocycleSplitStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper function to check if microcycle is split (global across all methods)
  const isMicrocycleSplit = (mesocycleId: string, microcycleIndex: number) => {
    const key = getMicrocycleSplitKey(mesocycleId, microcycleIndex);
    return globalMicrocycleSplitStates[key] || false;
  };

  // Helper function to get number of sessions for a cell
  const getCellSessions = (mesocycleId: string, microcycleIndex: number, methodName: string) => {
    // Handle both base method name and category-suffixed names
    const baseMethodName = getBaseMethodName(methodName);
    const frequency = getCellFrequency(mesocycleId, microcycleIndex, methodName);
    return frequency; // Always return the actual frequency regardless of split state
  };

  // Toggle category split for a method
  const toggleCategorySplit = useCallback((methodName: string) => {
    const isSplit = categorySplitStates[methodName];
    const categories = getMethodExerciseCategories(methodName);
    
    if (!isSplit) {
      // SPLITTING: Copy current method data to each category
      setParameterValues(prev => {
        const updated = { ...prev };
        
        // For each mesocycle where this method is allocated
        mesocycles.forEach(meso => {
          if (!isMethodAllocatedToMesocycle(methodName, meso.id)) return;
          
          const mesoData = updated[meso.id] || {};
          
          // For each microcycle
          (meso.microcycles || []).forEach((_, microIndex) => {
            const microData = mesoData[microIndex] || {};
            const methodData = microData[methodName];
            
            if (methodData) {
              // Copy to each category
              categories.forEach(category => {
                const categoryKey = `${methodName}::${category}`;
                microData[categoryKey] = JSON.parse(JSON.stringify(methodData)); // Deep copy
              });
              
              // Remove original method data
              delete microData[methodName];
            }
            
            mesoData[microIndex] = microData;
          });
          
          updated[meso.id] = mesoData;
        });
        
        return updated;
      });
      
      // Update split state
      setCategorySplitStates(prev => ({ ...prev, [methodName]: true }));
      
      toast({
        title: "Method split by category",
        description: `${methodName} is now split into ${categories.length} category rows`
      });
      
    } else {
      // UNSPLITTING: Merge category data back to method
      setParameterValues(prev => {
        const updated = { ...prev };
        
        mesocycles.forEach(meso => {
          if (!isMethodAllocatedToMesocycle(methodName, meso.id)) return;
          
          const mesoData = updated[meso.id] || {};
          
          (meso.microcycles || []).forEach((_, microIndex) => {
            const microData = mesoData[microIndex] || {};
            
            // Take first category's data as the merged data
            const firstCategoryKey = `${methodName}::${categories[0]}`;
            const firstCategoryData = microData[firstCategoryKey];
            
            if (firstCategoryData) {
              microData[methodName] = firstCategoryData;
            }
            
            // Remove all category keys
            categories.forEach(category => {
              delete microData[`${methodName}::${category}`];
            });
            
            mesoData[microIndex] = microData;
          });
          
          updated[meso.id] = mesoData;
        });
        
        return updated;
      });
      
      // Update split state
      setCategorySplitStates(prev => ({ ...prev, [methodName]: false }));
      
      toast({
        title: "Categories merged",
        description: `${methodName} is now a single row`
      });
    }
  }, [categorySplitStates, getMethodExerciseCategories, mesocycles, isMethodAllocatedToMesocycle, toast]);

  // Clear all parameter values
  const handleClearAllParameters = useCallback(() => {
    setParameterValues({});
    localStorage.setItem('mesocycle-parameter-values', JSON.stringify({}));
    setIsClearParametersDialogOpen(false);
    toast({
      title: "Parameters cleared",
      description: "All parameter values have been cleared successfully.",
    });
  }, [toast]);

  // Clear all exercise selections
  const handleClearAllExercises = useCallback(() => {
    // Clear localStorage items
    localStorage.removeItem('microcyclePlanningState');
    localStorage.removeItem('exerciseSelectionData');
    // Sync React state so AI context immediately reflects the cleared state
    setExerciseCellData({});
    // Force remount of MicrocyclePlanningTable to reset all state
    setMpTableKey(k => k + 1);
    setIsClearAllExercisesDialogOpen(false);
    
    toast({
      title: "Exercises cleared",
      description: "All exercise selections have been cleared successfully.",
    });
  }, [toast]);

  // Helper function to get global microcycle width (max frequency across all allocated methods)
  const getGlobalMicrocycleWidth = useCallback((mesocycleId: string, microcycleIndex: number) => {
    let maxFrequency = 1;
    
    // Scan all allocated methods for this specific microcycle
    getMethodsForAllocatedSubGoals.forEach((method: string) => {
      if (isMethodAllocatedToMesocycle(method, mesocycleId)) {
        const frequency = getCellFrequency(mesocycleId, microcycleIndex, method);
        const isSplit = isMicrocycleSplit(mesocycleId, microcycleIndex);
        if (isSplit && frequency > maxFrequency) {
          maxFrequency = frequency;
        }
      }
    });
    
    return maxFrequency > 1 ? maxFrequency * 120 : 180;
  }, [mesocycles, getMethodsForAllocatedSubGoals, isMethodAllocatedToMesocycle, getCellFrequency, isMicrocycleSplit]);

  // Get visible mesocycles based on selected IDs (maintains original order)
  const getVisibleMesocyclesForPeriodization = useCallback(() => {
    if (visibleMesocycleIds.size === 0) {
      // Fallback: show first mesocycle if nothing selected
      return mesocycles.length > 0 ? [mesocycles[0]] : [];
    }
    // Filter and maintain original order
    return mesocycles.filter(m => visibleMesocycleIds.has(m.id));
  }, [mesocycles, visibleMesocycleIds]);

  // Helper to check if there's a gap before a mesocycle (for visual indicator)
  const hasMesocycleGap = useCallback((mesoId: string) => {
    const visibleMesos = getVisibleMesocyclesForPeriodization();
    const currentVisibleIndex = visibleMesos.findIndex(m => m.id === mesoId);
    if (currentVisibleIndex <= 0) return false;
    
    const fullIndex = mesocycles.findIndex(m => m.id === mesoId);
    const prevVisibleMeso = visibleMesos[currentVisibleIndex - 1];
    const prevFullIndex = mesocycles.findIndex(m => m.id === prevVisibleMeso.id);
    
    // Gap exists if there's more than 1 position between them in the full list
    return fullIndex - prevFullIndex > 1;
  }, [mesocycles, getVisibleMesocyclesForPeriodization]);

  // Toggle mesocycle visibility
  const toggleMesocycleVisibility = useCallback((mesoId: string) => {
    setVisibleMesocycleIds(prev => {
      const next = new Set(prev);
      if (next.has(mesoId)) {
        // Don't allow deselecting the last one
        if (next.size > 1) {
          next.delete(mesoId);
        }
      } else {
        next.add(mesoId);
      }
      return next;
    });
  }, []);

  // Select all mesocycles
  const selectAllMesocycles = useCallback(() => {
    setVisibleMesocycleIds(new Set(mesocycles.map(m => m.id)));
  }, [mesocycles]);

  // Initialize visible mesocycles when mesocycles change
  useEffect(() => {
    if (mesocycles.length > 0 && visibleMesocycleIds.size === 0) {
      // Default: first 2 mesocycles visible (or just 1 if only 1 exists)
      setVisibleMesocycleIds(new Set(mesocycles.slice(0, 2).map(m => m.id)));
    } else if (mesocycles.length > 0) {
      // Clean up any IDs that no longer exist
      const validIds = new Set(
        Array.from(visibleMesocycleIds).filter(id => mesocycles.some(m => m.id === id))
      );
      if (validIds.size === 0) {
        setVisibleMesocycleIds(new Set(mesocycles.slice(0, 2).map(m => m.id)));
      } else if (validIds.size !== visibleMesocycleIds.size) {
        setVisibleMesocycleIds(validIds);
      }
    }
  }, [mesocycles]);

  // Helper function to generate dynamic header grid template using global widths
  const generateHeaderGridTemplate = useCallback((visibleMesos?: ExtendedMesocycle[]) => {
    const mesosToUse = visibleMesos || mesocycles;
    const widths = ['300px'];
    mesosToUse.forEach((meso, index) => {
      // Add gap column if there's a gap before this mesocycle
      if (hasMesocycleGap(meso.id)) {
        widths.push('24px'); // Gap indicator column
      }
      (meso.microcycles || []).forEach((_, microcycleIndex) => {
        const width = getGlobalMicrocycleWidth(meso.id, microcycleIndex);
        widths.push(`${width}px`);
      });
    });
    return widths.join(' ');
  }, [mesocycles, getGlobalMicrocycleWidth, hasMesocycleGap]);

  // Helper function to calculate grid template for dynamic widths using global calculation
  const calculateGridTemplate = useCallback((methodName: string, visibleMesos?: ExtendedMesocycle[]) => {
    const mesosToUse = visibleMesos || mesocycles;
    const widths = ['300px']; // Fixed left column
    mesosToUse.forEach((meso) => {
      // Add gap column if there's a gap before this mesocycle
      if (hasMesocycleGap(meso.id)) {
        widths.push('24px'); // Gap indicator column
      }
      (meso.microcycles || []).forEach((_, microcycleIndex) => {
        const width = getGlobalMicrocycleWidth(meso.id, microcycleIndex);
        widths.push(`${width}px`);
      });
    });
    return widths.join(' ');
  }, [mesocycles, getGlobalMicrocycleWidth, hasMesocycleGap]);

  // Helper function to check if a method has a valid frequency parameter
  const hasValidFrequencyParameter = useCallback((methodName: string): boolean => {
    if (!toolboxData.entries) return false;
    
    const normalizedMethodName = normalizeForComparison(methodName);
    
    // Strategy 1: Try exact match using full entry key
    let matchingEntries = toolboxData.entries.filter(entry => {
      const entryKey = `${entry.category}${entry.subCategory ? ' - ' + entry.subCategory : ''}`;
      return normalizeForComparison(entryKey) === normalizedMethodName;
    });
    
    // Strategy 2: If no exact match, split methodName and match category + subCategory separately
    if (matchingEntries.length === 0) {
      const parts = methodName.split(' - ').map(p => p.trim());
      const category = parts[0];
      const subCategory = parts[1] || '';
      
      matchingEntries = toolboxData.entries.filter(entry => {
        const categoryMatch = normalizeForComparison(entry.category) === normalizeForComparison(category);
        const subCategoryMatch = normalizeForComparison(entry.subCategory || '') === normalizeForComparison(subCategory);
        return categoryMatch && subCategoryMatch;
      });
    }
    
    // Strategy 3: Category-only fallback if still no matches
    if (matchingEntries.length === 0) {
      const parts = methodName.split(' - ').map(p => p.trim());
      const category = parts[0];
      
      matchingEntries = toolboxData.entries.filter(entry => {
        return normalizeForComparison(entry.category) === normalizeForComparison(category);
      });
      
    }

    // If still no matches found, return false
    if (matchingEntries.length === 0) {
      return false;
    }
    
    // Check if any matching entry is marked as frequency parameter
    return matchingEntries.some(entry => entry.isFrequencyParameter === true);
  }, [toolboxData.entries]);

  // Helper function to check if parameter is frequency-related
  const isFrequencyParameter = (paramName: string, methodName: string) => {
    // Get the method's toolbox entries
    const baseMethodName = getBaseMethodName(methodName);
    const methodEntries = toolboxData.entries.filter(
      entry => `${entry.category} → ${entry.subCategory}` === baseMethodName
    );
    
    // Find the parameter that's marked as frequency parameter
    const frequencyParam = methodEntries.find(entry => entry.isFrequencyParameter);
    
    // Check if the provided paramName matches the frequency parameter
    // Fallback to string matching for backward compatibility
    return frequencyParam ? paramName === frequencyParam.parameterName : paramName.toLowerCase().includes('frequency');
  };

  // Drag fill handlers (hooks must be at component level)
  const handleDragStart = useCallback((cellId: string, value: string | number) => {
    startDrag(cellId, value);
  }, [startDrag]);

  const handleDragEnd = useCallback(() => {
    fillCells((cellId: string, value: string | number) => {
      const [mesocycleId, microcycleIndex, methodName, sessionIndex, parameterName] = cellId.split('::');
      if (mesocycleId && microcycleIndex !== undefined && methodName && sessionIndex !== undefined && parameterName) {
        updateParameterValue(mesocycleId, parseInt(microcycleIndex), methodName, parameterName, value, parseInt(sessionIndex));
      }
    });
    endDrag();
    setTimeout(clearSelection, 100);
  }, [fillCells, endDrag, clearSelection, dragState.selectedCells, dragState.sourceValue]);

  // Fill functionality handlers
  const handleFillRight = useCallback((cellId: string, value: string | number, fillEmptyOnly = false) => {
    const [mesocycleId, microcycleIndex, methodName, sessionIndex, parameterName] = cellId.split('::');
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return;

    const startingMicrocycleIndex = parseInt(microcycleIndex);
    const sessionIdx = parseInt(sessionIndex);
    
    // Fill to the right within the same mesocycle
    for (let i = startingMicrocycleIndex + 1; i < (mesocycle.microcycles?.length || 0); i++) {
      const targetCellId = `${mesocycleId}::${i}::${methodName}::${sessionIdx}::${parameterName}`;
      const currentValue = getParameterValue(mesocycleId, i, methodName, parameterName, sessionIdx);
      
      if (!fillEmptyOnly || !currentValue) {
        updateParameterValue(mesocycleId, i, methodName, parameterName, value, sessionIdx);
      }
    }
  }, [mesocycles, getParameterValue, updateParameterValue]);

  const handleFillRow = useCallback((cellId: string, value: string | number, allMesocycles = false, fillEmptyOnly = false) => {
    const [, microcycleIndex, methodName, sessionIndex, parameterName] = cellId.split('::');
    const targetMicrocycleIndex = parseInt(microcycleIndex);
    const sessionIdx = parseInt(sessionIndex);

    const targetMesocycles = allMesocycles ? mesocycles : 
      mesocycles.filter(m => cellId.startsWith(m.id));

    targetMesocycles.forEach(mesocycle => {
      // Check if method is allocated to this mesocycle
      if (!isMethodAllocatedToMesocycle(methodName, mesocycle.id)) return;
      
      if (targetMicrocycleIndex < (mesocycle.microcycles?.length || 0)) {
        const targetCellId = `${mesocycle.id}::${targetMicrocycleIndex}::${methodName}::${sessionIdx}::${parameterName}`;
        const currentValue = getParameterValue(mesocycle.id, targetMicrocycleIndex, methodName, parameterName, sessionIdx);
        
        if (!fillEmptyOnly || !currentValue) {
          updateParameterValue(mesocycle.id, targetMicrocycleIndex, methodName, parameterName, value, sessionIdx);
        }
      }
    });
  }, [mesocycles, getParameterValue, updateParameterValue]);

  const handleRowFill = useCallback((
    methodName: string, 
    parameterName: string, 
    value: string | number, 
    unit?: string,
    selectedMesocycleIds?: string[],
    fillEmptyOnly: boolean = false,
    sessionIndex: number = 0
  ) => {
    // Determine which mesocycles to fill
    let targetMesocycles = mesocycles.filter(mesocycle => 
      isMethodAllocatedToMesocycle(methodName, mesocycle.id)
    );
    
    // If specific mesocycles selected, filter to only those
    if (selectedMesocycleIds && selectedMesocycleIds.length > 0) {
      targetMesocycles = targetMesocycles.filter(m => selectedMesocycleIds.includes(m.id));
    }

    // Fill the selected mesocycles
    targetMesocycles.forEach(mesocycle => {
      for (let i = 0; i < (mesocycle.microcycles?.length || 0); i++) {
        // Check if this microcycle is split into multiple sessions
        const isSplit = isMicrocycleSplit(mesocycle.id, i);
        
        if (isSplit) {
          // When microcycle is split, fill ALL sessions based on frequency
          // Use getCellFrequency directly to get the method's frequency, default to at least 1
          const frequency = getCellFrequency(mesocycle.id, i, methodName);
          const sessionsToFill = Math.max(frequency, 1);
          
          for (let sessionIdx = 0; sessionIdx < sessionsToFill; sessionIdx++) {
            // When explicitly using fill dialog on split microcycle, fill all sessions
            updateParameterValue(mesocycle.id, i, methodName, parameterName, value, sessionIdx);
            if (unit !== undefined) {
              updateParameterValue(mesocycle.id, i, methodName, `${parameterName}_unit`, unit, sessionIdx);
            }
          }
        } else {
          // Normal single session fill (use session 0)
          const currentValue = getParameterValue(mesocycle.id, i, methodName, parameterName, 0);
          if (!fillEmptyOnly || !currentValue) {
            updateParameterValue(mesocycle.id, i, methodName, parameterName, value, 0);
          }
          if (unit !== undefined) {
            updateParameterValue(mesocycle.id, i, methodName, `${parameterName}_unit`, unit, 0);
          }
        }
      }
    });
  }, [mesocycles, getParameterValue, updateParameterValue, isMethodAllocatedToMesocycle, isMicrocycleSplit, getCellFrequency]);

  // ── Template loading helpers ──────────────────────────────────────────────

  const totalPlanMicrocycles = useMemo(() =>
    mesocycles.reduce((sum, meso) => sum + (meso.microcycles?.length ?? 0), 0),
    [mesocycles],
  );

  /** Convert wizard method name ("Cat - Sub") to template methodId ("Cat|||Sub") */
  const getTemplatesForWizardMethod = useCallback((methodName: string): ProgramTemplate[] => {
    const parts = methodName.split(' - ');
    const category = parts[0]?.trim() ?? '';
    const subCategory = parts.slice(1).join(' - ').trim();
    const methodId = `${category}|||${subCategory}`;
    return templates.filter(t =>
      normalizeForComparison(t.methodId) === normalizeForComparison(methodId),
    );
  }, [templates]);

  /** Derive MethodParam list for the currently-open load-template dialog */
  const loadTemplateDialogParams = useMemo((): MethodParam[] => {
    const mName = loadTemplateDialog.lookupName || loadTemplateDialog.methodName;
    if (!mName || !toolboxData.entries) return [];
    return toolboxData.entries
      .filter(entry => {
        const entryKey = `${entry.category}${entry.subCategory ? ` - ${entry.subCategory}` : ''}`;
        return (
          normalizeForComparison(entryKey) === normalizeForComparison(mName) ||
          normalizeForComparison(entry.parameterName) === normalizeForComparison(mName)
        );
      })
      .filter(entry => entry.showInGridByDefault !== false)
      .map(entry => ({
        parameterName: entry.parameterName,
        isFrequencyParameter: entry.isFrequencyParameter,
        isQuantitative: entry.parameterType === 'quantitative',
        options: entry.options,
      }));
  }, [loadTemplateDialog.lookupName, loadTemplateDialog.methodName, toolboxData.entries]);

  const handleLoadTemplate = useCallback((columns: TemplateColumn[]) => {
    const methodName = loadTemplateDialog.methodName;

    // Flat ordered list of (mesocycleId, microcycleIndex) pairs
    const flatMicrocycles: Array<{ mesocycleId: string; microcycleIndex: number }> = [];
    mesocycles.forEach(meso => {
      (meso.microcycles || []).forEach((_, i) => {
        flatMicrocycles.push({ mesocycleId: meso.id, microcycleIndex: i });
      });
    });

    // Frequency param name for this method (never split into per-session)
    const methodEntries = toolboxData.entries.filter(
      entry => `${entry.category} → ${entry.subCategory}` === methodName,
    );
    const freqParamName = methodEntries.find(e => e.isFrequencyParameter)?.parameterName ?? null;

    const colsToApply = columns.slice(0, flatMicrocycles.length);
    const splitUpdates: Record<string, boolean> = {};

    colsToApply.forEach((col, colIndex) => {
      const { mesocycleId, microcycleIndex } = flatMicrocycles[colIndex];
      const allHalves = [col.parameters, col.parametersB, col.parametersC, col.parametersD, col.parametersE];
      const sessionsToFill = col.isSplit ? Math.min(col.splitCount, 5) : 1;

      for (let s = 0; s < sessionsToFill; s++) {
        const halfParams = allHalves[s] ?? {};
        Object.entries(halfParams).forEach(([paramName, value]) => {
          if (!value) return;
          // Frequency is always a merged cell in the wizard — always session 0
          const sessionIndex = paramName === freqParamName ? 0 : s;
          updateParameterValue(mesocycleId, microcycleIndex, methodName, paramName, value, sessionIndex);
        });
      }

      if (col.isSplit) {
        splitUpdates[`${mesocycleId}-${microcycleIndex}`] = true;
      }
    });

    if (Object.keys(splitUpdates).length > 0) {
      setGlobalMicrocycleSplitStates(prev => ({ ...prev, ...splitUpdates }));
    }

    toast({
      title: 'Template loaded',
      description: `Values applied to ${Math.min(columns.length, flatMicrocycles.length)} microcycle(s).`,
    });
  }, [loadTemplateDialog.methodName, mesocycles, toolboxData.entries, updateParameterValue, toast]);

  // Global keyboard shortcuts for drag-fill UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            break;
          case 'r':
            if (e.shiftKey) {
              e.preventDefault();
              // Fill right functionality - find focused input
              const activeElement = document.activeElement as HTMLInputElement;
              if (activeElement && activeElement.type === 'number' || activeElement.type === 'text') {
                const cell = activeElement.closest('[data-drag-cell]');
                const cellId = cell?.getAttribute('data-drag-cell');
                const isAllocated = cell?.getAttribute('data-allocated') === 'true';
                
                if (cellId && isAllocated && activeElement.value) {
                  const value = activeElement.type === 'number' ? 
                    (isNaN(Number(activeElement.value)) ? activeElement.value : Number(activeElement.value)) : 
                    activeElement.value;
                  handleFillRight(cellId, value);
                }
              }
            }
            break;
          case 'c':
            e.preventDefault();
            break;
          case 'v':
            e.preventDefault();
            break;
        }
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    };

    const handleDragFill = (e: CustomEvent) => {
      const targetEl = (e.detail as any)?.target as HTMLElement | null;
      const cellId = targetEl?.getAttribute('data-drag-cell');
      const isAllocated = targetEl?.getAttribute('data-allocated') === 'true';
      if (cellId && isAllocated && dragState.isDragging) {
        addToSelection(cellId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragFill', handleDragFill as EventListener);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragFill', handleDragFill as EventListener);
    };
  }, [clearSelection, dragState.isDragging, addToSelection, handleFillRight]);

  // Manual method management functions
  const handleAddMethod = useCallback((method: string) => {
    // Add to manually added methods list
    const newManualMethods = [...manuallyAddedMethods, method];
    setManuallyAddedMethods(newManualMethods);
    localStorage.setItem('manuallyAddedMethods', JSON.stringify(newManualMethods));
    
    // Auto-allocate to all mesocycles so it appears in the allocation grid immediately
    const allMesocycleIds = mesocycles.map(m => m.id);
    setMethodAllocations(prev => {
      const updated = { ...prev, [method]: allMesocycleIds };
      localStorage.setItem('methodAllocations', JSON.stringify(updated));
      return updated;
    });
  }, [manuallyAddedMethods, mesocycles]);

  const handleRemoveMethod = useCallback((method: string) => {
    // Remove from manually added methods
    const newManualMethods = manuallyAddedMethods.filter(m => m !== method);
    setManuallyAddedMethods(newManualMethods);
    localStorage.setItem('manuallyAddedMethods', JSON.stringify(newManualMethods));
    
    // Also remove from allocations
    setMethodAllocations(prev => {
      const updated = { ...prev };
      delete updated[method];
      localStorage.setItem('methodAllocations', JSON.stringify(updated));
      return updated;
    });
  }, [manuallyAddedMethods]);

  // Method classification helpers
  const isManualMethod = useCallback((method: string): boolean => {
    return manuallyAddedMethods.includes(method);
  }, [manuallyAddedMethods]);

  const isAutoAllocatedMethod = useCallback((method: string): boolean => {
    return getMethodsForAllocatedSubGoals.includes(method) && !manuallyAddedMethods.includes(method);
  }, [getMethodsForAllocatedSubGoals, manuallyAddedMethods]);

  // Enhanced delete handler for table headers
  const handleDeleteMethod = useCallback((method: string) => {
    setMethodToDelete(method);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDeleteMethod = useCallback(() => {
    if (!methodToDelete) return;

    if (isManualMethod(methodToDelete)) {
      // Direct removal for manual methods
      handleRemoveMethod(methodToDelete);
      toast({
        title: "Method deleted",
        description: `${methodToDelete} has been removed from your training plan.`,
      });
    } else {
      // For auto-allocated methods, remove from macrocycleData.methodsByQuality
      const updatedMacrocycleData = { ...macrocycleData };
      
      // Find and remove method from all quality-method associations
      if (updatedMacrocycleData.methodsByQuality) {
        Object.keys(updatedMacrocycleData.methodsByQuality).forEach(qualityId => {
          const entry = updatedMacrocycleData.methodsByQuality[qualityId];
          if (entry?.list && Array.isArray(entry.list)) {
            entry.list = entry.list.filter((m: string) => m !== methodToDelete);
          }
        });
      }
      
      // Update context state (context setter writes to localStorage)
      setMacrocycleData(updatedMacrocycleData);
      
      toast({
        title: "Method removed",
        description: `${methodToDelete} has been removed from your sub-goal allocations.`,
      });
    }

    setMethodToDelete(null);
    setIsDeleteDialogOpen(false);
  }, [methodToDelete, isManualMethod, handleRemoveMethod, macrocycleData, toast]);

  const cancelDeleteMethod = useCallback(() => {
    setMethodToDelete(null);
    setIsDeleteDialogOpen(false);
  }, []);

  // Get methods that are already selected (to exclude from add dialog)
  const getExcludedMethods = useCallback(() => {
    return getMethodsForAllocatedSubGoals;
  }, [getMethodsForAllocatedSubGoals]);

  // Precompute method parameters map to avoid recalculation on every render
  const methodParametersMap = useMemo(() => {
    const map: Record<string, Array<{
      name: string;
      type: string;
      options: string[];
      isQuantitative: boolean;
      isQualitative: boolean;
      isCalculated?: boolean;
      formula?: string;
    }>> = {};

    if (!toolboxData.entries) return map;

    const allMethods = getMethodsForAllocatedSubGoals;
    
    allMethods.forEach(methodName => {
      // Find all toolbox entries that match this method
      const matchingEntries = toolboxData.entries.filter(entry => {
        const entryKey = `${entry.category}${entry.subCategory ? ` - ${entry.subCategory}` : ''}`;
        return normalizeForComparison(entryKey) === normalizeForComparison(methodName) ||
               normalizeForComparison(entry.parameterName) === normalizeForComparison(methodName);
      });
      
      // Convert toolbox entries to parameter format
      map[methodName] = matchingEntries.map(entry => ({
        name: entry.parameterName,
        type: entry.parameterType === 'quantitative' ? 'number' : 'text',
        options: entry.options,
        isQuantitative: entry.parameterType === 'quantitative',
        isQualitative: entry.parameterType === 'qualitative',
        isCalculated: entry.isCalculated,
        formula: entry.formula
      }));
    });

    return map;
  }, [toolboxData.entries, getMethodsForAllocatedSubGoals]);

  // Helper function to compute calculated parameter values
  const computeCalculatedValue = useCallback((
    mesocycleId: string,
    microcycleIndex: number,
    methodName: string,
    formula: string,
    siblingParameters: Array<{ name: string; isCalculated?: boolean }>,
    sessionIndex: number = 0
  ): number | null => {
    const context: Record<string, number> = {};
    
    // Get values from all non-calculated sibling parameters
    siblingParameters.forEach(param => {
      if (param.isCalculated) return; // Skip other calculated params
      
      const value = getParameterValue(mesocycleId, microcycleIndex, methodName, param.name, sessionIndex);
      if (value !== undefined && value !== null && value !== '') {
        const numValue = parseFloat(value.toString());
        if (!isNaN(numValue)) {
          context[param.name] = numValue;
        }
      }
    });
    
    return evaluateFormula(formula, context);
  }, [getParameterValue]);

  // Get parameter information for a specific cell in exercise selection table
  const getParametersForCell = useCallback((
    mesocycleId: string,
    microcycleId: string | undefined,
    methodId: string,
    categoryName: string | undefined
  ): string => {
    // Helper to check if a parameter is a base parameter (not auto-generated session variant)
    const isBaseParameter = (paramName: string): boolean => {
      // Auto-generated parameters have suffixes like _set1, _set2, _set1_set1, etc.
      // Base parameters are the original user-defined ones
      return !/_set\d+(?:_set\d+)?$/.test(paramName);
    };
    
    // Get full method name with category if applicable
    const fullMethodName = categoryName ? `${methodId}::${categoryName}` : methodId;
    
    // Find the mesocycle
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return '';
    
    // Determine which microcycles to check
    let microcyclesToCheck: Array<{index: number}>;
    
    if (microcycleId) {
      // Split: only check specific microcycle
      const microcycleIndex = mesocycle.microcycles.findIndex(m => m.id === microcycleId);
      if (microcycleIndex === -1) return '';
      microcyclesToCheck = [{index: microcycleIndex}];
    } else {
      // Not split: check all microcycles in this mesocycle
      microcyclesToCheck = mesocycle.microcycles.map((_, i) => ({index: i}));
    }
    
    // Collect all parameter values across relevant microcycles and sessions
    const parameterMap: Record<string, Set<string | number>> = {};
    const sessionParameterMap: Record<number, Record<string, string | number>> = {}; // For session-by-session display
    let hasMultipleSessions = false;
    let maxSessionCount = 0;
    
    microcyclesToCheck.forEach(({index: microIndex}) => {
      // Check frequency split for this microcycle
      const splitKey = `${mesocycleId}-${microIndex}`;
      const isSplit = globalMicrocycleSplitStates[splitKey] || false;
      
      // Get method parameters for this microcycle
      let methodParams = parameterValues[mesocycleId]?.[microIndex]?.[fullMethodName];
      
      // FALLBACK: If no parameters found and we have a category, try the parent method
      if (!methodParams && categoryName) {
        methodParams = parameterValues[mesocycleId]?.[microIndex]?.[methodId];
      }
      
      if (!methodParams) return;
      
      const sessionCount = Object.keys(methodParams).length;
      maxSessionCount = Math.max(maxSessionCount, sessionCount);
      
      if (sessionCount > 1) {
        hasMultipleSessions = true;
        
        // Store session-specific parameters
        Object.entries(methodParams).forEach(([sessionIdx, params]) => {
          const sessionIndex = parseInt(sessionIdx);
          if (!sessionParameterMap[sessionIndex]) {
            sessionParameterMap[sessionIndex] = {};
          }
          
          Object.entries(params).forEach(([paramName, value]) => {
            // Only include base parameters, skip auto-generated session variants
            if (!isBaseParameter(paramName)) return;
            
            // For session-specific display, store directly
            sessionParameterMap[sessionIndex][paramName] = value;
          });
        });
      }
      
      // Also collect for range calculation
      Object.entries(methodParams).forEach(([sessionIdx, params]) => {
        Object.entries(params).forEach(([paramName, value]) => {
          // Only include base parameters, skip auto-generated session variants
          if (!isBaseParameter(paramName)) return;
          
          if (value !== undefined && value !== null && value !== '') {
            if (!parameterMap[paramName]) {
              parameterMap[paramName] = new Set();
            }
            parameterMap[paramName].add(value);
          }
        });
      });
    });
    
    // If no parameters found
    if (Object.keys(parameterMap).length === 0) {
      return '';
    }
    
    // Format output based on whether we have multiple sessions
    if (hasMultipleSessions && microcycleId) {
      // Session-by-session display (only when mesocycle IS split)
      
      // Collect all unique parameter names across sessions
      const allParamNames = new Set<string>();
      Object.values(sessionParameterMap).forEach(sessionParams => {
        Object.keys(sessionParams).forEach(paramName => {
          if (isBaseParameter(paramName)) {
            allParamNames.add(paramName);
          }
        });
      });
      
      if (allParamNames.size === 0) return '';
      
      // Build header row with session columns
      const headerParts = ['Parameter'.padEnd(20)]; // Left column for parameter names
      for (let sessionIdx = 0; sessionIdx < maxSessionCount; sessionIdx++) {
        headerParts.push(`Session ${sessionIdx + 1}`.padEnd(15));
      }
      const headerRow = headerParts.join('');
      
      // Build separator row
      const separatorRow = '-'.repeat(headerRow.length);
      
      // Build data rows for each parameter
      const dataRows: string[] = [];
      Array.from(allParamNames).forEach(paramName => {
        const rowParts = [paramName.padEnd(20)]; // Parameter name in first column
        
        for (let sessionIdx = 0; sessionIdx < maxSessionCount; sessionIdx++) {
          const sessionParams = sessionParameterMap[sessionIdx] || {};
          const value = sessionParams[paramName];
          
          if (value !== undefined && value !== null && value !== '') {
            // Get unit if available - try category first, fall back to parent
            let methodParamDefs = methodParametersMap[fullMethodName];
            if (!methodParamDefs && categoryName) {
              methodParamDefs = methodParametersMap[methodId];
            }
            methodParamDefs = methodParamDefs || [];
            const paramDef = methodParamDefs.find(p => p.name === paramName);
            const unit = paramDef?.isQuantitative && paramDef?.options?.[0] ? ` ${paramDef.options[0]}` : '';
            rowParts.push(`${value}${unit}`.padEnd(15));
          } else {
            rowParts.push('-'.padEnd(15)); // Empty cell indicator
          }
        }
        
        dataRows.push(rowParts.join(''));
      });
      
      // Combine header, separator, and data rows
      return [headerRow, separatorRow, ...dataRows].join('\n');
    } else {
      // Range display (when mesocycle is NOT split OR no frequency split)
      const formattedParams = Object.entries(parameterMap)
        .map(([paramName, values]) => {
          const uniqueValues = Array.from(values);
          
          if (uniqueValues.length === 0) return null;
          
          // Get unit if available - try category first, fall back to parent
          let methodParamDefs = methodParametersMap[fullMethodName];
          if (!methodParamDefs && categoryName) {
            methodParamDefs = methodParametersMap[methodId];
          }
          methodParamDefs = methodParamDefs || [];
          const paramDef = methodParamDefs.find(p => p.name === paramName);
          const unit = paramDef?.isQuantitative && paramDef?.options?.[0] ? ` ${paramDef.options[0]}` : '';
          
          if (uniqueValues.length === 1) {
            return `${paramName}: ${uniqueValues[0]}${unit}`;
          }
          
          // Try to parse as numbers for range formatting
          const numericValues = uniqueValues.map(v => {
            const parsed = parseFloat(v.toString());
            return isNaN(parsed) ? null : parsed;
          }).filter(v => v !== null) as number[];
          
          if (numericValues.length === uniqueValues.length && numericValues.length > 1) {
            // All numeric: show range
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            return `${paramName}: ${min}-${max}${unit}`;
          } else {
            // Mixed or non-numeric: show list
            return `${paramName}: ${uniqueValues.join(', ')}${unit}`;
          }
        })
        .filter(Boolean)
        .join('\n');
      
      return formattedParams;
    }
  }, [mesocycles, parameterValues, globalMicrocycleSplitStates, methodParametersMap]);

  const renderMethodPeriodization = () => {
    // Only show methods that are allocated to at least one mesocycle in Step 3
    const allMethods = getMethodsForAllocatedSubGoals.filter(method => {
      const allocatedMesocycles = methodAllocations[method] || [];
      return allocatedMesocycles.length > 0;
    });
    
    // Filter grouped methods to only include allocated methods (nested structure: category -> subcategory -> methods)
    // Use orderedGroupedMethods to respect the order set in Step 3
    const groupedMethods: Record<string, Record<string, string[]>> = {};
    Object.entries(orderedGroupedMethods).forEach(([category, subCategories]) => {
      const filteredSubCategories: Record<string, string[]> = {};
      Object.entries(subCategories).forEach(([subCategory, methods]) => {
        const allocatedMethods = methods.filter(method => {
          const allocatedMesocycles = methodAllocations[method] || [];
          return allocatedMesocycles.length > 0;
        });
        if (allocatedMethods.length > 0) {
          filteredSubCategories[subCategory] = allocatedMethods;
        }
      });
      if (Object.keys(filteredSubCategories).length > 0) {
        groupedMethods[category] = filteredSubCategories;
      }
    });
    
    // Helper function to get mesocycle overview data
    const getMesocycleOverview = (mesocycle: ExtendedMesocycle) => {
      return {
        subGoals: mesocycle.allocatedSubGoals || []
      };
    };


    // Helper function for intensity colors with transparency
    const intensityBg = (intensity: string) => {
      switch (intensity) {
        case "off":
          return "bg-[hsl(var(--intensity-off)/0.7)] text-foreground border-2";
        case "deload":
          return "bg-[hsl(var(--intensity-deload)/0.7)] text-white";
        case "easy":
          return "bg-[hsl(var(--intensity-easy)/0.7)] text-white";
        case "easy-moderate":
          return "bg-[hsl(var(--intensity-easy-moderate)/0.7)] text-white";
        case "moderate":
          return "bg-[hsl(var(--intensity-moderate)/0.7)] text-foreground";
        case "moderate-hard":
          return "bg-[hsl(var(--intensity-moderate-hard)/0.7)] text-white";
        case "hard":
          return "bg-[hsl(var(--intensity-hard)/0.7)] text-white";
        case "extremely-hard":
          return "bg-[hsl(var(--intensity-extremely-hard)/0.7)] text-white";
        default:
          return "bg-muted text-muted-foreground";
      }
    };

    // Helper function to get maximum sessions needed for a method across all microcycles (for grid layout)
    const getMaxMethodSessions = (methodName: string) => {
      let maxSessions = 1;
      mesocycles.forEach(meso => {
        if (isMethodAllocatedToMesocycle(methodName, meso.id)) {
          (meso.microcycles || []).forEach((_, microcycleIndex) => {
            const sessions = getCellSessions(meso.id, microcycleIndex, methodName);
            maxSessions = Math.max(maxSessions, sessions);
          });
        }
      });
      return maxSessions;
    };

    // Helper function to get total columns needed for all methods
    const getTotalColumns = () => {
      return mesocycles.reduce((sum, meso) => {
        return sum + (meso.microcycles?.length || 0) * allMethods.reduce((methodSum, method) => {
          return methodSum + getMaxMethodSessions(method);
        }, 0);
      }, 0);
    };

    return (
      <>
      <Card className="w-full" data-step="5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Step 4: Method Periodization</span>
              </CardTitle>
              <CardDescription>
                Configure loading parameters for each training method across all mesocycles and microcycles.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsClearParametersDialogOpen(true)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Parameters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {allMethods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No training methods allocated yet.</p>
              <p className="text-sm text-muted-foreground">Allocate methods in step 3, or manually add methods below.</p>
            </div>
          ) : (
            <>
              {/* Validation warning banner */}
              {(() => {
                const methodsWithoutFrequency = allMethods.filter(method => !hasValidFrequencyParameter(method));
                if (methodsWithoutFrequency.length > 0) {
                  return (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Configuration Required</AlertTitle>
                      <AlertDescription>
                        The following methods don't have a frequency parameter marked: 
                        <strong className="ml-1">{methodsWithoutFrequency.join(', ')}</strong>
                        <br />
                        <span className="text-xs mt-2 block">
                          Go to <strong>Toolbox Database</strong> → Edit each method → Mark one quantitative parameter as "Training Frequency Parameter". 
                          This is required for session planning and exercise allocation.
                        </span>
                      </AlertDescription>
                    </Alert>
                  );
                }
                return null;
              })()}
              
              <div className="space-y-3">
               <h3 className="text-lg font-semibold">Method Periodization</h3>
               
               {/* Mesocycle Toggle Bar */}
               {mesocycles.length > 1 && (
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-sm text-muted-foreground shrink-0">Show:</span>
                    
                    {/* All button first */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllMesocycles}
                      disabled={visibleMesocycleIds.size === mesocycles.length}
                      className="h-7 px-3 text-xs shrink-0"
                    >
                      All
                    </Button>
                    
                    {/* Separator */}
                    <div className="h-6 w-px bg-border shrink-0" />
                    
                    {/* Individual mesocycle toggles */}
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1 pl-1">
                      {mesocycles.map((meso) => {
                        const isVisible = visibleMesocycleIds.has(meso.id);
                        
                        return (
                          <Button
                            key={meso.id}
                            variant={isVisible ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleMesocycleVisibility(meso.id)}
                            className={cn(
                              "min-w-[80px] shrink-0 transition-all",
                              isVisible ? "ring-2 ring-primary shadow-sm" : "opacity-60 hover:opacity-100"
                            )}
                          >
                            {meso.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
               )}
               
                 <div className="w-full border rounded-lg overflow-auto" style={{height: 'calc(100vh - 340px)', scrollbarWidth: 'thin'}}>
                   <div className="w-fit relative">
                     {/* Multi-Level Sticky Headers */}
                     <div className="sticky top-0 z-[90] bg-background border-b space-y-1 shadow-sm">
                         {/* Level 1: Mesocycle Group Headers */}
                           <div className="grid gap-1" style={{
                             gridTemplateColumns: generateHeaderGridTemplate(getVisibleMesocyclesForPeriodization())
                           }}>
                            <div className="sticky left-0 z-[95] bg-background" />
                           {getVisibleMesocyclesForPeriodization().map((meso) => {
                             const hasGap = hasMesocycleGap(meso.id);
                             return (
                               <React.Fragment key={`${meso.id}-header-group`}>
                                 {hasGap && (
                                   <div className="flex items-center justify-center bg-gradient-to-r from-muted/40 via-muted/60 to-muted/40 rounded-t-lg border-l border-r border-muted-foreground/30">
                                     <span className="text-muted-foreground text-xs">...</span>
                                   </div>
                                 )}
                                 <div 
                                   key={`${meso.id}-header`} 
                                   className={cn(
                                     "p-2 font-medium text-sm border rounded-t-lg text-center",
                                     intensityBg(meso.intensity)
                                   )}
                                   style={{ 
                                     gridColumn: `span ${meso.microcycles?.length || 0}` 
                                   }}
                                 >
                                   <div className="flex items-center justify-center space-x-2">
                                     <div className={`w-2 h-2 rounded-full bg-white/80`}></div>
                                     <span>{meso.name}</span>
                                   </div>
                                 </div>
                               </React.Fragment>
                             );
                           })}
                       </div>

                          {/* Level 2: Description */}
                          <div className="grid gap-1" style={{
                            gridTemplateColumns: generateHeaderGridTemplate(getVisibleMesocyclesForPeriodization())
                          }}>
                             <div className="sticky left-0 z-[95] bg-background" />
                           {getVisibleMesocyclesForPeriodization().map((meso) => {
                                const hasGap = hasMesocycleGap(meso.id);
                                return (
                                  <React.Fragment key={`${meso.id}-description-group`}>
                                    {hasGap && (
                                      <div className="bg-gradient-to-b from-muted/40 via-muted/60 to-muted/40 border-l border-r border-muted-foreground/30" />
                                    )}
                                    <div 
                                      key={`${meso.id}-description`} 
                                      className="p-2 bg-muted/30 border-l border-r text-xs"
                                      style={{ 
                                        gridColumn: `span ${meso.microcycles?.length || 0}` 
                                      }}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="flex-1 min-h-[40px]">
                                          {mesocycleNotes[meso.id] ? (
                                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                                              {mesocycleNotes[meso.id]}
                                            </p>
                                          ) : (
                                            <span className="text-muted-foreground italic">
                                              No description added
                                            </span>
                                          )}
                                        </div>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0"
                                                onClick={() => {
                                                  setSelectedMesocycleForNotes(meso);
                                                  setNotesDialogOpen(true);
                                                }}
                                              >
                                                <MessageSquare className={cn(
                                                  "h-3.5 w-3.5",
                                                  mesocycleNotes[meso.id] 
                                                    ? "text-primary fill-primary/20" 
                                                    : "text-muted-foreground"
                                                )} />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {mesocycleNotes[meso.id] ? 'Edit description' : 'Add description'}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                       </div>

                         {/* Level 3: Microcycle Headers with Intensity Colors */}
                          <div className="grid gap-1" style={{
                            gridTemplateColumns: generateHeaderGridTemplate(getVisibleMesocyclesForPeriodization())
                          }}>
                            <div className="sticky left-0 z-[95] bg-background" />
                           {getVisibleMesocyclesForPeriodization().map((meso) => {
                             const hasGap = hasMesocycleGap(meso.id);
                             return (
                               <React.Fragment key={`${meso.id}-micros`}>
                                 {hasGap && (
                                   <div className="bg-gradient-to-b from-muted/40 via-muted/60 to-muted/40 rounded-b-lg border-l border-r border-muted-foreground/30" />
                                 )}
                                 {(meso.microcycles || []).map((microcycle, microcycleIndex) => {
                                    const intensity = microcycle.intensity || meso.intensity;
                                    const dateRange = calculateMicrocycleDates.get(microcycle.id);
                                    const testDetails = dateRange ? getTestsInRange(dateRange.start, dateRange.end) : [];
                                    const eventDetails = dateRange ? getEventsInRange(dateRange.start, dateRange.end) : [];
                                    
                                    const distribution = getMicrocycleIntensityDistribution(microcycle.id);
                                    const hasDistributionData = Object.values(distribution).some(count => count > 0);
                                    
                                    return (
                                      <TooltipProvider key={`${meso.id}-micro-${microcycleIndex}`}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={`text-center border rounded-b cursor-help ${intensityBg(intensity)}`}>
                                              <div className="text-xs p-1 font-medium">
                                                {microcycle.name || `Mic${microcycleIndex + 1}`}
                                              </div>
                                              <div className="text-xs px-1 py-0.5 opacity-80 border-t">
                                                {microcycle.duration} days
                                              </div>
                                              {/* Event/Test indicators - centered below */}
                                              {(testDetails.length > 0 || eventDetails.length > 0) && (
                                                <div className="flex items-center justify-center gap-1 py-0.5 border-t border-border/30">
                                                  {testDetails.length > 0 && (
                                                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                                                      <Trophy className="h-2.5 w-2.5" />
                                                    </Badge>
                                                  )}
                                                  {eventDetails.length > 0 && (
                                                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                                                      <CalendarDays className="h-2.5 w-2.5" />
                                                    </Badge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom" className="p-3 max-w-xs">
                                            <div className="space-y-2">
                                              <p className="text-xs font-semibold border-b pb-1">Daily Intensity Distribution</p>
                                              {hasDistributionData ? (
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                  {Object.entries(distribution)
                                                    .filter(([_, count]) => count > 0)
                                                    .sort(([a], [b]) => {
                                                      const order = ["extremely-hard", "hard", "moderate-hard", "moderate", "easy-moderate", "easy", "deload", "off"];
                                                      return order.indexOf(a) - order.indexOf(b);
                                                    })
                                                    .map(([level, count]) => (
                                                      <div key={level} className="flex items-center gap-2 text-xs">
                                                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", getIntensityColor(level as IntensityLevel))} />
                                                        <span className="capitalize truncate">{level.replace(/-/g, ' ')}</span>
                                                        <span className="text-muted-foreground ml-auto">{count}</span>
                                                      </div>
                                                    ))}
                                                </div>
                                              ) : (
                                                <p className="text-xs text-muted-foreground">No daily intensities set yet. Configure in Step 2.</p>
                                              )}
                                              {/* Show tests/events in tooltip too */}
                                              {testDetails.length > 0 && (
                                                <div className="pt-2 border-t">
                                                  <p className="text-xs font-semibold">Tests:</p>
                                                  {testDetails.map((test, i) => (
                                                    <div key={i} className="text-xs text-muted-foreground">
                                                      <div>• {test.name}</div>
                                                      <div className="pl-2 text-[10px]">
                                                        {test.dates.map(d => format(d, 'MMM d')).join(', ')}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              {eventDetails.length > 0 && (
                                                <div className="pt-2 border-t">
                                                  <p className="text-xs font-semibold">Events:</p>
                                                  {eventDetails.map((event, i) => (
                                                    <div key={i} className="text-xs text-muted-foreground">
                                                      <div>• {event.name}</div>
                                                      <div className="pl-2 text-[10px]">
                                                        {event.dates.map(d => format(d, 'MMM d')).join(', ')}
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                               </React.Fragment>
                             );
                           })}
                        </div>
                     </div>

                      {/* Method Categories */}
                      <div className="py-4 space-y-6">
                        {Object.entries(groupedMethods).map(([category, subCategories]) => (
                          <div key={category} className="space-y-4">
                            {/* Category Header - sticky left column */}
                            <div 
                              className="grid gap-0 border-b cursor-pointer"
                              style={{ gridTemplateColumns: generateHeaderGridTemplate(getVisibleMesocyclesForPeriodization()) }}
                              onClick={() => toggleCategoryCollapse(category)}
                            >
                              <div className="sticky left-0 z-[80] p-3 bg-muted border-r overflow-hidden shadow-md">
                                <div className="flex items-center gap-2">
                                  <ChevronDown 
                                    className={cn(
                                      "h-4 w-4 transition-transform text-primary",
                                      collapsedCategories.has(category) && "-rotate-90"
                                    )} 
                                  />
                                  <h4 className="text-lg font-semibold text-primary">{category}</h4>
                                </div>
                              </div>
                            </div>
                            
                            {/* Sub-categories and Methods */}
                            {!collapsedCategories.has(category) && Object.entries(subCategories).map(([subCategory, methods]) => (
                              <div key={subCategory} className="space-y-2">

                                {/* Methods in this sub-category */}
                                {methods.map((method: string) => {
                                  const parameters = methodParametersMap[method] || [];
                                  const categories = getMethodExerciseCategories(method);
                                  const hasCategoriesAvailable = categories.length > 0;
                                  const isCategorySplit = categorySplitStates[method];
                                  
                                  // If split, render one section per category
                                  const methodsToRender = isCategorySplit 
                                    ? categories.map(cat => `${method}::${cat}`)
                                    : [method];
                                  
                                  return methodsToRender.map((fullMethodName) => {
                                    const baseMethodName = getBaseMethodName(fullMethodName);
                                    const categoryName = getCategoryFromMethodName(fullMethodName);
                                    const isIndented = categoryName !== null;
                                    const methodTemplates = getTemplatesForWizardMethod(baseMethodName);
                                    
                                    return (
                                      <div key={fullMethodName} className={`border rounded-lg bg-card shadow-sm ${isIndented ? 'border-l-4 border-l-primary/50' : ''}`}>
                                           {/* Method/Category name header */}
                                           <div className="grid gap-1 w-fit relative" style={{ 
                                                gridTemplateColumns: calculateGridTemplate(baseMethodName, getVisibleMesocyclesForPeriodization())
                                              }}>
                                              <div className="sticky left-0 z-50 p-3 border-r bg-background rounded-tl shadow-md">
                                                <div className="flex items-center justify-between group pr-16 relative">
                                                   <div className="flex items-center gap-2 flex-wrap">
                                                    <button 
                                                      onClick={(e) => { e.stopPropagation(); toggleMethodCollapse(fullMethodName); }}
                                                      className="p-0.5 hover:bg-muted-foreground/20 rounded"
                                                    >
                                                      <ChevronDown 
                                                        className={cn(
                                                          "h-4 w-4 transition-transform text-muted-foreground",
                                                          (collapsedMethods.has(fullMethodName) || (categoryName && collapsedMethods.has(method))) && "-rotate-90"
                                                        )} 
                                                      />
                                                    </button>
                                                    {categoryName && <span className="text-xs text-muted-foreground">↳</span>}
                                    <div className="line-clamp-3 text-md font-medium text-foreground" title={fullMethodName}>
                                      {categoryName ? `${subCategory}-${categoryName}` : subCategory}
                                    </div>
                                                    {/* Warning badge if no frequency parameter */}
                                                    {!hasValidFrequencyParameter(baseMethodName) && (
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger>
                                                            <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                                                              ⚠
                                                            </Badge>
                                                          </TooltipTrigger>
                                                          <TooltipContent className="max-w-xs">
                                                            <p className="font-semibold mb-1">No Frequency Parameter</p>
                                                            <p className="text-xs">
                                                              This method doesn't have a frequency parameter marked in the Toolbox Database. 
                                                              Go to Toolbox → Edit this method → Mark one quantitative parameter as "Training Frequency Parameter".
                                                            </p>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    )}
                                                  </div>
                                                 <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                                   {/* Split button - only show for base method when not split */}
                                                   {hasCategoriesAvailable && !categoryName && !isCategorySplit && (
                                                     <Button
                                                       variant="ghost"
                                                       size="sm"
                                                       className="h-6 w-6 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
                                                       onClick={() => toggleCategorySplit(baseMethodName)}
                                                       title="Split by exercise category"
                                                     >
                                                       <SplitSquareHorizontal className="h-4 w-4" />
                                                     </Button>
                                                   )}
                                                   {/* Merge button - show on ALL exercise category rows */}
                                                   {categoryName && (
                                                     <Button
                                                       variant="ghost"
                                                       size="sm"
                                                       className="h-6 w-6 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
                                                       onClick={() => toggleCategorySplit(baseMethodName)}
                                                       title="Merge categories back together"
                                                     >
                                                       <Columns className="h-4 w-4" />
                                                     </Button>
                                                   )}
                                                   {/* Load Template button - visible for base and category-split rows */}
                                                   {methodTemplates.length > 0 && (
                                                     <Button
                                                       variant="ghost"
                                                       size="sm"
                                                       className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                       onClick={() => setLoadTemplateDialog({ open: true, methodName: fullMethodName, lookupName: baseMethodName })}
                                                       title="Load template"
                                                     >
                                                       <LayoutTemplate className="h-4 w-4" />
                                                     </Button>
                                                   )}
                                                   {/* Delete button - show on all rows */}
                                                   <Button
                                                     variant="ghost"
                                                     size="sm"
                                                     className="h-6 w-6 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                     onClick={() => handleDeleteMethod(baseMethodName)}
                                                     title="Delete method"
                                                   >
                                                     <Trash2 className="h-4 w-4" />
                                                   </Button>
                                                   {/* Edit button with parameter visibility and rationale */}
                                                   <Popover>
                                                     <PopoverTrigger asChild>
                                                       <Button
                                                         variant="ghost"
                                                         size="sm"
                                                         className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                                         title="Edit parameter visibility and view rationale"
                                                       >
                                                         <SlidersHorizontal className="h-4 w-4" />
                                                       </Button>
                                                     </PopoverTrigger>
                                                     <PopoverContent className="w-80 p-3" align="start" side="bottom">
                                                       <div className="space-y-3">
                                                         {/* Parameter Visibility Section */}
                                                         <div className="space-y-2">
                                                           <h4 className="text-sm font-medium">Visible Parameters</h4>
                                                            <ScrollArea className="h-48">
                                                              <div className="space-y-1 pr-3">
                                                                {parameters.map(param => {
                                                                  const isVisible = isParameterVisibleForMethod(fullMethodName, param.name, true);
                                                                  return (
                                                                    <div key={param.name} className="flex items-center gap-2 py-1">
                                                                      <Checkbox 
                                                                        id={`visibility-${fullMethodName}-${param.name}`}
                                                                        checked={isVisible}
                                                                        onCheckedChange={(checked) => toggleParameterVisibility(fullMethodName, param.name, !!checked)}
                                                                      />
                                                                      <Label 
                                                                        htmlFor={`visibility-${fullMethodName}-${param.name}`}
                                                                        className="text-xs cursor-pointer"
                                                                      >
                                                                        {param.name}
                                                                      </Label>
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>
                                                            </ScrollArea>
                                                           <div className="flex gap-2 pt-1">
                                                             <Button 
                                                               size="sm" 
                                                               variant="outline" 
                                                               className="text-xs h-7"
                                                               onClick={() => showAllParametersForMethod(fullMethodName, parameters)}
                                                             >
                                                               Show All
                                                             </Button>
                                                             <Button 
                                                               size="sm" 
                                                               variant="outline"
                                                               className="text-xs h-7"
                                                               onClick={() => resetParameterVisibilityForMethod(fullMethodName)}
                                                             >
                                                               Reset
                                                             </Button>
                                                           </div>
                                                         </div>
                                                         
                                                         <Separator />
                                                         
                                                         {/* Rationale Section */}
                                                         <div className="space-y-2">
                                                           <h4 className="text-sm font-medium">Why This Method?</h4>
                                                           {(() => {
                                                             const rationales = getMethodRationale(baseMethodName);
                                                             if (rationales.length === 0) {
                                                               return (
                                                                 <p className="text-xs text-muted-foreground italic">
                                                                   No rationale specified. Add rationale in the Athleticism Database when linking methods to parameters.
                                                                 </p>
                                                               );
                                                             }
                                                             return rationales.map(({ rationale, parameterName }, idx) => (
                                                               <div key={idx} className="text-xs p-2 bg-muted rounded-md">
                                                                 <span className="font-medium text-primary">{parameterName}:</span>
                                                                 <p className="mt-1 text-muted-foreground">{rationale}</p>
                                                               </div>
                                                             ));
                                                           })()}
                                                         </div>
                                                       </div>
                                                     </PopoverContent>
                                                   </Popover>
                                                 </div>
                                               </div>
                                             </div>
                                           {getVisibleMesocyclesForPeriodization().map((meso) => {
                                              const hasGap = hasMesocycleGap(meso.id);
                                              return (
                                                <React.Fragment key={`${meso.id}-method-cells`}>
                                                   {hasGap && (
                                                     <div className="bg-gradient-to-b from-muted/40 via-muted/60 to-muted/40 border-l border-r border-muted-foreground/30" />
                                                   )}
                                                  {(meso.microcycles || []).map((microcycle, microcycleIndex) => {
                                                const isAllocated = isMethodAllocatedToMesocycle(fullMethodName, meso.id);
                                                const frequency = getCellFrequency(meso.id, microcycleIndex, fullMethodName);
                                                const isSplit = isMicrocycleSplit(meso.id, microcycleIndex);
                                                const sessionsCount = getCellSessions(meso.id, microcycleIndex, fullMethodName);
                                                const hasFrequencyParam = hasValidFrequencyParameter(baseMethodName);
                                                return (
                                                  <div 
                                                    key={`${meso.id}-${microcycleIndex}`} 
                                                    className={`relative z-10 p-2 text-xs text-center font-medium border-l border-r ${intensityBg(microcycle.intensity)} ${!isAllocated ? 'opacity-50' : ''} ${!hasFrequencyParam ? 'border-2 border-destructive/50' : ''} flex flex-col items-center gap-1`}
                                                 >
                                                   {/* Show warning icon if no frequency parameter */}
                                                   {!hasFrequencyParam && (
                                                     <TooltipProvider>
                                                       <Tooltip>
                                                         <TooltipTrigger>
                                                           <span className="text-destructive text-xs">⚠</span>
                                                         </TooltipTrigger>
                                                         <TooltipContent>
                                                           <p className="text-xs">Missing frequency parameter</p>
                                                         </TooltipContent>
                                                       </Tooltip>
                                                     </TooltipProvider>
                                                   )}
                                                   
                                                   <div className="flex items-center gap-1">
                                                      {hasFrequencyParam && (isSplit || (frequency > 1 && frequency <= 10)) && (
                                                         <button
                                                           onClick={() => toggleMicrocycleSplit(meso.id, microcycleIndex)}
                                                           className="p-0.5 text-current hover:bg-black/20 rounded transition-colors"
                                                          title={`${isSplit ? 'Merge' : 'Split'} sessions (${frequency}×/wk)`}
                                                        >
                                                          {isSplit ? <Columns className="h-3 w-3" /> : <SplitSquareHorizontal className="h-3 w-3" />}
                                                        </button>
                                                      )}
                                                   </div>
                                                  {isSplit && (
                                                    <div className="flex gap-0.5 text-[10px] w-full">
                                                      {Array.from({ length: sessionsCount }, (_, i) => (
                                                        <span key={i} className="flex-1 text-center px-1 bg-black/20 rounded">
                                                          {String.fromCharCode(65 + i)}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                               );
                                             })}
                                               </React.Fragment>
                                             );
                                           })}
                                         </div>
                                      
                                       {/* Parameter sub-rows */}
                                       {parameters.length > 0 && !collapsedMethods.has(fullMethodName) && !(categoryName && collapsedMethods.has(method)) && (
                                         <div className="divide-y">
                                             {parameters.filter((param) => isParameterVisibleForMethod(fullMethodName, param.name, true)).map((param) => (
                                                  <div key={param.name} className="grid gap-1 w-fit hover:bg-muted/5" style={{ 
                                                     gridTemplateColumns: calculateGridTemplate(baseMethodName, getVisibleMesocyclesForPeriodization())
                                                   }}>
                                                 <div className="sticky left-0 z-50 p-2 text-xs text-muted-foreground bg-background border-r flex items-center justify-between shadow-md">
                                                   <div className="flex items-center">
                                                     <span className="ml-4 font-medium">{param.name}</span>
                                                     {param.isQuantitative && param.options && param.options.length > 0 && (
                                                       <span className="ml-1 text-xs opacity-70">({param.options[0]})</span>
                                                     )}
                                                   </div>
                                                   <ParameterFillControl
                                                      methodName={fullMethodName}
                                                      parameterName={param.name}
                                                      parameterType={param.isQuantitative ? 'quantitative' : 'qualitative'}
                                                      parameterOptions={param.options}
                                                      parameterUnits={param.isQuantitative ? param.options : undefined}
                                                      mesocycles={mesocycles.map(m => ({
                                                        id: m.id,
                                                        name: m.name || `Mesocycle ${mesocycles.indexOf(m) + 1}`,
                                                        isAllocated: isMethodAllocatedToMesocycle(fullMethodName, m.id)
                                                      }))}
                                                      onFillRow={(value, unit, selectedMesocycleIds, fillEmptyOnly) => 
                                                        handleRowFill(fullMethodName, param.name, value, unit, selectedMesocycleIds, fillEmptyOnly ?? false, 0)
                                                      }
                                                      disabled={!mesocycles.some(meso => isMethodAllocatedToMesocycle(fullMethodName, meso.id))}
                                                    />
                                                 </div>
                                                  {getVisibleMesocyclesForPeriodization().map((meso) => {
                                                    const hasGap = hasMesocycleGap(meso.id);
                                                    return (
                                                      <React.Fragment key={`${meso.id}-param-cells`}>
                                                        {hasGap && (
                                                          <div className="bg-gradient-to-b from-muted/40 via-muted/60 to-muted/40 border-l border-r border-muted-foreground/30" />
                                                        )}
                                                        {(meso.microcycles || []).map((microcycle, microcycleIndex) => {
                                                        const isAllocated = isMethodAllocatedToMesocycle(fullMethodName, meso.id);
                                                         const isSplit = isMicrocycleSplit(meso.id, microcycleIndex);
                                                         const sessionsCount = getCellSessions(meso.id, microcycleIndex, fullMethodName);
                                                        const isFrequency = isFrequencyParameter(param.name, fullMethodName);
                                                      if (isSplit && !isFrequency) {
                                                       return (
                                                         <div key={`${meso.id}-${microcycleIndex}`} className="flex relative z-10 border-r">
                                                           {Array.from({ length: sessionsCount }, (_, sessionIndex) => {
                                                             const currentValue = getParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, sessionIndex);
                                                             const cellId = `${meso.id}::${microcycleIndex}::${fullMethodName}::${sessionIndex}::${param.name}`;
                                                             const isDragSource = dragState.sourceCell === cellId;
                                                             const isInSelection = dragState.selectedCells.has(cellId);
                                                             
                                                              return (
                                                                <div 
                                                                  key={sessionIndex}
                                                                  className={`relative z-10 p-1 border-l flex-1 ${!isAllocated ? 'bg-muted/20' : ''}`}
                                                                  style={{ minWidth: '120px' }}
                                                                  data-drag-cell={cellId}
                                                                  data-allocated={isAllocated ? 'true' : 'false'}
                                                                >
                                                                  {isAllocated ? (
                                                                    param.isCalculated && param.formula ? (
                                                                      // Calculated parameter - show computed value (read-only)
                                                                      <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                          <div className="flex items-center justify-center h-full bg-muted/40 rounded px-2 py-1 min-h-[32px]">
                                                                            <span className="text-sm font-medium text-muted-foreground italic">
                                                                              {(() => {
                                                                                const calculatedValue = computeCalculatedValue(
                                                                                  meso.id,
                                                                                  microcycleIndex,
                                                                                  fullMethodName,
                                                                                  param.formula!,
                                                                                  parameters,
                                                                                  sessionIndex
                                                                                );
                                                                                return calculatedValue !== null ? calculatedValue : '—';
                                                                              })()}
                                                                            </span>
                                                                          </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top">
                                                                          <p className="text-xs">Formula: {param.formula}</p>
                                                                        </TooltipContent>
                                                                      </Tooltip>
                                                                    ) : (
                                                                    <ParameterContextMenu
                                                                      cellId={cellId}
                                                                      value={currentValue}
                                                                      onFillRight={handleFillRight}
                                                                      onFillRow={handleFillRow}
                                                                      disabled={!currentValue}
                                                                    >
                                                                      {param.isQuantitative ? (
                                                                        <QuantitativeParameterInput
                                                                          value={currentValue.toString()}
                                                                          onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, sessionIndex)}
                                                                          unit={getParameterValue(meso.id, microcycleIndex, fullMethodName, `${param.name}_unit`, sessionIndex)?.toString() || param.options?.[0] || ''}
                                                                          onUnitChange={(unit) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, `${param.name}_unit`, unit, sessionIndex)}
                                                                          units={param.options || []}
                                                                          placeholder=""
                                                                          cellId={cellId}
                                                                          onDragStart={handleDragStart}
                                                                          onDragEnd={handleDragEnd}
                                                                          isDragSource={isDragSource}
                                                                          isInDragSelection={isInSelection}
                                                                          isEnabled={true}
                                                                        />
                                                                      ) : param.isQualitative ? (
                                                                        <QualitativeParameterInput
                                                                          value={currentValue.toString()}
                                                                          onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, sessionIndex)}
                                                                          options={param.options || []}
                                                                          placeholder=""
                                                                          cellId={cellId}
                                                                          onDragStart={handleDragStart}
                                                                          onDragEnd={handleDragEnd}
                                                                          isDragSource={isDragSource}
                                                                          isInDragSelection={isInSelection}
                                                                          isEnabled={true}
                                                                        />
                                                                      ) : (
                                                                        <DebouncedTextInput
                                                                          value={currentValue.toString()}
                                                                          onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, param.type === 'number' ? Number(value) : value, sessionIndex)}
                                                                          placeholder=""
                                                                        />
                                                                      )}
                                                                    </ParameterContextMenu>
                                                                    )
                                                                  ) : (
                                                                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
                                                                  )}
                                                                </div>
                                                              );
                                                           })}
                                                         </div>
                                                       );
                                                     } else {
                                                       const currentValue = getParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, 0);
                                                       const cellId = `${meso.id}::${microcycleIndex}::${fullMethodName}::0::${param.name}`;
                                                       const isDragSource = dragState.sourceCell === cellId;
                                                       const isInSelection = dragState.selectedCells.has(cellId);
                                                       
                                                          return (
                                                              <div 
                                                               key={`${meso.id}-${microcycleIndex}-${param.name}`} 
                                                                className={`relative z-10 p-1 border-l border-r ${!isAllocated ? 'bg-muted/20' : ''}`}
                                                               data-drag-cell={cellId}
                                                               data-allocated={isAllocated ? 'true' : 'false'}
                                                             >
                                                            {isAllocated ? (
                                                              param.isCalculated && param.formula ? (
                                                                // Calculated parameter - show computed value (read-only)
                                                                <Tooltip>
                                                                  <TooltipTrigger asChild>
                                                                    <div className="flex items-center justify-center h-full bg-muted/40 rounded px-2 py-1 min-h-[32px]">
                                                                      <span className="text-sm font-medium text-muted-foreground italic">
                                                                        {(() => {
                                                                          const calculatedValue = computeCalculatedValue(
                                                                            meso.id,
                                                                            microcycleIndex,
                                                                            fullMethodName,
                                                                            param.formula!,
                                                                            parameters,
                                                                            0
                                                                          );
                                                                          return calculatedValue !== null ? calculatedValue : '—';
                                                                        })()}
                                                                      </span>
                                                                    </div>
                                                                  </TooltipTrigger>
                                                                  <TooltipContent side="top">
                                                                    <p className="text-xs">Formula: {param.formula}</p>
                                                                  </TooltipContent>
                                                                </Tooltip>
                                                              ) : (
                                                              <ParameterContextMenu
                                                                cellId={cellId}
                                                                value={currentValue}
                                                                onFillRight={handleFillRight}
                                                                onFillRow={handleFillRow}
                                                                disabled={!currentValue}
                                                              >
                                                                {param.isQuantitative ? (
                                                                  <QuantitativeParameterInput
                                                                    value={currentValue.toString()}
                                                                    onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, 0)}
                                                                    unit={getParameterValue(meso.id, microcycleIndex, fullMethodName, `${param.name}_unit`, 0)?.toString() || param.options?.[0] || ''}
                                                                    onUnitChange={(unit) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, `${param.name}_unit`, unit, 0)}
                                                                    units={param.options || []}
                                                                    placeholder=""
                                                                    cellId={cellId}
                                                                    onDragStart={handleDragStart}
                                                                    onDragEnd={handleDragEnd}
                                                                    isDragSource={isDragSource}
                                                                    isInDragSelection={isInSelection}
                                                                    isEnabled={true}
                                                                  />
                                                                ) : param.isQualitative ? (
                                                                  <QualitativeParameterInput
                                                                    value={currentValue.toString()}
                                                                    onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, 0)}
                                                                    options={param.options || []}
                                                                    placeholder=""
                                                                    cellId={cellId}
                                                                    onDragStart={handleDragStart}
                                                                    onDragEnd={handleDragEnd}
                                                                    isDragSource={isDragSource}
                                                                    isInDragSelection={isInSelection}
                                                                    isEnabled={true}
                                                                  />
                                                                ) : (
                                                                  <DebouncedTextInput
                                                                    value={currentValue.toString()}
                                                                    onValueChange={(value) => updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, param.type === 'number' ? Number(value) : value, 0)}
                                                                    placeholder=""
                                                                  />
                                                                )}
                                                              </ParameterContextMenu>
                                                              )
                                                            ) : (
                                                              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
                                                            )}
                                                         </div>
                                                       );
                                                    }
                                                   })}
                                                      </React.Fragment>
                                                    );
                                                  })}
                                               </div>
                                             ))}
                                         </div>
                                       )}
                                    </div>
                                  );
                                });
                              })}
                              </div>
                            ))}
                          </div>
                        ))}
                       </div>
                    </div>
                  </div>
               </div>
            </>
          )}


           </CardContent>
       </Card>
       
       {/* Clear Parameters Confirmation Dialog */}
       <AlertDialog open={isClearParametersDialogOpen} onOpenChange={setIsClearParametersDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Clear all parameter values?</AlertDialogTitle>
             <AlertDialogDescription>
               This will clear all parameter values you've configured for all methods across all mesocycles and microcycles. 
               The method structure and allocations will remain intact. This action cannot be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleClearAllParameters}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               Clear All Parameters
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
      </>
    );
  };

  // Get allocated methods for exercise selection
  const getAllocatedMethods = () => {
    // Return all methods from allocated sub-goals
    return getMethodsForAllocatedSubGoals;
  };

  const renderExerciseSelection = () => (
    <>
      <Card className="w-full" data-step="6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Step 5: Exercise Selection</span>
              </CardTitle>
              <CardDescription>
                Select specific exercises for each training method across your mesocycles and microcycles.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsClearAllExercisesDialogOpen(true)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Exercises
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto max-w-full">
          <MicrocyclePlanningTable
            ref={mpTableRef}
            key={mpTableKey}
            mesocycles={mesocycles}
            selectedMethods={getAllocatedMethods()}
            parameterValues={parameterValues}
            methodParametersMap={methodParametersMap}
            onExerciseSelectionChange={(cellData) => {
              localStorage.setItem('exerciseSelectionData', JSON.stringify(cellData));
              setExerciseCellData(cellData);
            }}
            getParametersForCell={getParametersForCell}
            methodAllocations={methodAllocations}
          />
        </CardContent>
      </Card>

      {/* Clear All Exercises Confirmation Dialog */}
      <AlertDialog open={isClearAllExercisesDialogOpen} onOpenChange={setIsClearAllExercisesDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all exercise selections?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all exercise selections you've configured for all methods across all mesocycles and microcycles. 
              The method structure and parameter values will remain intact. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllExercises}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Exercises
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Calculate all days based on macrocycle data and mesocycle structure
  const calculateTrainingDays = (): TrainingDay[] => {
    if (!macrocycleData || !mesocycles.length) return [];
    
    const days: TrainingDay[] = [];
    
    // Create maps to store dates with their names
    const testDateMap = new Map<string, string>();
    
    macrocycleData.subGoals?.forEach((sg: any) => {
      const testName = sg.testMethod || sg.name || sg.testName || sg.method || sg.description || "Test";
      if (sg.testDates) {
        sg.testDates?.forEach((dateStr: string) => {
          testDateMap.set(dateStr, testName);
        });
      }
    });

    // Also include primary SMART goal tests
    macrocycleData.smartGoals?.forEach((sg: any) => {
      const testName = sg.description || "Test";
      sg.testDates?.forEach((dateStr: string) => {
        if (!testDateMap.has(dateStr)) testDateMap.set(dateStr, testName);
      });
    });

    // Also include athlete's existing tests
    // Normalize ISO strings to yyyy-MM-dd to match the map lookup key
    macrocycleData.athleteExistingTests?.forEach((t: any) => {
      const testName = t.testMethod || 'Test';
      t.testDates?.forEach((dateStr: string) => {
        const normalized = dateStr.split('T')[0];
        if (!testDateMap.has(normalized)) testDateMap.set(normalized, testName);
      });
    });

    const eventDateMap = new Map<string, string>();

    macrocycleData.events?.forEach((e: any, idx: number) => {
      // Try multiple possible property names for event name
      const eventName = e.name || e.eventName || e.title || e.description || "Event";

      if (e.eventDates) {
        e.eventDates?.forEach((dateStr: string) => {
          eventDateMap.set(dateStr, eventName);
        });
      }
    });

    // Also include athlete's existing events
    // Normalize ISO strings to yyyy-MM-dd to match the map lookup key
    macrocycleData.athleteExistingEvents?.forEach((e: any) => {
      const eventName = e.name || 'Event';
      e.eventDates?.forEach((dateStr: string) => {
        const normalized = dateStr.split('T')[0];
        if (!eventDateMap.has(normalized)) eventDateMap.set(normalized, eventName);
      });
    });

    let currentDate = new Date(planStartDate);
    
    mesocycles.forEach((meso, mesoIndex) => {
      meso.microcycles.forEach((micro, microIndex) => {
        // Add all days for this microcycle (no predetermined training day restrictions)
        for (let dayInMicro = 0; dayInMicro < micro.duration; dayInMicro++) {
          const dayDate = new Date(currentDate);
          dayDate.setDate(currentDate.getDate() + dayInMicro);
          
          const dayOfWeek = dayDate.getDay();
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          
          const testName = testDateMap.get(dateStr);
          const eventName = eventDateMap.get(dateStr);
          const isTestDay = !!testName;
          const isEventDay = !!eventName;
          
          days.push({
            date: dateStr,
            dayOfWeek,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            mesocycleId: meso.id,
            microcycleId: micro.id,
            isTestDay,
            isEventDay,
            isTrainingDay: true,
            testNames: testName ? [testName] : undefined,
            eventNames: eventName ? [eventName] : undefined,
            intensity: 'moderate', // Default intensity
            sessions: 1, // Default to 1 session
            sessionNames: ['Session 1']
          });
        }
        
        currentDate.setDate(currentDate.getDate() + micro.duration);
      });
    });
    
    return days;
  };

  // Update training days when mesocycles change
  useEffect(() => {
    // Only run after intensity data has been attempted to load
    if (!isIntensityDataLoaded) return;
    
    const days = calculateTrainingDays();
    setTrainingDays(days);
    
    // Create a map of existing intensities from state
    const existingIntensities = dailyIntensityData.reduce((acc, di) => {
      acc[di.date] = di;
      return acc;
    }, {} as Record<string, DailyIntensity>);
    
    // Check if we need to regenerate (new days were added or removed)
    const existingDates = new Set(dailyIntensityData.map(di => di.date));
    const newDates = new Set(days.map(d => d.date));
    
    // Only regenerate if structure changed
    const hasStructureChange = 
      existingDates.size !== newDates.size ||
      days.some(day => !existingDates.has(day.date));
    
    // If no structure change, don't regenerate (preserve existing intensities)
    if (!hasStructureChange && dailyIntensityData.length > 0) {
      return;
    }

    // Generate new intensities, preserving existing ones
    const newIntensities = days.map(day => 
      existingIntensities[day.date] || {
        date: day.date,
        mesocycleId: day.mesocycleId,
        microcycleId: day.microcycleId,
        dayOfWeek: day.dayOfWeek,
        intensity: "off" as IntensityLevel,
        isTestDay: day.isTestDay,
        isEventDay: day.isEventDay
      }
    );
    
    setDailyIntensityData(newIntensities);
  }, [mesocycles, macrocycleData, planStartDate, isIntensityDataLoaded]);

  // Handle intensity selection
  const handleIntensityClick = (date: string, intensity: IntensityLevel) => {
    // Update dailyIntensityData
    setDailyIntensityData(prev => 
      prev.map(di => 
        di.date === date ? { ...di, intensity } : di
      )
    );
    
    // Also update trainingDays for immediate consistency
    setTrainingDays(prev => 
      prev.map(td => 
        td.date === date ? { ...td, intensity } : td
      )
    );
  };

  // Helper function to get all microcycles in chronological order
  const getAllMicrocyclesChronologically = () => {
    const allMicros: Array<{
      id: string;
      duration: number;
      mesocycleId: string;
      startDate: Date;
      microcycle: Microcycle;
    }> = [];
    
    mesocycles.forEach(meso => {
      let mesoStartDate = meso.startDate || planStartDate;
      let currentDate = mesoStartDate;
      
      meso.microcycles.forEach(micro => {
        allMicros.push({
          id: micro.id,
          duration: micro.duration,
          mesocycleId: meso.id,
          startDate: new Date(currentDate),
          microcycle: micro
        });
        // Add days for next microcycle start
        currentDate = new Date(currentDate.getTime() + (micro.duration * 24 * 60 * 60 * 1000));
      });
    });
    
    // Sort by start date
    return allMicros.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  };

  // Copy previous week function (enhanced with automatic cross-mesocycle support)
  const copyPreviousWeek = (microcycleId: string) => {
    const currentMicrocycle = mesocycles.flatMap(m => m.microcycles).find(micro => micro.id === microcycleId);
    if (!currentMicrocycle) return;
    
    const microcycleDays = trainingDays.filter(day => day.microcycleId === microcycleId);
    if (microcycleDays.length === 0) return;
    
    // Get all microcycles in chronological order
    const chronologicalMicros = getAllMicrocyclesChronologically();
    const currentIndex = chronologicalMicros.findIndex(m => m.id === microcycleId);
    
    if (currentIndex <= 0) {
      toast({
        title: "No previous microcycle",
        description: "This is the first microcycle in your training plan."
      });
      return;
    }
    
    // Search backwards for the first microcycle with matching duration
    let compatibleMicro = null;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (chronologicalMicros[i].duration === currentMicrocycle.duration) {
        compatibleMicro = chronologicalMicros[i];
        break;
      }
    }
    
    if (!compatibleMicro) {
      // Only show dialog if no compatible preceding microcycle exists
      setTargetMicrocycleForCopy({
        id: microcycleId,
        duration: currentMicrocycle.duration
      });
      setCrossCopyDialogOpen(true);
      return;
    }
    
    // Copy from the compatible microcycle
    const sourceDays = trainingDays.filter(day => day.microcycleId === compatibleMicro.id);
    
    if (sourceDays.length > 0) {
      const sourceDescription = compatibleMicro.mesocycleId === microcycleDays[0].mesocycleId 
        ? "previous week" 
        : "previous compatible microcycle";
      copyIntensityPattern(microcycleDays, sourceDays, sourceDescription);
    } else {
      toast({
        title: "No data to copy",
        description: "The previous compatible microcycle has no intensity data."
      });
    }
  };

  // Helper function to copy intensity pattern between microcycles
  const copyIntensityPattern = (targetDays: any[], sourceDays: any[], sourceDescription: string) => {
    setDailyIntensityData(prev => {
      const updated = [...prev];
      targetDays.forEach((currentDay, index) => {
        if (sourceDays[index]) {
          const sourceIntensity = prev.find(di => di.date === sourceDays[index].date)?.intensity || "moderate";
          const currentIndex = updated.findIndex(di => di.date === currentDay.date);
          if (currentIndex !== -1) {
            updated[currentIndex] = { ...updated[currentIndex], intensity: sourceIntensity };
          }
        }
      });
      return updated;
    });
    
    toast({
      title: `Copied from ${sourceDescription}`,
      description: "Intensity pattern has been applied to this microcycle."
    });
  };

  // Handle cross-mesocycle copy
  const handleCrossMesocycleCopy = (sourceMesocycleId: string, sourceMicrocycleId: string) => {
    if (!targetMicrocycleForCopy) return;
    
    // Find source microcycle data from localStorage or current mesocycles
    let sourceMicrocycleDays: any[] = [];
    
    // Check current mesocycles first
    const currentSourceMeso = mesocycles.find(m => m.id === sourceMesocycleId);
    if (currentSourceMeso) {
      sourceMicrocycleDays = trainingDays.filter(day => day.microcycleId === sourceMicrocycleId);
    } else {
      // Scan localStorage for the source mesocycle data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('macrocycleData')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.dailyIntensityData) {
              const sourceIntensities = data.dailyIntensityData.filter((di: any) => di.microcycleId === sourceMicrocycleId);
              if (sourceIntensities.length > 0) {
                // Create mock days structure for copying
                sourceMicrocycleDays = sourceIntensities.map((di: any) => ({
                  date: di.date,
                  microcycleId: di.microcycleId,
                  mesocycleId: di.mesocycleId
                }));
                break;
              }
            }
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
    }
    
    const targetDays = trainingDays.filter(day => day.microcycleId === targetMicrocycleForCopy.id);
    
    if (sourceMicrocycleDays.length > 0 && targetDays.length > 0) {
      copyIntensityPattern(targetDays, sourceMicrocycleDays, "other mesocycle");
    }
  };

  // Helper functions for tooltips — all date comparisons use slice(0,10) to avoid
  // timezone drift from new Date() round-trips on yyyy-MM-dd strings.
  const getTestsForDate = (date: string): string[] => {
    const wizardSubGoalTests = (macrocycleData?.subGoals || [])
      .filter((sg: any) => sg.testDates?.some((td: string) => td.slice(0, 10) === date))
      .map((sg: any) => sg.testMethod || sg.description || 'Test');

    const wizardSmartGoalTests = (macrocycleData?.smartGoals || [])
      .filter((sg: any) => sg.testDates?.some((td: string) => td.slice(0, 10) === date))
      .map((sg: any) => sg.description || 'Test');

    const athleteTests = (macrocycleData?.athleteExistingTests || [])
      .filter((t: any) => t.testDates?.some((td: string) => td.slice(0, 10) === date))
      .map((t: any) => t.testMethod || 'Test');

    const all = [...wizardSubGoalTests, ...wizardSmartGoalTests];
    return [...all, ...athleteTests.filter((t: string) => !all.includes(t))];
  };

  const getEventsForDate = (date: string): string[] => {
    const wizardEvents = (macrocycleData?.events || [])
      .filter((event: any) => event.eventDates?.some((ed: string) => ed.slice(0, 10) === date))
      .map((event: any) => event.name || 'Event');

    const athleteEvents = (macrocycleData?.athleteExistingEvents || [])
      .filter((e: any) => e.eventDates?.some((ed: string) => ed.slice(0, 10) === date))
      .map((e: any) => e.name || 'Event');

    return [...wizardEvents, ...athleteEvents.filter((e: string) => !wizardEvents.includes(e))];
  };

  const getTooltipContent = (day: TrainingDay): string => {
    const tests = getTestsForDate(day.date);
    const events = getEventsForDate(day.date);
    
    const content: string[] = [];
    if (tests.length > 0) {
      content.push(`Tests: ${tests.join(', ')}`);
    }
    if (events.length > 0) {
      content.push(`Events: ${events.join(', ')}`);
    }
    
    return content.length > 0 ? content.join('\n') : '';
  };

  // Helper function to check if a training day is the last day of its microcycle
  const isLastDayOfMicrocycle = (dayIndex: number): boolean => {
    if (dayIndex >= trainingDays.length - 1) return true; // Last day overall
    
    const currentDay = trainingDays[dayIndex];
    const nextDay = trainingDays[dayIndex + 1];
    
    return currentDay.microcycleId !== nextDay.microcycleId;
  };

  // Helper function to check if a training day is the last day of its mesocycle
  const isLastDayOfMesocycle = (dayIndex: number): boolean => {
    if (dayIndex >= trainingDays.length - 1) return true; // Last day overall
    
    const currentDay = trainingDays[dayIndex];
    const nextDay = trainingDays[dayIndex + 1];
    
    return currentDay.mesocycleId !== nextDay.mesocycleId;
  };

  // Copy daily intensity pattern from previous microcycle
  const copyMicrocycleDailyIntensity = (mesocycleId: string, targetMicrocycleId: string) => {
    const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
    const mesocycle = mesocycles[mesocycleIndex];
    if (!mesocycle) return;
    
    const targetMicrocycleIndex = mesocycle.microcycles.findIndex(m => m.id === targetMicrocycleId);
    if (targetMicrocycleIndex < 0) return;
    
    const targetMicrocycle = mesocycle.microcycles[targetMicrocycleIndex];
    
    // Determine source microcycle
    let previousMicrocycle = null;
    let sourceMesocycleName = mesocycle.name;
    
    if (targetMicrocycleIndex > 0) {
      // Copy from previous microcycle in same mesocycle
      previousMicrocycle = mesocycle.microcycles[targetMicrocycleIndex - 1];
    } else if (mesocycleIndex > 0) {
      // Copy from last microcycle of previous mesocycle
      const previousMesocycle = mesocycles[mesocycleIndex - 1];
      previousMicrocycle = previousMesocycle.microcycles[previousMesocycle.microcycles.length - 1];
      sourceMesocycleName = previousMesocycle.name;
    } else {
      // This is the first microcycle of the first mesocycle - nothing to copy from
      return;
    }
    
    if (!previousMicrocycle) return;
    
    // Check if durations match
    if (targetMicrocycle.duration !== previousMicrocycle.duration) {
      toast({
        title: "Cannot copy",
        description: "Microcycles must have matching durations to copy intensity patterns.",
        variant: "destructive"
      });
      return;
    }
    
    // Find all days for both microcycles from trainingDays
    const previousDays = trainingDays.filter(day => day.microcycleId === previousMicrocycle.id);
    const targetDays = trainingDays.filter(day => day.microcycleId === targetMicrocycle.id);
    
    if (previousDays.length !== targetDays.length) {
      toast({
        title: "Cannot copy",
        description: "Day count mismatch between microcycles.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a map of previous day intensities by day index
    const intensityMap = previousDays.map(day => {
      const intensity = dailyIntensityData.find(di => di.date === day.date)?.intensity || "moderate";
      return intensity;
    });
    
    // Update dailyIntensityData for target microcycle days
    setDailyIntensityData(prev => {
      const updated = [...prev];
      
      targetDays.forEach((day, index) => {
        const existingIndex = updated.findIndex(di => di.date === day.date);
        const newIntensity = intensityMap[index];
        
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            intensity: newIntensity
          };
        } else {
          updated.push({
            date: day.date,
            mesocycleId: mesocycleId,
            microcycleId: targetMicrocycle.id,
            dayOfWeek: day.dayOfWeek,
            intensity: newIntensity,
            isTestDay: day.isTestDay,
            isEventDay: day.isEventDay
          });
        }
      });
      
      return updated;
    });
    
    toast({
      title: "Intensity pattern copied",
      description: `Copied daily intensity from ${previousMicrocycle.name}`
    });
  };

  // Copy daily intensity pattern from previous mesocycle
  const copyMesocycleDailyIntensity = (targetMesocycleId: string) => {
    const targetMesoIndex = mesocycles.findIndex(m => m.id === targetMesocycleId);
    if (targetMesoIndex <= 0) return; // Can't copy if first mesocycle
    
    const sourceMesocycle = mesocycles[targetMesoIndex - 1];
    const targetMesocycle = mesocycles[targetMesoIndex];
    
    // Get all training days for both mesocycles
    const sourceDays = trainingDays.filter(day => 
      sourceMesocycle.microcycles.some(micro => micro.id === day.microcycleId)
    );
    const targetDays = trainingDays.filter(day => 
      targetMesocycle.microcycles.some(micro => micro.id === day.microcycleId)
    );
    
    // Map intensities by relative day position within mesocycle
    setDailyIntensityData(prev => {
      const updated = [...prev];
      
      targetDays.forEach((targetDay, index) => {
        if (index < sourceDays.length) {
          const sourceDay = sourceDays[index];
          const sourceIntensity = dailyIntensityData.find(di => di.date === sourceDay.date)?.intensity || "moderate";
          
          // Update or add the intensity for target day
          const existingIndex = updated.findIndex(di => di.date === targetDay.date);
          if (existingIndex >= 0) {
            updated[existingIndex] = {
              ...updated[existingIndex],
              intensity: sourceIntensity
            };
          } else {
            updated.push({
              date: targetDay.date,
              mesocycleId: targetMesocycle.id,
              microcycleId: targetDay.microcycleId,
              dayOfWeek: targetDay.dayOfWeek,
              intensity: sourceIntensity,
              isTestDay: targetDay.isTestDay,
              isEventDay: targetDay.isEventDay
            });
          }
        }
      });
      
      return updated;
    });
    
    toast({
      title: "Intensity pattern copied",
      description: `Copied daily intensity pattern from ${sourceMesocycle.name} to ${targetMesocycle.name}`
    });
  };

  // Clear daily intensity for entire mesocycle
  const clearMesocycleDailyIntensity = (mesocycleId: string) => {
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return;
    
    // Get all training days for this mesocycle
    const mesocycleDays = trainingDays.filter(day => 
      mesocycle.microcycles.some(micro => micro.id === day.microcycleId)
    );
    
    // Set all daily intensity entries to "off" for these days
    setDailyIntensityData(prev => {
      const updated = [...prev];
      
      mesocycleDays.forEach(day => {
        const existingIndex = updated.findIndex(di => di.date === day.date);
        
        if (existingIndex >= 0) {
          // Update existing entry to "off"
          updated[existingIndex] = {
            ...updated[existingIndex],
            intensity: "off"
          };
        } else {
          // Create new entry with "off"
          updated.push({
            date: day.date,
            mesocycleId: mesocycleId,
            microcycleId: day.microcycleId,
            dayOfWeek: day.dayOfWeek,
            intensity: "off",
            isTestDay: day.isTestDay,
            isEventDay: day.isEventDay
          });
        }
      });
      
      return updated;
    });
    
    toast({
      title: "Intensities cleared",
      description: `Set all daily intensities to "off" for ${mesocycle.name}`
    });
  };

  // Clear daily intensity for specific microcycle
  const clearMicrocycleDailyIntensity = (mesocycleId: string, microcycleId: string) => {
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return;
    
    const microcycle = mesocycle.microcycles.find(m => m.id === microcycleId);
    if (!microcycle) return;
    
    // Get all training days for this microcycle
    const microcycleDays = trainingDays.filter(day => day.microcycleId === microcycleId);
    
    // Set all daily intensity entries to "off" for these days
    setDailyIntensityData(prev => {
      const updated = [...prev];
      
      microcycleDays.forEach(day => {
        const existingIndex = updated.findIndex(di => di.date === day.date);
        
        if (existingIndex >= 0) {
          // Update existing entry to "off"
          updated[existingIndex] = {
            ...updated[existingIndex],
            intensity: "off"
          };
        } else {
          // Create new entry with "off"
          updated.push({
            date: day.date,
            mesocycleId: mesocycleId,
            microcycleId: microcycleId,
            dayOfWeek: day.dayOfWeek,
            intensity: "off",
            isTestDay: day.isTestDay,
            isEventDay: day.isEventDay
          });
        }
      });
      
      return updated;
    });
    
    toast({
      title: "Intensities cleared",
      description: `Set all daily intensities to "off" for ${microcycle.name}`
    });
  };

  const renderDailyIntensityPlanning = () => {
    // Get the current mesocycle for navigation
    const currentMeso = mesocycles[currentMesocycleIndexDailyPlanning];
    
    // Filter training days for the current mesocycle only
    const currentMesoTrainingDays = trainingDays.filter(day => day.mesocycleId === currentMeso?.id);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5" />
                <span>Step 2: Daily Training Intensity Planning</span>
              </CardTitle>
              <CardDescription>
                Set the training intensity for each training day across all mesocycles and microcycles.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-muted-foreground/20 rounded"></div>
                <span className="text-xs">Test Day</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-destructive/30 rounded"></div>
                <span className="text-xs">Event Day</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-primary rounded"></div>
                <span className="text-xs">Training Day</span>
              </div>
            </div>
            
            {/* Mesocycle Navigation */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentMesocycleIndexDailyPlanning(Math.max(0, currentMesocycleIndexDailyPlanning - 1))}
                disabled={currentMesocycleIndexDailyPlanning === 0}
                className="shrink-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex-1 overflow-x-auto min-w-0">
                <div className="flex items-center justify-center gap-2 py-1">
                  {mesocycles.map((meso, index) => (
                    <Button
                      key={meso.id}
                      variant={index === currentMesocycleIndexDailyPlanning ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentMesocycleIndexDailyPlanning(index)}
                      className="min-w-[80px] shrink-0"
                    >
                      {meso.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => setCurrentMesocycleIndexDailyPlanning(Math.min(mesocycles.length - 1, currentMesocycleIndexDailyPlanning + 1))}
                disabled={currentMesocycleIndexDailyPlanning === mesocycles.length - 1}
                className="shrink-0"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            
            {/* Horizontal scrollable grid */}
            <div className="w-full min-w-0 border rounded-lg">
              <div className="force-scrollbar-x overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'thin' }}>
                <div className="w-max p-4">
                  {/* Mesocycle Headers - Only show current mesocycle */}
                  <div className="flex mb-4 flex-nowrap">
                    <div className="sticky left-0 bg-background z-20 w-[150px] shrink-0">
                      <div className="text-sm font-semibold text-center py-2">Daily Intensity</div>
                    </div>
                    <div className="flex flex-nowrap">
                      {currentMeso && (() => {
                        const width = currentMeso.microcycles.reduce((acc, micro) => acc + micro.duration * 100, 0);
                        return currentMeso.microcycles.length > 0 ? (
                          <div 
                            key={currentMeso.id}
                            className={cn("relative text-center border border-border rounded-md font-semibold py-3 shrink-0", getSubtleIntensityBg(currentMeso.intensity))}
                            style={{ width: `${width}px` }}
                          >
                            {/* Mesocycle Name Row with Clickable Intensity Badge */}
                            <div className="flex items-center justify-center gap-2">
                              <span>{currentMeso.name}</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "text-xs font-medium px-2 py-0.5 h-auto hover:opacity-80 rounded",
                                      getIntensityColor(currentMeso.intensity)
                                    )}
                                  >
                                    {currentMeso.intensity.replace(/-/g, ' ').toUpperCase()}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2 bg-popover" align="center">
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium mb-2">Change Mesocycle Intensity</div>
                                    {intensityLevels.map((level) => (
                                      <Button
                                        key={level}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "w-full justify-start text-xs",
                                          level === currentMeso.intensity && "bg-accent"
                                        )}
                                        onClick={() => {
                                          const updated = [...mesocycles];
                                          updated[currentMesocycleIndexDailyPlanning].intensity = level;
                                          setMesocycles(updated);
                                        }}
                                      >
                                        <span className={cn("inline-block w-3 h-3 rounded-full mr-2", getIntensityColor(level))} />
                                        {level.replace(/-/g, ' ')}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {currentMesocycleIndexDailyPlanning > 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyMesocycleDailyIntensity(currentMeso.id);
                                  }}
                                  className="h-6 w-6 p-0"
                                  title="Copy daily intensity pattern from previous mesocycle"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearMesocycleDailyIntensity(currentMeso.id);
                                }}
                                className="h-6 w-6 p-0"
                                title={`Clear all daily intensities for ${currentMeso.name}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            {/* Date Range with Duration */}
                            {currentMeso.startDate && currentMeso.endDate && (
                              <div className="text-xs font-normal text-muted-foreground">
                                {format(new Date(currentMeso.startDate), 'MMM d')} - {format(new Date(currentMeso.endDate), 'MMM d')} ({differenceInDays(new Date(currentMeso.endDate), new Date(currentMeso.startDate)) + 1}d)
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  {/* Microcycle Names Row - Only show current mesocycle's microcycles */}
                  <div className="flex mb-2 flex-nowrap">
                    <div className="sticky left-0 bg-background z-20 w-[150px] shrink-0">
                      {/* Empty space to align with intensity scale */}
                    </div>
                    <div className="flex flex-nowrap">
                      {currentMeso && currentMeso.microcycles.map((micro, microIndex) => {
                        const width = micro.duration * 100; // 100px per day for better readability
                        const isLastMicro = microIndex === currentMeso.microcycles.length - 1;
                        
                        // Check if we can copy - fixed logic to check across mesocycles
                        let canCopy = false;
                        let copySourceName = '';
                        
                        if (microIndex > 0) {
                          // Has previous microcycle in same mesocycle
                          const prevMicro = currentMeso.microcycles[microIndex - 1];
                          if (prevMicro.duration === micro.duration) {
                            canCopy = true;
                            copySourceName = prevMicro.name;
                          }
                        } else if (currentMesocycleIndexDailyPlanning > 0) {
                          // First microcycle of this mesocycle, but not first mesocycle overall
                          const prevMeso = mesocycles[currentMesocycleIndexDailyPlanning - 1];
                          const lastMicroOfPrevMeso = prevMeso.microcycles[prevMeso.microcycles.length - 1];
                          if (lastMicroOfPrevMeso && lastMicroOfPrevMeso.duration === micro.duration) {
                            canCopy = true;
                            copySourceName = `${prevMeso.name} - ${lastMicroOfPrevMeso.name}`;
                          }
                        }
                        
                        return (
                          <div 
                            key={micro.id}
                            className={cn("relative text-center text-sm font-semibold py-1 px-2 shrink-0 border-l border-border/50 border border-border rounded-md", getSubtleIntensityBg(micro.intensity))}
                            style={{ width: `${width}px` }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>{micro.name}</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "text-xs font-medium px-1.5 py-0.5 h-auto hover:opacity-80 rounded",
                                      getIntensityColor(micro.intensity)
                                    )}
                                  >
                                    {micro.intensity.replace(/-/g, ' ').toUpperCase()}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2 bg-popover" align="center">
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium mb-2">Change Microcycle Intensity</div>
                                    {intensityLevels.map((level) => (
                                      <Button
                                        key={level}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "w-full justify-start text-xs",
                                          level === micro.intensity && "bg-accent"
                                        )}
                                        onClick={() => {
                                          const updated = [...mesocycles];
                                          updated[currentMesocycleIndexDailyPlanning].microcycles[microIndex].intensity = level;
                                          setMesocycles(updated);
                                        }}
                                      >
                                        <span className={cn("inline-block w-3 h-3 rounded-full mr-2", getIntensityColor(level))} />
                                        {level.replace(/-/g, ' ')}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              
                              {/* Copy button */}
                              {canCopy && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyMicrocycleDailyIntensity(currentMeso.id, micro.id);
                                  }}
                                  className="h-6 w-6 p-0"
                                  title={`Copy intensity pattern from ${copySourceName}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Clear button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearMicrocycleDailyIntensity(currentMeso.id, micro.id);
                                }}
                                className="h-6 w-6 p-0"
                                title={`Clear all daily intensities for ${micro.name}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column Chart */}
                  <div className="flex items-end flex-nowrap">
                    {/* Intensity Scale - Sticky */}
                    <div className="sticky left-0 z-30 bg-background shrink-0">
                      <IntensityScale
                        intensityLevels={intensityLevels}
                        getIntensityColor={getIntensityColor}
                      />
                    </div>

                    {/* Day Columns - Only show current mesocycle's days */}
                    <TooltipProvider>
                      <div className="flex items-end flex-nowrap">
                        {currentMesoTrainingDays.map((day, index) => {
                          const dayIntensity = dailyIntensityData.find(di => di.date === day.date)?.intensity || "moderate";
                          const isLastDayOfMicro = index === currentMesoTrainingDays.length - 1 || 
                            (index < currentMesoTrainingDays.length - 1 && currentMesoTrainingDays[index + 1].microcycleId !== day.microcycleId);
                          const isLastDayOfMeso = index === currentMesoTrainingDays.length - 1;
                          
                          return (
                            <IntensityColumn
                              key={day.date}
                              day={day}
                              intensity={dayIntensity}
                              onIntensityChange={handleIntensityClick}
                              tooltipContent={getTooltipContent(day)}
                              isLastDayOfMicrocycle={isLastDayOfMicro}
                              isLastDayOfMesocycle={isLastDayOfMeso}
                              intensityLevels={intensityLevels}
                              getIntensityColor={getIntensityColor}
                              calendarEventsForDay={athleteCalendarEvents.filter(e => e.date === day.date)}
                            />
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </CardContent>
      </Card>
    );
  };

  const stepTitles = [
    "Mesocycle Setup",
    "Daily Training Intensity Planning",
    "Mesocycle Characterization",
    "Method Periodization",
    "Exercise Selection"
  ];

  const mesoStepLabel = stepTitles[currentStep - 1] ?? `Step ${currentStep}`;

  const mesoWizardContext = useMemo(() => {
    const athleteStr = athleteName ? `Athlete: ${athleteName}` : "No athlete selected";
    const planStr = macrocycleData?.planName ? `Plan: ${macrocycleData.planName}` : "";
    const goalStr = macrocycleData?.smartGoals?.[0]?.description
      ? `Primary goal: ${macrocycleData.smartGoals[0].description}`
      : macrocycleData?.smartGoal?.specific
      ? `Primary goal: ${macrocycleData.smartGoal.specific}`
      : "";
    const mesoCount = mesocycles.length;
    const mesoStr = mesoCount > 0
      ? `Mesocycles (${mesoCount}):\n${mesocycles.map((m) => {
          const micros = m.microcycles?.map(mc => `  - ${mc.name} (${mc.duration}d, ${mc.intensity})`).join("\n") ?? "";
          return `- ${m.name} (${m.weeks}w)${micros ? "\n" + micros : ""}`;
        }).join("\n")}`
      : "No mesocycles configured yet";
    const allocatedMethods = Object.keys(methodAllocations).filter(
      (m) => methodAllocations[m]?.length > 0
    );
    const methodsStr = allocatedMethods.length
      ? `Allocated methods:\n${allocatedMethods.map((m) => `- ${m}`).join("\n")}`
      : "";

    // Step 5: exercise library override block + available exercises
    let step5OverrideStr = "";
    let exerciseLibraryStr = "";
    if (currentStep === 5) {
      // ⚠️ Override block — must appear FIRST so it is read before any sports science instincts fire
      const hasLibraryExercises = exerciseLibraries.some(lib => lib.exercises?.length > 0);
      step5OverrideStr = [
        "⚠️ EXERCISE SELECTION RULES (App System Rules — override prior knowledge, follow exactly):",
        "- When the coach asks which exercises to recommend: ONLY suggest exercises that appear in the Available exercises list below. Do NOT recommend exercises by generic name that are not in that list.",
        "- If no suitable exercises exist in the database for a method, say so explicitly and tell the coach to add them to the Exercise Database first.",
        "- When producing an assign_exercises block: include ONLY exercises whose exerciseId is listed below. For any requested exercise not found in the list, name it in your text response and explain it is missing from the database.",
        "- Never invent exercise IDs, library IDs, or exercise names not found in the list.",
        hasLibraryExercises ? "" : "⚠️ The exercise database is empty — tell the coach to add exercises to the Exercise Database before selection.",
      ].filter(Boolean).join("\n");

      if (exerciseLibraries.length > 0) {
        const libraryLines: string[] = ["Available exercises in the database (ONLY use these for recommendations and assign_exercises):"];
        exerciseLibraries.forEach(lib => {
          if (!lib.exercises || lib.exercises.length === 0) return;
          const nameCol = lib.columns.find(c => c.name.toLowerCase().includes('name'));
          const catCol = lib.columns.find(c => c.name.toLowerCase().includes('categor'));
          libraryLines.push(`\nLibrary: "${lib.name}" (libraryId: "${lib.id}")`);
          lib.exercises.forEach(ex => {
            const name = nameCol ? (ex.data[nameCol.id] ?? ex.id) : ex.id;
            const cat = catCol ? (ex.data[catCol.id] ?? '') : '';
            libraryLines.push(`  - exerciseId: "${ex.id}" | name: "${name}"${cat ? ` | category: "${cat}"` : ''}`);
          });
        });
        exerciseLibraryStr = libraryLines.join("\n");
      }

      // Currently selected exercises — always explicit so AI never falls back to conversation history
      const selectionLines: string[] = ["\nCurrently selected exercises per cell (this is the authoritative current state — ignore anything from earlier in the conversation):"];
      let hasAnyExercises = false;
      Object.entries(exerciseCellData).forEach(([, cell]) => {
        if (cell.exercises?.length > 0) {
          hasAnyExercises = true;
          const meso = mesocycles.find(m => m.id === cell.mesocycleId);
          const mesoName = meso?.name ?? cell.mesocycleId;
          const label = cell.categoryName ? `${cell.methodId}::${cell.categoryName}` : cell.methodId;
          selectionLines.push(`  ${mesoName} | ${label}: ${cell.exercises.map(e => e.exerciseName).join(", ")}`);
        }
      });
      if (!hasAnyExercises) selectionLines.push("  (no exercises currently selected in any cell)");
      exerciseLibraryStr += "\n" + selectionLines.join("\n");
    }

    return [
      step5OverrideStr,
      `Current step: ${mesoStepLabel}`,
      athleteStr,
      planStr,
      goalStr,
      mesoStr,
      methodsStr,
      exerciseLibraryStr,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [currentStep, athleteName, macrocycleData, mesocycles, methodAllocations, mesoStepLabel, exerciseLibraries, exerciseCellData]);

  // ── AI Apply handler ──────────────────────────────────────────────────────
  const handleMesoAIApply = useCallback((action: import("@/components/wizard/WizardAIAssistant").ApplySuggestion) => {
    switch (action.type) {
      case "set_mesocycle_config": {
        const count = Math.max(1, Math.min(12, action.count));
        const weeksEach = Math.max(1, action.weeksDuration);
        const newMesocycles: ExtendedMesocycle[] = Array.from({ length: count }, (_, i) => ({
          id: `meso-${i + 1}`,
          name: `Mesocycle ${i + 1}`,
          weeks: weeksEach,
          sessionsPerWeek: 3,
          sessionLength: 60,
          startDate: planStartDate,
          endDate: planStartDate,
          duration: weeksEach,
          intensity: "moderate" as IntensityLevel,
          trainingMethods: [],
          trainingQualities: [],
          microcycles: Array.from({ length: weeksEach }, (_, j) => ({
            id: `micro-${i + 1}-${j + 1}`,
            name: `Microcycle ${j + 1}`,
            duration: 7,
            intensity: "moderate" as IntensityLevel,
          })),
        }));
        setMesocycles(recalculateAllMesocycleDates(newMesocycles, planStartDate));
        break;
      }
      case "configure_mesocycles": {
        const newMesocycles: ExtendedMesocycle[] = action.mesocycles.map((m, i) => ({
          id: `meso-${i + 1}`,
          name: m.name ?? `Mesocycle ${i + 1}`,
          weeks: m.microcycles.reduce((s, mc) => s + Math.ceil(mc.duration / 7), 0),
          sessionsPerWeek: 3,
          sessionLength: 60,
          startDate: planStartDate,
          endDate: planStartDate,
          duration: m.microcycles.reduce((s, mc) => s + mc.duration, 0),
          intensity: (m.microcycles.at(-1)?.intensity ?? "moderate") as IntensityLevel,
          trainingMethods: [],
          trainingQualities: [],
          microcycles: m.microcycles.map((mc, j) => ({
            id: `micro-${i + 1}-${j + 1}`,
            name: mc.name ?? `Microcycle ${j + 1}`,
            duration: mc.duration,
            intensity: (mc.intensity ?? "moderate") as IntensityLevel,
          })),
        }));
        setMesocycles(recalculateAllMesocycleDates(newMesocycles, planStartDate));
        break;
      }
      case "rename_cycles": {
        setMesocycles(prev => prev.map(meso => {
          const mesoRename = action.renames.find(r => r.currentName === meso.name);
          const updatedMeso = mesoRename ? { ...meso, name: mesoRename.newName } : meso;
          return {
            ...updatedMeso,
            microcycles: (meso.microcycles ?? []).map(mc => {
              const mcRename = action.renames.find(r => r.currentName === mc.name);
              return mcRename ? { ...mc, name: mcRename.newName } : mc;
            }),
          };
        }));
        break;
      }
      case "set_microcycle_intensities": {
        setMesocycles(prev => {
          const updated = prev.map(meso => {
            const plan = action.plan.find(p => p.mesocycleName === meso.name);
            if (!plan) return meso;
            const updatedMicros = meso.microcycles?.map((mc, i) => ({
              ...mc,
              intensity: (plan.intensities?.[i] ?? mc.intensity) as IntensityLevel,
            })) ?? [];
            return {
              ...meso,
              intensity: (plan.mesoIntensity ?? meso.intensity) as IntensityLevel,
              microcycles: updatedMicros,
            };
          });
          return recalculateAllMesocycleDates(updated, planStartDate);
        });
        break;
      }
      case "set_daily_intensities": {
        setDailyIntensityData(prev => {
          const updated = [...prev];
          action.plan.forEach(({ mesocycleName, microcycleIndex, days }) => {
            const meso = mesocycles.find(m => m.name === mesocycleName);
            if (!meso) return;
            const micro = meso.microcycles?.[microcycleIndex - 1];
            if (!micro) return;
            const microDays = updated.filter(d => d.microcycleId === micro.id);
            days.forEach((intensity, i) => {
              const day = microDays[i];
              if (!day) return;
              const idx = updated.findIndex(d => d.date === day.date);
              if (idx !== -1) updated[idx] = { ...updated[idx], intensity: intensity as IntensityLevel };
            });
          });
          return updated;
        });
        setTrainingDays(prev => {
          const updated = [...prev];
          action.plan.forEach(({ mesocycleName, microcycleIndex, days }) => {
            const meso = mesocycles.find(m => m.name === mesocycleName);
            if (!meso) return;
            const micro = meso.microcycles?.[microcycleIndex - 1];
            if (!micro) return;
            const microDays = updated.filter(d => d.microcycleId === micro.id);
            days.forEach((intensity, i) => {
              const day = microDays[i];
              if (!day) return;
              const idx = updated.findIndex(d => d.date === day.date);
              if (idx !== -1) updated[idx] = { ...updated[idx], intensity: intensity as IntensityLevel };
            });
          });
          return updated;
        });
        break;
      }
      case "allocate_methods": {
        setMethodAllocations(prev => {
          const next = { ...prev };
          action.allocations.forEach(({ methodName, mesocycleNames }) => {
            const mesoIds = mesocycleNames
              .map(n => mesocycles.find(m => m.name === n)?.id)
              .filter((id): id is string => !!id);
            next[methodName] = mesoIds;
          });
          return next;
        });
        break;
      }
      case "add_methods": {
        action.methods.forEach(({ name }) => {
          setMethodAllocations(prev => ({
            ...prev,
            [name]: prev[name] ?? mesocycles.map(m => m.id),
          }));
        });
        break;
      }
      case "remove_methods": {
        setMethodAllocations(prev => {
          const next = { ...prev };
          action.methodNames.forEach(n => { delete next[n]; });
          return next;
        });
        setManuallyAddedMethods(prev => prev.filter(m => !action.methodNames.includes(m)));
        break;
      }
      case "set_periodization": {
        setParameterValues(prev => {
          const next = JSON.parse(JSON.stringify(prev)) as typeof prev;
          action.entries.forEach(entry => {
            const meso = mesocycles.find(m => m.name === entry.mesocycleName);
            if (!meso) return;
            const mcIndices = entry.microcycleIndex != null
              ? [entry.microcycleIndex - 1]
              : meso.microcycles?.map((_, i) => i) ?? [0];
            mcIndices.forEach(mcIdx => {
              if (!next[meso.id]) next[meso.id] = {};
              if (!next[meso.id][mcIdx]) next[meso.id][mcIdx] = {};
              if (!next[meso.id][mcIdx][entry.methodName]) next[meso.id][mcIdx][entry.methodName] = {};
              if (!next[meso.id][mcIdx][entry.methodName][0]) next[meso.id][mcIdx][entry.methodName][0] = {};
              const cell = next[meso.id][mcIdx][entry.methodName][0];
              if (entry.frequency != null) cell['Frequency'] = entry.frequency;
              if (entry.sets != null) cell['Sets'] = entry.sets;
              if (entry.reps != null) cell['Reps'] = entry.reps;
              if (entry.intensity != null) cell['Intensity'] = entry.intensity;
              if (entry.extraParams) Object.assign(cell, entry.extraParams);
            });
          });
          return next;
        });
        break;
      }
      case "assign_exercises": {
        // Build newCellData in MicrocyclePlanningTable's CellData format
        // (keyed by `methodId::categoryName::mesocycleId`) and merge via the
        // imperative handle so the table's internal state stays in sync.
        const newCellData: Record<string, import('@/types/microcycle-planning').CellData> = {};
        action.assignments.forEach(({ methodName, mesocycleName, categoryName, exercises }) => {
          const meso = mesocycles.find(m => m.name === mesocycleName);
          if (!meso) return;
          const cellKey = `${methodName}::${categoryName ?? ''}::${meso.id}`;
          const newExercises = exercises.map(ex => ({
            id: ex.exerciseId,
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            library: ex.libraryId,
          }));
          newCellData[cellKey] = {
            methodId: methodName,
            categoryName: categoryName,
            mesocycleId: meso.id,
            exercises: newExercises,
          };
        });
        if (action.replace) {
          // For replace mode, write the cell data directly via ref (overwrites existing for each cell)
          mpTableRef.current?.mergeCellData(newCellData);
        } else {
          // For append mode, read existing cell data from the dedicated step-5 key
          const stored = localStorage.getItem('exerciseSelectionData');
          const existing: Record<string, import('@/types/microcycle-planning').CellData> = stored
            ? JSON.parse(stored)
            : {};
          const merged: Record<string, import('@/types/microcycle-planning').CellData> = {};
          Object.entries(newCellData).forEach(([key, cell]) => {
            const prev = existing[key];
            const prevExercises = prev?.exercises ?? [];
            merged[key] = {
              ...cell,
              exercises: [
                ...prevExercises.filter(e => !cell.exercises.some(n => n.exerciseId === e.exerciseId)),
                ...cell.exercises,
              ],
            };
          });
          mpTableRef.current?.mergeCellData(merged);
        }
        break;
      }
      default:
        break;
    }
  }, [mesocycles, planStartDate, recalculateAllMesocycleDates, setDailyIntensityData, setTrainingDays]);

  return (
    <div className="w-full max-w-none space-y-6 min-w-0">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mesocycle Planning</h1>
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
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              Ask AI for Help
            </Button>
            <PlanningNavigationMenu currentPage="mesocycle" currentPageStep={currentStep} onChangeCurrentPageStep={setCurrentStep} />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

        <NavigationButtons />
        
        <div className="space-y-8">
          {renderTrainingPlanOverview()}
          {currentStep === 1 && renderMesocycleSetup()}
          {currentStep === 2 && renderDailyIntensityPlanning()}
          {currentStep === 3 && renderMethodAllocation()}
          {currentStep === 4 && renderMethodPeriodization()}
          {currentStep === 5 && renderExerciseSelection()}
        </div>

        <NavigationButtons />
        
        {/* Keyboard Shortcuts Panel - only show on Method Periodization step */}
        {currentStep === 4 && <KeyboardShortcutsPanel />}
        
        {/* Add Method Dialog */}
        <AddMethodDialog
          open={isAddMethodDialogOpen}
          onOpenChange={setIsAddMethodDialogOpen}
          onAddMethod={handleAddMethod}
          excludedMethods={getExcludedMethods()}
        />
        
        {/* Delete Method Dialog */}
        <MethodDeleteDialog
          isOpen={isDeleteDialogOpen}
          onClose={cancelDeleteMethod}
          onConfirm={confirmDeleteMethod}
          methodName={methodToDelete || ''}
          isManualMethod={methodToDelete ? isManualMethod(methodToDelete) : false}
        />
        
        {/* Cross-Mesocycle Copy Dialog */}
        <CrossMesocycleCopyDialog
          open={crossCopyDialogOpen}
          onOpenChange={setCrossCopyDialogOpen}
          targetMicrocycleId={targetMicrocycleForCopy?.id || ''}
          targetMicrocycleDuration={targetMicrocycleForCopy?.duration || 7}
          currentMesocycles={mesocycles}
          onCopy={handleCrossMesocycleCopy}
        />
        
        {/* Mesocycle Intensity Copy Dialog */}
        <CrossMesocycleMicrocycleCopyDialog
          open={mesocycleCopyDialogOpen}
          onOpenChange={setMesocycleCopyDialogOpen}
          targetMesocycleId={targetMesocycleForIntensityCopy?.mesocycleId || ''}
          targetMicrocycleStructure={targetMesocycleForIntensityCopy?.microcycleStructure || []}
          currentMesocycles={mesocycles}
          onCopy={handleCrossMesocycleIntensityCopy}
        />
        
        {/* Coach Notes Dialog - Available for both Step 3 and Step 4 */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Coach Notes - {selectedMesocycleForNotes?.name}</DialogTitle>
              <DialogDescription>
                {selectedMesocycleForNotes && (
                  <>
                    {format(selectedMesocycleForNotes.startDate, 'MMM d')} - {format(selectedMesocycleForNotes.endDate, 'MMM d')} | 
                    Intensity: <span className="capitalize">{selectedMesocycleForNotes.intensity.replace('-', ' ')}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Add notes about training focus, adaptations, special considerations, tapering strategies..."
              value={selectedMesocycleForNotes ? (mesocycleNotes[selectedMesocycleForNotes.id] || '') : ''}
              onChange={(e) => {
                if (selectedMesocycleForNotes) {
                  setMesocycleNotes(prev => ({
                    ...prev,
                    [selectedMesocycleForNotes.id]: e.target.value
                  }));
                }
              }}
              className="min-h-[150px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load Template Dialog */}
        <LoadTemplateDialog
          open={loadTemplateDialog.open}
          onOpenChange={(open) => setLoadTemplateDialog(prev => ({ ...prev, open }))}
          methodName={loadTemplateDialog.lookupName || loadTemplateDialog.methodName}
          templates={getTemplatesForWizardMethod(loadTemplateDialog.lookupName || loadTemplateDialog.methodName)}
          planMicrocycleCount={totalPlanMicrocycles}
          onLoad={handleLoadTemplate}
          parameters={loadTemplateDialogParams}
          onSaveAsNew={(name, columns) => {
            const mName = loadTemplateDialog.lookupName || loadTemplateDialog.methodName;
            const parts = mName.split(' - ');
            const category = parts[0]?.trim() ?? '';
            const subCategory = parts.slice(1).join(' - ').trim();
            addTemplate({ name, methodId: `${category}|||${subCategory}`, methodName: mName, columns });
          }}
        />

      {/* AI Assistant */}
      <WizardAIAssistant stepLabel={mesoStepLabel} wizardContext={mesoWizardContext} onApplySuggestion={handleMesoAIApply} ragContext={ragContext} globalContext={globalAIContext} />
    </div>
  );
};