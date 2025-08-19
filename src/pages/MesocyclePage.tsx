import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrainingMethod, IntensityLevel } from "@/types/training";
import { ExtendedMesocycle } from "@/features/planner/types";
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays, Info } from "lucide-react";
import MesocycleCalendar from "@/components/mesocycle/MesocycleCalendar";
import { format, addWeeks } from "date-fns";

export default function MesocyclePage() {
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

  const totalSteps = 3;

  // Navigation component for top and bottom
  const NavigationButtons = () => (
    <div className="flex justify-between items-center">
      <Button 
        onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
        disabled={currentStep <= 1}
        variant="outline"
      >
        Previous
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
      
      // Calculate plan dates
      const startDate = new Date();
      const endDate = addWeeks(startDate, weeks);
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
              <p className="text-sm font-medium">{macrocycleData.smartGoal?.specific || "Not specified"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Total Duration</Label>
              <p className="text-sm font-medium">{totalWeeks} weeks ({totalWeeks * 7} days)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
              <p className="text-sm font-medium">{format(planStartDate, 'MMM dd, yyyy')}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
              <p className="text-sm font-medium">{format(planEndDate, 'MMM dd, yyyy')}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm font-medium text-muted-foreground">Training Qualities</Label>
              <div className="flex flex-wrap gap-1">
                {macrocycleData.qualities?.map((quality: any, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {typeof quality === 'string' ? quality : quality.name || quality.id || 'Unknown Quality'}
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
          <span>Mesocycle Intensity</span>
        </CardTitle>
        <CardDescription>
          Set the training intensity for each mesocycle using the interactive chart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Intensity Levels</h4>
              <div className="space-y-2">
                {intensityLevels.map((level) => (
                  <div key={level} className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded ${getIntensityColor(level)}`}></div>
                    <span className="text-sm capitalize">{level.replace("-", " ")}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Mesocycle Intensity Assignment</h4>
              <div className="space-y-3">
                {mesocycles.map((meso, index) => (
                  <div key={meso.id} className="flex items-center space-x-4">
                    <div className={`w-6 h-6 rounded ${getIntensityColor(meso.intensity)}`}></div>
                    <span className="w-32 text-sm font-medium">{meso.name}</span>
                    <Select
                      value={meso.intensity}
                      onValueChange={(value: IntensityLevel) => {
                        const updated = [...mesocycles];
                        updated[index].intensity = value;
                        setMesocycles(updated);
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
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
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderQualityAllocation = () => {
    // Extract training qualities and sub-goals from macrocycle data
    const trainableQualities = macrocycleData?.qualities || [];
    const subGoals = macrocycleData?.subGoals || {};

    const handleDragStart = (e: React.DragEvent, quality: string) => {
      e.dataTransfer.setData('text/plain', quality);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, mesocycleId: string) => {
      e.preventDefault();
      const quality = e.dataTransfer.getData('text/plain');
      
      // Check if quality already exists in this mesocycle
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      const currentQualities = mesocycles[mesocycleIndex].trainingQualities || [];
      if (currentQualities.includes(quality)) return; // Prevent duplicates
      
      // Add quality to mesocycle
      const updated = [...mesocycles];
      updated[mesocycleIndex].trainingQualities = [...currentQualities, quality];
      setMesocycles(updated);
    };

    const removeQualityFromMesocycle = (mesocycleId: string, quality: string) => {
      const mesocycleIndex = mesocycles.findIndex(m => m.id === mesocycleId);
      if (mesocycleIndex === -1) return;
      
      const updated = [...mesocycles];
      updated[mesocycleIndex].trainingQualities = (updated[mesocycleIndex].trainingQualities || [])
        .filter(q => q !== quality);
      setMesocycles(updated);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GripVertical className="h-5 w-5" />
            <span>Training Quality Allocation</span>
          </CardTitle>
          <CardDescription>
            Drag and drop training qualities to assign them to specific mesocycles. Each quality can be used multiple times but only once per mesocycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Available Training Qualities</Label>
              <div className="space-y-2 p-4 border rounded-lg bg-muted/50 min-h-32">
                {trainableQualities.map((quality: any, index: number) => {
                  const qualityName = typeof quality === 'string' ? quality : quality.name || quality.id || 'Unknown Quality';
                  const relatedSubGoals = Array.isArray(subGoals[qualityName]) ? subGoals[qualityName] : [];
                  
                  return (
                    <div
                      key={index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, qualityName)}
                      className="p-3 bg-background border rounded-lg cursor-grab hover:shadow-md transition-shadow"
                    >
                      <div className="font-medium text-sm">{qualityName}</div>
                      {relatedSubGoals.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Related sub-goals: {relatedSubGoals.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Mesocycle Assignments</Label>
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
                    <div className="space-y-1">
                      {(meso.trainingQualities || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Drop training qualities here</p>
                      ) : (
                        meso.trainingQualities?.map((quality, index) => (
                          <div key={index} className="flex items-center justify-between bg-primary/10 rounded px-2 py-1">
                            <span className="text-xs font-medium">{quality}</span>
                            <button
                              onClick={() => removeQualityFromMesocycle(meso.id, quality)}
                              className="text-destructive hover:text-destructive/80 text-xs ml-2"
                            >
                              ×
                            </button>
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

  const renderMethodPeriodization = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Training Method Periodization</span>
        </CardTitle>
        <CardDescription>
          Configure loading parameters for each training method across mesocycles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-8">
          Method periodization matrix coming next...
        </p>
      </CardContent>
    </Card>
  );

  const stepTitles = [
    "Mesocycle Setup",
    "Intensity Configuration", 
    "Training Quality Allocation"
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
        </div>

        <NavigationButtons />
    </div>
  );
}