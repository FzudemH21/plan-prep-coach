import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Mesocycle, TrainingMethod, IntensityLevel } from "@/types/training";
import { Target, Calendar as CalendarIcon, Bot, GripVertical, CalendarDays } from "lucide-react";
import MesocycleCalendar from "@/components/mesocycle/MesocycleCalendar";

export default function MesocyclePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [trainingMethods, setTrainingMethods] = useState<TrainingMethod[]>([]);
  const [mesocycleLength, setMesocycleLength] = useState(4);
  const [uniformLength, setUniformLength] = useState(true);

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const intensityLevels: IntensityLevel[] = ["off", "deload", "easy", "easy-moderate", "moderate", "moderate-hard", "hard", "very-hard"];

  const getIntensityColor = (intensity: IntensityLevel) => {
    const colors = {
      "off": "bg-intensity-off text-intensity-foreground border-2",
      "deload": "bg-intensity-deload text-intensity-foreground",
      "easy": "bg-intensity-easy text-intensity-foreground", 
      "easy-moderate": "bg-intensity-easy-moderate text-intensity-foreground",
      "moderate": "bg-intensity-moderate text-intensity-foreground",
      "moderate-hard": "bg-intensity-moderate-hard text-intensity-foreground",
      "hard": "bg-intensity-hard text-intensity-foreground",
      "very-hard": "bg-intensity-very-hard text-intensity-foreground"
    };
    return colors[intensity] || "bg-muted text-muted-foreground";
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
      <CardContent className="space-y-6">
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
                const newMesocycles: Mesocycle[] = Array.from({ length: count }, (_, i) => ({
                  id: `meso-${i + 1}`,
                  name: `Mesocycle ${i + 1}`,
                  startDate: new Date(),
                  endDate: new Date(),
                  duration: mesocycleLength,
                  intensity: "moderate" as IntensityLevel,
                  trainingMethods: [],
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
                      <Input
                        value={meso.name}
                        onChange={(e) => {
                          const updated = [...mesocycles];
                          updated[index].name = e.target.value;
                          setMesocycles(updated);
                        }}
                        className="font-medium"
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar Visualization */}
            <MesocycleCalendar mesocycles={mesocycles} />
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

  const renderMethodAllocation = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <GripVertical className="h-5 w-5" />
          <span>Training Method Allocation</span>
        </CardTitle>
        <CardDescription>
          Drag and drop training methods to assign them to specific mesocycles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Available Training Methods</Label>
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50 min-h-32">
              {trainingMethods.map((method) => (
                <div
                  key={method.id}
                  className="p-3 bg-background border rounded cursor-move hover:bg-accent"
                  draggable
                >
                  <div className="font-medium text-sm">{method.name}</div>
                  <div className="text-xs text-muted-foreground">{method.quality}</div>
                </div>
              ))}
              {trainingMethods.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No training methods available. Complete the macrocycle planning first.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Mesocycles</Label>
            <div className="space-y-2">
              {mesocycles.map((meso) => (
                <div
                  key={meso.id}
                  className={`p-4 border rounded-lg min-h-20 ${getIntensityColor(meso.intensity)} ${
                    meso.intensity === "off" ? "text-black" : "text-white"
                  }`}
                >
                  <div className="font-medium text-sm mb-2">{meso.name}</div>
                  <div className="space-y-1">
                    {meso.trainingMethods.map((methodId) => {
                      const method = trainingMethods.find(m => m.id === methodId);
                      return method ? (
                        <Badge key={methodId} variant="secondary" className="text-xs">
                          {method.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
    "Intensity Assignment", 
    "Method Allocation",
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

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 1 && renderMesocycleSetup()}
        {currentStep === 2 && renderIntensitySetup()}
        {currentStep === 3 && renderMethodAllocation()}
        {currentStep === 4 && renderMethodPeriodization()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        
        <Button 
          onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
          disabled={currentStep === totalSteps}
        >
          {currentStep === totalSteps ? "Complete" : "Next"}
        </Button>
      </div>
    </div>
  );
}