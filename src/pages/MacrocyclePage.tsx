import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { AthleteInfo, SmartGoal, SubGoal, TrainableQuality } from "@/types/training";
import { User, Target, Calendar as CalendarIcon, Plus, Bot } from "lucide-react";
import { 
  getUniqueSubGoals, 
  getUniqueQualities, 
  getUniqueTrainingMethods 
} from "@/data/trainingData";

export default function MacrocyclePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [athleteInfo, setAthleteInfo] = useState<Partial<AthleteInfo>>({});
  const [smartGoal, setSmartGoal] = useState<Partial<SmartGoal>>({});
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [qualities, setQualities] = useState<TrainableQuality[]>([]);

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const renderAthleteInfoForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Athlete Information</span>
        </CardTitle>
        <CardDescription>
          Basic information about the athlete. This will be saved to the client database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={athleteInfo.name || ""}
              onChange={(e) => setAthleteInfo({...athleteInfo, name: e.target.value})}
              placeholder="Enter athlete's full name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              value={athleteInfo.age || ""}
              onChange={(e) => setAthleteInfo({...athleteInfo, age: parseInt(e.target.value)})}
              placeholder="Age in years"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex</Label>
            <Select value={athleteInfo.sex} onValueChange={(value) => setAthleteInfo({...athleteInfo, sex: value as any})}>
              <SelectTrigger>
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sport">Sport</Label>
            <Input
              id="sport"
              value={athleteInfo.sport || ""}
              onChange={(e) => setAthleteInfo({...athleteInfo, sport: e.target.value})}
              placeholder="Primary sport or activity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={athleteInfo.occupation || ""}
              onChange={(e) => setAthleteInfo({...athleteInfo, occupation: e.target.value})}
              placeholder="Current occupation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dailyActivity">Daily Activity Level</Label>
            <Select value={athleteInfo.dailyActivity} onValueChange={(value) => setAthleteInfo({...athleteInfo, dailyActivity: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select activity level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Light Activity</SelectItem>
                <SelectItem value="moderate">Moderate Activity</SelectItem>
                <SelectItem value="high">High Activity</SelectItem>
                <SelectItem value="very-high">Very High Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sleep">Sleep Habits</Label>
          <Input
            id="sleep"
            value={athleteInfo.sleep || ""}
            onChange={(e) => setAthleteInfo({...athleteInfo, sleep: e.target.value})}
            placeholder="e.g., 7-8 hours nightly, sleep quality issues, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="trainingHistory">Training History</Label>
          <Textarea
            id="trainingHistory"
            value={athleteInfo.trainingHistory || ""}
            onChange={(e) => setAthleteInfo({...athleteInfo, trainingHistory: e.target.value})}
            placeholder="Previous training experience, years of training, specializations..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="movementAnalysis">Movement Analysis Results</Label>
          <Textarea
            id="movementAnalysis"
            value={athleteInfo.movementAnalysisResults || ""}
            onChange={(e) => setAthleteInfo({...athleteInfo, movementAnalysisResults: e.target.value})}
            placeholder="FMS scores, movement screen results, injury history..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="freeText">Additional Information</Label>
          <Textarea
            id="freeText"
            value={athleteInfo.freeTextInfo || ""}
            onChange={(e) => setAthleteInfo({...athleteInfo, freeTextInfo: e.target.value})}
            placeholder="Any other relevant information about the athlete..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderGoalSettingForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>S.M.A.R.T. Goal Setting</span>
        </CardTitle>
        <CardDescription>
          Define a specific, measurable, achievable, relevant, and time-bound training goal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="goalDescription">Goal Description</Label>
          <Input
            id="goalDescription"
            value={smartGoal.description || ""}
            onChange={(e) => setSmartGoal({...smartGoal, description: e.target.value})}
            placeholder="e.g., Improve 100m sprint time from 10.9s to 10.8s in 12 weeks"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="baselineValue">Baseline Value</Label>
            <div className="flex space-x-2">
              <Input
                id="baselineValue"
                type="number"
                step="0.01"
                value={smartGoal.baselineValue || ""}
                onChange={(e) => setSmartGoal({...smartGoal, baselineValue: parseFloat(e.target.value)})}
                placeholder="10.9"
              />
              <Input
                value={smartGoal.unit || ""}
                onChange={(e) => setSmartGoal({...smartGoal, unit: e.target.value})}
                placeholder="seconds"
                className="w-24"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desiredValue">Target Value</Label>
            <div className="flex space-x-2">
              <Input
                id="desiredValue"
                type="number"
                step="0.01"
                value={smartGoal.desiredValue || ""}
                onChange={(e) => {
                  const desired = parseFloat(e.target.value);
                  const baseline = smartGoal.baselineValue || 0;
                  const percentChange = baseline > 0 ? ((desired - baseline) / baseline) * 100 : 0;
                  setSmartGoal({...smartGoal, desiredValue: desired, percentChange});
                }}
                placeholder="10.8"
              />
              <div className="w-24 flex items-center">
                <Badge variant={smartGoal.percentChange && smartGoal.percentChange < 0 ? "destructive" : "default"}>
                  {smartGoal.percentChange ? `${smartGoal.percentChange.toFixed(1)}%` : "0%"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Training Plan Duration</Label>
          <div className="border rounded-md p-3">
            <Calendar
              mode="range"
              selected={{
                from: smartGoal.startDate,
                to: smartGoal.endDate
              }}
              onSelect={(range) => {
                if (!range) return;
                
                const start = range.from || new Date();
                const end = range.to || range.from || new Date();
                const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                const totalWeeks = Math.ceil(totalDays / 7);
                
                setSmartGoal({
                  ...smartGoal, 
                  startDate: start, 
                  endDate: end,
                  totalDays: totalDays > 0 ? totalDays : 1,
                  totalWeeks: totalWeeks > 0 ? totalWeeks : 1
                });
              }}
              className="rounded-md"
            />
          </div>
        </div>

        {smartGoal.totalDays && smartGoal.totalWeeks && (
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Training Plan Duration</h4>
            <div className="flex space-x-6 text-sm">
              <div>
                <span className="text-muted-foreground">Total Days: </span>
                <span className="font-medium">{smartGoal.totalDays}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Weeks: </span>
                <span className="font-medium">{smartGoal.totalWeeks}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSubGoalsForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Sub-Goals & Testing Methods</span>
        </CardTitle>
        <CardDescription>
          Break down your main goal into measurable sub-goals and define testing methods.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {subGoals.map((subGoal, index) => (
            <div key={subGoal.id} className="p-4 border rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sub-Goal Description</Label>
                  <SearchableDropdown
                    value={subGoal.description}
                    onChange={(value) => {
                      const updated = [...subGoals];
                      updated[index].description = value;
                      setSubGoals(updated);
                    }}
                    options={getUniqueSubGoals()}
                    placeholder="Select or type sub-goal..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Test Method</Label>
                  <SearchableDropdown
                    value={subGoal.testMethod}
                    onChange={(value) => {
                      const updated = [...subGoals];
                      updated[index].testMethod = value;
                      setSubGoals(updated);
                    }}
                    options={["1RM Back Squat", "1RM Front Squat", "1RM Deadlift", "CMJ Height", "CMJ RSI", "Drop Jump RSI", "10m Sprint", "20m Sprint", "40m Sprint", "505 COD Test", "T-Test", "Yo-Yo IR1"]}
                    placeholder="Select or type test method..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Pre-Test Value</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={subGoal.preTestValue || ""}
                      onChange={(e) => {
                        const updated = [...subGoals];
                        updated[index].preTestValue = parseFloat(e.target.value);
                        const percentChange = updated[index].preTestValue > 0 ? 
                          ((updated[index].goalValue - updated[index].preTestValue) / updated[index].preTestValue) * 100 : 0;
                        updated[index].percentChange = percentChange;
                        setSubGoals(updated);
                      }}
                      placeholder="150"
                    />
                    <Input
                      value={subGoal.unit}
                      onChange={(e) => {
                        const updated = [...subGoals];
                        updated[index].unit = e.target.value;
                        setSubGoals(updated);
                      }}
                      placeholder="kg"
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Goal Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={subGoal.goalValue || ""}
                    onChange={(e) => {
                      const updated = [...subGoals];
                      updated[index].goalValue = parseFloat(e.target.value);
                      const percentChange = updated[index].preTestValue > 0 ? 
                        ((updated[index].goalValue - updated[index].preTestValue) / updated[index].preTestValue) * 100 : 0;
                      updated[index].percentChange = percentChange;
                      setSubGoals(updated);
                    }}
                    placeholder="180"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Change</Label>
                  <div className="flex items-center h-10">
                    <Badge variant={subGoal.percentChange && subGoal.percentChange > 0 ? "default" : "destructive"}>
                      {subGoal.percentChange ? `${subGoal.percentChange.toFixed(1)}%` : "0%"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSubGoals(subGoals.filter((_, i) => i !== index));
                }}
              >
                Remove Sub-Goal
              </Button>
            </div>
          ))}
        </div>

        <Button
          onClick={() => {
            const newSubGoal: SubGoal = {
              id: `subgoal-${Date.now()}`,
              description: "",
              testMethod: "",
              preTestValue: 0,
              goalValue: 0,
              unit: "",
              percentChange: 0,
              testDates: []
            };
            setSubGoals([...subGoals, newSubGoal]);
          }}
          variant="outline"
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Sub-Goal
        </Button>

        {subGoals.length > 0 && smartGoal.startDate && smartGoal.endDate && (
          <div className="space-y-4">
            <h4 className="font-semibold">Test Scheduling</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium mb-2 block">Available Tests</Label>
                <div className="space-y-2 p-4 border rounded-lg bg-muted/50 min-h-32">
                  {subGoals.map((subGoal) => (
                    <div
                      key={subGoal.id}
                      className="p-2 bg-background border rounded cursor-move hover:bg-accent"
                      draggable
                    >
                      <div className="font-medium text-sm">{subGoal.testMethod || "Unnamed Test"}</div>
                      <div className="text-xs text-muted-foreground">{subGoal.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Training Calendar</Label>
                <div className="border rounded-lg p-3">
                  <Calendar
                    mode="single"
                    selected={undefined}
                    className="rounded-md"
                    disabled={(date) => {
                      if (!smartGoal.startDate || !smartGoal.endDate) return true;
                      return date < smartGoal.startDate || date > smartGoal.endDate;
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTrainableQualitiesForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Trainable Qualities</span>
        </CardTitle>
        <CardDescription>
          Identify the qualities that need to be developed to achieve your sub-goals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {subGoals.map((subGoal, index) => {
            const quality = qualities.find(q => q.id === subGoal.id) || { id: subGoal.id, name: "", description: "", methods: [] };
            
            return (
              <div key={subGoal.id} className="p-4 border rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label className="font-medium">{subGoal.description || "Sub-Goal"}</Label>
                <SearchableDropdown
                  value={quality.name}
                  onChange={(value) => {
                    const updated = [...qualities];
                    const existingIndex = updated.findIndex(q => q.id === subGoal.id);
                    
                    if (existingIndex >= 0) {
                      updated[existingIndex].name = value;
                    } else {
                      updated.push({
                        id: subGoal.id,
                        name: value,
                        description: "",
                        methods: []
                      });
                    }
                    setQualities(updated);
                  }}
                  options={getUniqueQualities()}
                  placeholder="Select or type trainable quality..."
                />
                  <p className="text-xs text-muted-foreground">
                    Enter trainable qualities separated by commas
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderTrainingMethodsForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Training Methods</span>
        </CardTitle>
        <CardDescription>
          Select and configure training methods to develop the identified qualities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {qualities.map((quality, index) => (
            <div key={quality.id} className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label className="font-medium">
                  {quality.name || "Quality"} - Training Methods
                </Label>
                <SearchableDropdown
                  value={quality.methods.join(", ")}
                  onChange={(value) => {
                    const updated = [...qualities];
                    updated[index].methods = value.split(",").map(m => m.trim()).filter(m => m);
                    setQualities(updated);
                  }}
                  options={getUniqueTrainingMethods()}
                  placeholder="Select or type training methods..."
                />
                <p className="text-xs text-muted-foreground">
                  Enter training methods separated by commas
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const stepTitles = [
    "Athlete Information",
    "Goal Setting", 
    "Sub-Goals & Testing",
    "Trainable Qualities",
    "Training Methods"
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Macrocycle Planning</h1>
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
        {currentStep === 1 && renderAthleteInfoForm()}
        {currentStep === 2 && renderGoalSettingForm()}
        {currentStep === 3 && renderSubGoalsForm()}
        {currentStep === 4 && renderTrainableQualitiesForm()}
        {currentStep === 5 && renderTrainingMethodsForm()}
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