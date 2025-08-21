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
import { TrainingMethod, IntensityLevel } from "@/types/training";
import { ExtendedMesocycle } from "@/features/planner/types";
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays, Info, ChevronDown, Settings } from "lucide-react";
import MesocycleCalendar from "@/components/mesocycle/MesocycleCalendar";
import { MicrocycleIntensityChart } from "@/components/mesocycle/MicrocycleIntensityChart";
import { format, addWeeks } from "date-fns";
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
      
      // Extract total weeks from SMART goal
      const weeks = data.smartGoal?.timeframe || 12;
      setTotalWeeks(weeks);
      
      // Calculate plan dates from macrocycle SMART goal
      const startDate = data.smartGoal?.startDate ? new Date(data.smartGoal.startDate) : new Date();
      const endDate = data.smartGoal?.endDate ? new Date(data.smartGoal.endDate) : addWeeks(startDate, weeks);
      setPlanStartDate(startDate);
      setPlanEndDate(endDate);
      
      // Auto-calculate mesocycles based on total duration
      const suggestedMesocycleCount = Math.max(2, Math.min(6, Math.round(weeks / 4)));
      const suggestedLength = Math.round(weeks / suggestedMesocycleCount);
      
      setMesocycleLength(suggestedLength);
      
      // Create default mesocycles
      const defaultMesocycles: ExtendedMesocycle[] = Array.from({ length: suggestedMesocycleCount }, (_, i) => {
        let currentStartDate = addWeeks(startDate, i * suggestedLength);
        let currentEndDate = addWeeks(currentStartDate, suggestedLength);
        
        return {
          id: `meso-${i + 1}`,
          name: `Mesocycle ${i + 1}`,
          weeks: suggestedLength,
          sessionsPerWeek: 3,
          sessionLength: 60,
          startDate: currentStartDate,
          endDate: currentEndDate,
          duration: suggestedLength,
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
                  `${totalWeeks} weeks (${totalWeeks * 7} days)` : 
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
              <p className="text-sm text-muted-foreground">{trainingMethods.length} training methods available</p>
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

  // Group qualities by sub-goal using the training data - moved to component level
  const qualitiesBySubGoal = React.useMemo(() => {
    const trainableQualities = macrocycleData?.qualities || [];
    const result: Record<string, Array<{ quality: string; methods: string[] }>> = {};
    
    trainableQualities.forEach((quality: any) => {
      const qualityName = typeof quality === 'string' ? quality : quality.name || quality.id || 'Unknown Quality';
      
      // Find all data entries for this quality to get its sub-goal(s) and methods
      const qualityEntries = trainingData.filter(item => item.quality === qualityName);
      
      qualityEntries.forEach(entry => {
        const subGoal = entry.subGoal;
        if (!result[subGoal]) {
          result[subGoal] = [];
        }
        
        // Check if quality already exists in this sub-goal
        const existingQuality = result[subGoal].find(q => q.quality === qualityName);
        const methods = getMethodsForQuality(qualityName);
        
        if (!existingQuality) {
          result[subGoal].push({ quality: qualityName, methods });
        }
      });
    });
    
    return result;
  }, [macrocycleData?.qualities]);

  const renderQualityAllocation = () => {
    // Extract training qualities and sub-goals from macrocycle data
    const trainableQualities = macrocycleData?.qualities || [];
    const subGoals = macrocycleData?.subGoals || {};

    const handleMethodDragStart = (e: React.DragEvent, method: string, quality: string, subGoal: string) => {
      const dragData = JSON.stringify({ method, quality, subGoal });
      e.dataTransfer.setData('text/plain', dragData);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, mesocycleId: string) => {
      e.preventDefault();
      const dragDataString = e.dataTransfer.getData('text/plain');
      
      try {
        const dragData = JSON.parse(dragDataString);
        const { method, quality, subGoal } = dragData;
        
        // Check if method already exists in this mesocycle
        const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
        if (mesocycleIndex === -1) return;
        
        const currentMethods = mesocycles[mesocycleIndex].trainingMethods || [];
        const methodExists = currentMethods.some((m: any) => 
          (typeof m === 'string' ? m : m.method) === method
        );
        
        if (methodExists) return; // Prevent duplicates
        
        // Add method with metadata to mesocycle
        const updated = [...mesocycles];
        const newMethod = { method, quality, subGoal };
        updated[mesocycleIndex].trainingMethods = [...currentMethods, newMethod];
        setMesocycles(updated);
      } catch (error) {
        console.error('Failed to parse drag data:', error);
      }
    };

    const removeMethodFromMesocycle = (mesocycleId: string, method: string) => {
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      const updated = [...mesocycles];
      updated[mesocycleIndex].trainingMethods = (updated[mesocycleIndex].trainingMethods || [])
        .filter((m: any) => (typeof m === 'string' ? m : m.method) !== method);
      setMesocycles(updated);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GripVertical className="h-5 w-5" />
            <span>Training Method Allocation</span>
          </CardTitle>
          <CardDescription>
            Expand training qualities to view methods, then drag and drop training methods to assign them to specific mesocycles. Each method can only be used once per mesocycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Available Training Methods by Sub-Goal</Label>
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50 max-h-96 overflow-y-auto">
                {Object.entries(qualitiesBySubGoal).map(([subGoal, qualities]) => (
                  <Collapsible key={subGoal} className="space-y-2">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-background border rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="font-medium text-sm text-left">{subGoal}</span>
                      <ChevronDown className="h-4 w-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pl-4">
                      {qualities.map(({ quality, methods }) => (
                        <Collapsible key={quality} className="space-y-1">
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted border rounded text-left hover:bg-muted/80 transition-colors">
                            <span className="text-sm font-medium">{quality}</span>
                            <ChevronDown className="h-3 w-3" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1 pl-4">
                            {methods.map((method, index) => (
                              <div
                                key={index}
                                draggable
                                onDragStart={(e) => handleMethodDragStart(e, method, quality, subGoal)}
                                className="p-2 bg-background border rounded cursor-grab hover:shadow-md transition-shadow text-xs"
                                title={method}
                              >
                                <div className="line-clamp-2">
                                  {method.length > 80 ? `${method.substring(0, 80)}...` : method}
                                </div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Mesocycle Method Assignments</Label>
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
                      {(!meso.trainingMethods || meso.trainingMethods.length === 0) ? (
                        <p className="text-xs text-muted-foreground">Drop training methods here</p>
                      ) : (
                        meso.trainingMethods?.map((methodData: any, index: number) => {
                          const method = typeof methodData === 'string' ? methodData : methodData.method;
                          const quality = typeof methodData === 'string' ? '' : methodData.quality;
                          const subGoal = typeof methodData === 'string' ? '' : methodData.subGoal;
                          
                          return (
                            <div key={index} className="bg-primary/10 rounded p-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  {subGoal && (
                                    <div className="text-xs font-medium text-muted-foreground">{subGoal}</div>
                                  )}
                                  {quality && (
                                    <div className="text-xs font-medium text-primary">{quality}</div>
                                  )}
                                  <div className="text-xs mt-1 line-clamp-2">
                                    {method.length > 100 ? `${method.substring(0, 100)}...` : method}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeMethodFromMesocycle(meso.id, method)}
                                  className="text-destructive hover:text-destructive/80 text-sm ml-2 shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })
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
    // Get only allocated methods from mesocycles
    const getAllocatedMethods = () => {
      const allocatedMethods = new Set<string>();
      
      mesocycles.forEach(meso => {
        meso.trainingMethods?.forEach((methodData: any) => {
          const method = typeof methodData === 'string' ? methodData : methodData.method;
          if (method && methodParameters[method]) {
            allocatedMethods.add(method);
          }
        });
      });
      
      return Array.from(allocatedMethods);
    };

    const allMethods = getAllocatedMethods();
    
    // Helper function to check if a method is allocated to a specific mesocycle
    const isMethodAllocatedToMesocycle = (methodName: string, mesocycleId: string) => {
      const mesocycle = mesocycles.find(m => m.id === mesocycleId);
      if (!mesocycle || !mesocycle.trainingMethods) return false;
      
      return mesocycle.trainingMethods.some((methodData: any) => {
        const method = typeof methodData === 'string' ? methodData : methodData.method;
        return method === methodName;
      });
    };

    // Helper function to get mesocycle overview data
    const getMesocycleOverview = (mesocycle: ExtendedMesocycle) => {
      const subGoals = new Set<string>();
      const qualities = new Set<string>();
      
      mesocycle.trainingMethods?.forEach((methodData: any) => {
        if (typeof methodData === 'object') {
          if (methodData.subGoal) subGoals.add(methodData.subGoal);
          if (methodData.quality) qualities.add(methodData.quality);
        }
      });
      
      return {
        subGoals: Array.from(subGoals),
        qualities: Array.from(qualities)
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
              <p className="text-sm text-muted-foreground">Please allocate training methods to mesocycles in step 3 first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Method Periodization</h3>
              <ScrollArea className="h-[32rem] w-full border rounded-lg">
                <div className="min-w-max p-4">
                  {/* Multi-Level Headers */}
                  <div className="mb-4 space-y-1">
                    {/* Level 1: Mesocycle Group Headers */}
                    <div className="grid gap-1" style={{
                      gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)`
                    }}>
                      <div className="p-2 bg-muted font-medium text-sm border rounded-t-lg">
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
                      <div className="p-2 bg-muted/50 border-l border-r text-xs">
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
                            {overview.subGoals.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="font-medium text-muted-foreground">Goals:</span>
                                <span className="text-foreground">{overview.subGoals.join(', ')}</span>
                              </div>
                            )}
                            {overview.qualities.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="font-medium text-muted-foreground">Qualities:</span>
                                <span className="text-foreground">{overview.qualities.join(', ')}</span>
                              </div>
                            )}
                            {overview.subGoals.length === 0 && overview.qualities.length === 0 && (
                              <span className="text-muted-foreground italic">No methods allocated</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Level 3: Week Headers with Intensity Colors */}
                    <div className="grid gap-1" style={{
                      gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)`
                    }}>
                      <div className="p-2 bg-muted/80 font-medium text-xs border rounded-b-lg">
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

                  {/* Method Rows */}
                  <div className="space-y-4">
                    {allMethods.map((method: string) => {
                      const parameters = getParametersForMethod(method);
                      if (parameters.length === 0) return null;

                      return (
                        <div key={method} className="border rounded-lg bg-card shadow-sm">
                          {/* Method name header */}
                          <div className="grid gap-1 bg-muted/20" style={{ 
                            gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)` 
                          }}>
                            <div className="p-3 font-medium text-sm border-r bg-muted/40 rounded-tl">
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
                          
                          {/* Parameter rows */}
                          <div className="divide-y">
                            {parameters.map((param) => (
                              <div key={param.name} className="grid gap-1 hover:bg-muted/5" style={{ 
                                gridTemplateColumns: `300px repeat(${mesocycles.reduce((sum, meso) => sum + meso.duration, 0)}, 100px)` 
                              }}>
                                <div className="p-2 text-xs text-muted-foreground bg-muted/5 border-r flex items-center">
                                  <span className="font-medium">{param.name.replace(/_/g, ' ')}</span>
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
                                            value={currentValue?.toString() || param.defaultValue?.toString() || ''}
                                            onValueChange={(value) => isAllocated && updateParameterValue(meso.id, weekIndex, method, param.name, value)}
                                            disabled={!isAllocated}
                                          >
                                            <SelectTrigger className={`h-8 text-xs ${!isAllocated ? 'cursor-not-allowed' : ''}`}>
                                              <SelectValue placeholder={!isAllocated ? "Not allocated" : ""} />
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
                                            value={currentValue || param.defaultValue || ''}
                                            onChange={(e) => isAllocated && updateParameterValue(meso.id, weekIndex, method, param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                                            className={`h-8 text-xs ${!isAllocated ? 'cursor-not-allowed' : ''}`}
                                            min={param.min}
                                            max={param.max}
                                            placeholder={!isAllocated ? "Not allocated" : param.defaultValue?.toString() || ''}
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
                        </div>
                      );
                    })}
                   </div>
                  </div>
                </ScrollArea>
              </div>
            )}
        </CardContent>
      </Card>
    );
  };

  const stepTitles = [
    "Mesocycle Setup",
    "Intensity Configuration", 
    "Training Quality Allocation",
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