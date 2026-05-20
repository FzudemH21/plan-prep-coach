import { useState, useEffect, useMemo, useCallback } from "react";
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
import { User, Target, Calendar as CalendarIcon, Plus, Bot, X, Trash2, FileText, Check, ChevronsUpDown, ChevronDown, Pencil, Link, Link2, CheckSquare } from "lucide-react";
import { ResourcesButton } from "@/components/programs/ResourcesButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  getUniqueQualities, 
  getUniqueTrainingMethods
} from "@/data/trainingData";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useParametersDataV2 } from "@/hooks/useParametersDataV2";
import { PlanningNavigationMenu } from "@/components/ui/planning-navigation-menu";
import { format, parseISO, addDays, differenceInDays } from "date-fns";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName, Athlete } from "@/types/athlete";
import { cn } from "@/lib/utils";
import { AddSmartGoalDialog, AddSubGoalDialog, AddAdditionalMethodDialog } from "@/components/macrocycle";
import { AddParameterDialogV2 } from "@/components/goals/AddParameterDialogV2";
import { useToolboxData } from "@/hooks/useToolboxData";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { SaveProgramButton } from "@/components/programs/SaveProgramButton";
import { WizardAIAssistant } from "@/components/wizard/WizardAIAssistant";
import { useRAGRetrieval } from "@/hooks/useRAGRetrieval";
import { useGlobalAIContext } from "@/hooks/useGlobalAIContext";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TEST_COLOR, EVENT_COLOR, testEventGradient } from "@/lib/eventColors";
import { useWizardData } from "@/contexts/WizardDataContext";

