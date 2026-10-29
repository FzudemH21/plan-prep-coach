import { parseMeasuredNumber } from '@/utils/latestParameterValue';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { User, Target, Calendar as CalendarIcon, Plus, Bot, X, Trash2, FileText, Check, ChevronsUpDown, ChevronDown, ChevronRight, Pencil, Link, CheckSquare } from "lucide-react";
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
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { parseDateStr } from "@/utils/dateUtils";
import { useAthletes } from "@/hooks/useAthletes";
import { getAthleteDisplayName, Athlete } from "@/types/athlete";
import { cn } from "@/lib/utils";
import { AddSmartGoalDialog, AddSubGoalDialog, AddAdditionalMethodDialog, EVIDENCE_QUALITY_OPTIONS } from "@/components/macrocycle";
import { DayScheduleDialog } from "@/components/macrocycle/DayScheduleDialog";
import type { EvidenceQuality } from "@/components/macrocycle/AddAdditionalMethodDialog";
import { AddParameterDialogV2 } from "@/components/goals/AddParameterDialogV2";
import { useToolboxData } from "@/hooks/useToolboxData";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { SaveProgramButton } from "@/components/programs/SaveProgramButton";
import { AutoSaveIndicator } from "@/components/programs/AutoSaveIndicator";
import { useWizardAutoSave } from "@/hooks/useWizardAutoSave";
import { WizardAIAssistant } from "@/components/wizard/WizardAIAssistant";
import { WIZARD_CHAT_ID } from "@/contexts/AIChatContext";
import { useRAGRetrieval } from "@/hooks/useRAGRetrieval";
import { useGlobalAIContext } from "@/hooks/useGlobalAIContext";
import { useAnamnesisAIContext } from "@/hooks/useAnamnesisAIContext";
import { useAthleteParamsWithSelfReported } from "@/hooks/useSelfReportedValues";
import { latestNumericValue } from "@/utils/latestParameterValue";
import { useCoachMemory } from "@/hooks/useCoachMemory";
import { useTrainingPrograms } from "@/hooks/useTrainingPrograms";
import { useCalendarEvents, groupConsecutiveDates } from "@/hooks/useCalendarEvents";
import { TEST_COLOR, EVENT_COLOR, testEventGradient } from "@/lib/eventColors";
import { PlanNotesField } from "@/components/shared/PlanNotesField";
import type { ParameterMeasure } from "@/types/parametersV2";
import { formatGoalRange, goalMeasurePart, goalShowsPercent, groupGoalsByParameter } from "@/utils/goalMeasures";
import { hasCustomMeasures, parameterMeasures } from "@/utils/parameterMeasures";
import { isDatabaseAction, useDatabaseAIActions } from "@/hooks/useDatabaseAIActions";
import { applyNotesAction, readNotesHistory, restoreNotesVersion, strategyContext, WRITE_UP_PROMPT, type PlanNotesVersion } from "@/utils/planStrategy";
import { useWizardData } from "@/contexts/WizardDataContext";

// Type for manually added methods with rationale
interface ManuallyAddedMethod {
  methodId: string;
  rationale?: string;
  evidence?: string;
  evidenceQuality?: EvidenceQuality;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function MacrocyclePage() {
  const { displayMode } = useDisplayMode();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { saveCurrentSession, getProgram } = useTrainingPrograms();
  const { markDirty, status: autoSaveStatus } = useWizardAutoSave();
  const { setMacrocycleData: setContextMacrocycleData } = useWizardData();
  const { getEventsForDate } = useCalendarEvents();
  const { data: parametersDataV2, addParameter: addAthleticismParameter, addInteraction: addParameterInteraction } = useParametersDataV2();
  const { data: toolboxData } = useToolboxData();
  const { athletes, groups, getAthletePerformanceParameters, getAthleteBiometrics, biometricDefinitions, getAthleteCalendarAssignments } = useAthletes();
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  // The AI sees and edits the Parameter Database and the Training Toolbox from here too
  const { parameterContext, applyDatabaseActions } = useDatabaseAIActions();
  const aiGlobalContext = useMemo(() => `${globalAIContext}\n\n## Parameter Database\n${parameterContext}`, [globalAIContext, parameterContext]);
  const [athleteDropdownOpen, setAthleteDropdownOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [planName, setPlanName] = useState<string>("");
  const [planNotes, setPlanNotes] = useState<string>("");
  /** "Goal for another measure": the measure the goal dialog starts with */
  const [goalDefaultMeasureId, setGoalDefaultMeasureId] = useState<string | undefined>();
  /** Earlier versions of the strategy document (kept when the AI rewrites it) */
  const [planNotesHistory, setPlanNotesHistory] = useState<PlanNotesVersion[]>([]);
  // The AI handler is memoised without the notes — it reads them here
  const planNotesRef = useRef(planNotes);
  planNotesRef.current = planNotes;
  const planNotesHistoryRef = useRef(planNotesHistory);
  planNotesHistoryRef.current = planNotesHistory;
  /** "Write up from conversation" → a message for the AI chat */
  const [strategyPrompt, setStrategyPrompt] = useState<{ id: number; text: string } | undefined>();
  const strategyFieldProps = {
    value: planNotes,
    onChange: setPlanNotes,
    history: planNotesHistory,
    onRestore: (version: PlanNotesVersion) => {
      const next = restoreNotesVersion(planNotes, planNotesHistory, version);
      setPlanNotes(next.notes);
      setPlanNotesHistory(next.history);
    },
    onWriteUp: () => setStrategyPrompt({ id: Date.now(), text: WRITE_UP_PROMPT }),
  };
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
  const [expandedSubGoals, setExpandedSubGoals] = useState<Set<string>>(new Set());
  const [expandedPrimaryGoals, setExpandedPrimaryGoals] = useState<Set<string>>(new Set());
  const [addSubGoalForParent, setAddSubGoalForParent] = useState<string | undefined>(undefined);
  const [editingGoal, setEditingGoal] = useState<SmartGoal | null>(null);
const [editingSubGoal, setEditingSubGoal] = useState<SubGoal | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [addEventMode, setAddEventMode] = useState(false);
  // Step 2: the day clicked in the calendar (day dialog: test or event on that day)
  const [dayDialogDate, setDayDialogDate] = useState<string | null>(null);
  // Step 2 calendar day: ONE stable component that draws with the latest render's code. The day was
  // an inline component — a new component type on every render of this page, so every re-render
  // remounted all days and closed a day's hover popup while the mouse was still on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepTwoDayRender = useRef<(props: any) => React.ReactElement | null>(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const StepTwoDay = useMemo(() => function StepTwoDay(props: any) { return stepTwoDayRender.current(props); }, []);
  // Step 2 calendar: as many months side by side as fit (up to 5; a month is ~270 px wide)
  const [calendarMonths, setCalendarMonths] = useState(1);
  const calendarObserver = useRef<ResizeObserver | null>(null);
  const calendarBoxRef = useCallback((el: HTMLDivElement | null) => {
    calendarObserver.current?.disconnect();
    calendarObserver.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCalendarMonths(Math.max(1, Math.min(5, Math.floor((w - 8) / 268))));
    });
    ro.observe(el);
    calendarObserver.current = ro;
  }, []);
  // Main goals whose suggestions (parameters linked to the goal) are shown
  const [openSuggestions, setOpenSuggestions] = useState<Set<string>>(new Set());
  // A new sub-goal started from the day dialog gets that day as its test date
  const pendingSubGoalDateRef = useRef<string | null>(null);

