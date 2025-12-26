import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { SmartGoal, SubGoal, TrainableQuality, Event, PlanDuration } from "@/types/training";
import { User, Target, Calendar as CalendarIcon, Plus, Bot, X, Trash2, FileText, Check, ChevronsUpDown, ChevronDown, Pencil, Link, Link2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  getUniqueQualities, 
  getUniqueTrainingMethods
} from "@/data/trainingData";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useAthleticismData } from "@/hooks/useAthleticismData";
import { useParametersDataV2 } from "@/hooks/useParametersDataV2";
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { format, parseISO, addDays } from "date-fns";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName, Athlete } from "@/types/athlete";
import { cn } from "@/lib/utils";
import { AddSmartGoalDialog, AddSubGoalDialog } from "@/components/macrocycle";
import { AddParameterDialogV2 } from "@/components/goals/AddParameterDialogV2";
import { useToolboxData } from "@/hooks/useToolboxData";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function MacrocyclePage() {
  const { displayMode } = useDisplayMode();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: athleticismData } = useAthleticismData();
  const { data: parametersDataV2, addParameter: addAthleticismParameter, addInteraction: addParameterInteraction } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();
  const { athletes, groups, getAthletePerformanceParameters, addPerformanceParameter, getAthleteBiometrics, biometricDefinitions } = useAthletes();
  const [athleteDropdownOpen, setAthleteDropdownOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [planName, setPlanName] = useState<string>("");
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  
  // New state for plan duration and multiple SMART goals
  const [planDuration, setPlanDuration] = useState<PlanDuration | null>(null);
  const [smartGoals, setSmartGoals] = useState<SmartGoal[]>([]);
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);
  const [isAddSubGoalDialogOpen, setIsAddSubGoalDialogOpen] = useState(false);
  const [selectionPhase, setSelectionPhase] = useState<'start' | 'end'>('start');
  
  // Legacy state for backward compatibility (will be migrated)
  const [smartGoal, setSmartGoal] = useState<Partial<SmartGoal>>({});
  
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [qualities, setQualities] = useState<TrainableQuality[]>([]);
  const [qualitiesBySubGoal, setQualitiesBySubGoal] = useState<Record<string, { label: string; list: string[] }>>({});
  const [methodsByQuality, setMethodsByQuality] = useState<Record<string, { subGoalLabel: string; qualityName: string; list: string[] }>>({});
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [selectedSmartGoal, setSelectedSmartGoal] = useState<string | null>(null);
  const [expandedSubGoals, setExpandedSubGoals] = useState<Set<string>>(new Set());
  const [expandedPrimaryGoals, setExpandedPrimaryGoals] = useState<Set<string>>(new Set());
  const [addSubGoalForParent, setAddSubGoalForParent] = useState<string | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState<SmartGoal | null>(null);
