import { MicrocyclePlanningTable } from '@/components/microcycle-planning';
import React, { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { AddMethodDialog } from '@/components/ui/add-method-dialog';
import { MethodDeleteDialog } from '@/components/shared/MethodDeleteDialog';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Settings, SplitSquareHorizontal, Columns } from 'lucide-react';
import MesocycleCalendar from '@/components/mesocycle/MesocycleCalendar';
import MicrocycleIntensityPlanning from '@/components/mesocycle/MicrocycleIntensityPlanning';
import IntensityColumn from '@/components/mesocycle/IntensityColumn';
import IntensityScale from '@/components/mesocycle/IntensityScale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExtendedMesocycle, Mesocycle, Microcycle, Plan, Intensity } from '@/features/planner/types';
import { DailyIntensity, TrainingDay } from '@/types/daily-intensity';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useDragFill } from '@/hooks/useDragFill';
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
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays, Info, ChevronDown, Trash2, Copy } from "lucide-react";
import { format, addWeeks, differenceInWeeks } from "date-fns";
import { trainingData, getMethodsForQuality } from "@/data/trainingData";
import { IntensityLevel } from "@/types/training";
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";

// Helper function for string normalization
const normalizeForComparison = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export default function MesocyclePage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(() => {
    const savedStep = localStorage.getItem('mesocycleStep');
    return savedStep ? parseInt(savedStep) : 1;
  });
  const [isPending, startTransition] = useTransition();
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [macrocycleData, setMacrocycleData] = useState<any>(null);
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
  const [isClearParametersDialogOpen, setIsClearParametersDialogOpen] = useState(false);
  
  // Daily intensity planning state
  const [dailyIntensityData, setDailyIntensityData] = useState<DailyIntensity[]>([]);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  
  // Cross-mesocycle copy dialog state
  const [crossCopyDialogOpen, setCrossCopyDialogOpen] = useState(false);
  const [targetMicrocycleForCopy, setTargetMicrocycleForCopy] = useState<{id: string, duration: number} | null>(null);
  
  // Mesocycle intensity copy dialog state (for step 2)
  const [mesocycleCopyDialogOpen, setMesocycleCopyDialogOpen] = useState(false);
  const [targetMesocycleForIntensityCopy, setTargetMesocycleForIntensityCopy] = useState<{mesocycleId: string, microcycleStructure: Array<{id: string, duration: number}>} | null>(null);
  
  const { data: athleticismData } = useAthleticismData();
  const { data: toolboxData } = useToolboxData();
  const { dragState, startDrag, endDrag, addToSelection, clearSelection, fillCells } = useDragFill();
  const { toast } = useToast();

  const totalSteps = 6;

  // Navigation component for top and bottom
  const NavigationButtons = () => (
    <div className="flex flex-col md:flex-row md:justify-between items-stretch md:items-center gap-3 w-full max-w-full px-2 md:px-0 md:flex-nowrap">
      <Button 
        onClick={() => {
          if (currentStep <= 1) {
            // Smart navigation: go to last saved step in macrocycle
            const savedStep = localStorage.getItem('macrocycleStep');
            const targetStep = savedStep ? parseInt(savedStep) : 5; // Go to last step if no saved step
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
        onClick={() => {
          if (currentStep >= totalSteps) {
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

  // Load macrocycle data on mount
  useEffect(() => {
    const savedMacrocycleData = localStorage.getItem('macrocycleData');
    const savedMesocycleData = localStorage.getItem('mesocycleData');
    
    if (savedMacrocycleData) {
      const data = JSON.parse(savedMacrocycleData);
      console.log('DEBUG: Loaded macrocycle data:', data);
      setMacrocycleData(data);
      
      // Calculate total weeks from date range
      const startDate = data.smartGoal?.startDate ? new Date(data.smartGoal.startDate) : new Date();
      const endDate = data.smartGoal?.endDate ? new Date(data.smartGoal.endDate) : addWeeks(startDate, 12);
      const weeks = data.smartGoal?.startDate && data.smartGoal?.endDate ? 
        Math.ceil((Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) / 7) : 12;
      setTotalWeeks(weeks);
      
      // Set plan dates
      setPlanStartDate(startDate);
      setPlanEndDate(endDate);
      
      // Check if we have saved mesocycle data with allocatedSubGoals
      if (savedMesocycleData) {
        try {
          const savedMesocycles = JSON.parse(savedMesocycleData);
          if (savedMesocycles.mesocycles && savedMesocycles.mesocycles.length > 0) {
            console.log('DEBUG: Loading saved mesocycles with allocatedSubGoals:', savedMesocycles);
            setMesocycles(savedMesocycles.mesocycles);
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
        console.log('DEBUG: Loaded parameter values:', parsed);
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
        console.log('DEBUG: Loaded manually added methods:', parsed);
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
        console.log('DEBUG: Loaded category split states:', parsed);
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

  // Load training days from localStorage on mount
  useEffect(() => {
    const savedTrainingDays = localStorage.getItem('trainingDays');
    if (savedTrainingDays) {
      try {
        const parsed = JSON.parse(savedTrainingDays);
        setTrainingDays(parsed);
        console.log('DEBUG: Loaded training days:', parsed);
      } catch (e) {
        console.error('Failed to load training days:', e);
      }
    }
  }, []);

  // Load daily intensity data from localStorage on mount
  useEffect(() => {
    const savedDailyIntensity = localStorage.getItem('dailyIntensityData');
    if (savedDailyIntensity) {
      try {
        const parsed = JSON.parse(savedDailyIntensity);
        setDailyIntensityData(parsed);
        console.log('DEBUG: Loaded daily intensity data:', parsed);
      } catch (e) {
        console.error('Failed to load daily intensity data:', e);
      }
    }
  }, []);

  // Save mesocycle data to localStorage for microcycle planning
  useEffect(() => {
    if (mesocycles.length > 0) {
      console.log('DEBUG: Saving mesocycles to localStorage:', mesocycles.map(m => ({ id: m.id, allocatedSubGoals: m.allocatedSubGoals })));
      localStorage.setItem('mesocycleData', JSON.stringify({ mesocycles }));
    }
  }, [mesocycles]);

  // Save parameter values to localStorage
  useEffect(() => {
    if (Object.keys(parameterValues).length > 0) {
      localStorage.setItem('parameterValues', JSON.stringify(parameterValues));
    }
  }, [parameterValues]);

  // Save training days to localStorage
  useEffect(() => {
    if (trainingDays.length > 0) {
      localStorage.setItem('trainingDays', JSON.stringify(trainingDays));
    }
  }, [trainingDays]);

  // Save daily intensity data to localStorage
  useEffect(() => {
    if (dailyIntensityData.length > 0) {
      localStorage.setItem('dailyIntensityData', JSON.stringify(dailyIntensityData));
    }
  }, [dailyIntensityData]);

  // Save current step to localStorage
  useEffect(() => {
    localStorage.setItem('mesocycleStep', currentStep.toString());
  }, [currentStep]);

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

  const renderTrainingPlanOverview = () => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Info className="h-5 w-5" />
          <span>Training Plan Overview</span>
        </CardTitle>
        <CardDescription>
          Summary of your macrocycle plan and training timeline.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {macrocycleData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Goal</Label>
              <p className="text-sm font-medium">
                {(() => {
                  // Better goal display priority
                  const goal = macrocycleData.smartGoal?.description || 
                              macrocycleData.smartGoal?.specific || 
                              macrocycleData.smartGoal?.measurable || 
                              macrocycleData.smartGoal?.realistic;
                  return goal && goal.trim() !== "" ? goal : "Not specified";
                })()}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Total Duration</Label>
              <p className="text-sm font-medium">
                {macrocycleData.smartGoal?.startDate && macrocycleData.smartGoal?.endDate ? 
                  `${totalWeeks} weeks (${Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))} days)` : 
                  "-"
                }
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
              <p className="text-sm font-medium">
                {macrocycleData.smartGoal?.startDate ? format(planStartDate, 'MMM dd, yyyy') : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
              <p className="text-sm font-medium">
                {macrocycleData.smartGoal?.endDate ? format(planEndDate, 'MMM dd, yyyy') : "-"}
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm font-medium text-muted-foreground">Sub-goals</Label>
              <div className="flex flex-wrap gap-1">
                {macrocycleData.subGoals?.map((subGoal: any, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {subGoal.description || subGoal.name || subGoal.id || 'Unknown Sub-goal'}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm font-medium text-muted-foreground">Available Methods</Label>
              <p className="text-sm text-muted-foreground">{getMethodsForAllocatedSubGoals.length} unique methods from selected sub-goals</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No macrocycle data found. Please complete the macrocycle planning first.</p>
        )}
      </CardContent>
    </Card>
  );

  // Calculate total mesocycle days from microcycles
  const totalMesocycleDays = mesocycles.reduce((sum, meso) => 
    sum + meso.microcycles.reduce((mesoSum, micro) => mesoSum + micro.duration, 0), 0
  );
  const expectedTotalDays = totalWeeks * 7;
  const daysMismatch = totalMesocycleDays !== expectedTotalDays;

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
    setMesocycles(updated);
  };

  const removeMicrocycle = (mesocycleIndex: number, microcycleIndex: number) => {
    const updated = [...mesocycles];
    updated[mesocycleIndex].microcycles.splice(microcycleIndex, 1);
    setMesocycles(updated);
  };

  const updateMicrocycle = (mesocycleIndex: number, microcycleIndex: number, field: keyof Microcycle, value: any) => {
    const updated = [...mesocycles];
    (updated[mesocycleIndex].microcycles[microcycleIndex] as any)[field] = value;
    setMesocycles(updated);
  };

  const renderMesocycleSetup = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5" />
          <span>Mesocycle Setup</span>
        </CardTitle>
        <CardDescription>
          Configure the structure and duration of your mesocycles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-full">
        {/* Duration Validation Warning */}
        {daysMismatch && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-destructive">
              <Info className="h-4 w-4" />
              <span className="font-medium">Duration Mismatch Warning</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">
              Total microcycle days ({totalMesocycleDays}) don't match your macrocycle plan ({expectedTotalDays} days / {totalWeeks} weeks). 
              Please adjust microcycle durations to match your training plan.
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
            value={mesocycles.length || 3}
            onChange={(e) => {
              const count = parseInt(e.target.value);
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
            placeholder="3"
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
                            <div key={micro.id} className="flex items-center space-x-3 p-3 border rounded-md bg-muted/20">
                              <Input
                                value={micro.name}
                                onChange={(e) => updateMicrocycle(index, microIndex, 'name', e.target.value)}
                                className="flex-1"
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
                              <div className="flex items-center space-x-2">
                                <Label className="text-sm">Intensity:</Label>
                                <Select
                                  value={micro.intensity}
                                  onValueChange={(value: Intensity) => updateMicrocycle(index, microIndex, 'intensity', value)}
                                >
                                  <SelectTrigger className="w-32">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-2 h-2 rounded ${getIntensityColor(micro.intensity)}`}></div>
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {intensityLevels.map((level) => (
                                      <SelectItem key={level} value={level}>
                                        <div className="flex items-center space-x-2">
                                          <div className={`w-2 h-2 rounded ${getIntensityColor(level)}`}></div>
                                          <span className="capitalize text-xs">{level.replace("-", " ")}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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

            {/* Full Training Plan Calendar Visualization */}
            <MesocycleCalendar 
              mesocycles={mesocycles as any} 
              startDate={planStartDate}
              showFullPlan={true}
              totalWeeks={totalWeeks}
            />
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

  const renderIntensitySetup = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Step 2: Microcycle Intensity Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure the training intensity for each microcycle within your mesocycles. Click on any column to adjust the intensity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MicrocycleIntensityPlanning 
          mesocycles={mesocycles}
          intensityLevels={intensityLevels}
          getIntensityColor={getIntensityColor}
          onMicrocycleIntensityChange={handleMicrocycleIntensityChange}
          onCopyMesocycle={copyMesocycleIntensity}
        />
      </CardContent>
    </Card>
  );

  // Helper function for string normalization
  const normalizeForComparison = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Helper functions for sub-goal and method management
  const getSubGoalsFromAthleticismDB = useMemo(() => {
    const subGoalsMap = new Map<string, string>();
    
    // Get selected sub-goal descriptions from macrocycle data
    const selectedSubGoalDescriptions = new Set(
      macrocycleData?.subGoals?.map((sg: any) => normalizeForComparison(sg.description)) || []
    );
    
    athleticismData.entries.forEach(entry => {
      const formattedSubGoal = `${entry.overarchingGoal} - ${entry.subGoal}`;
      const normalizedDescription = normalizeForComparison(formattedSubGoal);
      
      // Only include sub-goals that were selected in macrocycle planning
      if (selectedSubGoalDescriptions.has(normalizedDescription)) {
        subGoalsMap.set(entry.subGoal, formattedSubGoal);
      }
    });
    
    return Array.from(subGoalsMap.values());
  }, [athleticismData, macrocycleData]);

  const getMethodsForAllocatedSubGoals = useMemo(() => {
    if (!macrocycleData) return [];

    // Collect all allocated sub-goals across mesocycles (strings like "Overarching - Sub-goal")
    const allocated = new Set<string>();
    mesocycles.forEach(meso => meso.allocatedSubGoals?.forEach(sg => allocated.add(sg)));

    const methodsSet = new Set<string>();

    allocated.forEach(formattedSubGoal => {
      // Find matching sub-goal in macrocycleData by comparing the full formatted description
      const macroSubGoal = macrocycleData.subGoals?.find((sg: any) => {
        const sgDesc = sg.description || sg.name || sg.id || sg;
        return normalizeForComparison(sgDesc) === normalizeForComparison(formattedSubGoal);
      });

      if (!macroSubGoal) return;

      // Get qualities for this sub-goal (structure: { label, list })
      const qEntry = macrocycleData.qualitiesBySubGoal?.[macroSubGoal.id];
      const qualityNames: string[] = qEntry?.list || [];

      // For each quality, pull selected methods from methodsByQuality (structure: { subGoalLabel, qualityName, list })
      qualityNames.forEach((qName: string) => {
        const qualityId = `${macroSubGoal.id}::${qName}`;
        const mEntry = macrocycleData.methodsByQuality?.[qualityId];
        const methodNames: string[] = mEntry?.list || [];
        methodNames.forEach(m => methodsSet.add(m));
      });
    });

    // Add manually added methods
    manuallyAddedMethods.forEach(method => methodsSet.add(method));

    return Array.from(methodsSet);
  }, [mesocycles, macrocycleData, manuallyAddedMethods]);

  const groupMethodsByToolboxCategory = useMemo(() => {
    const methods = getMethodsForAllocatedSubGoals;
    const grouped: Record<string, Record<string, string[]>> = {};
    
    methods.forEach(method => {
      // Try to match method with toolbox categories
      // For now, use simple heuristics - this could be enhanced with better mapping
      let category = 'General Training';
      let subCategory = 'General';
      
      if (method.toLowerCase().includes('sprint')) {
        category = 'Sprinting';
        if (method.toLowerCase().includes('acceleration')) subCategory = 'Acceleration';
        else if (method.toLowerCase().includes('resisted')) subCategory = 'Resisted Sprinting';
        else if (method.toLowerCase().includes('top speed')) subCategory = 'Top Speed';
        else subCategory = 'General';
      } else if (method.toLowerCase().includes('resistance') || method.toLowerCase().includes('strength')) {
        if (method.toLowerCase().includes('lower body')) {
          category = 'Lower Body Resistance Training';
          if (method.toLowerCase().includes('strength')) subCategory = 'Strength';
          else if (method.toLowerCase().includes('power')) subCategory = 'Power';
          else subCategory = 'General';
        } else if (method.toLowerCase().includes('upper body')) {
          category = 'Upper Body Resistance Training';
          subCategory = 'General';
        } else {
          category = 'Resistance Training';
          subCategory = 'General';
        }
      } else if (method.toLowerCase().includes('jump') || method.toLowerCase().includes('plyometric')) {
        category = 'Plyometrics';
        if (method.toLowerCase().includes('intensive')) subCategory = 'Intensive Jumps';
        else if (method.toLowerCase().includes('extensive')) subCategory = 'Extensive Jumps';
        else subCategory = 'General';
      }
      
      if (!grouped[category]) grouped[category] = {};
      if (!grouped[category][subCategory]) grouped[category][subCategory] = [];
      
      grouped[category][subCategory].push(method);
    });
    
    return grouped;
  }, [getMethodsForAllocatedSubGoals, manuallyAddedMethods]);

  // Helper function to get methods with loading recommendations for a specific sub-goal
  const getMethodsWithRecommendationsForSubGoal = useMemo(() => {
    return (subGoal: string) => {
      const methodsWithRecommendations: Array<{
        method: string;
        recommendations: Record<string, any>;
      }> = [];

      // Find all athleticism entries that match this sub-goal
      athleticismData.entries.forEach(entry => {
        const formattedSubGoal = `${entry.overarchingGoal} - ${entry.subGoal}`;
        if (normalizeForComparison(formattedSubGoal) === normalizeForComparison(subGoal)) {
          // Add all methods from this entry with their recommendations
          entry.mappedMethods.forEach(method => {
            const recommendations = entry.loadingRecommendations[method] || {};
            
            // Check if we already have this method, if so merge recommendations
            const existingMethod = methodsWithRecommendations.find(m => m.method === method);
            if (existingMethod) {
              // Merge recommendations (keep existing if there's a conflict)
              Object.entries(recommendations).forEach(([key, value]) => {
                if (!existingMethod.recommendations[key]) {
                  existingMethod.recommendations[key] = value;
                }
              });
            } else {
              methodsWithRecommendations.push({
                method,
                recommendations
              });
            }
          });
        }
      });

      return methodsWithRecommendations;
    };
  }, [athleticismData]);

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
    
    // Get parameters from toolbox data
    const parameters = toolboxData.entries
      .filter(entry => entry.category === category && entry.subCategory === subCategory)
      .map(entry => ({
        name: entry.parameter,
        type: entry.parameter.toLowerCase().includes('intensity') && entry.parameter.includes('[%]') ? 'number' : 
              entry.parameter.includes('[#]') || entry.parameter.includes('[m]') || entry.parameter.includes('[s]') ? 'number' :
              entry.parameter.includes('[') ? 'select' : 'text',
        unit: entry.parameter.match(/\[(.*?)\]/)?.[1] || '',
        options: entry.parameter.includes('[') && !entry.parameter.includes('%') && !entry.parameter.includes('#') && !entry.parameter.includes('m') && !entry.parameter.includes('s') ?
                entry.parameter.match(/\[(.*?)\]/)?.[1]?.split(', ') : undefined
      }));
    
    return parameters;
  };

  const renderQualityAllocation = () => {
    const handleSubGoalDragStart = (e: React.DragEvent, subGoal: string) => {
      e.dataTransfer.setData('text/plain', subGoal);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, mesocycleId: string) => {
      e.preventDefault();
      const subGoal = e.dataTransfer.getData('text/plain');
      
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      const currentSubGoals = mesocycles[mesocycleIndex].allocatedSubGoals || [];
      const subGoalExists = currentSubGoals.includes(subGoal);
      
      if (subGoalExists) return; // Prevent duplicates
      
      // Add sub-goal to mesocycle with proper immutable update
      const updated = mesocycles.map((meso, idx) => 
        idx === mesocycleIndex 
          ? { ...meso, allocatedSubGoals: [...currentSubGoals, subGoal] }
          : meso
      );
      setMesocycles(updated);
      console.log('DEBUG: Added sub-goal to mesocycle:', { mesocycleId, subGoal, allocatedSubGoals: updated[mesocycleIndex].allocatedSubGoals });
    };

    const removeSubGoalFromMesocycle = (mesocycleId: string, subGoal: string) => {
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      // Proper immutable update
      const updated = mesocycles.map((meso, idx) => 
        idx === mesocycleIndex 
          ? { ...meso, allocatedSubGoals: (meso.allocatedSubGoals || []).filter(sg => sg !== subGoal) }
          : meso
      );
      setMesocycles(updated);
      console.log('DEBUG: Removed sub-goal from mesocycle:', { mesocycleId, subGoal, allocatedSubGoals: updated[mesocycleIndex].allocatedSubGoals });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GripVertical className="h-5 w-5" />
            <span>Sub-Goal Allocation</span>
          </CardTitle>
          <CardDescription>
            Drag and drop sub-goals to assign them to specific mesocycles. Each sub-goal can be assigned to multiple mesocycles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Available Sub-Goals</Label>
              <div className="space-y-2 p-4 border rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
                {getSubGoalsFromAthleticismDB.map((subGoal) => (
                  <div
                    key={subGoal}
                    draggable
                    onDragStart={(e) => handleSubGoalDragStart(e, subGoal)}
                    className="p-3 bg-background border rounded cursor-grab hover:shadow-md transition-shadow"
                    title={subGoal}
                  >
                    <div className="text-sm font-medium">
                      {subGoal}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Mesocycle Sub-Goal Assignments</Label>
              <div className="space-y-3">
                {mesocycles.map((meso) => (
                  <div
                    key={meso.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, meso.id)}
                    className="p-4 border rounded-lg bg-background min-h-24 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded ${getIntensityColor(meso.intensity)}`}></div>
                        <span className="font-medium text-sm">{meso.name}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(!meso.allocatedSubGoals || meso.allocatedSubGoals.length === 0) ? (
                        <p className="text-xs text-muted-foreground">Drop sub-goals here</p>
                      ) : (
                        meso.allocatedSubGoals?.map((subGoal: string, index: number) => (
                          <div key={index} className="bg-primary/10 rounded p-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium">{subGoal}</div>
                              </div>
                              <button
                                onClick={() => removeSubGoalFromMesocycle(meso.id, subGoal)}
                                className="text-destructive hover:text-destructive/80 text-sm ml-2 shrink-0"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
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
    
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle || !mesocycle.allocatedSubGoals || !macrocycleData) return false;
    
    // Check if any of the sub-goals allocated to this mesocycle include this method
    return mesocycle.allocatedSubGoals.some((formattedSubGoal: string) => {
      // Match by full formatted string ("Overarching - Sub-goal")
      const macroSubGoal = macrocycleData.subGoals?.find((sg: any) => {
        const sgDesc = sg.description || sg.name || sg.id || sg;
        return normalizeForComparison(sgDesc) === normalizeForComparison(formattedSubGoal);
      });
      
      if (!macroSubGoal) return false;
      
      // Qualities for this sub-goal
      const qEntry = macrocycleData.qualitiesBySubGoal?.[macroSubGoal.id];
      const qualityNames: string[] = qEntry?.list || [];
      
      // If any quality maps to this method, it's allocated
      return qualityNames.some((qName: string) => {
        const qualityId = `${macroSubGoal.id}::${qName}`;
        const mEntry = macrocycleData.methodsByQuality?.[qualityId];
        const methodNames: string[] = mEntry?.list || [];
        return methodNames.includes(baseMethodName);
      });
    });
  }, [mesocycles, macrocycleData]);

  // Helper function to get cell-specific frequency from user input
  const getCellFrequency = (mesocycleId: string, microcycleIndex: number, methodName: string) => {
    // Handle both base method name and category-suffixed names
    const baseMethodName = getBaseMethodName(methodName);
    
    // Look for frequency parameter case-insensitively
    const cellData = parameterValues[mesocycleId]?.[microcycleIndex]?.[methodName]?.[0] || {};
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

  // Helper function to generate dynamic header grid template using global widths
  const generateHeaderGridTemplate = useCallback(() => {
    const widths = ['300px']; // Fixed left column
    mesocycles.forEach((meso) => {
      (meso.microcycles || []).forEach((_, microcycleIndex) => {
        const width = getGlobalMicrocycleWidth(meso.id, microcycleIndex);
        widths.push(`${width}px`);
      });
    });
    return widths.join(' ');
  }, [mesocycles, getGlobalMicrocycleWidth]);

  // Helper function to calculate grid template for dynamic widths using global calculation
  const calculateGridTemplate = (methodName: string) => {
    const widths = ['300px']; // Fixed left column
    mesocycles.forEach((meso) => {
      (meso.microcycles || []).forEach((_, microcycleIndex) => {
        const width = getGlobalMicrocycleWidth(meso.id, microcycleIndex);
        widths.push(`${width}px`);
      });
    });
    return widths.join(' ');
  };

  // Helper function to check if parameter is frequency-related
  const isFrequencyParameter = (paramName: string) => {
    return paramName.toLowerCase().includes('frequency');
  };

  // Drag fill handlers (hooks must be at component level)
  const handleDragStart = useCallback((cellId: string, value: string | number) => {
    console.log('Drag started from cell:', cellId, 'with value:', value);
    startDrag(cellId, value);
  }, [startDrag]);

  const handleDragEnd = useCallback(() => {
    console.log('Drag ended. Selected cells:', Array.from(dragState.selectedCells));
    console.log('Source value:', dragState.sourceValue);
    
    fillCells((cellId: string, value: string | number) => {
      console.log('Filling cell:', cellId, 'with value:', value);
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

  const handleRowFill = useCallback((methodName: string, parameterName: string, value: string | number, allMesocycles = false, fillEmptyOnly = false, sessionIndex: number = 0) => {
    const targetMesocycles = mesocycles.filter(mesocycle => 
      isMethodAllocatedToMesocycle(methodName, mesocycle.id)
    );

    if (!allMesocycles) {
      // Fill only first mesocycle that has this method
      const firstMesocycle = targetMesocycles[0];
      if (firstMesocycle) {
        for (let i = 0; i < (firstMesocycle.microcycles?.length || 0); i++) {
          const currentValue = getParameterValue(firstMesocycle.id, i, methodName, parameterName, sessionIndex);
          if (!fillEmptyOnly || !currentValue) {
            updateParameterValue(firstMesocycle.id, i, methodName, parameterName, value, sessionIndex);
          }
        }
      }
    } else {
      // Fill all mesocycles
      targetMesocycles.forEach(mesocycle => {
        for (let i = 0; i < (mesocycle.microcycles?.length || 0); i++) {
          const currentValue = getParameterValue(mesocycle.id, i, methodName, parameterName, sessionIndex);
          if (!fillEmptyOnly || !currentValue) {
            updateParameterValue(mesocycle.id, i, methodName, parameterName, value, sessionIndex);
          }
        }
      });
    }
  }, [mesocycles, getParameterValue, updateParameterValue]);

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
    const newManualMethods = [...manuallyAddedMethods, method];
    setManuallyAddedMethods(newManualMethods);
    localStorage.setItem('manuallyAddedMethods', JSON.stringify(newManualMethods));
  }, [manuallyAddedMethods]);

  const handleRemoveMethod = useCallback((method: string) => {
    const newManualMethods = manuallyAddedMethods.filter(m => m !== method);
    setManuallyAddedMethods(newManualMethods);
    localStorage.setItem('manuallyAddedMethods', JSON.stringify(newManualMethods));
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
      
      // Update state and localStorage
      setMacrocycleData(updatedMacrocycleData);
      localStorage.setItem('macrocycleData', JSON.stringify(updatedMacrocycleData));
      
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
    }>> = {};

    if (!toolboxData.entries) return map;

    const allMethods = getMethodsForAllocatedSubGoals;
    
    allMethods.forEach(methodName => {
      // Find all toolbox entries that match this method
      const matchingEntries = toolboxData.entries.filter(entry => {
        const entryKey = `${entry.category}${entry.subCategory ? ` - ${entry.subCategory}` : ''}`;
        return normalizeForComparison(entryKey) === normalizeForComparison(methodName) ||
               normalizeForComparison(entry.parameter) === normalizeForComparison(methodName);
      });
      
      // Convert toolbox entries to parameter format
      map[methodName] = matchingEntries.map(entry => ({
        name: entry.parameterName || entry.parameter.split('[')[0].trim(),
        type: entry.parameterType === 'quantitative' ? 'number' : 'text',
        options: entry.options || [],
        isQuantitative: entry.parameterType === 'quantitative',
        isQualitative: entry.parameterType === 'qualitative'
      }));
    });

    return map;
  }, [toolboxData.entries, getMethodsForAllocatedSubGoals]);

  const renderMethodPeriodization = () => {
    const allMethods = getMethodsForAllocatedSubGoals;
    const groupedMethods = groupMethodsByToolboxCategory;
    
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
                <span>Step 5: Method Periodization</span>
              </CardTitle>
              <CardDescription>
                Configure loading parameters for each training method across all mesocycles and microcycles.
              </CardDescription>
            </div>
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
        </CardHeader>
        <CardContent>
          {allMethods.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No training methods allocated.</p>
              <p className="text-sm text-muted-foreground">Please allocate sub-goals to mesocycles in step 3 first.</p>
            </div>
          ) : (
             <div className="space-y-3">
               <h3 className="text-lg font-semibold">Method Periodization</h3>
                 <div className="w-full border rounded-lg overflow-auto" style={{height: 'calc(100vh - 280px)', scrollbarWidth: 'thin'}}>
                   <div className="min-w-max relative">
                     {/* Multi-Level Sticky Headers */}
                     <div className="sticky top-0 z-[90] bg-background border-b space-y-1 shadow-sm">
                         {/* Level 1: Mesocycle Group Headers */}
                           <div className="grid gap-1" style={{
                             gridTemplateColumns: generateHeaderGridTemplate()
                           }}>
                           <div className="sticky left-0 z-[60] p-2 bg-background font-medium text-sm border rounded-t-lg shadow-md border-r">
                             Training Methods
                           </div>
                          {mesocycles.map((meso) => (
                            <div 
                              key={`${meso.id}-header`} 
                              className={`p-2 font-medium text-sm border rounded-t-lg text-center ${intensityBg(meso.intensity)}`}
                              style={{ 
                                gridColumn: `span ${meso.microcycles?.length || 0}` 
                              }}
                            >
                              <div className="flex items-center justify-center space-x-2">
                                <div className={`w-2 h-2 rounded-full bg-white/80`}></div>
                                <span>{meso.name}</span>
                              </div>
                            </div>
                          ))}
                       </div>

                         {/* Level 2: Sub-goals and Qualities */}
                          <div className="grid gap-1" style={{
                            gridTemplateColumns: generateHeaderGridTemplate()
                          }}>
                            <div className="sticky left-0 z-[60] p-2 bg-background border-l border-r text-xs shadow-md">
                              Focus Areas
                            </div>
                           {mesocycles.map((meso) => {
                             const overview = getMesocycleOverview(meso);
                             return (
                               <div 
                                 key={`${meso.id}-overview`} 
                                 className="p-2 bg-muted/30 border-l border-r text-xs space-y-2"
                                 style={{ 
                                   gridColumn: `span ${meso.microcycles?.length || 0}` 
                                 }}
                               >
                                 {overview.subGoals.length > 0 ? (
                                   <div className="space-y-1">
                                     <span className="font-medium text-muted-foreground">Sub-Goals:</span>
                                      <ul className="space-y-1">
                                        {overview.subGoals.map((subGoal) => {
                                          const methodsWithRecs = getMethodsWithRecommendationsForSubGoal(subGoal);
                                          
                                          return (
                                            <li key={subGoal} className="text-xs">
                                              <Popover>
                                                <PopoverTrigger
                                                  className="flex items-start gap-1 text-left hover:text-primary transition-colors cursor-pointer w-full"
                                                >
                                                  <span className="text-primary">•</span>
                                                  <span className="text-foreground leading-tight">{subGoal}</span>
                                                </PopoverTrigger>
                                                <PopoverContent 
                                                  className="w-[800px] max-w-[95vw] z-[100]" 
                                                  align="start"
                                                  side="bottom"
                                                  sideOffset={5}
                                                >
                                                  <div className="space-y-2">
                                                    <h4 className="font-semibold text-sm text-foreground">{subGoal}</h4>
                                                    {methodsWithRecs.length > 0 ? (
                                                      <div className="space-y-2">
                                                        {methodsWithRecs.map(({ method, recommendations }) => (
                                                          <div key={method} className="text-xs border-l-2 border-primary/30 pl-3">
                                                            <div className="font-medium text-primary mb-1">{method}</div>
                                                            <div className="text-muted-foreground leading-relaxed">
                                                              {formatLoadingRecommendations(recommendations)}
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <div className="text-xs text-muted-foreground italic">
                                                        No methods available for this sub-goal
                                                      </div>
                                                    )}
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                   </div>
                                 ) : (
                                   <span className="text-muted-foreground italic">No sub-goals allocated</span>
                                 )}
                              </div>
                            );
                          })}
                       </div>

                         {/* Level 3: Microcycle Headers with Intensity Colors */}
                          <div className="grid gap-1" style={{
                            gridTemplateColumns: generateHeaderGridTemplate()
                          }}>
                           <div className="sticky left-0 z-[60] p-2 bg-background font-medium text-xs border rounded-b-lg shadow-md border-r">
                             Parameters
                           </div>
                          {mesocycles.map((meso) => 
                            (meso.microcycles || []).map((microcycle, microcycleIndex) => {
                              const intensity = microcycle.intensity || meso.intensity;
                              
                              return (
                                <div key={`${meso.id}-micro-${microcycleIndex}`} className={`text-center border rounded-b ${intensityBg(intensity)}`}>
                                  <div className="text-xs p-1 font-medium">
                                    {microcycle.name || `Mic${microcycleIndex + 1}`}
                                  </div>
                                  <div className="text-xs px-1 py-0.5 opacity-80 border-t">
                                    {microcycle.duration} days
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                     </div>

                      {/* Method Categories */}
                      <div className="p-4 space-y-6">
                        {Object.entries(groupedMethods).map(([category, subCategories]) => (
                          <div key={category} className="space-y-4">
                            {/* Category Header */}
                            <div className="border-b pb-2">
                              <h4 className="text-lg font-semibold text-primary">{category}</h4>
                            </div>
                            
                            {/* Sub-categories and Methods */}
                            {Object.entries(subCategories).map(([subCategory, methods]) => (
                              <div key={subCategory} className="space-y-2">
                                {/* Sub-category Header */}
                                <h5 className="text-md font-medium text-muted-foreground">{subCategory}</h5>
                                
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
                                    
                                    return (
                                      <div key={fullMethodName} className={`border rounded-lg bg-card shadow-sm ${isIndented ? 'ml-4 border-l-4 border-primary/30' : ''}`}>
                                          {/* Method/Category name header */}
                                          <div className="grid gap-1 bg-muted/20" style={{ 
                                             gridTemplateColumns: calculateGridTemplate(baseMethodName)
                                           }}>
                                             <div className="sticky left-0 z-40 p-3 font-medium text-sm border-r bg-background rounded-tl shadow-md">
                                               <div className="flex items-center justify-between group pr-16 relative">
                                                 <div className="flex items-center gap-2">
                                                   {categoryName && <span className="text-xs text-muted-foreground">↳</span>}
                                                   <div className="line-clamp-3" title={fullMethodName}>
                                                     {categoryName ? `${baseMethodName} - ${categoryName}` : baseMethodName}
                                                   </div>
                                                 </div>
                                                 <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                                                   {/* Split/Unsplit button - only show for base method or first category */}
                                                   {hasCategoriesAvailable && (!categoryName || categoryName === categories[0]) && (
                                                     <Button
                                                       variant="ghost"
                                                       size="sm"
                                                       className="h-6 w-6 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
                                                       onClick={() => toggleCategorySplit(baseMethodName)}
                                                       title={isCategorySplit ? "Merge categories" : "Split by exercise category"}
                                                     >
                                                       {isCategorySplit ? <Columns className="h-4 w-4" /> : <SplitSquareHorizontal className="h-4 w-4" />}
                                                     </Button>
                                                   )}
                                                   {/* Delete button - only for base method or first category */}
                                                   {(!categoryName || categoryName === categories[0]) && (
                                                     <Button
                                                       variant="ghost"
                                                       size="sm"
                                                       className="h-6 w-6 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                       onClick={() => handleDeleteMethod(baseMethodName)}
                                                       title="Delete method"
                                                     >
                                                       <Trash2 className="h-4 w-4" />
                                                     </Button>
                                                   )}
                                                 </div>
                                               </div>
                                             </div>
                                          {mesocycles.map((meso) => 
                                            (meso.microcycles || []).map((microcycle, microcycleIndex) => {
                                              const isAllocated = isMethodAllocatedToMesocycle(fullMethodName, meso.id);
                                              const frequency = getCellFrequency(meso.id, microcycleIndex, fullMethodName);
                                              const isSplit = isMicrocycleSplit(meso.id, microcycleIndex);
                                              const sessionsCount = getCellSessions(meso.id, microcycleIndex, fullMethodName);
                                              
                                              return (
                                                <div 
                                                  key={`${meso.id}-${microcycleIndex}`} 
                                                  className={`p-2 text-xs text-center font-medium border-l ${intensityBg(microcycle.intensity)} ${!isAllocated ? 'opacity-50' : ''} flex flex-col items-center gap-1`}
                                                >
                                                  <div className="flex items-center gap-1">
                                                     {frequency > 1 && (
                                                        <button
                                                          onClick={() => toggleMicrocycleSplit(meso.id, microcycleIndex)}
                                                          className="px-1.5 py-0.5 text-[10px] text-current hover:bg-black/20 rounded transition-colors font-medium"
                                                         title={`${isSplit ? 'Merge' : 'Split'} sessions (${frequency}×/wk)`}
                                                       >
                                                         {isSplit ? 'Merge' : 'Split'}
                                                       </button>
                                                     )}
                                                  </div>
                                                  {isSplit && (
                                                    <div className="flex gap-0.5 text-[10px]">
                                                      {Array.from({ length: sessionsCount }, (_, i) => (
                                                        <span key={i} className="px-1 bg-black/20 rounded">S{i + 1}</span>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      
                                       {/* Parameter sub-rows */}
                                       {parameters.length > 0 && (
                                         <div className="divide-y">
                                             {parameters.map((param) => (
                                                  <div key={param.name} className="grid gap-1 hover:bg-muted/5" style={{ 
                                                    gridTemplateColumns: calculateGridTemplate(baseMethodName)
                                                  }}>
                                                 <div className="sticky left-0 z-40 p-2 text-xs text-muted-foreground bg-background border-r flex items-center justify-between shadow-md">
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
                                                     onFillRow={(value, allMesocycles, fillEmptyOnly) => 
                                                       handleRowFill(fullMethodName, param.name, value, allMesocycles, fillEmptyOnly, 0)
                                                     }
                                                     disabled={!mesocycles.some(meso => isMethodAllocatedToMesocycle(fullMethodName, meso.id))}
                                                   />
                                                 </div>
                                                 {mesocycles.map((meso) =>
                                                   (meso.microcycles || []).map((microcycle, microcycleIndex) => {
                                                      const isAllocated = isMethodAllocatedToMesocycle(fullMethodName, meso.id);
                                                       const isSplit = isMicrocycleSplit(meso.id, microcycleIndex);
                                                       const sessionsCount = getCellSessions(meso.id, microcycleIndex, fullMethodName);
                                                      const isFrequency = isFrequencyParameter(param.name);
                                                      
                                                      if (isSplit && !isFrequency) {
                                                       return (
                                                         <div key={`${meso.id}-${microcycleIndex}`} className="flex">
                                                           {Array.from({ length: sessionsCount }, (_, sessionIndex) => {
                                                             const currentValue = getParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, sessionIndex);
                                                             const cellId = `${meso.id}::${microcycleIndex}::${fullMethodName}::${sessionIndex}::${param.name}`;
                                                             const isDragSource = dragState.sourceCell === cellId;
                                                             const isInSelection = dragState.selectedCells.has(cellId);
                                                             
                                                             return (
                                                               <div 
                                                                 key={sessionIndex}
                                                                 className={`p-1 border-l flex-1 ${!isAllocated ? 'bg-gray-100/50 opacity-50' : ''}`}
                                                                 style={{ minWidth: '120px' }}
                                                                 data-drag-cell={cellId}
                                                                 data-allocated={isAllocated ? 'true' : 'false'}
                                                               >
                                                                 <ParameterContextMenu
                                                                   cellId={cellId}
                                                                   value={currentValue}
                                                                   onFillRight={handleFillRight}
                                                                   onFillRow={handleFillRow}
                                                                   disabled={!isAllocated || !currentValue}
                                                                 >
                                                                   {param.isQuantitative ? (
                                                                     <QuantitativeParameterInput
                                                                       value={isAllocated ? currentValue.toString() : ''}
                                                                       onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, sessionIndex)}
                                                                       unit={param.options?.[0] || ''}
                                                                       onUnitChange={(unit) => {
                                                                         // For now, we don't change units dynamically
                                                                       }}
                                                                       units={param.options || []}
                                                                       placeholder=""
                                                                       cellId={cellId}
                                                                       onDragStart={handleDragStart}
                                                                       onDragEnd={handleDragEnd}
                                                                       isDragSource={isDragSource}
                                                                       isInDragSelection={isInSelection}
                                                                       isEnabled={isAllocated}
                                                                     />
                                                                   ) : param.isQualitative ? (
                                                                     <QualitativeParameterInput
                                                                       value={isAllocated ? currentValue.toString() : ''}
                                                                       onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, sessionIndex)}
                                                                       options={param.options || []}
                                                                       placeholder=""
                                                                       cellId={cellId}
                                                                       onDragStart={handleDragStart}
                                                                       onDragEnd={handleDragEnd}
                                                                       isDragSource={isDragSource}
                                                                       isInDragSelection={isInSelection}
                                                                       isEnabled={isAllocated}
                                                                     />
                                                                    ) : (
                                                                      <DebouncedTextInput
                                                                        value={isAllocated ? currentValue.toString() : ''}
                                                                        onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, param.type === 'number' ? Number(value) : value, sessionIndex)}
                                                                        className={!isAllocated ? 'cursor-not-allowed' : ''}
                                                                        placeholder=""
                                                                        disabled={!isAllocated}
                                                                      />
                                                                    )}
                                                                 </ParameterContextMenu>
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
                                                             className={`p-1 border-l ${!isAllocated ? 'bg-gray-100/50 opacity-50' : ''}`}
                                                             data-drag-cell={cellId}
                                                             data-allocated={isAllocated ? 'true' : 'false'}
                                                           >
                                                           <ParameterContextMenu
                                                             cellId={cellId}
                                                             value={currentValue}
                                                             onFillRight={handleFillRight}
                                                             onFillRow={handleFillRow}
                                                             disabled={!isAllocated || !currentValue}
                                                           >
                                                             {param.isQuantitative ? (
                                                               <QuantitativeParameterInput
                                                                 value={isAllocated ? currentValue.toString() : ''}
                                                                 onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, 0)}
                                                                unit={param.options?.[0] || ''}
                                                                onUnitChange={(unit) => {
                                                                  // For now, we don't change units dynamically
                                                                }}
                                                                units={param.options || []}
                                                                placeholder=""
                                                                cellId={cellId}
                                                                onDragStart={handleDragStart}
                                                                onDragEnd={handleDragEnd}
                                                                isDragSource={isDragSource}
                                                                isInDragSelection={isInSelection}
                                                                isEnabled={isAllocated}
                                                              />
                                                            ) : param.isQualitative ? (
                                                              <QualitativeParameterInput
                                                                value={isAllocated ? currentValue.toString() : ''}
                                                                onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, value, 0)}
                                                                options={param.options || []}
                                                                placeholder=""
                                                                cellId={cellId}
                                                                onDragStart={handleDragStart}
                                                                onDragEnd={handleDragEnd}
                                                                isDragSource={isDragSource}
                                                                isInDragSelection={isInSelection}
                                                                isEnabled={isAllocated}
                                                              />
                                                             ) : (
                                                               <DebouncedTextInput
                                                                 value={isAllocated ? currentValue.toString() : ''}
                                                                 onValueChange={(value) => isAllocated && updateParameterValue(meso.id, microcycleIndex, fullMethodName, param.name, param.type === 'number' ? Number(value) : value, 0)}
                                                                 className={!isAllocated ? 'cursor-not-allowed' : ''}
                                                                 placeholder=""
                                                                 disabled={!isAllocated}
                                                               />
                                                             )}
                                                          </ParameterContextMenu>
                                                        </div>
                                                      );
                                                    }
                                                  }).flat()
                                                )}
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
             )}

             {/* Add Method Section */}
             <div className="mt-4 pt-4 border-t">
               <div className="flex items-center justify-between">
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Step 6: Exercise Selection</span>
        </CardTitle>
        <CardDescription>
          Select specific exercises for each training method across your mesocycles and microcycles.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto max-w-full">
        <MicrocyclePlanningTable 
          mesocycles={mesocycles}
          selectedMethods={getAllocatedMethods()}
          parameterValues={parameterValues}
          methodParametersMap={methodParametersMap}
          onExerciseSelectionChange={(cellData) => {
            localStorage.setItem('exerciseSelectionData', JSON.stringify(cellData));
          }}
        />
      </CardContent>
    </Card>
  );

  // Calculate all days based on macrocycle data and mesocycle structure
  const calculateTrainingDays = (): TrainingDay[] => {
    if (!macrocycleData || !mesocycles.length) return [];
    
    const days: TrainingDay[] = [];
    const testDates = macrocycleData.subGoals?.flatMap((sg: any) => sg.testDates || []).map((d: string) => new Date(d)) || [];
    const eventDates = macrocycleData.events?.flatMap((e: any) => e.eventDates || []).map((d: string) => new Date(d)) || [];
    
    console.log('DEBUG: Processing dates for daily intensity:');
    console.log('DEBUG: testDates:', testDates);
    console.log('DEBUG: eventDates:', eventDates);
    console.log('DEBUG: testDates converted:', testDates.map(d => d.toISOString().split('T')[0]));
    console.log('DEBUG: eventDates converted:', eventDates.map(d => d.toISOString().split('T')[0]));
    
    let currentDate = new Date(planStartDate);
    
    mesocycles.forEach((meso, mesoIndex) => {
      meso.microcycles.forEach((micro, microIndex) => {
        // Add all days for this microcycle (no predetermined training day restrictions)
        for (let dayInMicro = 0; dayInMicro < micro.duration; dayInMicro++) {
          const dayDate = new Date(currentDate);
          dayDate.setDate(currentDate.getDate() + dayInMicro);
          
          const dayOfWeek = dayDate.getDay();
          const dateStr = dayDate.toISOString().split('T')[0];
          const isTestDay = testDates.some(td => td.toISOString().split('T')[0] === dateStr);
          const isEventDay = eventDates.some(ed => ed.toISOString().split('T')[0] === dateStr);
          
          if (isTestDay || isEventDay) {
            console.log(`DEBUG: Found special day ${dateStr} - isTestDay: ${isTestDay}, isEventDay: ${isEventDay}`);
          }
          
          days.push({
            date: dateStr,
            dayOfWeek,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
            mesocycleId: meso.id,
            microcycleId: micro.id,
            isTestDay,
            isEventDay,
            isTrainingDay: true // All days are now equally selectable
          });
        }
        
        currentDate.setDate(currentDate.getDate() + micro.duration);
      });
    });
    
    return days;
  };

  // Update training days when mesocycles change
  useEffect(() => {
    const days = calculateTrainingDays();
    setTrainingDays(days);
    
    // Initialize daily intensity data if not exists
    const existingIntensities = dailyIntensityData.reduce((acc, di) => {
      acc[di.date] = di;
      return acc;
    }, {} as Record<string, DailyIntensity>);
    
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
  }, [mesocycles, macrocycleData, planStartDate]);

  // Handle intensity selection
  const handleIntensityClick = (date: string, intensity: IntensityLevel) => {
    setDailyIntensityData(prev => 
      prev.map(di => 
        di.date === date ? { ...di, intensity } : di
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

  // Helper functions for tooltips
  const getTestsForDate = (date: string): string[] => {
    if (!macrocycleData?.subGoals) return [];
    
    return macrocycleData.subGoals
      .filter((subGoal: any) => 
        subGoal.testDates?.some((testDate: string) => 
          new Date(testDate).toISOString().split('T')[0] === date
        )
      )
      .map((subGoal: any) => subGoal.testMethod || subGoal.description || 'Test');
  };

  const getEventsForDate = (date: string): string[] => {
    if (!macrocycleData?.events) return [];
    
    return macrocycleData.events
      .filter((event: any) => 
        event.eventDates?.some((eventDate: string) => 
          new Date(eventDate).toISOString().split('T')[0] === date
        )
      )
      .map((event: any) => event.name || 'Event');
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
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return;
    
    const targetMicrocycleIndex = mesocycle.microcycles.findIndex(m => m.id === targetMicrocycleId);
    if (targetMicrocycleIndex <= 0) return; // Can't copy if it's the first microcycle
    
    const targetMicrocycle = mesocycle.microcycles[targetMicrocycleIndex];
    const previousMicrocycle = mesocycle.microcycles[targetMicrocycleIndex - 1];
    
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

  const renderDailyIntensityPlanning = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CalendarDays className="h-5 w-5" />
          <span>Step 3: Daily Training Intensity Planning</span>
        </CardTitle>
        <CardDescription>
          Set the training intensity for each training day across all mesocycles and microcycles.
        </CardDescription>
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
          
          {/* Horizontal scrollable grid */}
          <div className="w-full min-w-0 border rounded-lg">
            <div className="force-scrollbar-x overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'thin' }}>
              <div className="w-max p-4">
                {/* Mesocycle Headers */}
                <div className="flex mb-4 flex-nowrap">
                  <div className="sticky left-0 bg-background z-20 min-w-[140px] mr-4 shrink-0">
                    <div className="text-sm font-semibold text-center py-2">Daily Intensity</div>
                  </div>
                  <div className="flex flex-nowrap">
                    {mesocycles.map((meso) => {
                      const width = meso.microcycles.reduce((acc, micro) => acc + micro.duration * 80, 0);
                      return meso.microcycles.length > 0 ? (
                        <div 
                          key={meso.id}
                          className={`relative text-center border-r-2 font-semibold border-r-slate-400 ${getIntensityColor(meso.intensity)} py-2 shrink-0`}
                          style={{ width: `${width}px` }}
                        >
                          {meso.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                {/* Microcycle Names Row */}
                <div className="flex mb-2 flex-nowrap">
                  <div className="sticky left-0 bg-background z-20 min-w-[140px] mr-4 shrink-0">
                    {/* Empty space to align with intensity scale */}
                  </div>
                  <div className="flex flex-nowrap">
                    {mesocycles.map((meso) => 
                      meso.microcycles.map((micro, microIndex) => {
                        const width = micro.duration * 80; // 80px per day
                        const isLastMicro = microIndex === meso.microcycles.length - 1;
                        
                        // Check if we can show copy icon (has previous microcycle with matching duration)
                        const canCopy = microIndex > 0 && 
                          meso.microcycles[microIndex - 1].duration === micro.duration;
                        
                        return (
                          <div 
                            key={micro.id}
                            className={`relative text-center text-sm py-1 px-2 shrink-0 ${getIntensityColor(micro.intensity)} ${
                              isLastMicro ? 'border-r-2 border-r-slate-400' : 'border-r border-border'
                            }`}
                            style={{ width: `${width}px` }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>{micro.name}</span>
                              
                              {/* Copy icon - only show if can copy from previous microcycle */}
                              {canCopy && (
                                <button
                                  onClick={() => copyMicrocycleDailyIntensity(meso.id, micro.id)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title={`Copy intensity pattern from ${meso.microcycles[microIndex - 1].name}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
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

                  {/* Day Columns */}
                  <TooltipProvider>
                    <div className="flex items-end flex-nowrap">
                      {trainingDays.map((day, index) => {
                        const dayIntensity = dailyIntensityData.find(di => di.date === day.date)?.intensity || "moderate";
                        const isLastDayOfMicro = index === trainingDays.length - 1 || 
                          (index < trainingDays.length - 1 && trainingDays[index + 1].microcycleId !== day.microcycleId);
                        
                        return (
                          <IntensityColumn
                            key={day.date}
                            day={day}
                            intensity={dayIntensity}
                            onIntensityChange={handleIntensityClick}
                            tooltipContent={getTooltipContent(day)}
                            isLastDayOfMicrocycle={isLastDayOfMicro}
                            isLastDayOfMesocycle={isLastDayOfMesocycle(index)}
                            intensityLevels={intensityLevels}
                            getIntensityColor={getIntensityColor}
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

  const stepTitles = [
    "Mesocycle Setup",
    "Intensity Configuration",
    "Daily Training Intensity Planning", 
    "Sub-Goal Allocation",
    "Method Periodization",
    "Exercise Selection"
  ];

  return (
    <div className="w-full max-w-none space-y-6 min-w-0">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mesocycle Planning</h1>
          <div className="flex items-center gap-2">
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
          {currentStep === 2 && renderIntensitySetup()}
          {currentStep === 3 && renderDailyIntensityPlanning()}
          {currentStep === 4 && renderQualityAllocation()}
          {currentStep === 5 && renderMethodPeriodization()}
          {currentStep === 6 && renderExerciseSelection()}
        </div>

        <NavigationButtons />
        
        {/* Keyboard Shortcuts Panel - only show on Method Periodization step */}
        {currentStep === 5 && <KeyboardShortcutsPanel />}
        
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
    </div>
  );
};