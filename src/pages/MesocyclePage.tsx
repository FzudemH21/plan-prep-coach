import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ExtendedMesocycle, Mesocycle, Intensity } from '@/features/planner/types';
import { TrainingMethod, IntensityLevel } from "@/types/training";
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { useToolboxData } from '@/hooks/useToolboxData';
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays, Info, ChevronDown, Settings } from "lucide-react";
import MesocycleCalendar from "@/components/mesocycle/MesocycleCalendar";
import { MicrocycleIntensityChart } from "@/components/mesocycle/MicrocycleIntensityChart";
import { format, addWeeks, differenceInWeeks } from "date-fns";
import { trainingData, getMethodsForQuality } from "@/data/trainingData";
import { methodParameters, getParametersForMethod, getParameterValue, setParameterValue } from "@/data/methodParameters";

export default function MesocyclePage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [mesocycles, setMesocycles] = useState<ExtendedMesocycle[]>([]);
  const [trainingMethods, setTrainingMethods] = useState<TrainingMethod[]>([]);
  const [mesocycleLength, setMesocycleLength] = useState(4);
  const [uniformLength, setUniformLength] = useState(true);
  
  // Macrocycle data from previous step
  const [macrocycleData, setMacrocycleData] = useState<any>(null);
  const [planStartDate, setPlanStartDate] = useState<Date>(new Date());
  const [planEndDate, setPlanEndDate] = useState<Date>(new Date());
  const [totalWeeks, setTotalWeeks] = useState<number>(0);
  
  // Parameter values for method periodization (step 4)
  const [parameterValues, setParameterValues] = useState<Record<string, Record<number, Record<string, Record<string, string | number>>>>>({});

  // Load athleticism and toolbox data
  const { data: athleticismData } = useAthleticismData();
  const { data: toolboxData } = useToolboxData();

  const totalSteps = 4;

  // Navigation component for top and bottom
  const NavigationButtons = () => (
    <div className="flex justify-between items-center">
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
      >
        {currentStep <= 1 ? "Back to Macrocycle" : "Previous"}
      </Button>
      <Button 
        onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
        disabled={currentStep >= totalSteps}
      >
        Next
      </Button>
    </div>
  );
  const progress = (currentStep / totalSteps) * 100;

  // Load macrocycle data on mount
  useEffect(() => {
    const savedMacrocycleData = localStorage.getItem('macrocycleData');
    if (savedMacrocycleData) {
      const data = JSON.parse(savedMacrocycleData);
      setMacrocycleData(data);
      
      // Calculate total weeks from date range (inclusive calculation to match MacrocyclePage)
      const startDate = data.smartGoal?.startDate ? new Date(data.smartGoal.startDate) : new Date();
      const endDate = data.smartGoal?.endDate ? new Date(data.smartGoal.endDate) : addWeeks(startDate, 12);
      const weeks = data.smartGoal?.startDate && data.smartGoal?.endDate ? 
        Math.ceil((Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) / 7) : 12; // match MacrocyclePage calculation
      setTotalWeeks(weeks);
      
      // Set plan dates
      setPlanStartDate(startDate);
      setPlanEndDate(endDate);
      
      // Auto-calculate mesocycles using 4-week blocks as default
      const suggestedMesocycleCount = Math.ceil(weeks / 4);
      const suggestedLength = 4;
      
      setMesocycleLength(suggestedLength);
      
      // Create default mesocycles with 4-week blocks
      const defaultMesocycles: ExtendedMesocycle[] = Array.from({ length: suggestedMesocycleCount }, (_, i) => {
        const remainingWeeks = weeks - (i * 4);
        const mesocycleWeeks = Math.min(4, remainingWeeks);
        let currentStartDate = addWeeks(startDate, i * 4);
        let currentEndDate = addWeeks(currentStartDate, mesocycleWeeks);
        
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
          microcycles: []
        };
      });
      
      setMesocycles(defaultMesocycles);
      
      // Load training methods from macrocycle data
      if (data.methodsByQuality) {
        const allMethods: TrainingMethod[] = [];
        Object.values(data.methodsByQuality).forEach((methods: any) => {
          // Ensure methods is an array before spreading
          if (Array.isArray(methods)) {
            allMethods.push(...methods);
          } else if (methods && typeof methods === 'object') {
            // If it's a single method object, push it directly
            allMethods.push(methods);
          }
        });
        setTrainingMethods(allMethods);
      }
    }
  }, []);

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

  // Calculate total mesocycle weeks
  const totalMesocycleWeeks = mesocycles.reduce((sum, meso) => sum + meso.duration, 0);
  const weeksMismatch = totalMesocycleWeeks !== totalWeeks;

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
      <CardContent className="space-y-6">
        {/* Week Validation Warning */}
        {weeksMismatch && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-destructive">
              <Info className="h-4 w-4" />
              <span className="font-medium">Week Mismatch Warning</span>
            </div>
            <p className="text-sm text-destructive/80 mt-1">
              Total mesocycle weeks ({totalMesocycleWeeks}) don't match your macrocycle plan ({totalWeeks} weeks). 
              Please adjust mesocycle durations to match your training plan.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                const newMesocycles: ExtendedMesocycle[] = Array.from({ length: count }, (_, i) => ({
                  id: `meso-${i + 1}`,
                  name: `Mesocycle ${i + 1}`,
                  weeks: mesocycleLength,
                  sessionsPerWeek: 3,
                  sessionLength: 60,
                  startDate: new Date(),
                  endDate: new Date(),
                  duration: mesocycleLength,
                  intensity: "moderate" as IntensityLevel,
                  trainingMethods: [],
                  trainingQualities: [],
                  microcycles: []
                }));
                setMesocycles(newMesocycles);
              }}
              placeholder="3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mesocycleLength">Standard Mesocycle Length (weeks)</Label>
            <Input
              id="mesocycleLength"
              type="number"
              min="1"
              max="12"
              value={mesocycleLength}
              onChange={(e) => {
                const length = parseInt(e.target.value);
                setMesocycleLength(length);
                if (uniformLength) {
                  const updated = mesocycles.map(meso => ({ ...meso, duration: length }));
                  setMesocycles(updated);
                }
              }}
              placeholder="4"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="uniformLength"
            checked={uniformLength}
            onChange={(e) => setUniformLength(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="uniformLength">Use uniform length for all mesocycles</Label>
        </div>

        {mesocycles.length > 0 && (
          <>
            <div className="space-y-4">
              <h4 className="font-semibold">Mesocycle Configuration</h4>
              <div className="grid grid-cols-1 gap-4">
                {mesocycles.map((meso, index) => (
                  <div key={meso.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1">
                        <Input
                          value={meso.name}
                          onChange={(e) => {
                            const updated = [...mesocycles];
                            updated[index].name = e.target.value;
                            setMesocycles(updated);
                          }}
                          className="font-medium flex-1"
                        />
                        {!uniformLength && (
                          <div className="flex items-center space-x-2">
                            <Label>Weeks:</Label>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              value={meso.duration}
                              onChange={(e) => {
                                const updated = [...mesocycles];
                                updated[index].duration = parseInt(e.target.value);
                                setMesocycles(updated);
                              }}
                              className="w-20"
                            />
                          </div>
                        )}
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
                            <SelectTrigger className="w-36">
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
                      </div>
                    </div>
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

  const renderIntensitySetup = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Microcycle Intensity Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure the training intensity for each week (microcycle) within your mesocycles using the interactive chart.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MicrocycleIntensityChart 
          mesocycles={mesocycles}
          onMesocyclesChange={setMesocycles}
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
  const getSubGoalsFromAthleticismDB = React.useMemo(() => {
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

  const getMethodsForAllocatedSubGoals = React.useMemo(() => {
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

    return Array.from(methodsSet);
  }, [mesocycles, macrocycleData]);

  const groupMethodsByToolboxCategory = React.useMemo(() => {
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
  }, [getMethodsForAllocatedSubGoals]);

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
      
      // Add sub-goal to mesocycle
      const updated = [...mesocycles];
      updated[mesocycleIndex].allocatedSubGoals = [...currentSubGoals, subGoal];
      setMesocycles(updated);
    };

    const removeSubGoalFromMesocycle = (mesocycleId: string, subGoal: string) => {
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      const updated = [...mesocycles];
      updated[mesocycleIndex].allocatedSubGoals = (updated[mesocycleIndex].allocatedSubGoals || [])
        .filter(sg => sg !== subGoal);
      setMesocycles(updated);
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

  const renderMethodPeriodization = () => {
    const allMethods = getMethodsForAllocatedSubGoals;
    const groupedMethods = groupMethodsByToolboxCategory;
    
    // Helper function to check if a method should be shown for a mesocycle
    const isMethodAllocatedToMesocycle = (methodName: string, mesocycleId: string) => {
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
          return methodNames.includes(methodName);
        });
      });
    };

    // Helper function to get mesocycle overview data
    const getMesocycleOverview = (mesocycle: ExtendedMesocycle) => {
      return {
        subGoals: mesocycle.allocatedSubGoals || []
      };
    };

    const updateParameterValue = (mesocycleId: string, microcycleIndex: number, methodName: string, parameterName: string, value: string | number) => {
      setParameterValues(prev => setParameterValue(mesocycleId, microcycleIndex, methodName, parameterName, value, prev));
    };

    // Helper function for intensity colors (using same logic from other components)
    const intensityBg = (intensity: string) => {
      const intensityMap: Record<string, string> = {
        'off': 'bg-gray-200 text-gray-700 border-gray-300',
        'deload': 'bg-blue-100 text-blue-700 border-blue-300',
        'easy': 'bg-green-100 text-green-700 border-green-300',
        'easy-moderate': 'bg-emerald-100 text-emerald-700 border-emerald-300',
        'moderate': 'bg-yellow-100 text-yellow-700 border-yellow-300',
        'moderate-hard': 'bg-orange-100 text-orange-700 border-orange-300',
        'hard': 'bg-red-100 text-red-700 border-red-300',
        'extremely-hard': 'bg-red-200 text-red-800 border-red-400'
      };
      return intensityMap[intensity] || intensityMap['easy'];
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Step 4: Method Periodization</span>
          </CardTitle>
          <CardDescription>
            Configure loading parameters for each training method across all mesocycles and microcycles.
          </CardDescription>
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
                 <div className="h-[32rem] w-full border rounded-lg overflow-auto" style={{scrollbarWidth: 'thin'}}>
                   <div className="min-w-max relative">
                     {/* Multi-Level Sticky Headers */}
                     <div className="sticky top-0 z-[90] bg-background border-b space-y-1 shadow-sm">
                       {/* Level 1: Mesocycle Group Headers */}
                       <div className="grid gap-1" style={{
                         gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)`
                       }}>
                          <div className="sticky left-0 z-[60] p-2 bg-background font-medium text-sm border rounded-t-lg shadow-md border-r">
                            Training Methods
                          </div>
                         {mesocycles.map((meso) => (
                           <div 
                             key={`${meso.id}-header`} 
                             className="p-2 bg-primary text-primary-foreground font-medium text-sm border rounded-t-lg text-center"
                             style={{ 
                               gridColumn: `span ${meso.duration}` 
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
                         gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)`
                       }}>
                          <div className="sticky left-0 z-[60] p-2 bg-background border-l border-r text-xs shadow-md">
                            Focus Areas
                          </div>
                         {mesocycles.map((meso) => {
                           const overview = getMesocycleOverview(meso);
                           return (
                             <div 
                               key={`${meso.id}-overview`} 
                               className="p-2 bg-muted/30 border-l border-r text-xs space-y-1"
                               style={{ 
                                 gridColumn: `span ${meso.duration}` 
                               }}
                             >
                                {overview.subGoals.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    <span className="font-medium text-muted-foreground">Sub-Goals:</span>
                                    <span className="text-foreground text-xs">{overview.subGoals.join(', ')}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">No sub-goals allocated</span>
                                )}
                             </div>
                           );
                         })}
                       </div>

                       {/* Level 3: Week Headers with Intensity Colors */}
                       <div className="grid gap-1" style={{
                         gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)`
                       }}>
                          <div className="sticky left-0 z-[60] p-2 bg-background font-medium text-xs border rounded-b-lg shadow-md border-r">
                            Parameters
                          </div>
                         {mesocycles.map((meso) => 
                           Array.from({ length: meso.duration }, (_, weekIndex) => {
                             const globalWeek = mesocycles.slice(0, mesocycles.indexOf(meso)).reduce((sum, m) => sum + m.duration, 0) + weekIndex + 1;
                             const microcycle = meso.microcycles?.[weekIndex];
                             const intensity = microcycle?.intensity || meso.intensity;
                             
                             return (
                               <div key={`${meso.id}-week-${weekIndex}`} className={`text-center border rounded-b ${intensityBg(intensity)}`}>
                                 <div className="text-xs p-1 font-medium">
                                   Week {globalWeek}
                                 </div>
                                 <div className="text-xs px-1 py-0.5 opacity-80 border-t">
                                   {intensity?.replace('-', ' ') || 'easy'}
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
                                  const parameters = getParametersForMethod(method);
                                  
                                  return (
                                    <div key={method} className="border rounded-lg bg-card shadow-sm">
                                      {/* Method name header */}
                                      <div className="grid gap-1 bg-muted/20" style={{ 
                                        gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)` 
                                      }}>
                                        <div className="sticky left-0 z-40 p-3 font-medium text-sm border-r bg-background rounded-tl shadow-md">
                                          <div className="line-clamp-3" title={method}>
                                            {method}
                                          </div>
                                        </div>
                                        {mesocycles.map((meso) => 
                                          Array.from({ length: meso.duration }, (_, weekIndex) => {
                                            const isAllocated = isMethodAllocatedToMesocycle(method, meso.id);
                                            return (
                                              <div 
                                                key={`${meso.id}-${weekIndex}`} 
                                                className={`h-16 border-l ${isAllocated ? 'bg-muted/10' : 'bg-gray-100/50 opacity-50'}`}
                                              />
                                            );
                                          })
                                        )}
                                      </div>
                                      
                                      {/* Parameter sub-rows */}
                                      {parameters.length > 0 && (
                                        <div className="divide-y">
                                          {parameters.map((param) => (
                                            <div key={param.name} className="grid gap-1 hover:bg-muted/5" style={{ 
                                              gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)` 
                                            }}>
                                              <div className="sticky left-0 z-40 p-2 text-xs text-muted-foreground bg-background border-r flex items-center shadow-md">
                                                <span className="ml-4 font-medium">{param.name.replace(/\[.*?\]/g, '').trim()}</span>
                                                {param.unit && <span className="ml-1 text-xs opacity-70">({param.unit})</span>}
                                              </div>
                                              {mesocycles.map((meso) =>
                                                Array.from({ length: meso.duration }, (_, weekIndex) => {
                                                  const isAllocated = isMethodAllocatedToMesocycle(method, meso.id);
                                                  const currentValue = getParameterValue(meso.id, weekIndex, method, param.name, parameterValues);
                                                  
                                                  return (
                                                    <div 
                                                      key={`${meso.id}-${weekIndex}-${param.name}`} 
                                                      className={`p-1 border-l ${!isAllocated ? 'bg-gray-100/50 opacity-50' : ''}`}
                                                    >
                                                      {param.type === 'select' ? (
                                                        <Select
                                                          value={isAllocated ? (currentValue?.toString() || '') : ''}
                                                          onValueChange={(value) => isAllocated && updateParameterValue(meso.id, weekIndex, method, param.name, value)}
                                                          disabled={!isAllocated}
                                                        >
                                                          <SelectTrigger className={`h-8 text-xs ${!isAllocated ? 'cursor-not-allowed' : ''}`}>
                                                            <SelectValue placeholder="" />
                                                          </SelectTrigger>
                                                          <SelectContent className="z-50">
                                                            {param.options?.map((option) => (
                                                              <SelectItem key={option} value={option} className="text-xs">
                                                                {option}
                                                              </SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      ) : (
                                                        <Input
                                                          type={param.type === 'number' ? 'number' : 'text'}
                                                          value={isAllocated ? (currentValue || '') : ''}
                                                          onChange={(e) => isAllocated && updateParameterValue(meso.id, weekIndex, method, param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                          className={`h-8 text-xs ${!isAllocated ? 'cursor-not-allowed' : ''}`}
                                                          placeholder=""
                                                          disabled={!isAllocated}
                                                        />
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
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
        </CardContent>
      </Card>
    );
  };

  const stepTitles = [
    "Mesocycle Setup",
    "Intensity Configuration", 
    "Sub-Goal Allocation",
    "Method Periodization"
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mesocycle Planning</h1>
          <Button variant="outline" size="sm">
            <Bot className="h-4 w-4 mr-2" />
            Ask AI for Help
          </Button>
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
          {currentStep === 3 && renderQualityAllocation()}
          {currentStep === 4 && renderMethodPeriodization()}
        </div>

        <NavigationButtons />
    </div>
  );
}