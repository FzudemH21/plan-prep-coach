import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AthleteInfo, SmartGoal, SubGoal, TrainableQuality } from "@/types/training";
import { User, Target, Calendar as CalendarIcon, Plus, Bot, X } from "lucide-react";
import { 
  getUniqueSubGoals, 
  getUniqueQualities, 
  getUniqueTrainingMethods,
  trainingData
} from "@/data/trainingData";
import { useDisplayMode } from "@/contexts/DisplayModeContext";

export default function MacrocyclePage() {
  const { displayMode } = useDisplayMode();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [athleteInfo, setAthleteInfo] = useState<Partial<AthleteInfo>>({});
  const [smartGoal, setSmartGoal] = useState<Partial<SmartGoal>>({});
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [qualities, setQualities] = useState<TrainableQuality[]>([]);
  const [qualitiesBySubGoal, setQualitiesBySubGoal] = useState<Record<string, { label: string; list: string[] }>>({});
  const [methodsByQuality, setMethodsByQuality] = useState<Record<string, { subGoalLabel: string; qualityName: string; list: string[] }>>({});
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectionPhase, setSelectionPhase] = useState<'start' | 'end'>('start');

  // Load saved data and step on mount
  useEffect(() => {
    const savedData = localStorage.getItem('macrocycleData');
    const savedStep = localStorage.getItem('macrocycleStep');
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setAthleteInfo(data.athleteInfo || {});
        // Convert string dates to Date objects when loading from localStorage
        const parsedSmartGoal = data.smartGoal || {};
        if (parsedSmartGoal.startDate) {
          parsedSmartGoal.startDate = new Date(parsedSmartGoal.startDate);
        }
        if (parsedSmartGoal.endDate) {
          parsedSmartGoal.endDate = new Date(parsedSmartGoal.endDate);
        }
        setSmartGoal(parsedSmartGoal);
        setSubGoals(data.subGoals || []);
        setQualities(data.qualities || []);
        setQualitiesBySubGoal(data.qualitiesBySubGoal || {});
        setMethodsByQuality(data.methodsByQuality || {});
        setSelectedTest(data.selectedTest || null);
      } catch (error) {
        console.error('Error loading saved macrocycle data:', error);
      }
    }
    
    if (savedStep) {
      try {
        setCurrentStep(parseInt(savedStep));
      } catch (error) {
        console.error('Error loading saved step:', error);
      }
    }
  }, []);

  // Save data whenever form data changes (continuous saving)
  useEffect(() => {
    const macrocycleData = {
      athleteInfo,
      smartGoal,
      subGoals,
      qualities,
      qualitiesBySubGoal,
      methodsByQuality,
      selectedTest,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
  }, [athleteInfo, smartGoal, subGoals, qualities, qualitiesBySubGoal, methodsByQuality, selectedTest]);

  // Save step whenever it changes (step persistence)
  useEffect(() => {
    localStorage.setItem('macrocycleStep', currentStep.toString());
  }, [currentStep]);

  // Helper function to normalize strings for comparison
  const normalizeForComparison = (str: string): string => {
    return str.toLowerCase()
      .replace(/–/g, '-')  // Replace em dash with regular dash
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };

  // Helper function to get qualities for a sub-goal label
  const getQualitiesForSubGoalLabel = (subGoalLabel: string): string[] => {
    const parts = subGoalLabel.split(' - ');
    if (parts.length < 2) return [];
    
    const overarchingGoal = parts[0].trim();
    const subGoal = parts[1].trim();
    
    // Normalize for comparison
    const normalizedOverarching = normalizeForComparison(overarchingGoal);
    const normalizedSubGoal = normalizeForComparison(subGoal);
    
    return Array.from(new Set(
      trainingData
        .filter(item => 
          normalizeForComparison(item.overarchingGoal) === normalizedOverarching && 
          normalizeForComparison(item.subGoal) === normalizedSubGoal
        )
        .map(item => item.quality)
    ));
  };

  // Helper function to get training methods for a specific quality
  const getTrainingMethodsForQuality = (overarchingGoal: string, subGoal: string, qualityName: string): string[] => {
    // Normalize for comparison
    const normalizedOverarching = normalizeForComparison(overarchingGoal);
    const normalizedSubGoal = normalizeForComparison(subGoal);
    const normalizedQuality = normalizeForComparison(qualityName);
    
    return Array.from(new Set(
      trainingData
        .filter(item => 
          normalizeForComparison(item.overarchingGoal) === normalizedOverarching && 
          normalizeForComparison(item.subGoal) === normalizedSubGoal &&
          normalizeForComparison(item.quality) === normalizedQuality
        )
        .map(item => item.trainingMethod)
    ));
  };

  // Auto-populate qualities when sub-goals change
  useEffect(() => {
    const newQualitiesBySubGoal: Record<string, { label: string; list: string[] }> = {};
    
    subGoals.forEach(subGoal => {
      const existing = qualitiesBySubGoal[subGoal.id];
      const recommendedQualities = getQualitiesForSubGoalLabel(subGoal.description);
      
      // If the sub-goal description has changed, reset to recommended qualities
      const hasDescriptionChanged = existing && existing.label !== subGoal.description;
      
      newQualitiesBySubGoal[subGoal.id] = {
        label: subGoal.description,
        list: hasDescriptionChanged ? recommendedQualities : (existing?.list?.length ? existing.list : recommendedQualities)
      };
    });
    
    // Remove qualities for sub-goals that no longer exist
    const existingSubGoalIds = new Set(subGoals.map(sg => sg.id));
    Object.keys(qualitiesBySubGoal).forEach(subGoalId => {
      if (!existingSubGoalIds.has(subGoalId)) {
        delete qualitiesBySubGoal[subGoalId];
      }
    });
    
    // Only update if there are actual changes
    const hasChanges = Object.keys(newQualitiesBySubGoal).some(subGoalId => {
      const oldList = qualitiesBySubGoal[subGoalId]?.list || [];
      const newList = newQualitiesBySubGoal[subGoalId]?.list || [];
      const oldLabel = qualitiesBySubGoal[subGoalId]?.label || '';
      const newLabel = newQualitiesBySubGoal[subGoalId]?.label || '';
      return JSON.stringify(oldList) !== JSON.stringify(newList) || oldLabel !== newLabel;
    });

    if (hasChanges || Object.keys(qualitiesBySubGoal).length !== Object.keys(newQualitiesBySubGoal).length) {
      setQualitiesBySubGoal(newQualitiesBySubGoal);
    }
  }, [subGoals, subGoals.map(sg => sg.description).join('|')]);

  // Sync qualities array from qualitiesBySubGoal changes
  useEffect(() => {
    const allQualities: TrainableQuality[] = Object.entries(qualitiesBySubGoal)
      .flatMap(([subGoalId, { list }]) =>
        list.map(qualityName => ({
          id: `${subGoalId}::${qualityName}`,
          name: qualityName,
          description: "",
          methods: qualities.find(q => q.id === `${subGoalId}::${qualityName}`)?.methods || []
        }))
      );
    
    // Only update if there are actual changes
    const hasChanges = JSON.stringify(qualities.map(q => ({ id: q.id, name: q.name }))) !== 
                      JSON.stringify(allQualities.map(q => ({ id: q.id, name: q.name })));
    
    if (hasChanges) {
      setQualities(allQualities);
    }
  }, [JSON.stringify(qualitiesBySubGoal)]);

  // Auto-populate training methods when qualities change
  useEffect(() => {
    setMethodsByQuality(prevMethods => {
      const nextMethods: Record<string, { subGoalLabel: string; qualityName: string; list: string[] }> = {};
      
      qualities.forEach(quality => {
        const [subGoalId, qualityName] = quality.id.split('::');
        const subGoal = subGoals.find(sg => sg.id === subGoalId);
        
        if (subGoal && qualityName) {
          const existing = prevMethods[quality.id];
          const parts = subGoal.description.split(' - ');
          
          if (parts.length >= 2) {
            const overarchingGoal = parts[0].trim();
            const subGoalName = parts[1].trim();
            const recommendedMethods = getTrainingMethodsForQuality(overarchingGoal, subGoalName, qualityName);
            
            // If the sub-goal description has changed, reset to recommended methods
            const hasSubGoalChanged = existing && existing.subGoalLabel !== subGoal.description;
            
            nextMethods[quality.id] = {
              subGoalLabel: subGoal.description,
              qualityName: qualityName,
              list: hasSubGoalChanged ? recommendedMethods : (existing?.list?.length ? existing.list : recommendedMethods)
            };
          }
        }
      });
      
      // Remove methods for qualities that no longer exist
      Object.keys(prevMethods).forEach(qualityId => {
        if (!qualities.find(q => q.id === qualityId)) {
          delete prevMethods[qualityId];
        }
      });
      
      // Check if there are actual changes
      const hasChanges = JSON.stringify(prevMethods) !== JSON.stringify(nextMethods);
      
      if (hasChanges) {
        // Sync back to qualities array
        setQualities(prevQualities => 
          prevQualities.map(quality => ({
            ...quality,
            methods: nextMethods[quality.id]?.list || []
          }))
        );
        return nextMethods;
      }
      
      return prevMethods;
    });
  }, [
    JSON.stringify(qualities.map(q => ({ id: q.id, name: q.name }))),
    JSON.stringify(subGoals.map(sg => ({ id: sg.id, description: sg.description }))),
    JSON.stringify(qualitiesBySubGoal)
  ]);

  const addQualityToSubGoal = (subGoalId: string, quality: string) => {
    setQualitiesBySubGoal(prev => {
      const updated = {
        ...prev,
        [subGoalId]: {
          ...prev[subGoalId],
          list: Array.from(new Set([...(prev[subGoalId]?.list || []), quality]))
        }
      };
      
      // Immediately sync to qualities array
      const allQualities: TrainableQuality[] = Object.entries(updated)
        .flatMap(([subGoalId, { list }]) =>
          list.map(qualityName => ({
            id: `${subGoalId}::${qualityName}`,
            name: qualityName,
            description: "",
            methods: qualities.find(q => q.id === `${subGoalId}::${qualityName}`)?.methods || []
          }))
        );
      setQualities(allQualities);
      
      return updated;
    });
  };

  const removeQualityFromSubGoal = (subGoalId: string, quality: string) => {
    setQualitiesBySubGoal(prev => {
      const updated = {
        ...prev,
        [subGoalId]: {
          ...prev[subGoalId],
          list: prev[subGoalId]?.list.filter(q => q !== quality) || []
        }
      };
      
      // Immediately sync to qualities array
      const allQualities: TrainableQuality[] = Object.entries(updated)
        .flatMap(([subGoalId, { list }]) =>
          list.map(qualityName => ({
            id: `${subGoalId}::${qualityName}`,
            name: qualityName,
            description: "",
            methods: qualities.find(q => q.id === `${subGoalId}::${qualityName}`)?.methods || []
          }))
        );
      setQualities(allQualities);
      
      return updated;
    });
  };

  const addMethodToQuality = (qualityId: string, method: string) => {
    setMethodsByQuality(prev => {
      const newList = Array.from(new Set([...(prev[qualityId]?.list || []), method]));
      return {
        ...prev,
        [qualityId]: {
          ...prev[qualityId],
          list: newList
        }
      };
    });
    
    // Sync back to qualities array with functional update
    setQualities(prev => prev.map(quality => 
      quality.id === qualityId 
        ? { ...quality, methods: Array.from(new Set([...(quality.methods || []), method])) }
        : quality
    ));
  };

  const removeMethodFromQuality = (qualityId: string, method: string) => {
    setMethodsByQuality(prev => ({
      ...prev,
      [qualityId]: {
        ...prev[qualityId],
        list: prev[qualityId]?.list.filter(m => m !== method) || []
      }
    }));
    
    // Sync back to qualities array with functional update
    setQualities(prev => prev.map(quality => 
      quality.id === qualityId 
        ? { ...quality, methods: (quality.methods || []).filter(m => m !== method) }
        : quality
    ));
  };

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
          <div className="flex justify-center">
            <div className="border rounded-md p-3 w-fit">
            <Calendar
              mode="single"
              selected={smartGoal.startDate || smartGoal.endDate}
              onSelect={(selectedDate) => {
                if (!selectedDate) return;

                if (selectionPhase === 'start' || !smartGoal.startDate) {
                  // First click or reset: set start date, clear end date
                  setSmartGoal({
                    ...smartGoal,
                    startDate: selectedDate,
                    endDate: undefined,
                    totalDays: undefined,
                    totalWeeks: undefined
                  });
                  setSelectionPhase('end');
                } else if (selectionPhase === 'end') {
                  if (selectedDate >= smartGoal.startDate) {
                    // Second click: set end date if after start date
                    const totalDays = Math.ceil((selectedDate.getTime() - smartGoal.startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const totalWeeks = Math.ceil(totalDays / 7);
                    
                    setSmartGoal({
                      ...smartGoal,
                      endDate: selectedDate,
                      totalDays: totalDays > 0 ? totalDays : 1,
                      totalWeeks: totalWeeks > 0 ? totalWeeks : 1
                    });
                    setSelectionPhase('start');
                  } else {
                    // If clicked date is before start date, treat as new start date
                    setSmartGoal({
                      ...smartGoal,
                      startDate: selectedDate,
                      endDate: undefined,
                      totalDays: undefined,
                      totalWeeks: undefined
                    });
                    setSelectionPhase('end');
                  }
                }
              }}
              modifiers={{
                start: (date) => smartGoal.startDate && date.getTime() === smartGoal.startDate.getTime(),
                end: (date) => smartGoal.endDate && date.getTime() === smartGoal.endDate.getTime(),
                middle: (date) => {
                  if (!smartGoal.startDate || !smartGoal.endDate) return false;
                  return date > smartGoal.startDate && date < smartGoal.endDate;
                }
              }}
              modifiersStyles={{
                start: { 
                  backgroundColor: 'hsl(var(--foreground))', 
                  color: 'hsl(var(--background))',
                  fontWeight: 'bold'
                },
                end: { 
                  backgroundColor: 'hsl(var(--foreground))', 
                  color: 'hsl(var(--background))',
                  fontWeight: 'bold'
                },
                middle: { 
                  backgroundColor: 'hsl(var(--muted))', 
                  color: 'hsl(var(--muted-foreground))'
                }
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
          <div className="space-y-6">
            <h4 className="font-semibold text-center">Test Scheduling</h4>
            
            {/* Available Tests - Centered */}
            <div className="flex flex-col items-center">
              <Label className="text-sm font-medium mb-3">Available Tests</Label>
              <div className="flex flex-wrap justify-center gap-2 p-4 border rounded-lg bg-muted/50 min-h-24 max-w-2xl">
                {subGoals.map((subGoal) => (
                  <div
                    key={subGoal.id}
                    className={`p-3 bg-background border rounded cursor-pointer hover:bg-accent transition-colors ${
                      selectedTest === subGoal.id ? 'ring-2 ring-primary bg-primary/10' : ''
                    }`}
                    onClick={() => setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id)}
                  >
                    <div className="font-medium text-sm text-center">{subGoal.testMethod || "Unnamed Test"}</div>
                    <div className="text-xs text-muted-foreground text-center">{subGoal.description}</div>
                  </div>
                ))}
              </div>
              {selectedTest && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Click on a date in the calendar below to schedule this test
                </p>
              )}
            </div>

            {/* Training Calendar - Larger and Centered */}
            <div className="flex flex-col items-center">
              <Label className="text-sm font-medium mb-3">Training Calendar</Label>
              <div className="border rounded-lg p-6 bg-background">
                <Calendar
                  mode="single"
                  selected={undefined}
                  onSelect={(date) => {
                    if (date && selectedTest) {
                      const updated = [...subGoals];
                      const subGoalIndex = updated.findIndex(sg => sg.id === selectedTest);
                      if (subGoalIndex !== -1) {
                        const currentDates = updated[subGoalIndex].testDates || [];
                        const isAlreadyScheduled = currentDates.some(testDate => 
                          testDate.toDateString() === date.toDateString()
                        );
                        
                        if (isAlreadyScheduled) {
                          // Remove the test from this date (unschedule)
                          updated[subGoalIndex].testDates = currentDates.filter(testDate => 
                            testDate.toDateString() !== date.toDateString()
                          );
                        } else {
                          // Add the test to this date (schedule)
                          updated[subGoalIndex].testDates = [...currentDates, date];
                        }
                        
                        setSubGoals(updated);
                        // Keep the test selected for multiple scheduling
                      }
                    }
                  }}
                  className="rounded-md scale-110"
                  disabled={(date) => {
                    if (!smartGoal.startDate || !smartGoal.endDate) return true;
                    return date < smartGoal.startDate || date > smartGoal.endDate;
                  }}
                  modifiers={{
                    scheduled: subGoals.flatMap(sg => sg.testDates || [])
                  }}
                  modifiersStyles={{
                    scheduled: { 
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))',
                      fontWeight: 'bold'
                    }
                  }}
                  components={{
                    Day: ({ date, ...buttonProps }: any) => {
                      const scheduledTests = subGoals.filter(sg => 
                        sg.testDates?.some(testDate => 
                          testDate.toDateString() === date.toDateString()
                        )
                      );
                      
                      const dayContent = (
                        <button 
                          {...buttonProps}
                          className={`relative h-9 w-9 p-0 font-normal flex items-center justify-center ${
                            scheduledTests.length > 0 ? 'ring-2 ring-primary rounded-full' : ''
                          } ${buttonProps.className || ''}`}
                        >
                          {scheduledTests.length > 0 && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] leading-none text-primary truncate max-w-[36px]">
                              {scheduledTests[0].testMethod || "Test"}{scheduledTests.length > 1 ? ` +${scheduledTests.length - 1}` : ""}
                            </span>
                          )}
                          <span className={scheduledTests.length > 0 ? "mt-1" : ""}>
                            {date.getDate()}
                          </span>
                        </button>
                      );

                      // If there are scheduled tests and no test is currently selected, show hover card
                      if (scheduledTests.length > 0 && !selectedTest) {
                        return (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              {dayContent}
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <h4 className="font-semibold">
                                  Scheduled Tests for {date.toLocaleDateString()}
                                </h4>
                                <div className="space-y-1">
                                  {scheduledTests.map((test, index) => (
                                    <div key={index} className="text-sm">
                                      <div className="font-medium">{test.testMethod || "Unnamed Test"}</div>
                                      <div className="text-muted-foreground text-xs">{test.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }

                      return dayContent;
                    }
                  }}
                />
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
        <div className="space-y-6">
          {subGoals.map((subGoal) => {
            const subGoalQualities = qualitiesBySubGoal[subGoal.id] || { label: subGoal.description, list: [] };
            const recommendedQualities = getQualitiesForSubGoalLabel(subGoal.description);
            const availableQualities = recommendedQualities.filter(q => !subGoalQualities.list.includes(q));
            
            return (
              <div key={subGoal.id} className="p-4 border rounded-lg space-y-4">
                <div className="space-y-3">
                  <Label className="font-medium text-base">{subGoal.description || "Sub-Goal"}</Label>
                  
                  {/* Selected qualities */}
                  <div className="space-y-2">
                    {subGoalQualities.list.map((quality) => (
                      <div key={quality} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <span className="text-sm">{quality}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQualityFromSubGoal(subGoal.id, quality)}
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add quality dropdown */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Add Quality</Label>
                     <SearchableDropdown
                       value=""
                       onChange={(value) => {
                         if (value) {
                           addQualityToSubGoal(subGoal.id, value);
                         }
                       }}
                       options={[...availableQualities, ...getUniqueQualities()]}
                       placeholder="Select or type to add quality..."
                       allowCustomInput={true}
                       className="bg-background"
                     />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {subGoals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No sub-goals selected. Please go back to Step 3 to add sub-goals.</p>
          </div>
        )}
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
        <div className="space-y-6">
          {qualities.map((quality) => {
            const qualityData = methodsByQuality[quality.id];
            if (!qualityData) return null;
            
            const [subGoalId, qualityName] = quality.id.split('::');
            const subGoal = subGoals.find(sg => sg.id === subGoalId);
            const parts = subGoal?.description.split(' - ') || [];
            const overarchingGoal = parts[0] || '';
            const subGoalName = parts[1] || '';
            
            // Get recommended methods for this specific quality
            const recommendedMethods = overarchingGoal && subGoalName ? 
              getTrainingMethodsForQuality(overarchingGoal, subGoalName, qualityName) : [];
            const availableMethods = [...recommendedMethods, ...getUniqueTrainingMethods()];
            const uniqueAvailableMethods = Array.from(new Set(availableMethods));
            
            return (
              <div key={quality.id} className="p-4 border rounded-lg space-y-4">
                <div className="space-y-2">
                  {/* Sub-goal context */}
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Sub-goal:</span> {qualityData.subGoalLabel}
                  </div>
                  
                  {/* Quality header */}
                  <Label className="font-medium text-base flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>Quality: {qualityData.qualityName}</span>
                  </Label>
                  
                  {/* Selected methods */}
                  <div className="space-y-2">
                    {qualityData.list.map((method, methodIndex) => (
                      <div key={methodIndex} className="flex items-start justify-between p-3 bg-muted rounded-md">
                        <span className="text-sm flex-1">{method}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMethodFromQuality(quality.id, method)}
                          className="h-6 w-6 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add method dropdown */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Add Training Method</Label>
                    <SearchableDropdown
                      value=""
                      onChange={(value) => {
                        if (value) {
                          addMethodToQuality(quality.id, value);
                        }
                      }}
                      options={uniqueAvailableMethods}
                      placeholder="Select or type to add training method..."
                      allowCustomInput={true}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {qualities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No qualities selected. Please go back to Step 4 to select trainable qualities.</p>
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

  const handleNext = () => {
    if (currentStep === totalSteps) {
      // Save macrocycle data to localStorage before navigation
      const macrocycleData = {
        athleteInfo,
        smartGoal,
        subGoals,
        qualities,
        qualitiesBySubGoal,
        methodsByQuality,
        selectedTest,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
      navigate('/mesocycle');
    } else {
      setCurrentStep(Math.min(totalSteps, currentStep + 1));
    }
  };

  const renderMacroView = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Macrocycle Overview</h1>
          <Button variant="outline" size="sm">
            <Bot className="h-4 w-4 mr-2" />
            Ask AI for Help
          </Button>
        </div>
        <p className="text-muted-foreground">
          Complete overview of your macrocycle planning across all phases.
        </p>
      </div>

      {/* All Steps in One View */}
      <div className="space-y-8">
        {/* Step 1: Athlete Information */}
        <div id="athlete-info" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">1. Athlete Information</h2>
          {renderAthleteInfoForm()}
        </div>

        {/* Step 2: Goal Setting */}
        <div id="goal-setting" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">2. S.M.A.R.T. Goal Setting</h2>
          {renderGoalSettingForm()}
        </div>

        {/* Step 3: Sub-Goals */}
        <div id="sub-goals" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">3. Sub-Goals & Testing</h2>
          {renderSubGoalsForm()}
        </div>

        {/* Step 4: Trainable Qualities */}
        <div id="qualities" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">4. Trainable Qualities</h2>
          {renderTrainableQualitiesForm()}
        </div>

        {/* Step 5: Training Methods */}
        <div id="methods" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">5. Training Methods</h2>
          {renderTrainingMethodsForm()}
        </div>
      </div>
    </div>
  );

  // Conditional rendering based on display mode
  if (displayMode === "macro") {
    return renderMacroView();
  }

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
        
        {/* Top Navigation */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          <Button 
            size="sm"
            onClick={handleNext}
          >
            {currentStep === totalSteps ? "Move on to Mesocycle" : "Next"}
          </Button>
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
        
        <Button onClick={handleNext}>
          {currentStep === totalSteps ? "Move on to Mesocycle" : "Next"}
        </Button>
      </div>
    </div>
  );
}