// Type for manually added methods with rationale
interface ManuallyAddedMethod {
  methodId: string;
  rationale?: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function MacrocyclePage() {
  const { displayMode } = useDisplayMode();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { saveCurrentSession, getProgram } = useTrainingPrograms();
  const { setMacrocycleData: setContextMacrocycleData } = useWizardData();
  const { getEventsForDate } = useCalendarEvents();
  const { data: parametersDataV2, addParameter: addAthleticismParameter, addInteraction: addParameterInteraction } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();
  const { athletes, groups, getAthletePerformanceParameters, addPerformanceParameter, getAthleteBiometrics, biometricDefinitions, getAthleteCalendarAssignments } = useAthletes();
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  const [athleteDropdownOpen, setAthleteDropdownOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [planName, setPlanName] = useState<string>("");
  const [planNotes, setPlanNotes] = useState<string>("");
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

  // State for selected methods in Training Methods overview
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());

  // State for manually added methods with rationale
  const [manuallyAddedMethods, setManuallyAddedMethods] = useState<ManuallyAddedMethod[]>([]);
  const [isAddMethodDialogOpen, setIsAddMethodDialogOpen] = useState(false);
  const [editingMethodRationale, setEditingMethodRationale] = useState<string | null>(null);
  const [editingRationaleValue, setEditingRationaleValue] = useState("");
  const [showMissingRationaleWarning, setShowMissingRationaleWarning] = useState(false);

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
        setPlanNotes(data.planNotes || "");
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
            percentChange: g.percentChange ?? 0,
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
        
        // Load selected methods if saved
        if (data.selectedMethods && Array.isArray(data.selectedMethods)) {
          setSelectedMethods(new Set(data.selectedMethods));
        }
        
        // Load manually added methods with rationale
        if (data.manuallyAddedMethods && Array.isArray(data.manuallyAddedMethods)) {
          setManuallyAddedMethods(data.manuallyAddedMethods);
        }
      } catch (error) {
        console.error('Error loading saved macrocycle data:', error);
      }
    }
    
    if (savedStep) {
      try {
        const parsed = parseInt(savedStep);
        // Clamp to valid range [1, totalSteps] to prevent blank UI
        const clamped = isNaN(parsed) ? 1 : Math.max(1, Math.min(3, parsed));
        setCurrentStep(clamped);
        // Rewrite localStorage if we had to clamp
        if (clamped !== parsed) {
          localStorage.setItem('macrocycleStep', clamped.toString());
        }
      } catch (error) {
        console.error('Error loading saved step:', error);
        setCurrentStep(1);
      }
    }
  }, []);

  // Derive athlete's existing tests & events from their calendar assignments
  const athleteExistingTestsAndEvents = useMemo(() => {
    if (!selectedAthleteId) return { tests: [], events: [] };
    const assignments = getAthleteCalendarAssignments(selectedAthleteId);
    console.log('[athleteExistingTestsAndEvents] athleteId:', selectedAthleteId);
    console.log('[athleteExistingTestsAndEvents] assignments:', assignments.length, assignments.map(a => ({
      id: a.id,
      programName: a.programName,
      reviewedSubGoals: a.reviewedSubGoals?.length ?? 'undefined',
      reviewedEvents: a.reviewedEvents?.length ?? 'undefined',
    })));
    const tests: Array<{ testMethod: string; testDates: string[] }> = [];
    const events: Array<{ name: string; eventDates: string[] }> = [];
    assignments.forEach(assignment => {
      console.log('[athleteExistingTestsAndEvents] assignment object:', JSON.parse(JSON.stringify(assignment)));

      if (assignment.reviewedSubGoals !== undefined || assignment.reviewedEvents !== undefined) {
        // Primary path: assignment was created with reviewedSubGoals/reviewedEvents
        (assignment.reviewedSubGoals || []).forEach(sg => {
          if (sg.scheduledDates && sg.scheduledDates.length > 0) {
            tests.push({ testMethod: sg.testMethod || 'Test', testDates: sg.scheduledDates });
          }
        });
        (assignment.reviewedEvents || []).forEach(ev => {
          if (ev.scheduledDates && ev.scheduledDates.length > 0) {
            events.push({ name: ev.name || 'Event', eventDates: ev.scheduledDates });
          }
        });
      } else {
        // Fallback path: old assignment without reviewedSubGoals/reviewedEvents –
        // read directly from the program's macrocycleData and apply date offset
        const program = getProgram(assignment.programId);
        const macro = program?.macrocycleData;
        console.log('[athleteExistingTestsAndEvents] fallback → program:', program?.name, 'macro subGoals:', macro?.subGoals?.length ?? 0, 'events:', macro?.events?.length ?? 0);
        if (macro) {
          const originalStart = assignment.originalStartDate ? new Date(assignment.originalStartDate) : null;
          const assignedStart = new Date(assignment.startDate);
          const dayOffset = originalStart ? differenceInDays(assignedStart, originalStart) : 0;

          (macro.subGoals || []).forEach(sg => {
            const shiftedDates = (sg.testDates || []).map(d => addDays(new Date(d), dayOffset).toISOString());
            if (shiftedDates.length > 0) {
              tests.push({ testMethod: sg.testMethod || 'Test', testDates: shiftedDates });
            }
          });
          (macro.events || []).forEach(ev => {
            const shiftedDates = (ev.eventDates || []).map(d => addDays(new Date(d), dayOffset).toISOString());
            if (shiftedDates.length > 0) {
              events.push({ name: ev.name || 'Event', eventDates: shiftedDates });
            }
          });
        }
      }
    });
    console.log('[athleteExistingTestsAndEvents] result → tests:', tests, 'events:', events);
    return { tests, events };
  }, [selectedAthleteId, getAthleteCalendarAssignments, getProgram]);

  // Save data whenever form data changes (continuous saving)
  useEffect(() => {
    // Always include planDuration dates in legacy smartGoal for backward compatibility
    const legacySmartGoal = {
      ...(smartGoals.length > 0 ? smartGoals[0] : smartGoal),
      startDate: planDuration?.startDate,
      endDate: planDuration?.endDate,
      totalDays: planDuration?.totalDays,
      totalWeeks: planDuration?.totalWeeks,
    };
    
    const macrocycleData = {
      planName,
      planNotes,
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
      selectedMethods: Array.from(selectedMethods),
      manuallyAddedMethods, // Save manually added methods
      athleteExistingTests: athleteExistingTestsAndEvents.tests,
      athleteExistingEvents: athleteExistingTestsAndEvents.events,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
    setContextMacrocycleData(macrocycleData);
  }, [planName, planNotes, selectedAthleteId, planDuration, smartGoals, smartGoal, subGoals, events, qualities, qualitiesBySubGoal, methodsByQuality, selectedTest, selectedEvent, selectedMethods, manuallyAddedMethods, athleteExistingTestsAndEvents]);

  // Save step whenever it changes (step persistence)
  useEffect(() => {
    localStorage.setItem('macrocycleStep', currentStep.toString());
  }, [currentStep]);

  // RAG retrieval — refresh when goals or methods change
  useEffect(() => {
    const goalNames = smartGoals.map(g => g.description || g.specific || '').filter(Boolean).join(', ');
    const methodNames = Array.from(selectedMethods).join(', ');
    const query = [goalNames, methodNames].filter(Boolean).join('; ') || 'training plan goal setting periodization';
    ragRetrieve(query).then(setRagContext);
  }, [ragRetrieve, smartGoals, selectedMethods]);

  // Auto-select methods linked to primary goals (only on initial load or when goals change significantly)
  useEffect(() => {
    // Only auto-select if selectedMethods is empty (initial state)
    if (selectedMethods.size > 0) return;
    
    const primaryGoalMethods = new Set<string>();
    smartGoals.forEach(goal => {
      if (goal.linkedParameterId) {
        const methods = parametersDataV2.parameterMethods.filter(
          pm => pm.parameterId === goal.linkedParameterId
        );
        methods.forEach(m => primaryGoalMethods.add(m.methodId));
      }
    });
    
    if (primaryGoalMethods.size > 0) {
      setSelectedMethods(primaryGoalMethods);
    }
  }, [smartGoals, parametersDataV2.parameterMethods]);

  // Helper function to get unique sub-goals from athleticism database (v1 removed - returns empty)
  const getSubGoalsFromAthleticismDB = (): string[] => {
    return [];
  };

  // Helper function to get qualities for a sub-goal from athleticism database (v1 removed - returns empty)
  const getQualitiesForSubGoalFromDB = (_subGoalLabel: string): string[] => {
    return [];
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

  // Helper function to get methods with their sub-goals and qualities (v1 removed - returns empty)
  const getMethodsWithSubGoalsAndQualities = () => {
    return [];
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
  }, [subGoals]);

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
  }, [qualitiesBySubGoal]);

  // Auto-populate training methods when qualities change
  useEffect(() => {
    setMethodsByQuality(prevMethods => {
      const nextMethods: Record<string, { subGoalLabel: string; qualityName: string; list: string[] }> = {};
      
      qualities.forEach(quality => {
        const [subGoalId, qualityName] = quality.id.split('::');
        const subGoal = subGoals.find(sg => sg.id === subGoalId);
        
        if (subGoal && qualityName) {
          const existing = prevMethods[quality.id];
          if (true) {
            // v1 athleticism database removed - no auto-populated recommended methods
            const recommendedMethods: string[] = [];
            
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
  }, [qualities, subGoals, qualitiesBySubGoal]);

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
    const totalSubGoalTests = subGoals.reduce((sum, sg) => sum + (sg.testDates?.length || 0), 0);
    const totalSmartGoalTests = smartGoals.reduce((sum, g) => sum + (g.testDates?.length || 0), 0);
    const totalTests = totalSubGoalTests + totalSmartGoalTests;
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

    // Clear all test dates from sub-goals and smart goals
    setSubGoals(prev => prev.map(sg => ({
      ...sg,
      testDates: []
    })));
    setSmartGoals(prev => prev.map(g => ({
      ...g,
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

      {/* Notes / Brainstorming */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Notes & Brainstorming</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={planNotes}
            onChange={(e) => setPlanNotes(e.target.value)}
            placeholder="Notizen, Überlegungen, Ideen zum Plan..."
            className="min-h-[120px] resize-y"
          />
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
                  className="p-3 border rounded-lg flex items-start justify-between gap-3 bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{goal.description}</span>
                      <Badge
                        variant={(goal.percentChange ?? 0) < 0 ? "destructive" : "default"}
                        className="shrink-0"
                      >
                        {(goal.percentChange ?? 0) > 0 ? "+" : ""}{(goal.percentChange ?? 0).toFixed(1)}%
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
                    handleCalendarSelect(selectedDate);
                  }}
                  modifiers={{
                    start: (date) => planDuration?.startDate ? date.getTime() === planDuration.startDate.getTime() : false,
                    end: (date) => planDuration?.endDate ? date.getTime() === planDuration.endDate.getTime() : false,
                    middle: (date) => {
                      if (!planDuration?.startDate || !planDuration?.endDate) return false;
                      return date > planDuration.startDate && date < planDuration.endDate;
                    },
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
                    }
                  }}
                  className="rounded-md pointer-events-auto"
                />
                {planDuration && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setPlanDuration(undefined);
                        setSelectionPhase('start');
                        toast({ title: 'Calendar Cleared', description: 'Start and end dates have been removed.' });
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear Dates
                    </Button>
                  </div>
                )}
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
                    <div className="p-3 bg-muted/30 flex items-start gap-2">
                      {/* Expand Arrow - separate button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 mt-0.5 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
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
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isGoalExpanded && "rotate-180")} />
                      </Button>
                      
                      {/* Goal Content - clickable for selection */}
                      <div 
                        className={cn(
                          "flex-1 cursor-pointer transition-colors rounded p-1 -m-1 min-w-0",
                          selectedSmartGoal === goal.id 
                            ? "ring-2 ring-inset ring-primary bg-primary/5" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => {
                          setSelectedSmartGoal(selectedSmartGoal === goal.id ? null : goal.id);
                          setSelectedTest(null);
                          setSelectedEvent(null);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Target className="h-4 w-4 shrink-0 text-primary" />
                            <span className="font-medium text-sm truncate">{goal.description}</span>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {goalSubGoals.length} sub-goal{goalSubGoals.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {goal.baselineValue} {goal.unit} → {goal.desiredValue} {goal.unit}
                          <Badge
                            variant={(goal.percentChange ?? 0) > 0 ? "default" : "secondary"}
                            className="text-xs ml-2"
                          >
                            {(goal.percentChange ?? 0) > 0 ? "+" : ""}{(goal.percentChange ?? 0).toFixed(1)}%
                          </Badge>
                        </div>
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
                                      setSelectedSmartGoal(null);  // Clear main goal selection
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
                                setSelectedSmartGoal(null);
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
            
            {(selectedSmartGoal || selectedTest || selectedEvent) && (
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

                      // Athlete's existing tests & events (from calendar assignments)
                      // Use startsWith to handle both 'yyyy-MM-dd' and ISO strings ('yyyy-MM-ddT...')
                      const athleteExistingTestsOnDay = athleteExistingTestsAndEvents.tests.filter(t =>
                        t.testDates?.some(td => td.startsWith(dateStr))
                      );
                      const athleteExistingEventsOnDay = athleteExistingTestsAndEvents.events.filter(e =>
                        e.eventDates?.some(ed => ed.startsWith(dateStr))
                      );
                      if (athleteExistingTestsOnDay.length > 0 || athleteExistingEventsOnDay.length > 0) {
                        console.log('[Day] athlete items on', dateStr, '→ tests:', athleteExistingTestsOnDay, 'events:', athleteExistingEventsOnDay);
                      }

                      const handleClick = (e: any) => {
                        dayProps?.onClick?.(e);
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Handle primary (SMART) goal scheduling
                        if (selectedSmartGoal) {
                          setSmartGoals(prev => prev.map(goal => {
                            if (goal.id === selectedSmartGoal) {
                              const currentDates = goal.testDates || [];
                              const isAlreadyScheduled = currentDates.includes(dateStr);
                              if (isAlreadyScheduled) {
                                toast({ title: 'Test Unscheduled', description: `Removed test from ${format(date, 'PPP')}` });
                                return { ...goal, testDates: currentDates.filter(d => d !== dateStr) };
                              } else {
                                toast({ title: 'Test Scheduled', description: `Scheduled test for ${format(date, 'PPP')}` });
                                return { ...goal, testDates: [...currentDates, dateStr] };
                              }
                            }
                            return goal;
                          }));
                        } else if (selectedTest) {
                          // First check user-created subGoals
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
                          } else {
                            // Check if it's a derived sub-goal and "promote" it
                            const derivedSubGoal = derivedSubGoals.find(sg => sg.id === selectedTest);
                            if (derivedSubGoal) {
                              const promotedSubGoal: SubGoal = {
                                ...derivedSubGoal,
                                testDates: [dateStr],
                                isDerived: false,
                              };
                              setSubGoals(prev => [...prev, promotedSubGoal]);
                              toast({ 
                                title: 'Test Scheduled', 
                                description: `Scheduled "${derivedSubGoal.description}" for ${format(date, 'PPP')}` 
                              });
                            }
                          }
                        } else if (selectedEvent) {
                          scheduleEvent(selectedEvent, date);
                        } else {
                          toast({ title: 'Select an item', description: 'Choose a goal, sub-goal, or event from the list, then click a date.' });
                        }
                      };
                      
                      // Check date type for styling (dateStr already defined above)
                      const isStartDate = planDuration.startDate && 
                        format(planDuration.startDate, 'yyyy-MM-dd') === dateStr;
                      const isEndDate = planDuration.endDate && 
                        format(planDuration.endDate, 'yyyy-MM-dd') === dateStr;
                      const isMiddleDate = planDuration.startDate && planDuration.endDate &&
                        date > planDuration.startDate && date < planDuration.endDate;

                      // Combine both sources: plan-state tests/events + calendarEvents hook (athlete-bound)
                      const hasPlanTests = scheduledSubGoalTests.length > 0 || scheduledSmartGoalTests.length > 0 || athleteExistingTestsOnDay.length > 0;
                      const hasPlanEvents = scheduledEvents.length > 0 || athleteExistingEventsOnDay.length > 0;
                      const hookItems = selectedAthleteId ? getEventsForDate(selectedAthleteId, dateStr) : [];
                      const hasHookTests = hookItems.some(e => e.type === 'test');
                      const hasHookEvents = hookItems.some(e => e.type === 'event');

                      // Unified: treat both sources equally
                      const hasAnyTests = hasPlanTests || hasHookTests;
                      const hasAnyEvents = hasPlanEvents || hasHookEvents;

                      // Circle style — same amber/blue for both sources
                      let circleClass = '';
                      let circleInlineStyle: React.CSSProperties | undefined;
                      if (hasAnyTests && hasAnyEvents) {
                        circleClass = 'rounded-full text-white font-bold';
                        circleInlineStyle = { background: testEventGradient() };
                      } else if (hasAnyTests) {
                        circleClass = 'rounded-full text-white font-bold';
                        circleInlineStyle = { background: TEST_COLOR };
                      } else if (hasAnyEvents) {
                        circleClass = 'rounded-full text-white font-bold';
                        circleInlineStyle = { background: EVENT_COLOR };
                      }

                      // Start/end/middle styles only apply when no test/event circle
                      let dateStyle = '';
                      if (!circleInlineStyle) {
                        if (isStartDate || isEndDate) {
                          dateStyle = 'bg-[hsl(142_76%_36%)] text-white font-bold rounded-[4px]';
                        } else if (isMiddleDate) {
                          dateStyle = 'bg-muted text-foreground';
                        }
                      }

                      const dayContent = (
                        <button
                          {...dayProps}
                          onClick={handleClick}
                          className={`relative h-9 w-9 p-0 font-normal flex items-center justify-center ${dateStyle} ${circleClass} ${dayProps.className || ''}`}
                          style={circleInlineStyle}
                        >
                          <span>
                            {date.getDate()}
                          </span>
                        </button>
                      );

                      // If there are scheduled items, show hover card
                      if (hasAnyTests || hasAnyEvents) {
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
                                  {/* Athlete existing tests */}
                                  {athleteExistingTestsOnDay.map((t, index) => (
                                    <div key={`ath-test-${index}`} className="text-xs">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-orange-500">📋</span>
                                        {t.testMethod || 'Test'} <span className="font-normal text-muted-foreground">(Athlete)</span>
                                      </div>
                                    </div>
                                  ))}
                                  {/* Athlete existing events */}
                                  {athleteExistingEventsOnDay.map((e, index) => (
                                    <div key={`ath-event-${index}`} className="text-xs">
                                      <div className="font-medium flex items-center gap-1">
                                        <span className="text-orange-500">📅</span>
                                        {e.name || 'Event'} <span className="font-normal text-muted-foreground">(Athlete)</span>
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
                
                {/* Clear button - always visible */}
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

  // Build a flat list of all methods with their parameter associations
  type MethodAssociation = {
    parameterId: string;
    parameterName: string;
    isPrimaryGoal: boolean;
    goalDescription?: string;
    rationale?: string;
  };

  type MethodWithAssociations = {
    methodId: string;
    associations: MethodAssociation[];
  };

  const getAllMethodsWithAssociations = (): MethodWithAssociations[] => {
    const methodMap = new Map<string, MethodAssociation[]>();
    
    // Helper to get parameter name
    const getParameterName = (parameterId: string): string => {
      const param = parametersDataV2.parameters.find(p => p.id === parameterId);
      return param?.name || parameterId;
    };
    
    // Get all primary goal parameter IDs
    const primaryGoalParameterIds = new Set(
      smartGoals.filter(g => g.linkedParameterId).map(g => g.linkedParameterId!)
    );
    
    // Get all sub-goal parameter IDs with their parent goal info
    const allSubGoals = [...subGoals, ...derivedSubGoals];
    const subGoalToParentGoal = new Map<string, SmartGoal>();
    allSubGoals.forEach(sg => {
      const parentGoal = smartGoals.find(g => g.id === sg.parentGoalId);
      if (sg.parameterLinkedId && parentGoal) {
        subGoalToParentGoal.set(sg.parameterLinkedId, parentGoal);
      }
    });
    
    // Process all parameter methods
    parametersDataV2.parameterMethods.forEach(pm => {
      const existing = methodMap.get(pm.methodId) || [];
      const parameterName = getParameterName(pm.parameterId);
      
      // Check if this is a primary goal
      const isPrimaryGoal = primaryGoalParameterIds.has(pm.parameterId);
      const primaryGoal = smartGoals.find(g => g.linkedParameterId === pm.parameterId);
      
      // Check if this is a sub-goal
      const parentGoal = subGoalToParentGoal.get(pm.parameterId);
      
      // Only include methods that are related to our goals
      if (isPrimaryGoal || parentGoal) {
        existing.push({
          parameterId: pm.parameterId,
          parameterName,
          isPrimaryGoal,
          goalDescription: isPrimaryGoal ? primaryGoal?.description : parentGoal?.description,
          rationale: pm.rationale,
        });
        methodMap.set(pm.methodId, existing);
      }
    });
    
    // Convert to array
    return Array.from(methodMap.entries()).map(([methodId, associations]) => ({
      methodId,
      associations,
    }));
  };

  const toggleMethodSelection = (methodId: string, checked: boolean) => {
    setSelectedMethods(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(methodId);
      } else {
        newSet.delete(methodId);
      }
      return newSet;
    });
  };

  // Get all methods that are already shown (linked to goals)
  const getLinkedMethodIds = (): Set<string> => {
    const allMethods = getAllMethodsWithAssociations();
    return new Set(allMethods.map(m => m.methodId));
  };

  // Handle adding a manually added method
  const handleAddManualMethod = (method: { methodId: string; rationale: string }) => {
    setManuallyAddedMethods(prev => [...prev, method]);
    // Also select it
    setSelectedMethods(prev => new Set([...prev, method.methodId]));
    toast({
      title: "Method Added",
      description: `${method.methodId} has been added to your training plan.`
    });
  };

  // Handle removing a manually added method
  const handleRemoveManualMethod = (methodId: string) => {
    setManuallyAddedMethods(prev => prev.filter(m => m.methodId !== methodId));
    // Also deselect it
    setSelectedMethods(prev => {
      const newSet = new Set(prev);
      newSet.delete(methodId);
      return newSet;
    });
  };

  // Handle updating rationale for a manually added method
  const handleUpdateMethodRationale = (methodId: string, newRationale: string) => {
    setManuallyAddedMethods(prev => 
      prev.map(m => m.methodId === methodId ? { ...m, rationale: newRationale } : m)
    );
    setEditingMethodRationale(null);
    setEditingRationaleValue("");
  };

  // Get methods without rationale for warning
  const getMethodsWithoutRationale = (): string[] => {
    return manuallyAddedMethods
      .filter(m => !m.rationale?.trim())
      .map(m => m.methodId);
  };

  const renderTrainingMethodsForm = () => {
    const allMethods = getAllMethodsWithAssociations();
    const hasAnyMethods = allMethods.length > 0;
    
    // Separate methods into primary-goal-linked and other methods
    const primaryMethods = allMethods.filter(m => 
      m.associations.some(a => a.isPrimaryGoal)
    );
    const otherMethods = allMethods.filter(m => 
      !m.associations.some(a => a.isPrimaryGoal)
    );
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckSquare className="h-5 w-5" />
            <span>Select Training Methods</span>
          </CardTitle>
          <CardDescription>
            Select the methods to include in your training plan. Methods linked to primary goals are selected by default.
            Each method shows the parameters it's linked to and the rationale for each.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasAnyMethods ? (
            <div className="space-y-6">
              {/* Selection Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">
                  {selectedMethods.size} of {allMethods.length} methods selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMethods(new Set(allMethods.map(m => m.methodId)))}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMethods(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Primary Goal Methods */}
              {primaryMethods.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Methods Linked to Primary Goals
                  </Label>
                  <div className="space-y-2">
                    {primaryMethods.map(method => (
                      <div 
                        key={method.methodId} 
                        className={cn(
                          "flex items-start gap-3 p-4 border rounded-lg transition-colors",
                          selectedMethods.has(method.methodId) 
                            ? "bg-primary/5 border-primary/30" 
                            : "bg-background hover:bg-muted/50"
                        )}
                      >
                        <Checkbox 
                          id={method.methodId}
                          checked={selectedMethods.has(method.methodId)}
                          onCheckedChange={(checked) => toggleMethodSelection(method.methodId, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <label 
                            htmlFor={method.methodId}
                            className="font-medium text-sm cursor-pointer"
                          >
                            {method.methodId}
                          </label>
                          <div className="space-y-1.5">
                            {method.associations.map((assoc, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <Badge 
                                  variant={assoc.isPrimaryGoal ? "default" : "outline"}
                                  className={cn(
                                    "shrink-0",
                                    !assoc.isPrimaryGoal && "bg-muted text-foreground border-black"
                                  )}
                                >
                                  {assoc.parameterName}
                                  {assoc.isPrimaryGoal && " (Primary)"}
                                </Badge>
                                {assoc.rationale && (
                                  <span className="text-muted-foreground italic">
                                    "{assoc.rationale}"
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Methods (Sub-goal linked) */}
              {otherMethods.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Methods Linked to Sub-Goals
                  </Label>
                  <div className="space-y-2">
                    {otherMethods.map(method => (
                      <div 
                        key={method.methodId} 
                        className={cn(
                          "flex items-start gap-3 p-4 border rounded-lg transition-colors",
                          selectedMethods.has(method.methodId) 
                            ? "bg-secondary/20 border-secondary/50" 
                            : "bg-background hover:bg-muted/50"
                        )}
                      >
                        <Checkbox 
                          id={method.methodId}
                          checked={selectedMethods.has(method.methodId)}
                          onCheckedChange={(checked) => toggleMethodSelection(method.methodId, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <label 
                            htmlFor={method.methodId}
                            className="font-medium text-sm cursor-pointer"
                          >
                            {method.methodId}
                          </label>
                          <div className="space-y-1.5">
                            {method.associations.map((assoc, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <Badge variant="outline" className="shrink-0 bg-muted text-foreground border-black">
                                  {assoc.parameterName}
                                </Badge>
                                {assoc.goalDescription && (
                                  <span className="text-xs text-muted-foreground">
                                    → contributes to {assoc.goalDescription}
                                  </span>
                                )}
                                {assoc.rationale && (
                                  <span className="text-muted-foreground italic ml-1">
                                    "{assoc.rationale}"
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Training Methods Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Additional Training Methods
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add any other training methods not linked to your goals. Provide a rationale for each.
                </p>
                
                {/* Add Method Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddMethodDialogOpen(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Training Method
                </Button>

                {/* List of manually added methods */}
                {manuallyAddedMethods.length > 0 && (
                  <div className="space-y-2">
                    {manuallyAddedMethods.map(method => (
                      <div 
                        key={method.methodId} 
                        className={cn(
                          "flex items-start gap-3 p-4 border rounded-lg transition-colors",
                          selectedMethods.has(method.methodId) 
                            ? "bg-accent/20 border-accent/50" 
                            : "bg-background hover:bg-muted/50"
                        )}
                      >
                        <Checkbox 
                          id={`manual-${method.methodId}`}
                          checked={selectedMethods.has(method.methodId)}
                          onCheckedChange={(checked) => toggleMethodSelection(method.methodId, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <label 
                              htmlFor={`manual-${method.methodId}`}
                              className="font-medium text-sm cursor-pointer"
                            >
                              {method.methodId}
                            </label>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Manually Added
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveManualMethod(method.methodId)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Rationale section */}
                          {editingMethodRationale === method.methodId ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingRationaleValue}
                                onChange={(e) => setEditingRationaleValue(e.target.value)}
                                placeholder="Why are you including this method?"
                                className="min-h-[60px] text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateMethodRationale(method.methodId, editingRationaleValue)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingMethodRationale(null);
                                    setEditingRationaleValue("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              {method.rationale ? (
                                <p className="text-sm text-muted-foreground italic flex-1">
                                  "{method.rationale}"
                                </p>
                              ) : (
                                <p className="text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-1 flex-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  No rationale provided
                                </p>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  setEditingMethodRationale(method.methodId);
                                  setEditingRationaleValue(method.rationale || "");
                                }}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                {method.rationale ? "Edit" : "Add Rationale"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Empty state but still show Add Method option */}
              <div className="text-center py-8 text-muted-foreground space-y-2">
                <CheckSquare className="h-12 w-12 mx-auto opacity-30" />
                <p className="font-medium">No goal-linked methods yet</p>
                <p className="text-sm">
                  Link parameters to your primary goals and add training methods in the Athleticism Database.
                </p>
              </div>
              
              {/* Still allow adding additional methods */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Additional Training Methods
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddMethodDialogOpen(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Training Method
                </Button>

                {/* List of manually added methods */}
                {manuallyAddedMethods.length > 0 && (
                  <div className="space-y-2">
                    {manuallyAddedMethods.map(method => (
                      <div 
                        key={method.methodId} 
                        className={cn(
                          "flex items-start gap-3 p-4 border rounded-lg transition-colors bg-accent/20 border-accent/50"
                        )}
                      >
                        <Checkbox 
                          id={`manual-empty-${method.methodId}`}
                          checked={selectedMethods.has(method.methodId)}
                          onCheckedChange={(checked) => toggleMethodSelection(method.methodId, !!checked)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <label 
                              htmlFor={`manual-empty-${method.methodId}`}
                              className="font-medium text-sm cursor-pointer"
                            >
                              {method.methodId}
                            </label>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRemoveManualMethod(method.methodId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {method.rationale ? (
                            <p className="text-sm text-muted-foreground italic">"{method.rationale}"</p>
                          ) : (
                            <p className="text-sm text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              No rationale provided
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add Method Dialog */}
          <AddAdditionalMethodDialog
            open={isAddMethodDialogOpen}
            onOpenChange={setIsAddMethodDialogOpen}
            onAdd={handleAddManualMethod}
            excludedMethods={new Set([...getLinkedMethodIds(), ...manuallyAddedMethods.map(m => m.methodId)])}
          />
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
      // Check for methods without rationale
      const methodsWithoutRationale = getMethodsWithoutRationale();
      if (methodsWithoutRationale.length > 0 && !showMissingRationaleWarning) {
        setShowMissingRationaleWarning(true);
        return;
      }
      
      // Save macrocycle data to localStorage before navigation
      // Build unified snapshot including planDuration and smartGoals
      const legacySmartGoal = {
        ...(smartGoals.length > 0 ? smartGoals[0] : smartGoal),
        startDate: planDuration?.startDate,
        endDate: planDuration?.endDate,
        totalDays: planDuration?.totalDays,
        totalWeeks: planDuration?.totalWeeks,
      };
      const macrocycleData = {
        planName,
        planNotes,
        selectedAthleteId,
        planDuration,
        smartGoals,
        smartGoal: legacySmartGoal,
        subGoals,
        events,
        qualities,
        qualitiesBySubGoal,
        methodsByQuality,
        selectedTest,
        selectedEvent,
        selectedMethods: Array.from(selectedMethods),
        manuallyAddedMethods,
        athleteExistingTests: athleteExistingTestsAndEvents.tests,
        athleteExistingEvents: athleteExistingTestsAndEvents.events,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
      setContextMacrocycleData(macrocycleData);
      setShowMissingRationaleWarning(false);
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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                saveCurrentSession();
                navigate("/templates/programs");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
            <SaveProgramButton />
            <ResourcesButton />
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

  // Methods without rationale for warning dialog
  const methodsWithoutRationale = getMethodsWithoutRationale();

  const macroStepLabel = stepTitles[currentStep - 1] ?? `Step ${currentStep}`;

  const wizardContext = useMemo(() => {
    const athleteStr = selectedAthlete
      ? `Athlete: ${getAthleteDisplayName(selectedAthlete)}`
      : "No athlete selected yet";
    const planStr = planName ? `Plan name: ${planName}` : "";
    const durationStr = planDuration
      ? `Duration: ${planDuration.totalDays} days (${Math.round(planDuration.totalDays / 7)} weeks)`
      : "";
    const goalsStr = smartGoals.length
      ? `Goals:\n${smartGoals.map((g) => `- ${g.description || g.specific || ""}`).filter(Boolean).join("\n")}`
      : "";
    const selectedMethodList = [
      ...Array.from(selectedMethods),
      ...manuallyAddedMethods.map((m) => m.methodId),
    ];
    const methodsStr = selectedMethodList.length
      ? `Selected methods:\n${selectedMethodList.map((m) => `- ${m}`).join("\n")}`
      : "";
    let actionHints = "";
    if (currentStep === 1) {
      actionHints = "Available AI action: set_plan_name";
    } else if (currentStep === 2) {
      actionHints = "Available AI action: add_goal (include specific numbers and timeframe in the description)";
    } else if (currentStep === 3) {
      const allAvailableIds = Object.values(methodsByQuality).flatMap((q) => q.list);
      const unselected = allAvailableIds.filter((m) => !selectedMethods.has(m));
      const methodListStr = unselected.length
        ? `Available methods to suggest from (use exact names):\n${unselected.map((m) => `- ${m}`).join("\n")}`
        : "All available methods are already selected.";
      actionHints = `Available AI action: add_methods\n${methodListStr}`;
    }
    return [
      `Current step: ${macroStepLabel}`,
      athleteStr,
      planStr,
      durationStr,
      goalsStr,
      methodsStr,
      actionHints,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [currentStep, selectedAthlete, planName, planDuration, smartGoals, selectedMethods, manuallyAddedMethods, macroStepLabel, methodsByQuality]);

  const handleAIApply = useCallback((action: import("@/components/wizard/WizardAIAssistant").ApplySuggestion) => {
    switch (action.type) {
      case "set_plan_name":
        setPlanName(action.name);
        break;
      case "set_plan_duration": {
        const start = planDuration?.startDate ?? new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + action.weeks * 7);
        setPlanDuration({ startDate: start, endDate: end, totalDays: action.weeks * 7, totalWeeks: action.weeks });
        break;
      }
      case "add_goal":
        setSmartGoals((prev) => [
          ...prev,
          { id: generateId(), description: action.parameterName, baselineValue: 0, desiredValue: 0, unit: "", percentChange: 0, testDates: [] },
        ]);
        break;
      case "schedule_tests": {
        action.schedule.forEach(({ goalDescription, isEvent, action: act = "add", dates }) => {
          if (isEvent) {
            setEvents(prev => {
              const existing = prev.find(e => e.name.toLowerCase() === goalDescription.toLowerCase());
              if (existing) {
                return prev.map(e => e.id === existing.id ? {
                  ...e,
                  eventDates: act === "remove"
                    ? e.eventDates.filter(d => !dates.includes(d))
                    : [...new Set([...e.eventDates, ...dates])],
                } : e);
              }
              return act === "add" ? [...prev, { id: generateId(), name: goalDescription, eventDates: dates }] : prev;
            });
          } else {
            setSmartGoals(prev => prev.map(g => {
              if (g.description.toLowerCase().includes(goalDescription.toLowerCase())) {
                const current = g.testDates ?? [];
                return {
                  ...g,
                  testDates: act === "remove"
                    ? current.filter(d => !dates.includes(d))
                    : [...new Set([...current, ...dates])],
                };
              }
              return g;
            }));
            setSubGoals(prev => prev.map(sg => {
              if (sg.description.toLowerCase().includes(goalDescription.toLowerCase())) {
                const current = sg.testDates ?? [];
                return {
                  ...sg,
                  testDates: act === "remove"
                    ? current.filter(d => !dates.includes(d))
                    : [...new Set([...current, ...dates])],
                };
              }
              return sg;
            }));
          }
        });
        break;
      }
      case "create_event":
        setEvents(prev => [...prev, { id: generateId(), name: action.name, description: action.description, eventDates: [] }]);
        break;
      case "add_methods": {
        const allAvailableIds = new Set(Object.values(methodsByQuality).flatMap((q) => q.list));
        action.methods.forEach(({ name, rationale }) => {
          if (allAvailableIds.has(name)) {
            setSelectedMethods((prev) => new Set([...prev, name]));
          } else {
            handleAddManualMethod({ methodId: name, rationale: rationale ?? "" });
          }
        });
        break;
      }
      default:
        break;
    }
  }, [methodsByQuality, handleAddManualMethod, planDuration]);

  return (
    <>
      {/* Warning Dialog for Missing Rationales */}
      <AlertDialog open={showMissingRationaleWarning} onOpenChange={setShowMissingRationaleWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Missing Rationales
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>The following manually added methods have no rationale specified:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                {methodsWithoutRationale.map(methodId => (
                  <li key={methodId} className="text-sm">{methodId}</li>
                ))}
              </ul>
              <p className="mt-2">Would you like to add rationales or continue anyway?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowMissingRationaleWarning(false)}>
              Add Rationales
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              // Force proceed
              // Build unified snapshot including planDuration and smartGoals
              const legacySmartGoal = {
                ...(smartGoals.length > 0 ? smartGoals[0] : smartGoal),
                startDate: planDuration?.startDate,
                endDate: planDuration?.endDate,
                totalDays: planDuration?.totalDays,
                totalWeeks: planDuration?.totalWeeks,
              };
              const macrocycleData = {
                planName,
                planNotes,
                selectedAthleteId,
                planDuration,
                smartGoals,
                smartGoal: legacySmartGoal,
                subGoals,
                events,
                qualities,
                qualitiesBySubGoal,
                methodsByQuality,
                selectedTest,
                selectedEvent,
                selectedMethods: Array.from(selectedMethods),
                manuallyAddedMethods,
                athleteExistingTests: athleteExistingTestsAndEvents.tests,
                athleteExistingEvents: athleteExistingTestsAndEvents.events,
                completedAt: new Date().toISOString()
              };
              localStorage.setItem('macrocycleData', JSON.stringify(macrocycleData));
              setContextMacrocycleData(macrocycleData);
              setShowMissingRationaleWarning(false);
              navigate('/mesocycle');
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    
    <div className="w-full max-w-none space-y-6">
      {/* Progress Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Macrocycle Planning</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                saveCurrentSession();
                navigate("/templates/programs");
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Button>
            <SaveProgramButton />
            <ResourcesButton />
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

      {/* AI Assistant */}
      <WizardAIAssistant
        stepLabel={macroStepLabel}
        wizardContext={wizardContext}
        onApplySuggestion={handleAIApply}
        ragContext={ragContext}
        globalContext={globalAIContext}
      />
    </>
  );
}