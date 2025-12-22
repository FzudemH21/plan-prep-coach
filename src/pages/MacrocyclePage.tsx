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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { SmartGoal, SubGoal, TrainableQuality, Event } from "@/types/training";
import { User, Target, Calendar as CalendarIcon, Plus, Bot, X, Trash2, FileText } from "lucide-react";
import { 
  getUniqueQualities, 
  getUniqueTrainingMethods
} from "@/data/trainingData";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useAthleticismData } from "@/hooks/useAthleticismData";
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { format, parseISO } from "date-fns";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName } from "@/types/athlete";

export default function MacrocyclePage() {
  const { displayMode } = useDisplayMode();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: athleticismData } = useAthleticismData();
  const { athletes } = useAthletes();
  const [currentStep, setCurrentStep] = useState(1);
  const [planName, setPlanName] = useState<string>("");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [smartGoal, setSmartGoal] = useState<Partial<SmartGoal>>({});
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [qualities, setQualities] = useState<TrainableQuality[]>([]);
  const [qualitiesBySubGoal, setQualitiesBySubGoal] = useState<Record<string, { label: string; list: string[] }>>({});
  const [methodsByQuality, setMethodsByQuality] = useState<Record<string, { subGoalLabel: string; qualityName: string; list: string[] }>>({});
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectionPhase, setSelectionPhase] = useState<'start' | 'end'>('start');

  // Load saved data and step on mount
  useEffect(() => {
    const savedData = localStorage.getItem('macrocycleData');
    const savedStep = localStorage.getItem('macrocycleStep');
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPlanName(data.planName || "");
        setSelectedAthleteId(data.selectedAthleteId || null);
        // Convert string dates to Date objects when loading from localStorage
        const parsedSmartGoal = data.smartGoal || {};
        if (parsedSmartGoal.startDate) {
          parsedSmartGoal.startDate = new Date(parsedSmartGoal.startDate);
        }
        if (parsedSmartGoal.endDate) {
          parsedSmartGoal.endDate = new Date(parsedSmartGoal.endDate);
        }
        setSmartGoal(parsedSmartGoal);
        const parsedSubGoals = data.subGoals || [];
        setSubGoals(parsedSubGoals);
        const parsedEvents = data.events || [];
        setEvents(parsedEvents);
        setQualities(data.qualities || []);
        setQualitiesBySubGoal(data.qualitiesBySubGoal || {});
        setMethodsByQuality(data.methodsByQuality || {});
        setSelectedTest(data.selectedTest || null);
        setSelectedEvent(data.selectedEvent || null);
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
      planName,
      selectedAthleteId,
      smartGoal,
      subGoals,
      events,
      qualities,
      qualitiesBySubGoal,
      methodsByQuality,
      selectedTest,
      selectedEvent,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
  }, [planName, selectedAthleteId, smartGoal, subGoals, events, qualities, qualitiesBySubGoal, methodsByQuality, selectedTest, selectedEvent]);

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

  // Helper function to get unique sub-goals from athleticism database
  const getSubGoalsFromAthleticismDB = (): string[] => {
    const subGoalSet = new Set<string>();
    athleticismData.entries.forEach(entry => {
      const formatted = `${entry.overarchingGoal} - ${entry.subGoal}`;
      subGoalSet.add(formatted);
    });
    return Array.from(subGoalSet).sort();
  };

  // Helper function to get qualities for a sub-goal from athleticism database
  const getQualitiesForSubGoalFromDB = (subGoalLabel: string): string[] => {
    const parts = subGoalLabel.split(' - ');
    if (parts.length < 2) return [];
    
    const overarchingGoal = parts[0].trim();
    const subGoal = parts[1].trim();
    
    // Normalize for comparison
    const normalizedOverarching = normalizeForComparison(overarchingGoal);
    const normalizedSubGoal = normalizeForComparison(subGoal);
    
    return Array.from(new Set(
      athleticismData.entries
        .filter(entry => 
          normalizeForComparison(entry.overarchingGoal) === normalizedOverarching && 
          normalizeForComparison(entry.subGoal) === normalizedSubGoal
        )
        .map(entry => entry.quality)
    ));
  };

  // Helper function to format loading recommendations as sentences
  const formatLoadingRecommendations = (recommendations: Record<string, any>): string => {
    const parts: string[] = [];
    Object.entries(recommendations).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim()) {
        parts.push(`${key}: ${value}`);
      } else if (value && typeof value === 'number') {
        parts.push(`${key}: ${value}`);
      }
    });
    return parts.join(', ');
  };

  // Helper function to get methods with their sub-goals and qualities (for reversed Step 5 view)
  const getMethodsWithSubGoalsAndQualities = () => {
    const methodsMap = new Map<string, {
      subGoals: Set<string>;
      qualitiesWithRecommendations: Array<{
        subGoal: string;
        quality: string;
        recommendations: string;
      }>;
    }>();

    // Get all selected methods from qualities
    qualities.forEach(quality => {
      const methods = quality.methods || [];
      const [subGoalId, qualityName] = quality.id.split('::');
      const subGoal = subGoals.find(sg => sg.id === subGoalId);
      
      if (subGoal && qualityName) {
        const subGoalDescription = subGoal.description;
        const parts = subGoalDescription.split(' - ');
        
        if (parts.length >= 2) {
          const overarchingGoal = parts[0].trim();
          const subGoalName = parts[1].trim();
          
          // Find matching entry in athleticism database
          const athleticismEntry = athleticismData.entries.find(entry =>
            normalizeForComparison(entry.overarchingGoal) === normalizeForComparison(overarchingGoal) &&
            normalizeForComparison(entry.subGoal) === normalizeForComparison(subGoalName) &&
            normalizeForComparison(entry.quality) === normalizeForComparison(qualityName)
          );

          methods.forEach(method => {
            if (!methodsMap.has(method)) {
              methodsMap.set(method, {
                subGoals: new Set(),
                qualitiesWithRecommendations: []
              });
            }
            
            const methodData = methodsMap.get(method)!;
            methodData.subGoals.add(subGoalDescription);
            
            // Get loading recommendations for this method from athleticism database
            const recommendations = athleticismEntry?.loadingRecommendations?.[method] || {};
            const formattedRecommendations = formatLoadingRecommendations(recommendations);
            
            methodData.qualitiesWithRecommendations.push({
              subGoal: subGoalDescription,
              quality: qualityName,
              recommendations: formattedRecommendations
            });
          });
        }
      }
    });

    return Array.from(methodsMap.entries()).map(([method, data]) => ({
      method,
      subGoals: Array.from(data.subGoals),
      qualitiesWithRecommendations: data.qualitiesWithRecommendations
    }));
  };

  // Auto-populate qualities when sub-goals change
  useEffect(() => {
    const newQualitiesBySubGoal: Record<string, { label: string; list: string[] }> = {};
    
    subGoals.forEach(subGoal => {
      const existing = qualitiesBySubGoal[subGoal.id];
      const recommendedQualities = getQualitiesForSubGoalFromDB(subGoal.description);
      
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
            
            // Get recommended methods from athleticism database
            const normalizedOverarching = normalizeForComparison(overarchingGoal);
            const normalizedSubGoal = normalizeForComparison(subGoalName);
            const normalizedQuality = normalizeForComparison(qualityName);
            
            const recommendedMethods = Array.from(new Set(
              athleticismData.entries
                .filter(entry => 
                  normalizeForComparison(entry.overarchingGoal) === normalizedOverarching && 
                  normalizeForComparison(entry.subGoal) === normalizedSubGoal &&
                  normalizeForComparison(entry.quality) === normalizedQuality
                )
                .flatMap(entry => entry.mappedMethods)
            ));
            
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

  // Event management functions
  const addEvent = (name: string) => {
    const newEvent: Event = {
      id: `event-${Date.now()}`,
      name: name.trim(),
      description: '',
      eventDates: [],
      comments: ''
    };
    setEvents([...events, newEvent]);
    toast({ title: 'Event Added', description: `Created event "${name}"` });
  };

  const removeEvent = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    setEvents(events.filter(e => e.id !== eventId));
    if (selectedEvent === eventId) {
      setSelectedEvent(null);
    }
    if (event) {
      toast({ title: 'Event Removed', description: `Deleted event "${event.name}"` });
    }
  };

  const scheduleEvent = (eventId: string, date: Date) => {
    const updated = [...events];
    const eventIndex = updated.findIndex(e => e.id === eventId);
    if (eventIndex !== -1) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const currentDates = updated[eventIndex].eventDates || [];
      const isAlreadyScheduled = currentDates.some(eventDate => 
        eventDate === dateStr
      );
      if (isAlreadyScheduled) {
        updated[eventIndex].eventDates = currentDates.filter(eventDate => 
          eventDate !== dateStr
        );
        toast({ title: 'Event Unscheduled', description: `Removed "${updated[eventIndex].name}" from ${format(date, 'PPP')}` });
      } else {
        updated[eventIndex].eventDates = [...currentDates, dateStr];
        toast({ title: 'Event Scheduled', description: `Added "${updated[eventIndex].name}" to ${format(date, 'PPP')}` });
      }
      setEvents(updated);
    }
  };

  const clearAllScheduledItems = () => {
    // Count total scheduled items
    const totalTests = subGoals.reduce((sum, sg) => sum + (sg.testDates?.length || 0), 0);
    const totalEvents = events.reduce((sum, e) => sum + (e.eventDates?.length || 0), 0);
    const total = totalTests + totalEvents;
    
    if (total === 0) {
      toast({
        title: "Nothing to clear",
        description: "No tests or events are currently scheduled",
        variant: "destructive"
      });
      return;
    }
    
    // Clear all test dates
    setSubGoals(prev => prev.map(sg => ({
      ...sg,
      testDates: []
    })));
    
    // Clear all event dates
    setEvents(prev => prev.map(e => ({
      ...e,
      eventDates: []
    })));
    
    toast({
      title: "Calendar cleared",
      description: `Removed ${totalTests} test schedule(s) and ${totalEvents} event schedule(s)`,
    });
  };

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const selectedAthlete = selectedAthleteId ? athletes.find(a => a.id === selectedAthleteId) : null;

  const renderPlanSetupForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Plan Setup</span>
        </CardTitle>
        <CardDescription>
          Name your training plan and select the athlete you'll be working with.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="planName">Plan Name *</Label>
          <Input
            id="planName"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="e.g., Pre-Season 2025, Off-Season Strength Block"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="athlete">Select Athlete *</Label>
          {athletes.length > 0 ? (
            <Select 
              value={selectedAthleteId || ""} 
              onValueChange={(value) => setSelectedAthleteId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an athlete from your database" />
              </SelectTrigger>
              <SelectContent>
                {athletes.map((athlete) => (
                  <SelectItem key={athlete.id} value={athlete.id}>
                    {getAthleteDisplayName(athlete)}
                    {athlete.sport && ` • ${athlete.sport}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No athletes in your database yet.</p>
              <Button 
                variant="link" 
                className="text-primary"
                onClick={() => navigate('/athletes')}
              >
                Add an athlete first →
              </Button>
            </div>
          )}
        </div>

        {selectedAthlete && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Selected Athlete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name:</span> {getAthleteDisplayName(selectedAthlete)}</p>
              {selectedAthlete.sport && (
                <p><span className="text-muted-foreground">Sport:</span> {selectedAthlete.sport}</p>
              )}
              {selectedAthlete.birthday && (
                <p><span className="text-muted-foreground">Birthday:</span> {format(new Date(selectedAthlete.birthday), 'PP')}</p>
              )}
              {selectedAthlete.occupation && (
                <p><span className="text-muted-foreground">Occupation:</span> {selectedAthlete.occupation}</p>
              )}
            </CardContent>
          </Card>
        )}
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
          <CalendarIcon className="h-5 w-5" />
          <span>Calendar Planning</span>
        </CardTitle>
        <CardDescription>
          Break down your main goal into measurable sub-goals and schedule events that may affect your training plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Sub-Goals */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Sub-Goals & Testing</h3>
            
            <div className="space-y-4">
              {subGoals.map((subGoal, index) => (
                <div key={subGoal.id} className="p-4 border rounded-lg space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Sub-Goal Description</Label>
                       <SearchableDropdown
                         value={subGoal.description}
                         onChange={(value) => {
                           const updated = [...subGoals];
                           updated[index].description = value;
                           setSubGoals(updated);
                         }}
                         options={getSubGoalsFromAthleticismDB()}
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

                  {/* Comments field */}
                  <div className="space-y-2">
                    <Label htmlFor={`subgoal-comments-${index}`}>
                      Comments
                      <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                    </Label>
                    <Textarea
                      id={`subgoal-comments-${index}`}
                      value={subGoal.comments || ""}
                      onChange={(e) => {
                        const updated = [...subGoals];
                        updated[index].comments = e.target.value;
                        setSubGoals(updated);
                      }}
                      placeholder="Add notes about this test (e.g., testing protocol, preparation requirements, etc.)"
                      rows={2}
                      className="text-sm"
                    />
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
                  testDates: [],
                  comments: ""
                };
                setSubGoals([...subGoals, newSubGoal]);
              }}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Sub-Goal
            </Button>
          </div>
          
          {/* Right Column: Other Events */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Other Events</h3>
            
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{event.name}</div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeEvent(event.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Comments field */}
                  <div className="space-y-2">
                    <Label htmlFor={`event-comments-${event.id}`}>
                      Comments
                      <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                    </Label>
                    <Textarea
                      id={`event-comments-${event.id}`}
                      value={event.comments || ""}
                      onChange={(e) => {
                        const updated = events.map(ev => 
                          ev.id === event.id 
                            ? { ...ev, comments: e.target.value }
                            : ev
                        );
                        setEvents(updated);
                      }}
                      placeholder="Add notes about this event (e.g., logistics, preparation, travel details, etc.)"
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Event Name</Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter event name (e.g., Match, Vacation)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      const eventName = target.value.trim();
                      if (eventName) {
                        addEvent(eventName);
                        target.value = '';
                      }
                    }
                  }}
                />
                <Button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                    const eventName = input?.value?.trim();
                    if (eventName) {
                      addEvent(eventName);
                      input.value = '';
                    }
                  }}
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Section - Full Width */}
        {(subGoals.length > 0 || events.length > 0) && smartGoal.startDate && smartGoal.endDate && (
          <div className="space-y-6 mt-8 border-t pt-6">
            <h4 className="font-semibold text-center">Calendar Scheduling</h4>
            
            {/* Available Items - Centered */}
            <div className="flex flex-col items-center">
              <Label className="text-sm font-medium mb-3">Available Items</Label>
              <div className="flex flex-wrap justify-center gap-2 p-4 border rounded-lg bg-muted/50 min-h-24 max-w-4xl">
                {/* Tests */}
                {subGoals.map((subGoal) => (
                  <div
                    key={`test-${subGoal.id}`}
                    className={`p-3 bg-background border rounded cursor-pointer hover:bg-accent transition-colors ${
                      selectedTest === subGoal.id ? 'ring-2 ring-primary bg-primary/10' : ''
                    }`}
                    onClick={() => {
                      setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id);
                      setSelectedEvent(null);
                    }}
                  >
                    <div className="font-medium text-sm text-center">{subGoal.testMethod || "Unnamed Test"}</div>
                    <div className="text-xs text-muted-foreground text-center">{subGoal.description}</div>
                    <div className="text-xs text-blue-600 text-center">Test</div>
                  </div>
                ))}
                {/* Events */}
                {events.map((event) => (
                  <div
                    key={`event-${event.id}`}
                    className={`p-3 bg-background border rounded cursor-pointer hover:bg-accent transition-colors ${
                      selectedEvent === event.id ? 'ring-2 ring-secondary bg-secondary/10' : ''
                    }`}
                    onClick={() => {
                      setSelectedEvent(selectedEvent === event.id ? null : event.id);
                      setSelectedTest(null);
                    }}
                  >
                    <div className="font-medium text-sm text-center">{event.name}</div>
                    <div className="text-xs text-orange-600 text-center">Event</div>
                  </div>
                ))}
              </div>
              {(selectedTest || selectedEvent) && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Click on a date in the calendar below to schedule this item
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      subGoals.every(sg => !sg.testDates || sg.testDates.length === 0) &&
                      events.every(e => !e.eventDates || e.eventDates.length === 0)
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Scheduled Items
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all scheduled tests and events?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all test and event dates from the calendar. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllScheduledItems}>
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Training Calendar - Larger and Centered */}
            <div className="flex flex-col items-center">
              <Label className="text-sm font-medium mb-3">Training Calendar</Label>
              <div className="border rounded-lg p-6 bg-background">
                <Calendar
                  mode="single"
                  selected={undefined}
                  className="rounded-md scale-110"
                  disabled={(date) => {
                    if (!smartGoal.startDate || !smartGoal.endDate) return true;
                    return date < smartGoal.startDate || date > smartGoal.endDate;
                  }}
                  modifiers={{
                    scheduled: subGoals
                      .flatMap(sg => sg.testDates || [])
                      .concat(events.flatMap(e => e.eventDates || []))
                      .map(dateStr => parseISO(dateStr))
                  }}
                  modifiersStyles={{
                    scheduled: { 
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))',
                      fontWeight: 'bold'
                    }
                  }}
                  components={{
                    Day: ({ date, ...dayProps }: any) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const scheduledTests = subGoals.filter(sg => 
                        sg.testDates?.some(testDate => testDate === dateStr)
                      );
                      const scheduledEvents = events.filter(e => 
                        e.eventDates?.some(eventDate => eventDate === dateStr)
                      );

                      const handleClick = (e: any) => {
                        dayProps?.onClick?.(e);
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (selectedTest) {
                          const updated = [...subGoals];
                          const subGoalIndex = updated.findIndex(sg => sg.id === selectedTest);
                          if (subGoalIndex !== -1) {
                            const currentDates = updated[subGoalIndex].testDates || [];
                            const isAlreadyScheduled = currentDates.some(testDate => 
                              testDate === dateStr
                            );
                            if (isAlreadyScheduled) {
                              updated[subGoalIndex].testDates = currentDates.filter(testDate => 
                                testDate !== dateStr
                              );
                              toast({ title: 'Test Unscheduled', description: `Removed "${updated[subGoalIndex].testMethod}" from ${format(date, 'PPP')}` });
                            } else {
                              updated[subGoalIndex].testDates = [...currentDates, dateStr];
                              toast({ title: 'Test Scheduled', description: `Added "${updated[subGoalIndex].testMethod}" to ${format(date, 'PPP')}` });
                            }
                            setSubGoals(updated);
                          }
                        } else if (selectedEvent) {
                          scheduleEvent(selectedEvent, date);
                        } else {
                          toast({ title: 'Select an item', description: 'Choose a test or event above, then click a date.' });
                        }
                      };
                      
                      const dayContent = (
                        <button 
                          {...dayProps}
                          onClick={handleClick}
                          className={`relative h-9 w-9 p-0 font-normal flex items-center justify-center ${
                            scheduledTests.length > 0 && scheduledEvents.length > 0 
                              ? 'bg-gradient-to-r from-foreground to-red-500 text-white rounded-full font-bold' 
                              : scheduledEvents.length > 0 
                                ? 'bg-red-500 text-white rounded-full font-bold'
                                : scheduledTests.length > 0 
                                  ? 'bg-foreground text-background rounded-full font-bold' 
                                  : ''
                          } ${dayProps.className || ''}`}
                        >
                          <span>
                            {date.getDate()}
                          </span>
                        </button>
                      );

                      // If there are scheduled items, always show hover card
                      if (scheduledTests.length > 0 || scheduledEvents.length > 0) {
                        return (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              {dayContent}
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80" side="top">
                              <div className="space-y-2">
                                <h4 className="font-semibold">
                                  Scheduled Items for {date.toLocaleDateString()}
                                </h4>
                                <div className="space-y-1">
                                  {scheduledTests.map((test, index) => (
                                    <div key={`test-${index}`} className="text-sm">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-blue-600">📋</span>
                                        {test.testMethod || "Unnamed Test"}
                                      </div>
                                      <div className="text-muted-foreground text-xs">{test.description}</div>
                                    </div>
                                  ))}
                                  {scheduledEvents.map((event, index) => (
                                    <div key={`event-${index}`} className="text-sm">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-orange-600">📅</span>
                                        {event.name}
                                      </div>
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
            const recommendedQualities = getQualitiesForSubGoalFromDB(subGoal.description);
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

  const renderTrainingMethodsForm = () => {
    const methodsWithData = getMethodsWithSubGoalsAndQualities();
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Training Methods Overview</span>
          </CardTitle>
          <CardDescription>
            Overview of selected training methods with the sub-goals and qualities they address, including loading recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {methodsWithData.map((methodData, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                {/* Method header */}
                <div className="space-y-2">
                  <Label className="font-medium text-lg flex items-center space-x-2">
                    <Target className="h-4 w-4" />
                    <span>{methodData.method}</span>
                  </Label>
                </div>
                
                {/* Sub-goals and qualities this method addresses */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">
                    This method addresses the following sub-goals and qualities:
                  </Label>
                  
                  <div className="space-y-3">
                    {methodData.qualitiesWithRecommendations.map((item, itemIndex) => (
                      <div key={itemIndex} className="p-3 bg-muted/50 rounded-md space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Sub-Goal:</span> {item.subGoal}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Quality:</span> {item.quality}
                        </div>
                        {item.recommendations && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Loading Recommendations:</span> {item.recommendations}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {methodsWithData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No training methods selected. Please go back to Step 4 to select trainable qualities and methods.</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const stepTitles = [
    "Plan Setup",
    "Goal Setting", 
    "Sub-Goals & Testing",
    "Trainable Qualities",
    "Training Methods"
  ];

  const handleNext = () => {
    if (currentStep === totalSteps) {
      // Save macrocycle data to localStorage before navigation
      const macrocycleData = {
        planName,
        selectedAthleteId,
        smartGoal,
        subGoals,
        events,
        qualities,
        qualitiesBySubGoal,
        methodsByQuality,
        selectedTest,
        selectedEvent,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
      navigate('/mesocycle');
    } else {
      setCurrentStep(Math.min(totalSteps, currentStep + 1));
    }
  };

  const renderMacroView = () => (
    <div className="w-full max-w-none space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Macrocycle Overview</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              Ask AI for Help
            </Button>
            <PlanningNavigationMenu currentPage="macrocycle" currentPageStep={currentStep} onChangeCurrentPageStep={setCurrentStep} />
          </div>
        </div>
        <p className="text-muted-foreground">
          Complete overview of your macrocycle planning across all phases.
        </p>
      </div>

      {/* All Steps in One View */}
      <div className="space-y-8">
        {/* Step 1: Plan Setup */}
        <div id="plan-setup" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">1. Plan Setup</h2>
          {renderPlanSetupForm()}
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
    <div className="w-full max-w-none space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Macrocycle Planning</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              Ask AI for Help
            </Button>
            <PlanningNavigationMenu currentPage="macrocycle" currentPageStep={currentStep} onChangeCurrentPageStep={setCurrentStep} />
          </div>
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
        {currentStep === 1 && renderPlanSetupForm()}
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