const [editingSubGoal, setEditingSubGoal] = useState<SubGoal | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [addEventMode, setAddEventMode] = useState(false);

  // State for parameter creation from sub-goal dialog (links to a parent SMART goal)
  const [createParameterForGoalId, setCreateParameterForGoalId] = useState<string | null>(null);

  // Derive sub-goals from SMART goal parameter relationships
  const derivedSubGoals = useMemo(() => {
    const derived: SubGoal[] = [];
    
    // Get the selected athlete's performance parameters
    const athletePerformanceParams = selectedAthleteId 
      ? getAthletePerformanceParameters(selectedAthleteId) 
      : [];
    
    smartGoals.forEach(goal => {
      // Only process goals that are linked to a parameter
      if (!goal.linkedParameterId) return;
      
      // Get all parameters that "contribute to" this goal's parameter
      const contributingInteractions = parametersDataV2.interactions.filter(
        i => i.targetParameterId === goal.linkedParameterId && i.direction === 'contributes_to'
      );
      
      contributingInteractions.forEach(interaction => {
        const sourceParam = parametersDataV2.parameters.find(
          p => p.id === interaction.sourceParameterId
        );
        
        if (sourceParam) {
          // Check if already exists as a user-created sub-goal (by parameterLinkedId)
          const alreadyExists = subGoals.some(
            sg => sg.parameterLinkedId === sourceParam.id && sg.parentGoalId === goal.id
          );
          
          if (!alreadyExists) {
            // Look up athlete's current value for this parameter
            const athleteParam = athletePerformanceParams.find(
              pp => pp.athleticismParameterId === sourceParam.id
            );
            
            // Get the latest recorded value (if any)
            let preTestValue = 0;
            if (athleteParam && athleteParam.values.length > 0) {
              // Sort by recordedAt descending and get the most recent
              const sortedValues = [...athleteParam.values].sort(
                (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
              );
              const latestValue = parseFloat(sortedValues[0].value);
              if (!isNaN(latestValue)) {
                preTestValue = latestValue;
              }
            }
            
            derived.push({
              id: `derived-${goal.id}-${sourceParam.id}`,
              parentGoalId: goal.id,
              description: sourceParam.name,
              testMethod: '',
              preTestValue,
              goalValue: 0,
              unit: sourceParam.unit || '',
              percentChange: 0,
              testDates: [],
              parameterLinkedId: sourceParam.id,
              isDerived: true,
              interactionStrength: interaction.strength,
            });
          }
        }
      });
    });
    
    return derived;
  }, [smartGoals, parametersDataV2.interactions, parametersDataV2.parameters, subGoals, selectedAthleteId, getAthletePerformanceParameters]);

  // Group sub-goals by parent goal (including derived ones)
  const subGoalsByParent = useMemo(() => {
    const allSubGoals = [...subGoals, ...derivedSubGoals];
    const grouped: Record<string, SubGoal[]> = {};
    const unlinked: SubGoal[] = [];
    
    allSubGoals.forEach(sg => {
      if (sg.parentGoalId) {
        if (!grouped[sg.parentGoalId]) grouped[sg.parentGoalId] = [];
        grouped[sg.parentGoalId].push(sg);
      } else {
        unlinked.push(sg);
      }
    });
    
    return { grouped, unlinked };
  }, [subGoals, derivedSubGoals]);

  // Group athletes alphabetically by their groups
  const groupedAthletes = useMemo(() => {
    const grouped: Record<string, Athlete[]> = {};
    
    // Sort groups alphabetically
    const sortedGroups = [...groups].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    // For each group, get athletes and sort alphabetically
    sortedGroups.forEach(group => {
      const groupAthletes = athletes
        .filter(a => a.groupIds.includes(group.id))
        .sort((a, b) => 
          getAthleteDisplayName(a).localeCompare(getAthleteDisplayName(b))
        );
      if (groupAthletes.length > 0) {
        grouped[group.name] = groupAthletes;
      }
    });
    
    // Add "Ungrouped" for athletes without any group
    const ungroupedAthletes = athletes
      .filter(a => a.groupIds.length === 0)
      .sort((a, b) => 
        getAthleteDisplayName(a).localeCompare(getAthleteDisplayName(b))
      );
    if (ungroupedAthletes.length > 0) {
      grouped["Ungrouped"] = ungroupedAthletes;
    }
    
    return grouped;
  }, [athletes, groups]);

  useEffect(() => {
    const savedData = localStorage.getItem('macrocycleData');
    const savedStep = localStorage.getItem('macrocycleStep');
    
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPlanName(data.planName || "");
        setSelectedAthleteId(data.selectedAthleteId || null);
        
        // Load new planDuration if exists
        if (data.planDuration) {
          setPlanDuration({
            startDate: new Date(data.planDuration.startDate),
            endDate: new Date(data.planDuration.endDate),
            totalDays: data.planDuration.totalDays,
            totalWeeks: data.planDuration.totalWeeks,
          });
        }
        
        // Load new smartGoals array if exists
        if (data.smartGoals && Array.isArray(data.smartGoals)) {
          setSmartGoals(data.smartGoals.map((g: any) => ({
            ...g,
            id: g.id || generateId(),
          })));
        }
        
        // Backward compatibility: migrate old smartGoal to new structure
        const parsedSmartGoal = data.smartGoal || {};
        if (parsedSmartGoal.startDate) {
          parsedSmartGoal.startDate = new Date(parsedSmartGoal.startDate);
        }
        if (parsedSmartGoal.endDate) {
          parsedSmartGoal.endDate = new Date(parsedSmartGoal.endDate);
        }
        setSmartGoal(parsedSmartGoal);
        
        // If we have old smartGoal data but no new planDuration, migrate it
        if (!data.planDuration && parsedSmartGoal.startDate && parsedSmartGoal.endDate) {
          setPlanDuration({
            startDate: parsedSmartGoal.startDate,
            endDate: parsedSmartGoal.endDate,
            totalDays: parsedSmartGoal.totalDays || 1,
            totalWeeks: parsedSmartGoal.totalWeeks || 1,
          });
        }
        
        // If we have old smartGoal data but no new smartGoals array, migrate it
        if (!data.smartGoals && parsedSmartGoal.description) {
          setSmartGoals([{
            id: parsedSmartGoal.id || generateId(),
            description: parsedSmartGoal.description,
            baselineValue: parsedSmartGoal.baselineValue || 0,
            desiredValue: parsedSmartGoal.desiredValue || 0,
            unit: parsedSmartGoal.unit || '',
            percentChange: parsedSmartGoal.percentChange || 0,
          }]);
        }
        
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
    // Build smartGoal for backward compatibility with other pages
    const legacySmartGoal = smartGoals.length > 0 ? {
      ...smartGoals[0],
      startDate: planDuration?.startDate,
      endDate: planDuration?.endDate,
      totalDays: planDuration?.totalDays,
      totalWeeks: planDuration?.totalWeeks,
    } : smartGoal;
    
    const macrocycleData = {
      planName,
      selectedAthleteId,
      planDuration,
      smartGoals,
      smartGoal: legacySmartGoal, // Keep for backward compatibility
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
  }, [planName, selectedAthleteId, planDuration, smartGoals, smartGoal, subGoals, events, qualities, qualitiesBySubGoal, methodsByQuality, selectedTest, selectedEvent]);

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

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const selectedAthlete = selectedAthleteId ? athletes.find(a => a.id === selectedAthleteId) : null;
  
  // Get athlete performance parameters for the Add Goal dialog
  const athletePerformanceParams = selectedAthleteId ? getAthletePerformanceParameters(selectedAthleteId) : [];
  const athleticismParameters = parametersDataV2?.parameters || [];
  
  // State for create parameter dialog
  const [isCreateParameterDialogOpen, setIsCreateParameterDialogOpen] = useState(false);
  const [pendingGoalAfterParameterCreation, setPendingGoalAfterParameterCreation] = useState(false);
  const [shouldReopenSubGoalDialog, setShouldReopenSubGoalDialog] = useState(false);

  // Handler for creating a new parameter from the goal dialog
  const handleCreateParameter = (paramData: {
    name: string;
    unit?: string;
    category?: string;
    interactions: any[];
    methods: any[];
  }) => {
    // Add parameter to Athleticism Database
    const newParam = addAthleticismParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
    });
    const newParamId = newParam?.id;
    
    // Add parameter interactions and methods if provided
    paramData.interactions.forEach(interaction => {
      // Would need to call addInteraction but keeping it simple for now
    });
    paramData.methods.forEach(method => {
      // Would need to call addParameterMethod but keeping it simple for now
    });
    
    // Automatically add this parameter to the athlete's performance parameters
    if (selectedAthleteId && newParamId) {
      addPerformanceParameter(selectedAthleteId, newParamId);
    }
    
    setIsCreateParameterDialogOpen(false);
    
    // Reopen the goal dialog so user can select the newly created parameter
    if (pendingGoalAfterParameterCreation) {
      setPendingGoalAfterParameterCreation(false);
      setTimeout(() => setIsAddGoalDialogOpen(true), 100);
    }
    
    toast({ 
      title: 'Parameter Created', 
      description: `Created "${paramData.name}" and added to athlete's performance parameters.` 
    });
  };

  // Handlers for SMART goals
  const handleAddGoal = (goal: Omit<SmartGoal, 'id'>) => {
    setSmartGoals(prev => [...prev, { ...goal, id: generateId() }]);
  };

  const handleRemoveGoal = (goalId: string) => {
    setSmartGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const handleEditGoal = (goal: SmartGoal) => {
    setSmartGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
    toast({ title: 'Goal Updated', description: `Updated "${goal.description}"` });
  };

  // Handlers for Sub-goals
  const handleAddSubGoal = (subGoal: Omit<SubGoal, 'id'>) => {
    const newSubGoal: SubGoal = { ...subGoal, id: `subgoal-${Date.now()}` };
    setSubGoals(prev => [...prev, newSubGoal]);
    toast({ title: 'Sub-Goal Added', description: `Created sub-goal "${subGoal.description}"` });
  };

  const handleRemoveSubGoal = (subGoalId: string) => {
    const sg = subGoals.find(s => s.id === subGoalId);
    setSubGoals(prev => prev.filter(s => s.id !== subGoalId));
    if (selectedTest === subGoalId) {
      setSelectedTest(null);
    }
    if (sg) {
      toast({ title: 'Sub-Goal Removed', description: `Deleted "${sg.description}"` });
    }
  };

  const handleEditSubGoal = (subGoal: SubGoal) => {
    setSubGoals(prev => prev.map(sg => sg.id === subGoal.id ? subGoal : sg));
    toast({ title: 'Sub-Goal Updated', description: `Updated "${subGoal.testMethod || subGoal.description}"` });
  };

  // Handler to "promote" a derived sub-goal to a user-managed one (for editing)
  const handlePromoteDerivedSubGoal = (derivedSubGoal: SubGoal) => {
    // Create a new user-managed sub-goal from the derived one
    const promotedSubGoal: SubGoal = {
      ...derivedSubGoal,
      id: `subgoal-${Date.now()}`, // New ID for user-managed sub-goal
      isDerived: false, // No longer derived
    };
    setSubGoals(prev => [...prev, promotedSubGoal]);
    // Open edit dialog with the new sub-goal
    setEditingSubGoal(promotedSubGoal);
    setIsAddSubGoalDialogOpen(true);
  };

  // Handler to open parameter creation dialog for adding new parameter as sub-goal
  const handleOpenCreateParameterForSubGoal = (parentGoalId: string | undefined) => {
    setCreateParameterForGoalId(parentGoalId || null);
    setAddSubGoalForParent(parentGoalId); // Remember the parent for re-opening
    setShouldReopenSubGoalDialog(true);
    setIsCreateParameterDialogOpen(true);
  };

  // Handler for when a new parameter is created via the parameter dialog
  const handleParameterCreatedAsSubGoal = (paramData: {
    name: string;
    unit?: string;
    category?: string;
    contributesTo?: Array<{ parameterId: string; strength?: 'strong' | 'moderate' | 'weak' }>;
    improvedBy?: Array<{ parameterId: string; strength?: 'strong' | 'moderate' | 'weak' }>;
    methods?: Array<{ methodId: string; rationale?: string }>;
  }) => {
    // Create the parameter in the database
    const newParam = addAthleticismParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
    });
    
    // If there's a parent goal and it's linked to a parameter, create an interaction
    if (createParameterForGoalId) {
      const parentGoal = smartGoals.find(g => g.id === createParameterForGoalId);
      if (parentGoal?.linkedParameterId) {
        // This new parameter contributes_to the parent goal's parameter
        addParameterInteraction(newParam.id, parentGoal.linkedParameterId, 'contributes_to', 'moderate');
      }
    }
    
    // Create a sub-goal for this parameter
    const newSubGoal: SubGoal = {
      id: `subgoal-${Date.now()}`,
      parentGoalId: createParameterForGoalId || undefined,
      description: paramData.name,
      testMethod: '',
      preTestValue: 0,
      goalValue: 0,
      unit: paramData.unit || '',
      percentChange: 0,
      testDates: [],
      parameterLinkedId: newParam.id,
    };
    setSubGoals(prev => [...prev, newSubGoal]);
    
    // Open edit dialog for the new sub-goal to set test values
    setEditingSubGoal(newSubGoal);
    setIsAddSubGoalDialogOpen(true);
    
    toast({
      title: 'Parameter Created',
      description: `Created "${paramData.name}" and added as sub-goal.`,
    });
  };

  // Handlers for Events
  const handleAddEvent = (event: Omit<Event, 'id'>) => {
    const newEvent: Event = { ...event, id: `event-${Date.now()}` };
    setEvents(prev => [...prev, newEvent]);
    toast({ title: 'Event Added', description: `Created event "${event.name}"` });
  };

  const handleEditEvent = (updatedEvent: Event) => {
    setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    setEditingEvent(null);
    toast({ title: 'Event Updated', description: `Updated "${updatedEvent.name}"` });
  };

  // Test method options for the dialog
  const testMethodOptions = [
    "1RM Back Squat", "1RM Front Squat", "1RM Deadlift", "1RM Bench Press",
    "CMJ Height", "CMJ RSI", "Drop Jump RSI", "Broad Jump",
    "10m Sprint", "20m Sprint", "30m Sprint", "40m Sprint",
    "505 COD Test", "T-Test", "Pro Agility", "L-Drill",
    "Yo-Yo IR1", "Yo-Yo IR2", "Beep Test", "Cooper Test",
    "Grip Strength", "Isometric Mid-Thigh Pull", "Jump Mat Test"
  ];

  // Calendar handlers for plan duration
  const handleCalendarSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;

    if (selectionPhase === 'start' || !planDuration?.startDate) {
      setPlanDuration({
        startDate: selectedDate,
        endDate: selectedDate,
        totalDays: 1,
        totalWeeks: 1,
      });
      setSelectionPhase('end');
    } else if (selectionPhase === 'end') {
      if (selectedDate >= planDuration.startDate) {
        const totalDays = Math.ceil((selectedDate.getTime() - planDuration.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalWeeks = Math.ceil(totalDays / 7);
        
        setPlanDuration({
          ...planDuration,
          endDate: selectedDate,
          totalDays: totalDays > 0 ? totalDays : 1,
          totalWeeks: totalWeeks > 0 ? totalWeeks : 1,
        });
        setSelectionPhase('start');
      } else {
        setPlanDuration({
          startDate: selectedDate,
          endDate: selectedDate,
          totalDays: 1,
          totalWeeks: 1,
        });
        setSelectionPhase('end');
      }
    }
  };

  const renderPlanAndGoalSetup = () => (
    <div className="space-y-6">
      {/* Top Row: Plan & Athlete Selection (compact) */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Plan & Athlete</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Plan Name *</Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g., Pre-Season 2025"
              />
            </div>

            <div className="space-y-2">
              <Label>Select Athlete *</Label>
              {athletes.length > 0 ? (
                <Popover open={athleteDropdownOpen} onOpenChange={setAthleteDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={athleteDropdownOpen}
                      className="w-full justify-between"
                    >
                      {selectedAthlete 
                        ? `${getAthleteDisplayName(selectedAthlete)}${selectedAthlete.sport ? ` • ${selectedAthlete.sport}` : ''}`
                        : "Choose an athlete..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Search athletes..." />
                      <CommandList>
                        <CommandEmpty>No athletes found.</CommandEmpty>
                        {Object.entries(groupedAthletes).map(([groupName, groupAthletes]) => (
                          <CommandGroup key={groupName} heading={groupName}>
                            {groupAthletes.map((athlete) => (
                              <CommandItem
                                key={athlete.id}
                                value={`${getAthleteDisplayName(athlete)} ${athlete.sport || ''}`}
                                onSelect={() => {
                                  setSelectedAthleteId(athlete.id);
                                  setAthleteDropdownOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedAthleteId === athlete.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {getAthleteDisplayName(athlete)}
                                {athlete.sport && (
                                  <span className="ml-2 text-muted-foreground">• {athlete.sport}</span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                  <User className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-sm">No athletes yet.</p>
                  <Button 
                    variant="link" 
                    className="text-primary p-0 h-auto"
                    onClick={() => navigate('/athletes')}
                  >
                    Add an athlete first →
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: SMART Goals (left) + Plan Duration (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: SMART Goals List */}
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>SMART Goals</span>
              </div>
              <Button
                size="sm"
                onClick={() => setIsAddGoalDialogOpen(true)}
                disabled={!selectedAthleteId}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Goal
              </Button>
            </CardTitle>
            <CardDescription>
              Define measurable performance targets for the training plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {smartGoals.length === 0 ? (
              <div className="p-6 border border-dashed rounded-lg text-center text-muted-foreground">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No goals defined yet.</p>
                <p className="text-xs mt-1">
                  {selectedAthleteId 
                    ? "Click 'Add Goal' to create your first SMART goal."
                    : "Select an athlete first to add goals."}
                </p>
              </div>
            ) : (
              smartGoals.map((goal) => (
                <div
                  key={goal.id}
                  className={cn(
                    "p-3 border rounded-lg flex items-start justify-between gap-3 cursor-pointer transition-colors",
                    selectedSmartGoal === goal.id 
                      ? "ring-2 ring-green-500 bg-green-500/5" 
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedSmartGoal(selectedSmartGoal === goal.id ? null : goal.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{goal.description}</span>
                      <Badge 
                        variant={goal.percentChange < 0 ? "destructive" : "default"}
                        className="shrink-0"
                      >
                        {goal.percentChange > 0 ? "+" : ""}{goal.percentChange.toFixed(1)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {goal.baselineValue} {goal.unit} → {goal.desiredValue} {goal.unit}
                    </p>
                    {goal.testDates && goal.testDates.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        📅 {goal.testDates.map(d => format(parseISO(d), 'd MMM yyyy')).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGoal(goal);
                        setIsAddGoalDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveGoal(goal.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {selectedSmartGoal && (
              <p className="text-xs text-muted-foreground text-center bg-muted/50 p-2 rounded">
                Click on a date in the calendar to schedule a test for this goal
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right: Plan Duration */}
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Plan Duration</span>
            </CardTitle>
            <CardDescription>
              Select start and end dates for the training plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="border rounded-md p-3 w-fit">
                <Calendar
                  mode="single"
                  selected={planDuration?.startDate || planDuration?.endDate}
                  onSelect={(selectedDate) => {
                    if (!selectedDate) return;
                    
                    // If a SMART goal is selected, toggle scheduling for that goal
                    if (selectedSmartGoal) {
                      const dateStr = format(selectedDate, 'yyyy-MM-dd');
                      setSmartGoals(prev => prev.map(goal => {
                        if (goal.id === selectedSmartGoal) {
                          const currentDates = goal.testDates || [];
                          const isAlreadyScheduled = currentDates.includes(dateStr);
                          if (isAlreadyScheduled) {
                            toast({ title: 'Test Unscheduled', description: `Removed test from ${format(selectedDate, 'PPP')}` });
                            return { ...goal, testDates: currentDates.filter(d => d !== dateStr) };
                          } else {
                            toast({ title: 'Test Scheduled', description: `Scheduled test for ${format(selectedDate, 'PPP')}` });
                            return { ...goal, testDates: [...currentDates, dateStr] };
                          }
                        }
                        return goal;
                      }));
                    } else {
                      // Original calendar selection behavior
                      handleCalendarSelect(selectedDate);
                    }
                  }}
                  modifiers={{
                    start: (date) => planDuration?.startDate ? date.getTime() === planDuration.startDate.getTime() : false,
                    end: (date) => planDuration?.endDate ? date.getTime() === planDuration.endDate.getTime() : false,
                    middle: (date) => {
                      if (!planDuration?.startDate || !planDuration?.endDate) return false;
                      return date > planDuration.startDate && date < planDuration.endDate;
                    },
                    goalScheduled: smartGoals
                      .flatMap(g => g.testDates || [])
                      .map(dateStr => parseISO(dateStr))
                  }}
                  modifiersStyles={{
                    start: { 
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    end: { 
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    middle: { 
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))'
                    },
                    goalScheduled: {
                      backgroundColor: 'hsl(38 92% 50%)',
                      color: 'white',
                      fontWeight: 'bold'
                    }
                  }}
                  className="rounded-md pointer-events-auto"
                />
              </div>
            </div>

            {planDuration && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-muted-foreground">Start: </span>
                    <span className="font-medium">{format(planDuration.startDate, 'PP')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End: </span>
                    <span className="font-medium">{format(planDuration.endDate, 'PP')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border/50">
                  <div className="text-center">
                    <span className="text-2xl font-bold">{planDuration.totalDays}</span>
                    <span className="text-sm text-muted-foreground ml-1">days</span>
                  </div>
                  <div className="text-muted-foreground">•</div>
                  <div className="text-center">
                    <span className="text-2xl font-bold">{planDuration.totalWeeks}</span>
                    <span className="text-sm text-muted-foreground ml-1">weeks</span>
                  </div>
                </div>
              </div>
            )}

            {!planDuration && (
              <p className="text-sm text-muted-foreground text-center">
                Click a date to set the start, then click another to set the end.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Goal Dialog */}
      <AddSmartGoalDialog
        open={isAddGoalDialogOpen}
        onOpenChange={(open) => {
          setIsAddGoalDialogOpen(open);
          if (!open) setEditingGoal(null);
        }}
        onAddGoal={handleAddGoal}
        onEditGoal={handleEditGoal}
        editGoal={editingGoal}
        athletePerformanceParams={athletePerformanceParams}
        athleticismParameters={athleticismParameters}
        onOpenCreateParameter={() => {
          setPendingGoalAfterParameterCreation(true);
          setIsAddGoalDialogOpen(false);
          setIsCreateParameterDialogOpen(true);
        }}
      />
      
      {/* Create Parameter Dialog */}
      <AddParameterDialogV2
        open={isCreateParameterDialogOpen}
        onOpenChange={(open) => {
          setIsCreateParameterDialogOpen(open);
          if (!open) setPendingGoalAfterParameterCreation(false);
        }}
        allParameters={athleticismParameters}
        toolboxEntries={toolboxData?.entries || []}
        onAdd={handleCreateParameter}
      />
    </div>
  );

  const renderSubGoalsForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CalendarIcon className="h-5 w-5" />
          <span>Sub-Goals & Testing</span>
        </CardTitle>
        <CardDescription>
          Define measurable sub-goals with tests and schedule events that may affect your training plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Two-column layout: Items on left, Calendar on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column: Sub-Goals & Events (compact cards) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sub-Goals & Events</h3>
              <Button
                onClick={() => {
                  setAddEventMode(true);
                  setIsAddSubGoalDialogOpen(true);
                }}
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            </div>
            
            {/* Hierarchical Sub-Goals organized under Primary Goals */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto px-1 -mx-1 pr-3">
              {smartGoals.length === 0 && subGoals.length === 0 && events.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No primary goals or sub-goals yet</p>
                  <p className="text-xs">Add primary goals in Step 1, then add sub-goals here</p>
                </div>
              )}
              
              {/* Primary Goals with nested Sub-Goals */}
              {smartGoals.map((goal) => {
                const goalSubGoals = subGoalsByParent.grouped[goal.id] || [];
                const isGoalExpanded = expandedPrimaryGoals.has(goal.id);
                
                return (
                  <div key={goal.id} className="border rounded-lg overflow-hidden">
                    {/* Primary Goal Header */}
                    <div 
                      className="p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setExpandedPrimaryGoals(prev => {
                          const next = new Set(prev);
                          if (next.has(goal.id)) {
                            next.delete(goal.id);
                          } else {
                            next.add(goal.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Target className="h-4 w-4 shrink-0 text-primary" />
                          <span className="font-medium text-sm truncate">{goal.description}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {goalSubGoals.length} sub-goal{goalSubGoals.length !== 1 ? 's' : ''}
                          </Badge>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isGoalExpanded && "rotate-180")} />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {goal.baselineValue} {goal.unit} → {goal.desiredValue} {goal.unit}
                        <Badge 
                          variant={goal.percentChange > 0 ? "default" : "secondary"}
                          className="text-xs ml-2"
                        >
                          {goal.percentChange > 0 ? "+" : ""}{goal.percentChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Nested Sub-Goals */}
                    <Collapsible open={isGoalExpanded}>
                      <CollapsibleContent>
                        <div className="border-l-2 border-primary/20 ml-4">
                          {goalSubGoals.map((subGoal) => {
                            const isExpanded = expandedSubGoals.has(subGoal.id);
                            const toggleExpand = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setExpandedSubGoals(prev => {
                                const next = new Set(prev);
                                if (next.has(subGoal.id)) {
                                  next.delete(subGoal.id);
                                } else {
                                  next.add(subGoal.id);
                                }
                                return next;
                              });
                            };
                            
                            return (
                              <div 
                                key={subGoal.id} 
                                className={cn(
                                  "p-2 pl-3 border-b last:border-b-0 transition-colors",
                                  selectedTest === subGoal.id ? "ring-2 ring-inset ring-primary bg-primary/5" : "hover:bg-muted/30"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div 
                                    className="flex-1 cursor-pointer min-w-0"
                                    onClick={() => {
                                      setSelectedTest(selectedTest === subGoal.id ? null : subGoal.id);
                                      setSelectedEvent(null);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant={subGoal.isDerived ? "secondary" : "outline"} 
                                        className={cn("text-xs shrink-0", subGoal.isDerived && "border-blue-500/50 bg-blue-500/10 text-blue-600")}
                                      >
                                        {subGoal.isDerived ? (
                                          <span className="flex items-center gap-1">
                                            <Link className="h-3 w-3" />
                                            Linked
                                          </span>
                                        ) : (
                                          "Test"
                                        )}
                                      </Badge>
                                      {subGoal.interactionStrength && (
                                        <Badge variant="outline" className="text-xs shrink-0">
                                          {subGoal.interactionStrength === 'strong' ? '↑↑' : subGoal.interactionStrength === 'moderate' ? '↑' : '→'}
                                        </Badge>
                                      )}
                                      <span className="font-medium text-sm truncate">
                                        {subGoal.testMethod || subGoal.description || "Unnamed"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {subGoal.isDerived ? (
                                        <span className="text-xs text-muted-foreground italic">
                                          Click edit to set test values
                                        </span>
                                      ) : (
                                        <>
                                          <span className="text-xs">
                                            {subGoal.preTestValue || 0} {subGoal.unit} → {subGoal.goalValue || 0} {subGoal.unit}
                                          </span>
                                          <Badge 
                                            variant={subGoal.percentChange && subGoal.percentChange > 0 ? "default" : "secondary"}
                                            className="text-xs"
                                          >
                                            {subGoal.percentChange ? `${subGoal.percentChange > 0 ? "+" : ""}${subGoal.percentChange.toFixed(1)}%` : "0%"}
                                          </Badge>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (subGoal.isDerived) {
                                          // Promote derived sub-goal before editing
                                          handlePromoteDerivedSubGoal(subGoal);
                                        } else {
                                          setEditingSubGoal(subGoal);
                                          setIsAddSubGoalDialogOpen(true);
                                        }
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={toggleExpand}
                                    >
                                      <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                    </Button>
                                    {!subGoal.isDerived && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleRemoveSubGoal(subGoal.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                <Collapsible open={isExpanded}>
                                  <CollapsibleContent>
                                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-1">
                                      {subGoal.description && (
                                        <p>{subGoal.description}</p>
                                      )}
                                      {subGoal.testDates && subGoal.testDates.length > 0 && (
                                        <p>📅 {subGoal.testDates.map(d => format(parseISO(d), 'd MMM yyyy')).join(', ')}</p>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            );
                          })}
                          
                          {/* Add Sub-Goal button for this primary goal */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-muted-foreground hover:text-foreground pl-3"
                            onClick={() => {
                              setAddSubGoalForParent(goal.id);
                              setIsAddSubGoalDialogOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Sub-Goal
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
              
              {/* Events Section */}
              {events.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">Events</span>
                    </div>
                  </div>
                  
                  <div className="divide-y">
                    {events.map((event) => {
                      const isExpanded = expandedSubGoals.has(event.id);
                      const toggleExpand = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setExpandedSubGoals(prev => {
                          const next = new Set(prev);
                          if (next.has(event.id)) {
                            next.delete(event.id);
                          } else {
                            next.add(event.id);
                          }
                          return next;
                        });
                      };
                      
                      return (
                        <div 
                          key={event.id} 
                          className={cn(
                            "p-3 transition-colors",
                            selectedEvent === event.id ? "ring-2 ring-inset ring-orange-500 bg-orange-500/5" : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div 
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => {
                                setSelectedEvent(selectedEvent === event.id ? null : event.id);
                                setSelectedTest(null);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 shrink-0">Event</Badge>
                                <span className="font-medium text-sm truncate">{event.name}</span>
                              </div>
                              {event.eventDates && event.eventDates.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  📅 {event.eventDates.map(d => format(parseISO(d), 'd MMM yyyy')).join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(event);
                                  setAddEventMode(true);
                                  setIsAddSubGoalDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeEvent(event.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Add Event Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setAddEventMode(true);
                  setIsAddSubGoalDialogOpen(true);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Event
              </Button>
              
              {/* Empty state when there are primary goals but no sub-goals */}
              {smartGoals.length > 0 && subGoals.length === 0 && events.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Expand a primary goal and click "Add Sub-Goal" to get started
                </p>
              )}
            </div>
            
            {(selectedTest || selectedEvent) && (
              <p className="text-xs text-muted-foreground text-center bg-muted/50 p-2 rounded">
                Click on a date in the calendar to schedule the selected item
              </p>
            )}
          </div>
          
          {/* Right Column: Calendar */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Calendar Scheduling</h3>
            {planDuration?.startDate && planDuration?.endDate ? (
              <div className="border rounded-lg p-4 bg-muted/30 flex flex-col items-center">
                {/* Plan Duration Summary */}
                <div className="text-center text-sm text-muted-foreground space-y-1 mb-4">
                  <p className="font-medium">Plan Duration: {planDuration.totalWeeks} weeks</p>
                  <p className="text-xs">
                    {format(planDuration.startDate, 'd MMM yyyy')} — {format(planDuration.endDate, 'd MMM yyyy')}
                  </p>
                </div>
                <Calendar
                  mode="single"
                  selected={undefined}
                  className="rounded-md"
                  disabled={(date) => {
                    return date < planDuration.startDate || date > planDuration.endDate;
                  }}
                  modifiers={{
                    start: planDuration.startDate,
                    end: planDuration.endDate,
                    middle: { 
                      from: addDays(planDuration.startDate, 1), 
                      to: addDays(planDuration.endDate, -1) 
                    },
                    scheduled: subGoals
                      .flatMap(sg => sg.testDates || [])
                      .concat(events.flatMap(e => e.eventDates || []))
                      .map(dateStr => parseISO(dateStr))
                  }}
                  modifiersStyles={{
                    start: { 
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    end: { 
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    middle: { 
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))'
                    },
                    scheduled: { 
                      backgroundColor: 'hsl(var(--primary) / 0.1)',
                      color: 'hsl(var(--primary))',
                      fontWeight: 'bold'
                    }
                  }}
                  components={{
                    Day: ({ date, ...dayProps }: any) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      
                      // Check sub-goals for scheduled tests
                      const scheduledSubGoalTests = subGoals.filter(sg => 
                        sg.testDates?.some(testDate => testDate === dateStr)
                      );
                      
                      // Check primary SMART goals for scheduled tests
                      const scheduledSmartGoalTests = smartGoals.filter(goal => 
                        goal.testDates?.some(testDate => testDate === dateStr)
                      );
                      
                      const scheduledEvents = events.filter(e => 
                        e.eventDates?.some(eventDate => eventDate === dateStr)
                      );
                      
                      // Combined check for any scheduled tests
                      const hasScheduledTests = scheduledSubGoalTests.length > 0 || scheduledSmartGoalTests.length > 0;

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
                          toast({ title: 'Select an item', description: 'Choose a sub-goal or event from the list, then click a date.' });
                        }
                      };
                      
                      // Check date type for styling (dateStr already defined above)
                      const isStartDate = planDuration.startDate && 
                        format(planDuration.startDate, 'yyyy-MM-dd') === dateStr;
                      const isEndDate = planDuration.endDate && 
                        format(planDuration.endDate, 'yyyy-MM-dd') === dateStr;
                      const isMiddleDate = planDuration.startDate && planDuration.endDate &&
                        date > planDuration.startDate && date < planDuration.endDate;

                      // Determine styling based on date type (scheduled items take priority)
                      // Priority: Combined items > Events > Primary SMART goals > Sub-goal tests > Date range styling
                      let dateStyle = '';
                      if (scheduledSmartGoalTests.length > 0 && scheduledEvents.length > 0) {
                        // Primary goal + event combined - amber to orange gradient
                        dateStyle = 'bg-gradient-to-r from-[hsl(38_92%_50%)] to-orange-500 text-white rounded-full font-bold';
                      } else if (scheduledSubGoalTests.length > 0 && scheduledEvents.length > 0) {
                        // Sub-goal + event combined
                        dateStyle = 'bg-gradient-to-r from-foreground to-orange-500 text-white rounded-full font-bold';
                      } else if (scheduledSmartGoalTests.length > 0 && scheduledSubGoalTests.length > 0) {
                        // Both primary and sub-goal tests - amber square (primary takes precedence)
                        dateStyle = 'bg-[hsl(38_92%_50%)] text-white font-bold rounded-[4px]';
                      } else if (scheduledEvents.length > 0) {
                        // Events only - orange circle
                        dateStyle = 'bg-orange-500 text-white rounded-full font-bold';
                      } else if (scheduledSmartGoalTests.length > 0) {
                        // Primary SMART goal tests only - amber square (matches Step 1)
                        dateStyle = 'bg-[hsl(38_92%_50%)] text-white font-bold rounded-[4px]';
                      } else if (scheduledSubGoalTests.length > 0) {
                        // Sub-goal tests only - black circle
                        dateStyle = 'bg-foreground text-background rounded-full font-bold';
                      } else if (isStartDate || isEndDate) {
                        dateStyle = 'bg-[hsl(142_76%_36%)] text-white font-bold rounded-[4px]';
                      } else if (isMiddleDate) {
                        dateStyle = 'bg-muted text-foreground';
                      }

                      const dayContent = (
                        <button 
                          {...dayProps}
                          onClick={handleClick}
                          className={`relative h-9 w-9 p-0 font-normal flex items-center justify-center ${dateStyle} ${dayProps.className || ''}`}
                        >
                          <span>
                            {date.getDate()}
                          </span>
                        </button>
                      );

                      // If there are scheduled items, show hover card
                      if (hasScheduledTests || scheduledEvents.length > 0) {
                        return (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              {dayContent}
                            </HoverCardTrigger>
                            <HoverCardContent className="w-64" side="top">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">
                                  {format(date, 'PPP')}
                                </h4>
                                <div className="space-y-1">
                                  {/* Primary SMART goal tests - amber styling with target icon */}
                                  {scheduledSmartGoalTests.map((goal, index) => (
                                    <div key={`smart-${index}`} className="text-xs">
                                      <div className="font-medium flex items-center gap-1 text-amber-600">
                                        <span>🎯</span>
                                        {goal.description || "Primary Goal Test"}
                                      </div>
                                      {goal.desiredValue && goal.unit && (
                                        <div className="text-muted-foreground">
                                          Target: {goal.desiredValue} {goal.unit}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {/* Sub-goal tests */}
                                  {scheduledSubGoalTests.map((test, index) => (
                                    <div key={`test-${index}`} className="text-xs">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-primary">📋</span>
                                        {test.testMethod || test.description || "Test"}
                                      </div>
                                      {test.goalValue && test.unit ? (
                                        <div className="text-muted-foreground">
                                          Target: {test.goalValue} {test.unit}
                                        </div>
                                      ) : test.description && (
                                        <div className="text-muted-foreground">{test.description}</div>
                                      )}
                                    </div>
                                  ))}
                                  {scheduledEvents.map((event, index) => (
                                    <div key={`event-${index}`} className="text-xs">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-orange-500">📅</span>
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
                
                {/* Clear button */}
                {(subGoals.some(sg => sg.testDates && sg.testDates.length > 0) || 
                  events.some(e => e.eventDates && e.eventDates.length > 0)) && (
                  <div className="mt-4 flex justify-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Clear All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear all scheduled items?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove all test and event dates from the calendar.
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
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Set plan dates in Step 1</p>
                <p className="text-xs">to enable calendar scheduling</p>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Sub-Goal Dialog */}
        <AddSubGoalDialog
          open={isAddSubGoalDialogOpen}
          onOpenChange={(open) => {
            setIsAddSubGoalDialogOpen(open);
            if (!open) {
              setAddSubGoalForParent(undefined);
              setEditingSubGoal(null);
              setEditingEvent(null);
              setAddEventMode(false);
            }
          }}
          onAddSubGoal={handleAddSubGoal}
          onEditSubGoal={handleEditSubGoal}
          editSubGoal={editingSubGoal}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          editEvent={editingEvent}
          athleticismParameters={parametersDataV2.parameters}
          athletePerformanceParams={athletePerformanceParams}
          smartGoals={smartGoals}
          defaultParentGoalId={addSubGoalForParent}
          defaultCategory={addEventMode ? "event" : undefined}
          onCreateNewParameter={handleOpenCreateParameterForSubGoal}
        />

        {/* Create Parameter Dialog for Sub-Goals */}
        <AddParameterDialogV2
          open={isCreateParameterDialogOpen}
          onOpenChange={(open) => {
            setIsCreateParameterDialogOpen(open);
            // If closing without saving and we came from sub-goal dialog, reopen it
            if (!open && shouldReopenSubGoalDialog) {
              setShouldReopenSubGoalDialog(false);
              setIsAddSubGoalDialogOpen(true);
            }
          }}
          allParameters={parametersDataV2.parameters}
          toolboxEntries={toolboxData.entries}
          onAdd={handleParameterCreatedAsSubGoal}
        />
      </CardContent>
    </Card>
  );

  // Get methods for a parameter from the parameters database
  const getMethodsForParameter = (parameterId: string) => {
    return parametersDataV2.parameterMethods.filter(pm => pm.parameterId === parameterId);
  };

  // Build hierarchical data: Primary Goals -> Methods with rationale
  const getMethodsHierarchyByGoal = () => {
    const hierarchy: Array<{
      goal: SmartGoal;
      directMethods: Array<{
        methodId: string;
        rationale?: string;
      }>;
      subGoalMethods: Array<{
        subGoal: SubGoal;
        methods: Array<{
          methodId: string;
          rationale?: string;
        }>;
      }>;
    }> = [];

    smartGoals.forEach(goal => {
      if (!goal.linkedParameterId) return;

      // Get methods that directly improve this goal's parameter
      const directMethods = getMethodsForParameter(goal.linkedParameterId);

      // Get sub-goals for this primary goal and their methods
      const allSubGoals = [...subGoals, ...derivedSubGoals].filter(
        sg => sg.parentGoalId === goal.id
      );

      const subGoalMethods = allSubGoals
        .filter(sg => sg.parameterLinkedId)
        .map(sg => ({
          subGoal: sg,
          methods: getMethodsForParameter(sg.parameterLinkedId!)
        }))
        .filter(item => item.methods.length > 0);

      if (directMethods.length > 0 || subGoalMethods.length > 0) {
        hierarchy.push({
          goal,
          directMethods: directMethods.map(m => ({
            methodId: m.methodId,
            rationale: m.rationale
          })),
          subGoalMethods
        });
      }
    });

    return hierarchy;
  };

  const renderTrainingMethodsForm = () => {
    const hierarchy = getMethodsHierarchyByGoal();
    
    // Build method usage map for duplicate detection
    const methodUsageMap = new Map<string, { context: string; goalId: string; subGoalId?: string }[]>();
    
    hierarchy.forEach(item => {
      // Track direct methods
      item.directMethods.forEach(m => {
        const existing = methodUsageMap.get(m.methodId) || [];
        methodUsageMap.set(m.methodId, [...existing, { 
          context: `Primary Goal: ${item.goal.description}`,
          goalId: item.goal.id
        }]);
      });
      // Track sub-goal methods
      item.subGoalMethods.forEach(sg => {
        sg.methods.forEach(m => {
          const existing = methodUsageMap.get(m.methodId) || [];
          methodUsageMap.set(m.methodId, [...existing, { 
            context: `Sub-Goal: ${sg.subGoal.description}`,
            goalId: item.goal.id,
            subGoalId: sg.subGoal.id
          }]);
        });
      });
    });
    
    // Helper to get other usages of a method
    const getOtherUsages = (methodId: string, currentGoalId: string, currentSubGoalId?: string) => {
      const allUsages = methodUsageMap.get(methodId) || [];
      return allUsages.filter(u => {
        if (currentSubGoalId) {
          // We're in a sub-goal context, filter out this exact sub-goal
          return u.subGoalId !== currentSubGoalId;
        } else {
          // We're in a primary goal context, filter out this goal's direct methods
          return u.goalId !== currentGoalId || u.subGoalId !== undefined;
        }
      });
    };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Training Methods Overview</span>
          </CardTitle>
          <CardDescription>
            Hierarchical overview of training methods organized by primary goals, showing the rationale for each method.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hierarchy.length > 0 ? (
            <div className="space-y-8">
              {hierarchy.map((item) => (
                <div key={item.goal.id} className="space-y-4">
                  {/* Primary Goal Header */}
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">Primary Goal: {item.goal.description}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Baseline: {item.goal.baselineValue} {item.goal.unit} → Target: {item.goal.desiredValue} {item.goal.unit}
                      {item.goal.percentChange !== 0 && (
                        <span className="ml-2">
                          ({item.goal.percentChange > 0 ? '+' : ''}{item.goal.percentChange.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Direct Methods for Primary Goal */}
                  {item.directMethods.length > 0 && (
                    <div className="ml-4 space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Methods directly linked to this goal:
                      </Label>
                      <div className="space-y-2">
                        {item.directMethods.map((method, idx) => {
                          const otherUsages = getOtherUsages(method.methodId, item.goal.id);
                          return (
                            <div key={idx} className="p-3 border rounded-md bg-background">
                              <div className="flex items-start gap-2">
                                <div className="w-1 h-full bg-primary rounded-full" />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-sm">{method.methodId}</div>
                                    {otherUsages.length > 0 && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Link2 className="h-3 w-3" />
                                        <span>Also linked to: {otherUsages.map(u => u.context).join(', ')}</span>
                                      </div>
                                    )}
                                  </div>
                                  {method.rationale && (
                                    <div className="text-sm text-muted-foreground mt-1">
                                      <span className="font-medium">Rationale:</span> {method.rationale}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sub-Goals & Their Methods */}
                  {item.subGoalMethods.length > 0 && (
                    <div className="ml-4 space-y-3">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Sub-Goals & Their Methods:
                      </Label>
                      {item.subGoalMethods.map((sgItem) => (
                        <div key={sgItem.subGoal.id} className="border rounded-lg p-3 bg-muted/20">
                          {/* Sub-goal header */}
                          <div className="flex items-center gap-2 text-sm mb-3">
                            <Badge variant="secondary" className="font-medium">
                              {sgItem.subGoal.description}
                              {sgItem.subGoal.interactionStrength && (
                                <span className="ml-1 opacity-70">
                                  ({sgItem.subGoal.interactionStrength})
                                </span>
                              )}
                            </Badge>
                            <span className="text-muted-foreground text-xs">→ contributes to {item.goal.description}</span>
                          </div>
                          
                          {/* Methods for this sub-goal */}
                          <div className="space-y-2 ml-2">
                            {sgItem.methods.map((method, idx) => {
                              const otherUsages = getOtherUsages(method.methodId, item.goal.id, sgItem.subGoal.id);
                              return (
                                <div key={idx} className="p-3 border rounded-md bg-background">
                                  <div className="flex items-start gap-2">
                                    <div className="w-1 h-full bg-secondary rounded-full" />
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="font-medium text-sm">{method.methodId}</div>
                                        {otherUsages.length > 0 && (
                                          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                            <Link2 className="h-3 w-3" />
                                            <span>Also linked to: {otherUsages.map(u => u.context).join(', ')}</span>
                                          </div>
                                        )}
                                      </div>
                                      {method.rationale && (
                                        <div className="text-sm text-muted-foreground mt-1">
                                          <span className="font-medium">Rationale:</span> {method.rationale}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Target className="h-12 w-12 mx-auto opacity-30" />
              <p className="font-medium">No training methods configured yet</p>
              <p className="text-sm">
                Link parameters to your primary goals and add training methods in the Athleticism Database 
                to see them organized here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const stepTitles = [
    "Plan Setup & Goals",
    "Sub-Goals & Testing",
    "Training Methods"
  ];

  const canProceedFromStep1 = (): boolean => {
    return planName.trim().length > 0 && selectedAthleteId !== null;
  };

  const handleNext = () => {
    // Validate Step 1 before proceeding
    if (currentStep === 1 && !canProceedFromStep1()) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter a plan name and select an athlete before continuing.",
        variant: "destructive"
      });
      return;
    }

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
        {/* Step 1: Plan Setup & Goals */}
        <div id="plan-setup-goals" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">1. Plan Setup & Goals</h2>
          {renderPlanAndGoalSetup()}
        </div>

        {/* Step 2: Sub-Goals */}
        <div id="sub-goals" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">2. Sub-Goals & Testing</h2>
          {renderSubGoalsForm()}
        </div>

        {/* Step 3: Training Methods */}
        <div id="methods" className="space-y-4">
          <h2 className="text-2xl font-semibold border-b pb-2">3. Training Methods</h2>
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
        {currentStep === 1 && renderPlanAndGoalSetup()}
        {currentStep === 2 && renderSubGoalsForm()}
        {currentStep === 3 && renderTrainingMethodsForm()}
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