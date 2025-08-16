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
import { AthleteInfo, SmartGoal, SubGoal, TrainableQuality } from "@/types/training";
import { User, Target, Calendar as CalendarIcon, Plus, Bot } from "lucide-react";

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <div className="border rounded-md p-3">
              <Calendar
                mode="single"
                selected={smartGoal.startDate}
                onSelect={(date) => {
                  const start = date || new Date();
                  const end = smartGoal.endDate || new Date();
                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const totalWeeks = Math.ceil(totalDays / 7);
                  setSmartGoal({...smartGoal, startDate: start, totalDays, totalWeeks});
                }}
                className="rounded-md"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>End Date</Label>
            <div className="border rounded-md p-3">
              <Calendar
                mode="single"
                selected={smartGoal.endDate}
                onSelect={(date) => {
                  const end = date || new Date();
                  const start = smartGoal.startDate || new Date();
                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const totalWeeks = Math.ceil(totalDays / 7);
                  setSmartGoal({...smartGoal, endDate: end, totalDays, totalWeeks});
                }}
                className="rounded-md"
              />
            </div>
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
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Sub-Goals & Testing Methods</CardTitle>
              <CardDescription>
                Break down your main goal into measurable sub-goals and define testing methods.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Sub-goals form coming next...
              </p>
            </CardContent>
          </Card>
        )}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Trainable Qualities</CardTitle>
              <CardDescription>
                Identify the qualities that need to be developed to achieve your sub-goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Trainable qualities selection coming next...
              </p>
            </CardContent>
          </Card>
        )}
        {currentStep === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Training Methods</CardTitle>
              <CardDescription>
                Select and configure training methods to develop the identified qualities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Training methods configuration coming next...
              </p>
            </CardContent>
          </Card>
        )}
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