  // State for parameter creation from sub-goal dialog (links to a parent SMART goal)
  const [createParameterForGoalId, setCreateParameterForGoalId] = useState<string | null>(null);

  // State for selected methods in Training Methods overview
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());
  const { coachMemoryContext } = useCoachMemory({ currentMethods: Array.from(selectedMethods) });
  const anamnesisAIContext = useAnamnesisAIContext(selectedAthleteId ?? null);
  // The athlete's parameter values — coach-entered and entered by the athlete in the app — for goal
  // baselines (the most recent value of either)
  const athleteParamsProfile = useMemo(
    () => (selectedAthleteId ? getAthletePerformanceParameters(selectedAthleteId) : []),
    [selectedAthleteId, getAthletePerformanceParameters],
  );
  const athleteParamsForGoals = useAthleteParamsWithSelfReported(selectedAthleteId, athleteParamsProfile);

  // State for manually added methods with rationale
  const [manuallyAddedMethods, setManuallyAddedMethods] = useState<ManuallyAddedMethod[]>([]);
  const [isAddMethodDialogOpen, setIsAddMethodDialogOpen] = useState(false);
  const [editingMethodRationale, setEditingMethodRationale] = useState<string | null>(null);
  const [editingRationaleValue, setEditingRationaleValue] = useState("");
  const [showMissingRationaleWarning, setShowMissingRationaleWarning] = useState(false);
  // Hierarchical method selector (Step 3): which categories/methods are expanded to
  // progressively reveal rationale/goals/evidence instead of showing everything at once.
  const [expandedMethodCategories, setExpandedMethodCategories] = useState<Set<string>>(new Set());
  const [expandedMethodDetails, setExpandedMethodDetails] = useState<Set<string>>(new Set());

  // Derive sub-goals from SMART goal parameter relationships
  const derivedSubGoals = useMemo(() => {
    const derived: SubGoal[] = [];
    
    // Get the selected athlete's performance parameters (incl. results from the athlete app)
    const athletePerformanceParams = athleteParamsForGoals;
    
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
            const preTestValue = athleteParam ? (latestNumericValue(athleteParam.values) ?? 0) : 0;
            
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
  }, [smartGoals, parametersDataV2.interactions, parametersDataV2.parameters, subGoals, athleteParamsForGoals]);

  // Group the chosen sub-goals by parent goal (suggestions from the parameter links are listed
  // separately and only count once added)
  const subGoalsByParent = useMemo(() => {
    const allSubGoals = subGoals;
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
  }, [subGoals]);

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
        setPlanNotesHistory(readNotesHistory(data.planNotesHistory));
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
    const tests: Array<{ testMethod: string; testDates: string[] }> = [];
    const events: Array<{ name: string; eventDates: string[] }> = [];
    assignments.forEach(assignment => {
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
        if (macro) {
          const originalStart = assignment.originalStartDate ? new Date(assignment.originalStartDate) : null;
          const assignedStart = new Date(assignment.startDate);
          const dayOffset = originalStart ? differenceInCalendarDays(assignedStart, originalStart) : 0;

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
    return { tests, events };
  }, [selectedAthleteId, getAthleteCalendarAssignments, getProgram]);

  /**
   * Whether a day has a test / an event — the athlete's (calendar incl. anamnesis periods, assigned
   * programs) and the plan's own. Step 1 frames these days already while picking the plan dates
   * (the same frames as the step-2 calendar).
   */
  const dayTestEventMarks = (date: Date): { test: boolean; event: boolean } => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const hookItems = selectedAthleteId ? getEventsForDate(selectedAthleteId, dateStr) : [];
    const test = hookItems.some(e => e.type === 'test')
      || athleteExistingTestsAndEvents.tests.some(t => t.testDates?.some(td => td.startsWith(dateStr)))
      || subGoals.some(sg => sg.testDates?.includes(dateStr))
      || smartGoals.some(g => g.testDates?.includes(dateStr));
    const event = hookItems.some(e => e.type === 'event')
      || athleteExistingTestsAndEvents.events.some(e => e.eventDates?.some(ed => ed.startsWith(dateStr)))
      || events.some(e => e.eventDates?.includes(dateStr));
    return { test, event };
  };

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
      planNotesHistory,
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
    markDirty();
  }, [planName, planNotes, planNotesHistory, selectedAthleteId, planDuration, smartGoals, smartGoal, subGoals, events, qualities, qualitiesBySubGoal, methodsByQuality, selectedTest, selectedEvent, selectedMethods, manuallyAddedMethods, athleteExistingTestsAndEvents]);

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
  /** Plan and athlete on the strategy document's PDF */
  const strategyPdf = { planName: planName || 'Training plan', athleteName: selectedAthlete ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`.trim() : undefined };

  // Get athlete performance parameters for the Add Goal dialog
  const athletePerformanceParams = athleteParamsForGoals;
  const athleticismParameters = parametersDataV2?.parameters || [];
  
  // State for create parameter dialog
  const [isCreateParameterDialogOpen, setIsCreateParameterDialogOpen] = useState(false);
  const [pendingGoalAfterParameterCreation, setPendingGoalAfterParameterCreation] = useState(false);
  const [shouldReopenSubGoalDialog, setShouldReopenSubGoalDialog] = useState(false);
  const [newlyCreatedParameterId, setNewlyCreatedParameterId] = useState<string | null>(null);

  // Handler for creating a new parameter from the goal dialog
  const handleCreateParameter = async (paramData: {
    name: string;
    unit?: string;
    category?: string;
    isBiometric?: boolean;
    measures?: ParameterMeasure[];
    perSide?: boolean;
    interactions: any[];
    methods: any[];
  }) => {
    // Add parameter to Athleticism Database
    const newParam = await addAthleticismParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
      isBiometric: paramData.isBiometric,
      measures: paramData.measures,
      perSide: paramData.perSide,
    });
    const newParamId = newParam?.id;
    
    // Add parameter interactions and methods if provided
    paramData.interactions.forEach(interaction => {
      // Would need to call addInteraction but keeping it simple for now
    });
    paramData.methods.forEach(method => {
      // Would need to call addParameterMethod but keeping it simple for now
    });

    // NOTE: intentionally NOT auto-adding this parameter to the athlete's
    // performance parameters here — that's a separate decision (start tracking
    // measured values for this athlete over time) from creating a database
    // entry to use as a goal. Auto-linking used to make a freshly-created
    // parameter show up under "Athlete Parameters" instead of "All Parameters"
    // in the goal picker, which was confusing.

    setIsCreateParameterDialogOpen(false);
    setNewlyCreatedParameterId(newParamId ?? null);

    // Reopen the goal dialog so user can select the newly created parameter
    if (pendingGoalAfterParameterCreation) {
      setPendingGoalAfterParameterCreation(false);
      setTimeout(() => setIsAddGoalDialogOpen(true), 100);
    }

    toast({
      title: 'Parameter Created',
      description: `Created "${paramData.name}".`
    });
  };

  // Handlers for SMART goals
  const handleAddGoal = (goal: Omit<SmartGoal, 'id'>) => {
    setSmartGoals(prev => [...prev, { ...goal, id: generateId() }]);
  };

  const handleRemoveGoal = (goalId: string) => {
    const goalBeingDeleted = smartGoals.find(g => g.id === goalId);

    if (goalBeingDeleted?.linkedParameterId) {
      // Methods linked to the deleted goal's parameter
      const methodsForDeletedGoal = new Set(
        parametersDataV2.parameterMethods
          .filter(pm => pm.parameterId === goalBeingDeleted.linkedParameterId)
          .map(pm => pm.methodId)
      );

      // Methods still needed by other remaining goals
      const methodsForRemainingGoals = new Set(
        smartGoals
          .filter(g => g.id !== goalId && g.linkedParameterId)
          .flatMap(g =>
            parametersDataV2.parameterMethods
              .filter(pm => pm.parameterId === g.linkedParameterId)
              .map(pm => pm.methodId)
          )
      );

      setSelectedMethods(prev => {
        const next = new Set(prev);
        for (const m of methodsForDeletedGoal) {
          if (!methodsForRemainingGoals.has(m) && !manuallyAddedMethods.some(mm => mm.methodId === m)) {
            next.delete(m);
          }
        }
        return next;
      });
    }

    // Also clean up any manual sub-goals tied to this goal
    const removedSubGoalIds = new Set(
      subGoals.filter(sg => sg.parentGoalId === goalId).map(sg => sg.id)
    );
    if (removedSubGoalIds.size > 0) {
      setSubGoals(prev => prev.filter(sg => sg.parentGoalId !== goalId));
      setQualitiesBySubGoal(prev => {
        const next = { ...prev };
        for (const id of removedSubGoalIds) delete next[id];
        return next;
      });
    }

    setSmartGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const handleEditGoal = (goal: SmartGoal) => {
    setSmartGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
    toast({ title: 'Goal Updated', description: `Updated "${goal.description}"` });
  };

  // Handlers for Sub-goals
  const handleAddSubGoal = (subGoal: Omit<SubGoal, 'id'>) => {
    const pendingDate = pendingSubGoalDateRef.current;
    pendingSubGoalDateRef.current = null;
    const newSubGoal: SubGoal = {
      ...subGoal,
      id: `subgoal-${Date.now()}`,
      ...(pendingDate ? { testDates: [...new Set([...(subGoal.testDates ?? []), pendingDate])] } : {}),
    };
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
    // Deferred — see comment on the goal-dialog equivalent above.
    setTimeout(() => setIsCreateParameterDialogOpen(true), 0);
  };

  // Handler for when a new parameter is created via the parameter dialog
  const handleParameterCreatedAsSubGoal = async (paramData: {
    name: string;
    unit?: string;
    category?: string;
    measures?: ParameterMeasure[];
    perSide?: boolean;
    contributesTo?: Array<{ parameterId: string; strength?: 'strong' | 'moderate' | 'weak' }>;
    improvedBy?: Array<{ parameterId: string; strength?: 'strong' | 'moderate' | 'weak' }>;
    methods?: Array<{ methodId: string; rationale?: string }>;
  }) => {
    // Create the parameter in the database
    const newParam = await addAthleticismParameter({
      name: paramData.name,
      unit: paramData.unit,
      category: paramData.category,
      measures: paramData.measures,
      perSide: paramData.perSide,
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
        // differenceInDays (not raw ms / 86400000) — a DST transition inside the
        // range adds/removes an hour, which Math.ceil on raw ms rounds up into an
        // extra day (e.g. was showing 85 days for a 31.08–22.11 range that's really 84).
        const totalDays = differenceInCalendarDays(selectedDate, planDuration.startDate) + 1;
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

      {/* Notes / Brainstorming — step 1 only; shown at the top of the page for steps 2 and 3 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Plan strategy</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlanNotesField {...strategyFieldProps} pdf={strategyPdf} />
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
              // Goals of one parameter together: "30 m Sprint" with its goal measures underneath
              groupGoalsByParameter(smartGoals).map((group) => {
                const param = group.parameterId ? athleticismParameters.find((p) => p.id === group.parameterId) : undefined;
                const grouped = !!param && (group.goals.length > 1 || hasCustomMeasures(param) || !!param.perSide);
                const usedMeasures = new Set(group.goals.map((g) => g.measureId ?? "main"));
                const nextMeasure = param ? parameterMeasures(param).find((m) => !usedMeasures.has(m.id)) : undefined;
                return (
                  <div key={group.key} className="border rounded-lg bg-muted/30">
                    {grouped && param && (
                      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                        <span className="font-medium truncate">{param.name}</span>
                        {(hasCustomMeasures(param) || param.perSide) && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={() => {
                              setNewlyCreatedParameterId(param.id);
                              setGoalDefaultMeasureId(nextMeasure?.id);
                              setIsAddGoalDialogOpen(true);
                            }}>
                            <Plus className="h-3.5 w-3.5" />Goal for another measure
                          </Button>
                        )}
                      </div>
                    )}
                    {group.goals.map((goal) => (
                      <div key={goal.id} className={cn("p-3 flex items-start justify-between gap-3", grouped && "pl-6 pt-2 border-t first-of-type:border-t-0")}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("truncate", grouped ? "text-sm font-medium" : "font-medium")}>
                              {grouped ? (goalMeasurePart(goal, param) || "Value") : goal.description}
                            </span>
                            {goalShowsPercent(goal, param) && (
                              <Badge
                                variant={(goal.percentChange ?? 0) < 0 ? "destructive" : "default"}
                                className="shrink-0"
                              >
                                {(goal.percentChange ?? 0) > 0 ? "+" : ""}{(goal.percentChange ?? 0).toFixed(1)}%
                              </Badge>
                            )}
                            {goal.phaseNote && <span className="text-xs text-muted-foreground">· {goal.phaseNote}</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatGoalRange(goal, param)}
                          </p>
                          {goal.testDates && goal.testDates.length > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              📅 {goal.testDates.map(d => format(parseDateStr(d), 'd MMM yyyy')).join(', ')}
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
                    ))}
                  </div>
                );
              })
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
                    // The athlete's tests / events framed as in step 2 — visible while picking the dates
                    testOnly: (date) => { const m = dayTestEventMarks(date); return m.test && !m.event; },
                    eventOnly: (date) => { const m = dayTestEventMarks(date); return m.event && !m.test; },
                    testAndEvent: (date) => { const m = dayTestEventMarks(date); return m.test && m.event; },
                  }}
                  modifiersStyles={{
                    start: {
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    // Same colours as step 2: start green, end red
                    end: {
                      backgroundColor: 'hsl(347 77% 50%)',
                      color: 'white',
                      fontWeight: 'bold',
                      borderRadius: '4px'
                    },
                    middle: {
                      backgroundColor: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))'
                    },
                    testOnly: { boxShadow: `inset 0 0 0 2px ${TEST_COLOR}`, borderRadius: '4px', fontWeight: 600 },
                    eventOnly: { boxShadow: `inset 0 0 0 2px ${EVENT_COLOR}`, borderRadius: '4px', fontWeight: 600 },
                    testAndEvent: { boxShadow: `inset 0 0 0 2px ${TEST_COLOR}, inset 0 0 0 4px ${EVENT_COLOR}`, borderRadius: '4px', fontWeight: 600 },
                  }}
                  className="rounded-md pointer-events-auto"
                />
                {/* Legend — frames only when the athlete has tests / events */}
                <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] bg-[hsl(142_76%_36%)]" />Start</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] bg-[hsl(347_77%_50%)]" />End</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px]" style={{ boxShadow: `inset 0 0 0 2px ${TEST_COLOR}` }} />Test</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px]" style={{ boxShadow: `inset 0 0 0 2px ${EVENT_COLOR}` }} />Event</span>
                </div>
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
          if (!open) {
            setEditingGoal(null);
            setNewlyCreatedParameterId(null);
            setGoalDefaultMeasureId(undefined);
          }
        }}
        onAddGoal={handleAddGoal}
        onEditGoal={handleEditGoal}
        editGoal={editingGoal}
        athletePerformanceParams={athletePerformanceParams}
        athleticismParameters={athleticismParameters}
        defaultParameterId={newlyCreatedParameterId}
        defaultMeasureId={goalDefaultMeasureId}
        onOpenCreateParameter={() => {
          setPendingGoalAfterParameterCreation(true);
          setIsAddGoalDialogOpen(false);
          // Defer to the next tick so the closing dialog's scroll-lock fully
          // releases before the new one mounts and claims its own — opening
          // both in the same tick can leave the new dialog unable to scroll
          // (a known Radix Dialog + scroll-lock timing quirk).
          setTimeout(() => setIsCreateParameterDialogOpen(true), 0);
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
        {/* Left half: goals | events side by side (stacked on narrower screens); right half: the calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start min-w-0">
          {/* The goals — main goals and the sub-goals chosen for them (with their values) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between min-h-9">
              <h3 className="font-semibold text-sm">Goals</h3>
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
                      <div className="flex-1 rounded p-1 -m-1 min-w-0">
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
                          {formatGoalRange(goal, athleticismParameters.find((p) => p.id === goal.linkedParameterId))}
                          {goalShowsPercent(goal, athleticismParameters.find((p) => p.id === goal.linkedParameterId)) && (
                            <Badge
                              variant={(goal.percentChange ?? 0) > 0 ? "default" : "secondary"}
                              className="text-xs ml-2"
                            >
                              {(goal.percentChange ?? 0) > 0 ? "+" : ""}{(goal.percentChange ?? 0).toFixed(1)}%
                            </Badge>
                          )}
                          {goal.phaseNote && <span className="ml-2">· {goal.phaseNote}</span>}
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
                                className="p-2 pl-3 border-b last:border-b-0"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      {subGoal.interactionStrength && (
                                        <Badge variant="outline" className="text-xs shrink-0"
                                          title={`${subGoal.interactionStrength === 'strong' ? 'Strong' : subGoal.interactionStrength === 'moderate' ? 'Moderate' : 'Weak'} link to the main goal (parameter database)`}>
                                          {subGoal.interactionStrength === 'strong' ? '↑↑' : subGoal.interactionStrength === 'moderate' ? '↑' : '→'}
                                        </Badge>
                                      )}
                                      <span className="font-medium text-sm truncate">
                                        {subGoal.testMethod || subGoal.description || "Unnamed"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {subGoal.isDerived || (!subGoal.preTestValue && !subGoal.goalValue) ? (
                                        <span className="text-xs text-amber-700">
                                          No values set yet — set baseline and goal with the pencil
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
                                        <p>📅 {subGoal.testDates.map(d => format(parseDateStr(d), 'd MMM yyyy')).join(', ')}</p>
                                      )}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            );
                          })}
                          
                          {/* Suggestions: parameters linked to this main goal in the parameter database —
                              they only count (calendar, step 3) once added */}
                          {(() => {
                            const suggestions = derivedSubGoals.filter(d => d.parentGoalId === goal.id);
                            if (suggestions.length === 0) return null;
                            const open = openSuggestions.has(goal.id);
                            return (
                              <div className="border-b px-3 py-2 space-y-1.5">
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                                  onClick={() => setOpenSuggestions(prev => {
                                    const next = new Set(prev);
                                    if (next.has(goal.id)) next.delete(goal.id); else next.add(goal.id);
                                    return next;
                                  })}
                                >
                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
                                  Suggested from the parameter database ({suggestions.length})
                                </button>
                                {open && (
                                  <>
                                    <p className="text-xs text-muted-foreground">
                                      Parameters that contribute to this main goal (arrows: how strongly). Add the ones you want as sub-goals — only added sub-goals appear in the calendar and in step 3.
                                    </p>
                                    {suggestions.map(sg => (
                                      <div key={sg.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                                        {sg.interactionStrength && (
                                          <Badge variant="outline" className="text-xs shrink-0"
                                            title={`${sg.interactionStrength === 'strong' ? 'Strong' : sg.interactionStrength === 'moderate' ? 'Moderate' : 'Weak'} link to the main goal`}>
                                            {sg.interactionStrength === 'strong' ? '↑↑' : sg.interactionStrength === 'moderate' ? '↑' : '→'}
                                          </Badge>
                                        )}
                                        <span className="flex-1 min-w-0 truncate text-sm">{sg.description}</span>
                                        {sg.preTestValue ? (
                                          <span className="text-xs text-muted-foreground shrink-0">last {sg.preTestValue} {sg.unit}</span>
                                        ) : null}
                                        <Button variant="outline" size="sm" className="h-7 px-2 shrink-0" onClick={() => handlePromoteDerivedSubGoal(sg)}>
                                          <Plus className="h-3 w-3 mr-0.5" />Add
                                        </Button>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            );
                          })()}

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
              
            </div>
          </div>

          {/* Events */}
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between min-h-9">
              <h3 className="font-semibold text-sm">Events</h3>
              <Button
                onClick={() => {
                  setAddEventMode(true);
                  setIsAddSubGoalDialogOpen(true);
                }}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Event
              </Button>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto px-1 -mx-1 pr-3">
              {events.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events yet</p>
                  <p className="text-xs">Competitions, holidays, camps — add one here or click a day in the calendar</p>
                </div>
              )}
              {events.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                                    
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
                        <div key={event.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 shrink-0">Event</Badge>
                                <span className="font-medium text-sm truncate">{event.name}</span>
                              </div>
                              {event.eventDates && event.eventDates.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  📅 {groupConsecutiveDates(event.eventDates).map(([a, b]) => (a === b
                                    ? format(parseDateStr(a), 'd MMM yyyy')
                                    : `${format(parseDateStr(a), 'd MMM')} – ${format(parseDateStr(b), 'd MMM yyyy')}`)).join(', ')}
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
              
            </div>
          </div>
          </div>

          {/* The calendar — click a day → the tests and events of that day (day dialog);
              as many months side by side as fit (up to 5) */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-sm">Calendar</h3>
              <p className="text-xs text-muted-foreground">Click a day to add a test or an event</p>
            </div>
            {planDuration?.startDate && planDuration?.endDate ? (
              <div ref={calendarBoxRef} className="border rounded-lg p-4 bg-muted/30 flex flex-col items-center">
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
                  numberOfMonths={calendarMonths}
                  showOutsideDays={false}
                  defaultMonth={planDuration.startDate > new Date() ? planDuration.startDate : new Date()}
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
                      .map(dateStr => parseDateStr(dateStr))
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
                    // (assigns this render's drawing code, hands the calendar the stable component)
                    Day: (stepTwoDayRender.current = ({ date, ...dayProps }: any) => {
                      // Months side by side: a neighbouring month's days stay empty (they showed twice)
                      if (dayProps.displayMonth && date.getMonth() !== dayProps.displayMonth.getMonth()) {
                        return <div className="h-9 w-9" />;
                      }
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
                        
                        // Tests and events are scheduled from the day dialog (no more "select in the
                        // list, then click days")
                        setDayDialogDate(dateStr);
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

                      // The plan is always visible: every plan day grey, first and last day green.
                      // Tests / events only add a coloured frame (orange / blue; both: two frames)
                      let dateStyle = 'rounded-[4px]';
                      if (isStartDate) {
                        dateStyle += ' bg-[hsl(142_76%_36%)] text-white font-bold';
                      } else if (isEndDate) {
                        dateStyle += ' bg-[hsl(347_77%_50%)] text-white font-bold';
                      } else if (isMiddleDate) {
                        dateStyle += ' bg-foreground/10 text-foreground';
                      }
                      const circleClass = hasAnyTests || hasAnyEvents ? 'font-semibold' : '';
                      const circleInlineStyle: React.CSSProperties | undefined = hasAnyTests && hasAnyEvents
                        ? { boxShadow: `inset 0 0 0 2px ${TEST_COLOR}, inset 0 0 0 4px ${EVENT_COLOR}` }
                        : hasAnyTests
                          ? { boxShadow: `inset 0 0 0 2px ${TEST_COLOR}` }
                          : hasAnyEvents
                            ? { boxShadow: `inset 0 0 0 2px ${EVENT_COLOR}` }
                            : undefined;

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
                          <HoverCard openDelay={120} closeDelay={60}>
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
                                  {/* Tests / events in the athlete's calendar (entered there, or from the anamnesis) —
                                      those already listed above (from an assigned program) only once */}
                                  {hookItems
                                    .filter(it => !(it.type === 'event'
                                      ? athleteExistingEventsOnDay.some(e => e.name === it.title) || scheduledEvents.some(e => e.name === it.title)
                                      : athleteExistingTestsOnDay.some(t => t.testMethod === it.title)))
                                    .map(it => (
                                      <div key={`cal-${it.id}`} className="text-xs">
                                        <div className="font-medium flex items-center gap-1">
                                          <span className={it.type === 'test' ? 'text-amber-600' : 'text-blue-600'}>{it.type === 'test' ? '📋' : '📅'}</span>
                                          {it.title} <span className="font-normal text-muted-foreground">(athlete calendar{it.source ? ', anamnesis' : ''})</span>
                                        </div>
                                        {it.endDate && it.endDate > it.date && (
                                          <div className="text-muted-foreground">
                                            {format(parseDateStr(it.date), 'd MMM')} – {format(parseDateStr(it.endDate), 'd MMM yyyy')}
                                          </div>
                                        )}
                                        {it.type === 'test' && it.targetValue && <div className="text-muted-foreground">Target: {it.targetValue}</div>}
                                        {it.notes && <div className="text-muted-foreground">{it.notes}</div>}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }

                      return dayContent;
                    }, StepTwoDay),
                  }}
                />
                
                {/* Legend */}
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] bg-[hsl(142_76%_36%)]" />Start</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] bg-[hsl(347_77%_50%)]" />End</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px] bg-foreground/10" />Plan</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px]" style={{ boxShadow: `inset 0 0 0 2px ${TEST_COLOR}` }} />Test</span>
                  <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-[3px]" style={{ boxShadow: `inset 0 0 0 2px ${EVENT_COLOR}` }} />Event</span>
                </div>

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
        {dayDialogDate && (
          <DayScheduleDialog
            open={!!dayDialogDate}
            onOpenChange={(o) => { if (!o) setDayDialogDate(null); }}
            date={dayDialogDate}
            planEndDate={planDuration?.endDate ? format(planDuration.endDate, 'yyyy-MM-dd') : undefined}
            smartGoals={smartGoals}
            subGoals={subGoals}
            events={events}
            existingOnDay={[
              ...athleteExistingTestsAndEvents.tests.filter(t => t.testDates?.some(d => d.startsWith(dayDialogDate))).map(t => `test ${t.testMethod}`),
              ...athleteExistingTestsAndEvents.events.filter(e => e.eventDates?.some(d => d.startsWith(dayDialogDate))).map(e => e.name),
            ]}
            onToggleGoalTest={(goalId) => setSmartGoals(prev => prev.map(g => {
              if (g.id !== goalId) return g;
              const dates = g.testDates || [];
              return { ...g, testDates: dates.includes(dayDialogDate) ? dates.filter(d => d !== dayDialogDate) : [...dates, dayDialogDate] };
            }))}
            onToggleSubGoalTest={(subGoalId) => {
              if (subGoals.some(sg => sg.id === subGoalId)) {
                setSubGoals(prev => prev.map(sg => {
                  if (sg.id !== subGoalId) return sg;
                  const dates = sg.testDates || [];
                  return { ...sg, testDates: dates.includes(dayDialogDate) ? dates.filter(d => d !== dayDialogDate) : [...dates, dayDialogDate] };
                }));
                return;
              }
            }}
            onNewSubGoal={() => {
              pendingSubGoalDateRef.current = dayDialogDate;
              setDayDialogDate(null);
              setAddEventMode(false);
              setIsAddSubGoalDialogOpen(true);
            }}
            onCreateEvent={({ name, comments, dates }) => handleAddEvent({ name, description: '', eventDates: dates, comments })}
            onAddEventDays={(eventId, dates) => setEvents(prev => prev.map(e => (e.id === eventId
              ? { ...e, eventDates: [...new Set([...(e.eventDates || []), ...dates])].sort() }
              : e)))}
            onRemoveEventDays={(eventId, dates) => setEvents(prev => prev.map(e => (e.id === eventId
              ? { ...e, eventDates: (e.eventDates || []).filter(d => !dates.includes(d)) }
              : e)))}
          />
        )}

        <AddSubGoalDialog
          open={isAddSubGoalDialogOpen}
          onOpenChange={(open) => {
            setIsAddSubGoalDialogOpen(open);
            if (!open) {
              pendingSubGoalDateRef.current = null;
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
          planStartDate={planDuration?.startDate ? format(planDuration.startDate, 'yyyy-MM-dd') : undefined}
          planEndDate={planDuration?.endDate ? format(planDuration.endDate, 'yyyy-MM-dd') : undefined}
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
      const allSubGoals = subGoals.filter(
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
    const allSubGoals = subGoals;
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
  const handleAddManualMethod = (method: { methodId: string; rationale: string; evidence?: string; evidenceQuality?: EvidenceQuality }) => {
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
    // All selectable method IDs — goal-linked + manually-added, deduplicated —
    // used by the Selection Summary bar so its count matches what the
    // hierarchical tree below actually shows (which includes manual methods too).
    const linkedMethodIds = new Set(allMethods.map(m => m.methodId));
    const allSelectableMethodIds = [
      ...allMethods.map(m => m.methodId),
      ...manuallyAddedMethods.filter(mm => !linkedMethodIds.has(mm.methodId)).map(mm => mm.methodId),
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckSquare className="h-5 w-5" />
            <span>Select Training Methods</span>
          </CardTitle>
          <CardDescription>
            Select the methods to include in your training plan. Methods linked to primary goals are selected by default.
            Methods are grouped by category — click a category to see its methods, then "Details" on a method to see the goals it contributes to and its rationale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasAnyMethods ? (
            <div className="space-y-6">
              {/* Selection Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">
                  {selectedMethods.size} of {allSelectableMethodIds.length} methods selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMethods(new Set(allSelectableMethodIds))}
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

              {/* All methods (goal-linked + manually-added) — grouped by Category,
                  progressively disclosed: click a category to see its methods,
                  click "Details" on a method to see the rationale/goals/evidence
                  for it. Replaces the old flat list that showed everything at once. */}
              {(() => {
                type DisplayMethod = {
                  methodId: string;
                  isManual: boolean;
                  associations: MethodAssociation[];
                  manualRationale?: string;
                  manualEvidence?: string;
                  manualEvidenceQuality?: string;
                };
                const linkedIds = new Set(allMethods.map(m => m.methodId));
                const displayMethods: DisplayMethod[] = [
                  ...allMethods.map(m => ({ methodId: m.methodId, isManual: false, associations: m.associations })),
                  ...manuallyAddedMethods
                    .filter(mm => !linkedIds.has(mm.methodId))
                    .map(mm => ({
                      methodId: mm.methodId,
                      isManual: true,
                      associations: [] as MethodAssociation[],
                      manualRationale: mm.rationale,
                      manualEvidence: mm.evidence,
                      manualEvidenceQuality: mm.evidenceQuality,
                    })),
                ];
                if (displayMethods.length === 0) return null;

                const categoryGroups = new Map<string, DisplayMethod[]>();
                displayMethods.forEach(m => {
                  const category = m.methodId.includes(' - ') ? m.methodId.split(' - ')[0] : m.methodId;
                  if (!categoryGroups.has(category)) categoryGroups.set(category, []);
                  categoryGroups.get(category)!.push(m);
                });
                const sortedCategories = Array.from(categoryGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

                const toggleCategory = (category: string) => {
                  setExpandedMethodCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(category)) next.delete(category); else next.add(category);
                    return next;
                  });
                };
                const toggleMethodDetail = (methodId: string) => {
                  setExpandedMethodDetails(prev => {
                    const next = new Set(prev);
                    if (next.has(methodId)) next.delete(methodId); else next.add(methodId);
                    return next;
                  });
                };
                const toggleCategorySelection = (methods: DisplayMethod[], selectAll: boolean) => {
                  setSelectedMethods(prev => {
                    const next = new Set(prev);
                    methods.forEach(m => selectAll ? next.add(m.methodId) : next.delete(m.methodId));
                    return next;
                  });
                };

                return (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Training Methods
                    </Label>
                    <div className="border rounded-lg divide-y overflow-hidden">
                      {sortedCategories.map(([category, methods]) => {
                        const categorySelectedCount = methods.filter(m => selectedMethods.has(m.methodId)).length;
                        const categoryExpanded = expandedMethodCategories.has(category);
                        const categoryChecked: boolean | "indeterminate" =
                          categorySelectedCount === 0 ? false : categorySelectedCount === methods.length ? true : "indeterminate";
                        const sortedMethods = [...methods].sort((a, b) => {
                          const aPrimary = a.associations.some(x => x.isPrimaryGoal);
                          const bPrimary = b.associations.some(x => x.isPrimaryGoal);
                          if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
                          return a.methodId.localeCompare(b.methodId);
                        });
                        return (
                          <div key={category}>
                            <div className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors">
                              <Checkbox
                                checked={categoryChecked}
                                onCheckedChange={(checked) => toggleCategorySelection(methods, !!checked)}
                                onClick={(e) => e.stopPropagation()}
                                title="Select/deselect all methods in this category"
                              />
                              <button
                                type="button"
                                onClick={() => toggleCategory(category)}
                                className="flex-1 flex items-center justify-between gap-2 text-left min-w-0"
                              >
                                <span className="flex items-center gap-2 font-medium text-sm min-w-0">
                                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", categoryExpanded && "rotate-90")} />
                                  <span className="truncate">{category}</span>
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {categorySelectedCount}/{methods.length} selected
                                </span>
                              </button>
                            </div>
                            {categoryExpanded && (
                              <div className="divide-y border-t bg-muted/10">
                                {sortedMethods.map(method => {
                                  const subCategory = method.methodId.includes(' - ')
                                    ? method.methodId.slice(method.methodId.indexOf(' - ') + 3)
                                    : method.methodId;
                                  const detailExpanded = expandedMethodDetails.has(method.methodId);
                                  const hasDetails = method.isManual
                                    ? !!(method.manualRationale || method.manualEvidence)
                                    : method.associations.length > 0;
                                  return (
                                    <div key={method.methodId} className="pl-4">
                                      <div
                                        className={cn(
                                          "flex items-center gap-2 py-2.5 pr-4 transition-colors",
                                          selectedMethods.has(method.methodId) && "bg-primary/5"
                                        )}
                                      >
                                        <Checkbox
                                          id={method.methodId}
                                          checked={selectedMethods.has(method.methodId)}
                                          onCheckedChange={(checked) => toggleMethodSelection(method.methodId, !!checked)}
                                        />
                                        <label htmlFor={method.methodId} className="text-sm cursor-pointer truncate max-w-[55%]">
                                          {subCategory}
                                        </label>
                                        {hasDetails && (
                                          <button
                                            type="button"
                                            onClick={() => toggleMethodDetail(method.methodId)}
                                            className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                                          >
                                            Details
                                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", detailExpanded && "rotate-180")} />
                                          </button>
                                        )}
                                        {method.isManual && (
                                          <Badge variant="outline" className="ml-auto shrink-0 text-[10px] px-1.5 py-0 bg-muted text-foreground">
                                            Manually Added
                                          </Badge>
                                        )}
                                      </div>
                                      {detailExpanded && (
                                        <div className="pl-9 pb-3 pr-4 space-y-1.5">
                                          {method.isManual ? (
                                            <div className="text-sm border-l-2 border-muted pl-2.5 space-y-0.5">
                                              {method.manualRationale && <p className="text-muted-foreground italic">"{method.manualRationale}"</p>}
                                              {method.manualEvidence && <p className="text-xs text-muted-foreground">{method.manualEvidence}</p>}
                                              <p className="text-xs text-muted-foreground">
                                                Edit or remove this method under "Additional Training Methods" below.
                                              </p>
                                            </div>
                                          ) : (
                                            method.associations.map((assoc, idx) => (
                                              <div key={idx} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-2.5">
                                                <div className="space-y-0.5">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Badge
                                                      variant={assoc.isPrimaryGoal ? "default" : "outline"}
                                                      className={cn("shrink-0", !assoc.isPrimaryGoal && "bg-muted text-foreground border-black")}
                                                    >
                                                      {assoc.parameterName}
                                                      {assoc.isPrimaryGoal && " (Primary)"}
                                                    </Badge>
                                                    {assoc.goalDescription && !assoc.isPrimaryGoal && (
                                                      <span className="text-xs text-muted-foreground">
                                                        → contributes to {assoc.goalDescription}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {assoc.rationale && (
                                                    <p className="text-muted-foreground italic">"{assoc.rationale}"</p>
                                                  )}
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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
                            <div className="space-y-1">
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
                              {method.evidenceQuality && (
                                <Badge variant="outline" className="text-xs">
                                  Evidence: {EVIDENCE_QUALITY_OPTIONS.find(o => o.value === method.evidenceQuality)?.label}
                                </Badge>
                              )}
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
                          {method.evidenceQuality && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Evidence: {EVIDENCE_QUALITY_OPTIONS.find(o => o.value === method.evidenceQuality)?.label}
                            </Badge>
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
        planNotesHistory,
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
      // mesocycleStep persists globally (not scoped per-program) and MesocyclePage
      // resumes from it unconditionally on mount — without this, "Move on to
      // Mesocycle" can land on whatever step was last viewed in a completely
      // unrelated program instead of starting this one at step 1.
      localStorage.removeItem('mesocycleStep');
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
            <AutoSaveIndicator status={autoSaveStatus} />
            <SaveProgramButton />
            <ResourcesButton />
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
      ? `Plan dates: ${format(planDuration.startDate, 'yyyy-MM-dd')} → ${format(planDuration.endDate, 'yyyy-MM-dd')} (${planDuration.totalDays} days / ${Math.round(planDuration.totalDays / 7)} weeks)`
      : "";
    const goalsStr = smartGoals.length
      ? `Goals (use EXACT names for schedule_tests):\n${smartGoals.map((g) => {
          const name = g.description || g.specific || "";
          const dates = g.testDates?.length ? ` [tests: ${g.testDates.join(", ")}]` : "";
          return `- ${name}${dates}`;
        }).filter(Boolean).join("\n")}`
      : "";
    const eventsStr = events.length
      ? `Events (use EXACT names for schedule_tests — do NOT create a new event if one already exists here):\n${events.map((e) => {
          const dates = e.eventDates?.length ? ` [scheduled: ${e.eventDates.join(", ")}]` : " [no dates yet]";
          return `- "${e.name}"${dates}`;
        }).join("\n")}`
      : "Events: none yet";
    const selectedMethodList = [
      ...Array.from(selectedMethods),
      ...manuallyAddedMethods.map((m) => m.methodId),
    ];
    const methodsStr = selectedMethodList.length
      ? `Selected methods:\n${selectedMethodList.map((m) => `- ${m}`).join("\n")}`
      : "";
    const notesStr = strategyContext(planNotes);
    let actionHints = "";
    if (currentStep === 1) {
      actionHints = "Available AI actions: set_plan_name, set_plan_duration, add_goal, remove_goal, schedule_tests, create_event, remove_event";
    } else if (currentStep === 2) {
      actionHints = "Available AI actions: add_goal (include specific numbers and timeframe), remove_goal, schedule_tests, create_event, remove_event";
    } else if (currentStep === 3) {
      // Use the same function the UI uses — reads from parametersDataV2.parameterMethods filtered by goals
      const goalLinkedMethods = getAllMethodsWithAssociations();
      const goalLinkedStr = goalLinkedMethods.length
        ? `Goal-linked methods shown on this page (✓ = selected, ✗ = deselected):\n${goalLinkedMethods.map((m) => {
            const sel = selectedMethods.has(m.methodId) ? "✓" : "✗";
            const goals = m.associations.map(a => `${a.isPrimaryGoal ? "[primary goal]" : "[sub-goal]"} ${a.parameterName}`).join(", ");
            return `${sel} ${m.methodId} — linked to: ${goals}`;
          }).join("\n")}`
        : "No goal-linked methods on this page (no parameter-method links configured in the database for the current goals).";
      const manualStr = manuallyAddedMethods.length
        ? `Manually added methods:\n${manuallyAddedMethods.map((m) => {
            let line = `✓ ${m.methodId}`;
            if (m.rationale) line += ` — rationale: "${m.rationale}"`;
            if (m.evidence) line += ` | evidence: "${m.evidence}"`;
            if (m.evidenceQuality) line += ` | evidenceQuality: "${m.evidenceQuality}"`;
            return line;
          }).join("\n")}`
        : "";
      const allToolboxMethods = [...new Set(
        (toolboxData?.entries ?? []).map(e => `${e.category} - ${e.subCategory}`)
      )].sort();
      const toolboxStr = allToolboxMethods.length
        ? `Training Toolbox — ALL methods available to add (ONLY suggest from this list, use exact names):\n${allToolboxMethods.map(m => `- ${m}`).join("\n")}`
        : "Training Toolbox: empty.";
      actionHints = `Available AI actions: add_methods, remove_methods\n${goalLinkedStr}${manualStr ? `\n${manualStr}` : ""}\n${toolboxStr}`;
    }
    return [
      `Current step: ${macroStepLabel}`,
      athleteStr,
      planStr,
      durationStr,
      goalsStr,
      eventsStr,
      methodsStr,
      notesStr,
      actionHints,
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [currentStep, selectedAthlete, planName, planDuration, smartGoals, subGoals, derivedSubGoals, events, selectedMethods, manuallyAddedMethods, macroStepLabel, parametersDataV2, toolboxData, planNotes]);

  const handleAIApply = useCallback((action: import("@/components/wizard/WizardAIAssistant").ApplySuggestion) => {
    // Parameter Database / Training Toolbox
    if (isDatabaseAction(action)) { void applyDatabaseActions([action]); return; }
    switch (action.type) {
      case "set_plan_name":
        setPlanName(action.name);
        break;
      case "set_plan_notes": {
        // A rewrite keeps the text before as a version
        const next = applyNotesAction(planNotesRef.current, planNotesHistoryRef.current, action);
        planNotesRef.current = next.notes;
        planNotesHistoryRef.current = next.history;
        setPlanNotes(next.notes);
        setPlanNotesHistory(next.history);
        break;
      }
      case "set_plan_duration": {
        const start = action.startDate
          ? new Date(action.startDate + 'T12:00:00')
          : (planDuration?.startDate ?? new Date());
        const end = action.endDate
          ? new Date(action.endDate + 'T12:00:00')
          : (() => { const d = new Date(start); d.setDate(d.getDate() + (action.weeks ?? 0) * 7); return d; })();
        const totalDays = differenceInCalendarDays(end, start) + 1;
        const totalWeeks = Math.round(totalDays / 7);
        setPlanDuration({ startDate: start, endDate: end, totalDays, totalWeeks });
        break;
      }
      case "add_goal": {
        // Linked to the parameter of that name, with the athlete's most recent value as baseline
        const param = (parametersDataV2?.parameters ?? []).find(
          (p) => p.name.trim().toLowerCase() === action.parameterName.trim().toLowerCase()
        );
        const athleteParam = param ? athleteParamsForGoals.find((pp) => pp.athleticismParameterId === param.id) : undefined;
        const baseline = athleteParam ? latestNumericValue(athleteParam.values) ?? 0 : 0;
        setSmartGoals((prev) => [
          ...prev,
          {
            id: generateId(),
            description: param?.name ?? action.parameterName,
            baselineValue: baseline,
            desiredValue: 0,
            unit: param?.unit ?? "",
            percentChange: 0,
            testDates: [],
            ...(param ? { linkedParameterId: param.id } : {}),
          },
        ]);
        break;
      }
      case "remove_goal":
        setSmartGoals((prev) =>
          prev.filter((g) => (g.description || g.specific || "").toLowerCase() !== action.goalName.toLowerCase())
        );
        break;
      case "remove_event":
        setEvents((prev) =>
          prev.filter((e) => e.name.toLowerCase() !== action.eventName.toLowerCase())
        );
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
        const goalLinkedIds = new Set(getAllMethodsWithAssociations().map(m => m.methodId));
        action.methods.forEach(({ name, rationale, evidence, evidenceQuality }) => {
          if (goalLinkedIds.has(name)) {
            setSelectedMethods((prev) => new Set([...prev, name]));
          } else {
            handleAddManualMethod({ methodId: name, rationale: rationale ?? "", evidence, evidenceQuality: evidenceQuality as EvidenceQuality | undefined });
          }
        });
        break;
      }
      case "remove_methods": {
        action.methodNames.forEach((name) => {
          const isManual = manuallyAddedMethods.some((m) => m.methodId === name);
          if (isManual) {
            handleRemoveManualMethod(name);
          } else {
            toggleMethodSelection(name, false);
          }
        });
        break;
      }
      default:
        break;
    }
  }, [methodsByQuality, handleAddManualMethod, handleRemoveManualMethod, toggleMethodSelection, manuallyAddedMethods, planDuration, applyDatabaseActions]);

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
                planNotesHistory,
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
      {/* Progress Header — sticky so it stays visible while the step content below scrolls */}
      <div className="sticky -top-4 sm:-top-6 lg:-top-8 z-[100] space-y-4 bg-background pt-4 sm:pt-6 lg:pt-8 pb-4">
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
            <AutoSaveIndicator status={autoSaveStatus} />
            <SaveProgramButton />
            <ResourcesButton />
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

      {/* Notes / Brainstorming — top of page for steps 2 and 3. Step 1 has its own
          copy further down, positioned after the Plan & Athlete card instead. */}
      {currentStep !== 1 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Plan strategy</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PlanNotesField {...strategyFieldProps} pdf={strategyPdf} />
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 1 && renderPlanAndGoalSetup()}
        {currentStep === 2 && renderSubGoalsForm()}
        {currentStep === 3 && renderTrainingMethodsForm()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 pb-24">
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
        chatId={WIZARD_CHAT_ID}
        wizardContext={wizardContext}
        onApplySuggestion={handleAIApply}
        promptRequest={strategyPrompt}
        ragContext={ragContext}
        globalContext={aiGlobalContext}
        coachMemoryContext={coachMemoryContext}
        anamnesisContext={anamnesisAIContext || undefined}
      />
    </>
  );
}