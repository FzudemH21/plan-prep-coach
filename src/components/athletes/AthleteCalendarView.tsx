import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameMonth, isWithinInterval } from 'date-fns';
import { parseDateStr } from '@/utils/dateUtils';
import { useCalendarGrid, groupDaysIntoWeeks } from '@/hooks/useCalendarGrid';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Trash2, Calendar, LayoutGrid, Columns, ClipboardList, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Athlete, AthleteCalendarAssignment } from '@/types/athlete';
import { AssignProgramDialog } from './AssignProgramDialog';
import { PlanReviewDialog } from './PlanReviewDialog';
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useAthletes } from '@/hooks/useAthletes';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthleteCalendarEditing } from '@/hooks/useAthleteCalendarEditing';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import {
  shiftExerciseDates,
  shiftDailyIntensityDates,
  shiftSessionSectionDates,
  shiftSupersetDates,
  shiftTrainingDaysDates,
  shiftDaySplitStatesDates,
} from '@/utils/dateShifting';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { syncAthleteSchedule } from '@/utils/athleteScheduleSync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AthleteCalendarWeekRow } from './AthleteCalendarWeekRow';
import { AthleteCalendarDay, AthleteCalendarSession } from './AthleteCalendarDayCell';
import { WorkoutSessionSheet } from '@/components/microcycle-planning/WorkoutSessionSheet';
import { CompletedSessionSheet, CoachSessionLog } from './CompletedSessionSheet';
import { MasterPlannerGrid } from '@/components/microcycle-planning/MasterPlannerGrid';
import { WizardAIAssistant, FocusedSessionContext, ApplySuggestion } from '@/components/wizard/WizardAIAssistant';
import { useRAGRetrieval } from '@/hooks/useRAGRetrieval';
import { useCoachMemory } from '@/hooks/useCoachMemory';
import { useGlobalAIContext } from '@/hooks/useGlobalAIContext';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteAIContext } from '@/hooks/useAthleteAIContext';
import { IntensityLevel } from '@/types/training';
import { cn } from '@/lib/utils';

interface AthleteCalendarViewProps {
  athlete: Athlete;
  /** If supplied, the calendar will jump to show this date's week on mount / when the value changes. */
  initialDate?: string; // yyyy-MM-dd
  /** If supplied, the calendar will auto-open the session sheet for the given date + sessionName. */
  autoOpenSession?: { date: string; sessionName?: string };
  /** Called once after autoOpenSession has been consumed, so the parent can clear it. */
  onAutoOpenHandled?: () => void;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AthleteCalendarView({ athlete, initialDate, autoOpenSession, onAutoOpenHandled }: AthleteCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() =>
    initialDate ? new Date(initialDate + 'T12:00:00') : new Date()
  );

  // Jump whenever the caller changes initialDate (e.g. coach clicked a chat reference)
  useEffect(() => {
    if (initialDate) setCurrentDate(new Date(initialDate + 'T12:00:00'));
  }, [initialDate]);

  // Track which autoOpenSession we've already handled so we don't re-open on re-renders
  const autoOpenHandledRef = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<AthleteCalendarAssignment | null>(null);
  const [reviewAssignment, setReviewAssignment] = useState<AthleteCalendarAssignment | null>(null);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<{
    dayDate: string;
    sessionIndex: number;
    assignmentId: string;
  } | null>(null);

  // Live athlete_schedule data — reflects any session rearrangements the athlete made
  // AND any mobile-coach-app param edits. Keyed by date string.
  interface LiveScheduleExercise {
    id: string;
    /** Stable library exercise ID — fallback lookup key when the distribution id has changed. */
    exerciseLibraryId?: string;
    plannedParams?: Record<string, string | number>;
    visibleParams?: string[];
    /** Exercise-level notes edited on mobile. */
    notes?: string;
    /** Section-level notes (stored per-exercise so they survive plan syncs). */
    sectionId?: string;
    sectionNotes?: string;
    /** True when this exercise was added via the mobile coach app (not in the plan). */
    mobileAdded?: boolean;
    mobileEdited?: boolean;
    // Fields needed to render mobile-added exercises on desktop:
    name?: string;
    order?: number;
    isCircuit?: boolean;
    methodKey?: string;
    plannedSets?: number;
    sectionName?: string;
    sectionOrder?: number;
    supersetId?: string;
    circuitRounds?: string;
    circuitExercises?: unknown[];
  }
  interface LiveScheduleSession {
    id: string;
    sessionName: string;
    exerciseCount: number;
    intensity: string | null;
    /** Session-level notes edited on mobile. */
    notes?: string;
    /** All exercises from athlete_schedule — includes mobile-edited and mobile-added. */
    exercises: LiveScheduleExercise[];
  }
  interface LiveScheduleEntry {
    rowId: string;
    /** Day-level intensity from the athlete_schedule row (editable on mobile). */
    rowIntensity?: string | null;
    sessions: LiveScheduleSession[];
  }
  const [liveScheduleMap, setLiveScheduleMap] = useState<Map<string, LiveScheduleEntry>>(new Map());

  // Completed session logs — keyed by session_id = "${date}-${sessionIndex}"
  const [sessionLogs, setSessionLogs] = useState<Map<string, CoachSessionLog>>(new Map());
  const [sessionLogsLoaded, setSessionLogsLoaded] = useState(false);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const [selectedCompletedLog, setSelectedCompletedLog] = useState<CoachSessionLog | null>(null);
  
  // Master planner state
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // 1=Monday
  const [masterWeeksToDisplay, setMasterWeeksToDisplay] = useState(4);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  
  // Ref-based drag end timestamp for SYNCHRONOUS click suppression
  // State was too slow - React re-render happens AFTER onClick fires
  const lastDragEndRef = useRef<number>(0);
  
  // Global click suppression: swallow the very next click after any drag
  const suppressNextClickRef = useRef(false);
  const suppressNextClickTimeoutRef = useRef<number | null>(null);

  // Prevent spamming the user with repeated "sync failed" toasts — show at most once per mount
  const syncErrorShownRef = useRef(false);

  // Track which assignment IDs have already received a load-time sync so we don't repeat it
  const loadSyncedRef = useRef<Set<string>>(new Set());
  
  // Install global capture-phase click listener to swallow post-drag clicks
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('click', handler, true); // Capture phase
    return () => {
      window.removeEventListener('click', handler, true);
      if (suppressNextClickTimeoutRef.current) {
        clearTimeout(suppressNextClickTimeoutRef.current);
      }
    };
  }, []);

  const { user } = useAuth();
  const { programs, getProgram } = useTrainingPrograms();
  const athleteData = useAthletes();
  const { data: toolboxData } = useToolboxData();
  const { toast } = useToast();
  const { getConnectionForAthlete, loading: connectionsLoading } = useAthleteConnections();
  const { addEvent: addCalendarEvent, addEvents: addCalendarEvents, deleteEvent: deleteCalendarEvent, getEventsForAthlete, getEventsForDate } = useCalendarEvents();

  // AI assistant state
  const [aiOpenTrigger, setAiOpenTrigger] = useState(0);
  const [focusedSessionCtx, setFocusedSessionCtx] = useState<FocusedSessionContext | undefined>(undefined);

  // AI context hooks
  const { retrieve: ragRetrieve } = useRAGRetrieval();
  const [ragContext, setRagContext] = useState('');
  const globalAIContext = useGlobalAIContext();
  const { coachMemoryContext } = useCoachMemory();
  const { data: parametersData } = useParametersDataV2();

  /** Enrich calendar events with the unit from the parameter database so the
   *  athlete app can display "Goal: 10.5 s" rather than just "Goal: 10.5". */
  const enrichEvents = useCallback((events: ReturnType<typeof getEventsForAthlete>) =>
    events.map(ev => ({
      ...ev,
      unit: ev.parameterId
        ? parametersData?.parameters.find(p => p.id === ev.parameterId)?.unit
        : undefined,
    })),
  [parametersData]);

  // Sort newest-first so the default selection is always the most recently assigned program.
  // Without this, assignments[0] is the oldest (insertion order), so the desktop would load
  // an old desktop-assigned program with a localStorage key and load-sync it — overwriting
  // the athlete_schedule rows that the mobile assign-flow just wrote.
  const assignments = useMemo(() => {
    return athleteData.getAthleteCalendarAssignments(athlete.id)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [athleteData, athlete.id]);

  // Auto-open a specific session when `autoOpenSession` prop is set (e.g. coach clicked reference chip)
  useEffect(() => {
    if (!autoOpenSession) return;
    const key = `${autoOpenSession.date}::${autoOpenSession.sessionName ?? ''}`;
    if (autoOpenHandledRef.current === key) return;
    if (assignments.length === 0) return; // wait for assignments to load
    if (!sessionLogsLoaded) return; // wait for session logs so we can decide which sheet to open

    const { date, sessionName } = autoOpenSession;

    // Find the assignment that covers this date
    const assignment = assignments.find((a) => date >= a.startDate && date <= a.endDate);
    if (!assignment) return;

    // Find session index: prefer live schedule map, fall back to 0
    let sessionIndex = 0;
    const liveEntry = liveScheduleMap.get(date);
    if (liveEntry && sessionName) {
      const idx = liveEntry.sessions.findIndex((s) => s.sessionName === sessionName);
      if (idx >= 0) sessionIndex = idx;
    }

    autoOpenHandledRef.current = key;
    onAutoOpenHandled?.();
    setSelectedAssignmentId(assignment.id);

    // Prefer the completed session log if it exists (athlete has logged this session)
    // session_id format = "${assignment.id}-${date}-${sessionIndex}" (matches athleteScheduleSync)
    const logKey = `${assignment.id}-${date}-${sessionIndex}`;
    const completedLog = sessionLogs.get(logKey);
    if (completedLog) {
      setSelectedCompletedLog(completedLog);
      setCompletedSheetOpen(true);
    } else {
      setSelectedSessionInfo({ dayDate: date, sessionIndex, assignmentId: assignment.id });
      setSessionSheetOpen(true);
    }
  }, [autoOpenSession, assignments, liveScheduleMap, sessionLogs, sessionLogsLoaded, onAutoOpenHandled]);

  // Load live athlete_schedule from Supabase to reflect any session rearrangements.
  // Re-fetches whenever the athlete changes or connections finish loading.
  // Re-fetches whenever the athlete changes, connections finish loading, or the visible
  // date range changes. Scoped to calendarDateRange (typically 28 days for 4-week view)
  // instead of a fixed 150-day window so the payload stays small. Results are merged
  // into the existing map (not replaced) so navigating months doesn't flash empty.
  useEffect(() => {
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection || connectionsLoading) return;
    if (calendarDateRange.length === 0) return;

    const from = format(calendarDateRange[0], 'yyyy-MM-dd');
    const to   = format(calendarDateRange[calendarDateRange.length - 1], 'yyyy-MM-dd');

    supabase
      .from('athlete_schedule')
      .select('id, date, sessions, intensity')
      .eq('athlete_connection_id', connection.id)
      .gte('date', from)
      .lte('date', to)
      .then(({ data }) => {
        if (!data) return;
        // Cast broadly — we capture all fields that mobile coach can edit.
        type RawSession = {
          id: string; name: string; exerciseCount: number; intensity?: string; notes?: string;
          exercises?: LiveScheduleExercise[];
        };
        setLiveScheduleMap(prev => {
          const next = new Map(prev);
          data.forEach((row: Record<string, unknown>) => {
            const rawSessions = (row.sessions as RawSession[]) ?? [];
            next.set(row.date as string, {
              rowId: row.id as string,
              rowIntensity: row.intensity as string | null,
              sessions: rawSessions.map(s => ({
                id: s.id,
                sessionName: s.name,
                exerciseCount: s.exerciseCount ?? 0,
                intensity: s.intensity ?? null,
                notes: s.notes,
                exercises: (s.exercises ?? []) as LiveScheduleExercise[],
              })),
            });
          });
          return next;
        });
      });
  }, [athlete.id, connectionsLoading, getConnectionForAthlete, calendarDateRange]);

  // Realtime subscription — update liveScheduleMap whenever athlete_schedule rows change
  // so desktop reflects mobile coach saves without needing a page reload.
  useEffect(() => {
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection || connectionsLoading) return;

    // Helper: build a LiveScheduleEntry from a raw Supabase row.
    const buildLiveEntry = (row: Record<string, unknown>): LiveScheduleEntry => {
      type RawSession = {
        id: string; name: string; exerciseCount: number; intensity?: string; notes?: string;
        exercises?: LiveScheduleExercise[];
      };
      const rawSessions = (row.sessions as RawSession[]) ?? [];
      return {
        rowId: row.id as string,
        rowIntensity: row.intensity as string | null,
        sessions: rawSessions.map(s => ({
          id: s.id,
          sessionName: s.name,
          exerciseCount: s.exerciseCount ?? 0,
          intensity: s.intensity ?? null,
          notes: s.notes,
          exercises: (s.exercises ?? []) as LiveScheduleExercise[],
        })),
      };
    };

    const channel = supabase
      .channel(`athlete_schedule_live_${connection.id}`)
      .on(
        'postgres_changes' as any,
        {
          // Listen to both UPDATE (mobile coach save) and INSERT (post auto-sync upsert)
          event: '*',
          schema: 'public',
          table: 'athlete_schedule',
          filter: `athlete_connection_id=eq.${connection.id}`,
        },
        (payload: { eventType: string; new: Record<string, unknown> }) => {
          if (payload.eventType === 'DELETE') return; // ignore deletes
          const row = payload.new;
          const entry = buildLiveEntry(row);
          setLiveScheduleMap(prev => {
            const next = new Map(prev);
            next.set(row.date as string, entry);
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [athlete.id, connectionsLoading, getConnectionForAthlete]);

  // RAG retrieval — re-query when athlete changes
  useEffect(() => {
    const sports = [...(athlete.sports ?? []), ...(!athlete.sports && athlete.sport ? [athlete.sport] : [])];
    const query = sports.length > 0
      ? `athlete training ${sports.join(' ')} session design performance monitoring`
      : 'athlete training session design performance monitoring';
    ragRetrieve(query).then(setRagContext);
  }, [ragRetrieve, athlete.id]);

  // Editing hook — must be declared before useAthleteAIContext which references editing.exerciseDistribution
  const editing = useAthleteCalendarEditing(selectedAssignmentId, assignments);

  // Auto-sync to athlete_schedule whenever the editing hook persists a change to localStorage.
  // This ensures manually-added sessions and exercises appear in the athlete app without
  // requiring a full plan re-assignment.
  useEffect(() => {
    if (!editing.lastSavedAt || !selectedAssignmentId) return;
    // Skip if the desktop has no exercise data to contribute.
    // Guard A: mobile-created flag — set when initializeFromAssignment runs (no localStorage key).
    // While exercises are still empty, refuse to sync regardless of other conditions.
    if (editing.isMobileCreated && editing.exerciseDistribution.length === 0) return;
    // Guard B: belt-and-suspenders — also skip if exercises are empty and no localStorage key exists.
    if (
      editing.exerciseDistribution.length === 0 &&
      !localStorage.getItem(`athlete-assignment-${selectedAssignmentId}`)
    ) return;
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection) {
      // Distinguish: connections still loading vs. athlete has no invite link
      if (!connectionsLoading) {
        console.warn('[autoSync] no connection found for athlete', athlete.id,
          '— schedule sync skipped. Open the athlete profile → Invite tab and create an invite link to enable app sync.');
      }
      return;
    }
    const assignment = editing.selectedAssignment;
    if (!assignment) return;
    syncAthleteSchedule(
      connection.id,
      assignment,
      editing.trainingDays,
      editing.exerciseDistribution,
      assignment.programName ?? 'Training Plan',
      editing.parameterValues,
      editing.sessionSections,
      toolboxData?.entries,
      editing.supersets,
      editing.sessionIntensities,
      enrichEvents(getEventsForAthlete(athlete.id)),
    ).catch(e => {
      console.error('[autoSync] ✗ sync failed:', e);
      // Show a toast once per mount so the coach knows something is wrong
      if (!syncErrorShownRef.current) {
        syncErrorShownRef.current = true;
        toast({
          title: 'Athlete schedule sync failed',
          description: e?.message ?? 'Check the browser console (F12) for details.',
          variant: 'destructive',
        });
      }
    });
  // Re-run when a save completes OR when connections finish loading (so a save
  // that was deferred due to "connections still loading" gets retried automatically).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing.lastSavedAt, connectionsLoading]);

  // Re-sync to athlete_schedule once per assignment when data finishes loading.
  // This ensures stale Supabase records (written before a code fix) are refreshed
  // even when the coach makes no edits that would trigger the auto-save path.
  useEffect(() => {
    if (!selectedAssignmentId) return;
    if (editing.isInitializing) return;
    if (!editing.selectedAssignment || editing.trainingDays.length === 0) return;
    if (connectionsLoading) return;
    if (loadSyncedRef.current.has(selectedAssignmentId)) return;

    // Skip if there is no localStorage snapshot for this assignment.
    // Assignments created on mobile never write a desktop localStorage entry,
    // so `initializeFromAssignment` is used and exerciseDistribution is empty.
    // Syncing an empty payload would DELETE the Supabase rows the mobile
    // assign-flow wrote, making the training calendar appear blank on next open.
    if (!localStorage.getItem(`athlete-assignment-${selectedAssignmentId}`)) return;

    const connection = getConnectionForAthlete(athlete.id);
    if (!connection) return;

    // Skip if this assignment was already synced in the last 5 minutes within this browser
    // session. Prevents the expensive DELETE+UPSERT from running on every tab re-open when
    // the data hasn't changed. The autoSync path (editing.lastSavedAt) is unaffected.
    const sessionSyncKey = `schedule-synced-${connection.id}-${selectedAssignmentId}`;
    const lastSyncTime = sessionStorage.getItem(sessionSyncKey);
    if (lastSyncTime && (Date.now() - Number(lastSyncTime)) < 5 * 60 * 1000) {
      loadSyncedRef.current.add(selectedAssignmentId);
      return;
    }

    // If parameterValues is empty but the assignment has periodization-sourced
    // exercises, avoid overwriting correct Supabase data (written by the
    // assign-time sync) with an empty payload. Try to recover from the wizard's
    // active localStorage key first; skip entirely if recovery also fails.
    let loadSyncParamValues: typeof editing.parameterValues = editing.parameterValues;
    const hasPeriodizationExercises = editing.exerciseDistribution.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ex) => (ex as any).parameterSource !== 'toolbox'
    );
    if (hasPeriodizationExercises && Object.keys(loadSyncParamValues).length === 0) {
      try {
        const localPvStr = localStorage.getItem('parameterValues');
        if (localPvStr) {
          const localPv = JSON.parse(localPvStr);
          if (localPv && Object.keys(localPv).length > 0) {
            // Validate: at least one key matches a mesocycle ID from the current assignment
            const assignedMesoIds = new Set<string>(
              (editing.selectedAssignment?.assignedMesocycles ?? []).map(m => m.id).filter(Boolean)
            );
            const hasMatch = assignedMesoIds.size === 0 ||
              Object.keys(localPv).some(k => assignedMesoIds.has(k));
            if (hasMatch) {
              loadSyncParamValues = localPv as typeof editing.parameterValues;
            }
          }
        }
      } catch {
        // ignore
      }

      if (Object.keys(loadSyncParamValues).length === 0) {
        return;
      }
    }

    loadSyncedRef.current.add(selectedAssignmentId);
    syncAthleteSchedule(
      connection.id,
      editing.selectedAssignment,
      editing.trainingDays,
      editing.exerciseDistribution,
      editing.selectedAssignment.programName ?? 'Training Plan',
      loadSyncParamValues,
      editing.sessionSections,
      toolboxData?.entries,
      editing.supersets,
      editing.sessionIntensities,
      enrichEvents(getEventsForAthlete(athlete.id)),
    ).then(() => {
      sessionStorage.setItem(sessionSyncKey, String(Date.now()));
    }).catch(e => console.error('[loadSync] ✗ sync failed:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssignmentId, editing.isInitializing, editing.trainingDays.length, connectionsLoading]);

  // Wrappers that save the event AND immediately patch the athlete_schedule row so
  // the athlete app sees the new test/event without a full plan re-sync.
  const handleAddCalendarEvent = useCallback(async (
    athleteId: string,
    eventPayload: Omit<import('@/hooks/useCalendarEvents').CalendarEvent, 'id'>,
  ) => {
    const newEvent = await addCalendarEvent(athleteId, eventPayload);
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection) return;

    const { data: row } = await supabase
      .from('athlete_schedule')
      .select('id, events')
      .eq('athlete_connection_id', connection.id)
      .eq('date', eventPayload.date)
      .maybeSingle();

    const newEntry = {
      id: newEvent.id,
      type: newEvent.type,
      title: newEvent.title,
      notes: newEvent.notes ?? undefined,
      targetValue: newEvent.targetValue ?? undefined,
      unit: newEvent.unit ?? undefined,
      parameterId: newEvent.parameterId ?? undefined,
    };

    if (row) {
      const existing = (row.events as unknown[]) ?? [];
      await supabase
        .from('athlete_schedule')
        .update({ events: [...existing, newEntry] })
        .eq('id', row.id)
        .eq('athlete_connection_id', connection.id);
    } else {
      // Rest day with no existing row — create one
      await supabase
        .from('athlete_schedule')
        .insert({
          athlete_connection_id: connection.id,
          date: eventPayload.date,
          sessions: [],
          events: [newEntry],
        });
    }
  }, [addCalendarEvent, getConnectionForAthlete, athlete.id]);

  const handleDeleteCalendarEvent = useCallback(async (athleteId: string, eventId: string) => {
    // Find the event to get its date before deleting
    const allEvents = getEventsForAthlete(athleteId);
    const ev = allEvents.find(e => e.id === eventId);
    await deleteCalendarEvent(athleteId, eventId);

    if (!ev) return;
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection) return;

    const { data: row } = await supabase
      .from('athlete_schedule')
      .select('id, events')
      .eq('athlete_connection_id', connection.id)
      .eq('date', ev.date)
      .maybeSingle();

    if (row) {
      const updated = ((row.events as Array<{ id: string }>) ?? []).filter(e => e.id !== eventId);
      await supabase
        .from('athlete_schedule')
        .update({ events: updated })
        .eq('id', row.id)
        .eq('athlete_connection_id', connection.id);
    }
  }, [deleteCalendarEvent, getConnectionForAthlete, getEventsForAthlete, athlete.id]);

  // Athlete-specific AI context
  const athleteAIContext = useAthleteAIContext({
    athlete,
    performanceParameters: athleteData.athletePerformanceParameters.filter(p => p.athleteId === athlete.id),
    assignments,
    calendarEvents: getEventsForAthlete(athlete.id),
    programs,
    parametersData: parametersData ?? null,
    exerciseDistribution: editing.exerciseDistribution,
  });

  // AI apply handler — intensity changes can be applied directly; session-level
  // actions should be triggered from within the session sheet
  const handleAIApply = useCallback((action: ApplySuggestion) => {
    if (action.type === 'set_day_intensity') {
      editing.handleDayIntensityChange(action.dayDate, action.intensity as IntensityLevel);
    } else if (action.type === 'set_session_intensity') {
      editing.handleSessionIntensityChange(action.dayDate, action.sessionIndex, action.intensity as IntensityLevel);
    } else if (action.type === 'set_exercise_params') {
      // Apply parameter overrides (sets/reps/intensity/etc.) directly from the calendar.
      // handleParameterChange persists to parameterValues so the change is visible
      // when the session sheet opens, enabling bulk changes across many sessions.
      Object.entries(action.params).forEach(([paramName, value]) => {
        editing.handleParameterChange(
          action.dayDate,
          action.sessionIndex,
          action.methodId,
          '',
          paramName,
          value,
        );
      });
    } else if (action.type === 'set_exercise_param_override') {
      // Per-exercise overrides: update parameterOverrides on the specific ExerciseDistribution entry
      editing.setExerciseDistribution(prev =>
        prev.map(ex => {
          const match = action.entries.find(
            e => e.exerciseId === ex.exerciseId && e.dayDate === ex.dayDate && e.sessionIndex === ex.sessionIndex
          );
          if (!match) return ex;
          return { ...ex, parameterOverrides: { ...(ex.parameterOverrides ?? {}), ...match.params } };
        })
      );
      const names = [...new Set(action.entries.map(e => e.exerciseName))];
      const count = action.entries.length;
      toast({ title: `Per-exercise overrides applied`, description: `${names.join(', ')} — ${count} slot${count !== 1 ? 's' : ''} updated` });
    } else {
      toast({
        title: 'Open the session to apply',
        description: 'Click on a session first, then use the AI assistant from within it for this type of change.',
      });
    }
  }, [editing, toast]);

  // Store a map of assignment ID -> stored program data for quick lookups
  const [assignmentDataCache, setAssignmentDataCache] = useState<Record<string, any>>({});
  
  // Load assignment data from localStorage for all assignments
  useEffect(() => {
    if (assignments.length === 0) {
      if (Object.keys(assignmentDataCache).length > 0) {
        setAssignmentDataCache({});
      }
      return;
    }
    
    const cache: Record<string, any> = {};
    let hasNewData = false;

    assignments.forEach(assignment => {
      // Check if already cached
      if (assignmentDataCache[assignment.id]) {
        cache[assignment.id] = assignmentDataCache[assignment.id];
        return;
      }

      // New assignment ID not yet in cache — mark as new regardless of localStorage
      hasNewData = true;

      const storageKey = `athlete-assignment-${assignment.id}`;
      try {
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          cache[assignment.id] = JSON.parse(savedData);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    // Only update if we found new data
    if (hasNewData || Object.keys(cache).length !== Object.keys(assignmentDataCache).length) {
      setAssignmentDataCache(cache);
    }
  }, [assignments]); // intentionally exclude assignmentDataCache to prevent infinite loop

  // Initialize selected assignment when assignments change
  useEffect(() => {
    if (assignments.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  // Wrapper: clear day in editing state AND patch assignmentDataCache so non-selected
  // assignment rendering (cache path) immediately reflects the cleared state.
  // Optimistic wrapper: remove the session from liveScheduleMap immediately so
  // the calendar reflects the deletion without waiting for autoSync → realtime.
  const handleDeleteSession = useCallback((dayDate: string, sessionIndex: number) => {
    setLiveScheduleMap(prev => {
      const entry = prev.get(dayDate);
      if (!entry) return prev;
      const newSessions = entry.sessions.filter((_, idx) => idx !== sessionIndex);
      const next = new Map(prev);
      next.set(dayDate, { ...entry, sessions: newSessions });
      return next;
    });
    editing.handleDeleteSession(dayDate, sessionIndex);
  }, [editing]);

  const handleClearDay = useCallback((dayDate: string) => {
    // Block clearing if any session on this day has been completed by the athlete
    const hasCompleted = Array.from(sessionLogs.keys()).some(key => key.startsWith(`${dayDate}-`));
    if (hasCompleted) {
      toast({
        title: 'Cannot clear day',
        description: 'This day contains completed sessions and cannot be cleared.',
        variant: 'destructive',
      });
      return;
    }
    editing.handleClearDay(dayDate);
    if (!selectedAssignmentId) return;
    setAssignmentDataCache(prev => {
      const current = prev[selectedAssignmentId];
      if (!current) return prev;
      return {
        ...prev,
        [selectedAssignmentId]: {
          ...current,
          daySplitStates: { ...(current.daySplitStates || {}), [dayDate]: 0 },
          trainingDays: (current.trainingDays || []).map((d: any) =>
            d.date === dayDate
              ? { ...d, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false }
              : d
          ),
          exerciseDistribution: (current.exerciseDistribution || []).filter((ex: any) => ex.dayDate !== dayDate),
          sessionSections: (current.sessionSections || []).filter((s: any) => s.dayDate !== dayDate),
        },
      };
    });
    // Remove from liveScheduleMap immediately so the calendar reflects the clear
    // before auto-sync or Supabase realtime catches up.
    setLiveScheduleMap(prev => {
      const next = new Map(prev);
      next.delete(dayDate);
      return next;
    });
    // Also delete the Supabase row directly — mobile-created assignments skip
    // auto-sync entirely, so without this the row would never be cleaned up and
    // would reappear via the realtime subscription on the next mutation.
    const connection = getConnectionForAthlete(athlete.id);
    if (connection) {
      supabase
        .from('athlete_schedule')
        .delete()
        .eq('athlete_connection_id', connection.id)
        .eq('date', dayDate)
        .then(() => { /* ignore result — liveScheduleMap already cleared optimistically */ });
    }
    toast({ title: 'Day cleared' });
  }, [editing.handleClearDay, selectedAssignmentId, getConnectionForAthlete, athlete.id, sessionLogs, toast]);

  // Wrapper: clear week in editing state AND patch assignmentDataCache.
  const handleClearWeek = useCallback((weekStartDate: string) => {
    const [cy, cm, cd] = weekStartDate.split('-').map(Number);
    const startDateVal = new Date(cy, cm - 1, cd);
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDateVal);
      d.setDate(d.getDate() + i);
      weekDates.push(format(d, 'yyyy-MM-dd'));
    }

    // Separate days: completed (locked) vs clearable
    const completedDates = new Set(
      weekDates.filter(date => Array.from(sessionLogs.keys()).some(key => key.startsWith(`${date}-`)))
    );
    const clearableDates = weekDates.filter(date => !completedDates.has(date));

    if (completedDates.size > 0) {
      toast({
        title: completedDates.size === weekDates.length ? 'Cannot clear week' : 'Week partially cleared',
        description: completedDates.size === weekDates.length
          ? 'All days in this week have completed sessions and cannot be cleared.'
          : `${completedDates.size} day(s) with completed sessions were skipped.`,
        variant: completedDates.size === weekDates.length ? 'destructive' : 'default',
      });
      if (completedDates.size === weekDates.length) return;
    }

    // Only clear days that have no completed sessions
    clearableDates.forEach(date => editing.handleClearDay(date));

    if (!selectedAssignmentId) return;
    setAssignmentDataCache(prev => {
      const current = prev[selectedAssignmentId];
      if (!current) return prev;
      const clearedSplitStates = { ...(current.daySplitStates || {}) };
      clearableDates.forEach(date => { clearedSplitStates[date] = 0; });
      return {
        ...prev,
        [selectedAssignmentId]: {
          ...current,
          daySplitStates: clearedSplitStates,
          trainingDays: (current.trainingDays || []).map((d: any) =>
            clearableDates.includes(d.date)
              ? { ...d, sessions: 0, sessionNames: [], testNames: [], eventNames: [], isTestDay: false, isEventDay: false }
              : d
          ),
          exerciseDistribution: (current.exerciseDistribution || []).filter((ex: any) => !clearableDates.includes(ex.dayDate)),
          sessionSections: (current.sessionSections || []).filter((s: any) => !clearableDates.includes(s.dayDate)),
        },
      };
    });
    // Remove cleared dates from liveScheduleMap immediately.
    setLiveScheduleMap(prev => {
      const next = new Map(prev);
      clearableDates.forEach(date => next.delete(date));
      return next;
    });
    // Delete Supabase rows directly — needed for mobile-created assignments that skip auto-sync.
    const connection = getConnectionForAthlete(athlete.id);
    if (connection && clearableDates.length > 0) {
      supabase
        .from('athlete_schedule')
        .delete()
        .eq('athlete_connection_id', connection.id)
        .in('date', clearableDates)
        .then(() => { /* ignore result — liveScheduleMap already cleared optimistically */ });
    }
    if (completedDates.size === 0) {
      toast({ title: 'Week cleared' });
    }
  }, [editing.handleClearDay, selectedAssignmentId, sessionLogs, toast, getConnectionForAthlete, athlete.id]);

  // Build mesocycle from assignment for MasterPlannerGrid
  const currentMesocycleFromAssignment = useMemo(() => {
    if (!editing.selectedAssignment) return undefined;
    
    const meso = (editing.selectedAssignment.assignedMesocycles || [])[0];
    if (!meso) return undefined;
    
    return {
      id: meso.id,
      name: meso.name,
      weeks: meso.weeks,
      sessionsPerWeek: meso.sessionsPerWeek,
      sessionLength: meso.sessionLength,
      startDate: parseDateStr(meso.startDate),
      endDate: parseDateStr(meso.endDate),
      duration: meso.duration,
      intensity: meso.intensity as any,
      microcycles: (meso.microcycles || []).map(m => ({
        id: m.id,
        name: m.name,
        duration: m.duration,
        intensity: m.intensity as any,
      })),
      trainingMethods: [],
      trainingQualities: meso.trainingQualities,
      allocatedSubGoals: meso.allocatedSubGoals,
    };
  }, [editing.selectedAssignment]);

  // Shared calendar grid date range calculation
  const { dateRange: calendarDateRange } = useCalendarGrid(currentDate, viewMode);

  // Query athlete_session_logs for the visible date range whenever the connection or
  // visible window changes. Keyed by session_id = "${date}-${sessionIndex}".
  useEffect(() => {
    const connection = getConnectionForAthlete(athlete.id);
    if (!connection || calendarDateRange.length === 0) return;
    let cancelled = false;

    const from = format(calendarDateRange[0], 'yyyy-MM-dd');
    const to   = format(calendarDateRange[calendarDateRange.length - 1], 'yyyy-MM-dd');

    supabase
      .from('athlete_session_logs')
      .select('id, date, session_id, session_name, started_at, borg_rating, duration_seconds, completed_at, comment, sets_logged')
      .eq('athlete_connection_id', connection.id)
      .not('started_at', 'is', null)
      .gte('date', from)
      .lte('date', to)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map = new Map<string, CoachSessionLog>();
        for (const row of data) {
          if (row.session_id) {
            map.set(row.session_id as string, row as CoachSessionLog);
          }
        }
        setSessionLogs(map);
        setSessionLogsLoaded(true);
      });

    return () => { cancelled = true; };
  }, [athlete.id, getConnectionForAthlete, calendarDateRange]);

  const handleCompletedSessionClick = useCallback((log: CoachSessionLog) => {
    setSelectedCompletedLog(log);
    setCompletedSheetOpen(true);
  }, []);

  // For mobile-created assignments (no localStorage data), derive per-day intensities
  // from the program's planned dailyIntensityData, shifted to the assignment's start date.
  // This gives meaningful intensity colours even when athlete_schedule.intensity is null
  // (old syncs that pre-date the intensity-merge fix in CoachMobileAssignProgramPage).
  const programIntensityMap = useMemo(() => {
    if (!editing.isMobileCreated) return null;
    const assignment = editing.selectedAssignment;
    if (!assignment?.programId) return null;
    const program = getProgram(assignment.programId);
    if (!program?.dailyIntensityData?.length) return null;
    const origDate = parseDateStr(assignment.originalStartDate ?? assignment.startDate);
    const newDate = parseDateStr(assignment.startDate);
    const shifted = shiftDailyIntensityDates(program.dailyIntensityData, origDate, newDate);
    const map = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shifted.forEach((di: any) => { if (di.date && di.intensity) map.set(di.date, di.intensity); });
    return map;
  }, [editing.isMobileCreated, editing.selectedAssignment, getProgram]);

  // Calculate calendar days based on view mode (for calendar view)
  // IMPORTANT: For the currently selected assignment, read from live editing state
  // to ensure immediate visual feedback after paste/copy operations
  const calendarDays = useMemo((): AthleteCalendarDay[] => {
    if (viewMode === 'master') return [];

    // ── Build lookup Maps once (O(n) setup) so each day uses O(1) lookups ──────
    // Previously each day did O(n) .filter/.find scans through all exercises/trainingDays/etc.
    // With 90 visible days × 500+ exercises that was ~45k iterations per render.

    const liveExsByDate = new Map<string, typeof editing.exerciseDistribution>();
    for (const ex of editing.exerciseDistribution) {
      const key = (ex as any).dayDate as string;
      if (key) {
        if (!liveExsByDate.has(key)) liveExsByDate.set(key, []);
        liveExsByDate.get(key)!.push(ex);
      }
    }

    const liveTdByDate = new Map<string, any>();
    for (const td of editing.trainingDays) {
      if ((td as any).date) liveTdByDate.set((td as any).date, td);
    }

    const liveDiByDate = new Map<string, any>();
    for (const d of editing.dailyIntensityData) {
      if ((d as any).date) liveDiByDate.set((d as any).date, d);
    }

    // Maps for each cached (non-selected) assignment
    const cachedMapsById = new Map<string, {
      exsByDate: Map<string, any[]>;
      tdByDate: Map<string, any>;
      diByDate: Map<string, any>;
    }>();
    for (const [assignId, cachedData] of Object.entries(assignmentDataCache)) {
      const exsByDate = new Map<string, any[]>();
      for (const ex of ((cachedData as any)?.exerciseDistribution ?? [])) {
        const key = ex.dayDate as string;
        if (key) {
          if (!exsByDate.has(key)) exsByDate.set(key, []);
          exsByDate.get(key)!.push(ex);
        }
      }
      const tdByDate = new Map<string, any>();
      for (const td of ((cachedData as any)?.trainingDays ?? [])) {
        if (td.date) tdByDate.set(td.date, td);
      }
      const diByDate = new Map<string, any>();
      for (const d of ((cachedData as any)?.dailyIntensity ?? [])) {
        if (d.date) diByDate.set(d.date, d);
      }
      cachedMapsById.set(assignId, { exsByDate, tdByDate, diByDate });
    }

    // Hoist per-assignment lookups that are constant across all days
    const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
    const assignmentBounds = assignments.map(a => ({
      assignment: a,
      start: parseDateStr(a.startDate),
      end: parseDateStr(a.endDate),
    }));

    return calendarDateRange.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');

      // Extract session data for this specific day
      const sessions: AthleteCalendarSession[] = [];
      let assignmentId: string | undefined;
      let programName: string | undefined;
      let usedLiveEditingState = false;

      // CRITICAL FIX: Check live editing state FIRST for the selected assignment
      // This allows pasted content to display even on dates OUTSIDE the original assignment range
      if (selectedAssignmentId) {
        const liveExercises = liveExsByDate.get(dateString) ?? [];
        const liveSplitState = editing.daySplitStates[dateString];
        const liveTrainingDay = liveTdByDate.get(dateString);

        const hasLiveExercises = liveExercises.length > 0;
        const hasLiveSessions = liveSplitState !== undefined && liveSplitState > 0;
        // CRITICAL: If liveSplitState is defined (even as 0), the editing hook has authoritative state
        const hasExplicitEditingState = liveSplitState !== undefined || liveTrainingDay !== undefined;
        const hasLiveData = hasLiveExercises || hasLiveSessions;

        if (hasLiveData || hasExplicitEditingState) {
          if (hasExplicitEditingState || hasLiveExercises || hasLiveSessions) {
            usedLiveEditingState = true;
          }
          assignmentId = selectedAssignmentId;
          programName = selectedAssignment?.programName;

          // Get day intensity from live dailyIntensity data, fall back to trainingDays intensity
          let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || '5';
          const liveDayIntensity = liveDiByDate.get(dateString);
          if (liveDayIntensity?.intensity) {
            dayIntensity = liveDayIntensity.intensity as IntensityLevel;
          }

          // FIX: Use actual splitState value - 0 means cleared day.
          // Fall back to liveTrainingDay.sessions when daySplitStates hasn't been initialised yet.
          const numSessions = liveSplitState ?? liveTrainingDay?.sessions ?? 0;
          // Suppress ghost sessions: if dailyIntensityData says 'off' and there are no
          // actual exercises, the day is a rest day – regardless of what daySplitStates
          // says (can be corrupted to 1 by the fallback merge path).
          const effectiveNumSessions = dayIntensity === 'off' && !hasLiveExercises ? 0 : numSessions;
          if (effectiveNumSessions > 0 || hasLiveExercises) {
            const sessionCount = effectiveNumSessions > 0 ? effectiveNumSessions : 1;
            for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
              const sessionId = `${selectedAssignmentId}-${dateString}-${sessionIdx}`;
              const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
              const exerciseCount = liveExercises.filter(
                (ex: any) => ex.sessionIndex === sessionIdx
              ).length;

              const perSessionKey = `${dateString}-${sessionIdx}`;
              const sessionIntensity = editing.sessionIntensities?.[perSessionKey] ?? dayIntensity;

              sessions.push({
                id: sessionId,
                sessionIndex: sessionIdx,
                sessionName,
                exerciseCount,
                intensity: sessionIntensity,
                assignmentId: selectedAssignmentId,
              });
            }
          }
        }
      }

      // Always render cached assignments for non-selected assignments.
      // The live editing path above only handles selectedAssignmentId.
      // Skip selectedAssignmentId here only if live editing already handled it —
      // otherwise (usedLiveEditingState=false) it still needs to run through this path.
      {
        const dayAssignments = assignmentBounds.filter(({ assignment, start, end }) => {
          if (assignment.id === selectedAssignmentId && usedLiveEditingState) return false;
          return isWithinInterval(date, { start, end });
        });

        dayAssignments.forEach(({ assignment }) => {
          assignmentId = assignment.id;
          programName = assignment.programName;

          const isEditingAssignment = assignment.id === selectedAssignmentId;

          if (isEditingAssignment) {
            // Use live editing state for immediate updates
            const liveExercises = liveExsByDate.get(dateString) ?? [];
            const liveSplitState = editing.daySplitStates[dateString];
            const liveTrainingDay = liveTdByDate.get(dateString);

            let dayIntensity: IntensityLevel = liveTrainingDay?.intensity || '5';
            const liveDayIntensity = liveDiByDate.get(dateString);
            if (liveDayIntensity?.intensity) {
              dayIntensity = liveDayIntensity.intensity as IntensityLevel;
            }

            const hasExercises = liveExercises.length > 0;
            const numSessions = liveSplitState ?? liveTrainingDay?.sessions ?? 0;
            const isTrainingDay = hasExercises || numSessions > 0;

            if (isTrainingDay) {
              const sessionCount = numSessions > 0 ? numSessions : 1;
              for (let sessionIdx = 0; sessionIdx < sessionCount; sessionIdx++) {
                const sessionId = `${assignment.id}-${dateString}-${sessionIdx}`;
                const sessionName = liveTrainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
                const exerciseCount = liveExercises.filter(
                  (ex: any) => ex.sessionIndex === sessionIdx
                ).length;

                const perSessionKey = `${dateString}-${sessionIdx}`;
                const sessionIntensity = editing.sessionIntensities?.[perSessionKey] ?? dayIntensity;

                sessions.push({
                  id: sessionId,
                  sessionIndex: sessionIdx,
                  sessionName,
                  exerciseCount,
                  intensity: sessionIntensity,
                  assignmentId: assignment.id,
                });
              }
            }
          } else {
            // Use cache for other (non-editing) assignments
            const cachedData = assignmentDataCache[assignment.id];
            const cm = cachedMapsById.get(assignment.id);
            const trainingDay = cm?.tdByDate.get(dateString);
            const numSessions = cachedData?.daySplitStates?.[dateString] ?? trainingDay?.sessions ?? 1;

            let dayIntensity: IntensityLevel = 'moderate';
            if (cachedData?.dailyIntensity) {
              const storedDayIntensity = cm?.diByDate.get(dateString);
              if (storedDayIntensity?.intensity) {
                dayIntensity = storedDayIntensity.intensity as IntensityLevel;
              }
            }

            const dayExercises = cm?.exsByDate.get(dateString);
            const hasExercises = (dayExercises?.length ?? 0) > 0;
            const splitState = cachedData?.daySplitStates?.[dateString];
            const isTrainingDay = hasExercises || trainingDay?.isTrainingDay || (splitState !== undefined && splitState > 0);

            if (isTrainingDay) {
              for (let sessionIdx = 0; sessionIdx < numSessions; sessionIdx++) {
                const sessionId = `${assignment.id}-${dateString}-${sessionIdx}`;
                const sessionName = trainingDay?.sessionNames?.[sessionIdx] || `Session ${sessionIdx + 1}`;
                let exerciseCount = 0;
                if (dayExercises) {
                  exerciseCount = dayExercises.filter(
                    (ex: any) => ex.sessionIndex === sessionIdx
                  ).length;
                }

                let sessionIntensity = dayIntensity;
                if (trainingDay?.mesocycleId && cachedData?.parameterValues) {
                  const sessionIntensityKey = `sessionIntensity_${trainingDay.mesocycleId}_${dateString}_${sessionIdx}`;
                  if (cachedData.parameterValues[sessionIntensityKey]) {
                    sessionIntensity = cachedData.parameterValues[sessionIntensityKey] as IntensityLevel;
                  }
                }

                sessions.push({
                  id: sessionId,
                  sessionIndex: sessionIdx,
                  sessionName,
                  exerciseCount,
                  intensity: sessionIntensity,
                  assignmentId: assignment.id,
                });
              }
            }
          }
        });
      }

      // Compute day-level intensity for the overview square.
      // Priority: live Supabase value > program planned intensity (mobile-created) > editing state > default.
      let dayIntensityForSquare: IntensityLevel = 'moderate';
      if (selectedAssignmentId) {
        const liveDayIntensity = liveDiByDate.get(dateString);
        const liveTrainingDay = liveTdByDate.get(dateString);
        const liveRowIntensity = liveScheduleMap.get(dateString)?.rowIntensity;
        if (liveRowIntensity) {
          // Live Supabase value wins — reflects any mobile coach intensity edit.
          dayIntensityForSquare = liveRowIntensity as IntensityLevel;
        } else if (programIntensityMap?.get(dateString)) {
          // Mobile-created assignment: use planned intensity from the program
          // (athlete_schedule.intensity is null for syncs that pre-date the intensity fix).
          dayIntensityForSquare = programIntensityMap.get(dateString) as IntensityLevel;
        } else if (liveDayIntensity?.intensity) {
          dayIntensityForSquare = liveDayIntensity.intensity as IntensityLevel;
        } else if (liveTrainingDay?.intensity) {
          dayIntensityForSquare = liveTrainingDay.intensity;
        }
      }

      // Override sessions with live athlete_schedule data so the coach sees
      // the exact sessions the mobile assign-flow wrote to Supabase.
      // Guard: assignmentId must be set — prevents stale rows from old programs
      // from appearing on dates that no current assignment covers.
      // No editingClearedDay guard needed: handleClearDay now removes the entry
      // from liveScheduleMap optimistically, so cleared days already have
      // liveEntry === undefined and the override cannot fire.
      const liveEntry = liveScheduleMap.get(dateString);
      if (liveEntry !== undefined && assignmentId) {
        sessions.length = 0;
        liveEntry.sessions.forEach((s, idx) => {
          sessions.push({
            id: s.id,
            sessionIndex: idx,
            sessionName: s.sessionName,
            exerciseCount: s.exerciseCount,
            intensity: (s.intensity ?? dayIntensityForSquare) as IntensityLevel,
            assignmentId: assignmentId ?? '',
          });
        });
      }

      return {
        date,
        dateString,
        isCurrentMonth: isSameMonth(date, currentDate),
        sessions,
        assignmentId,
        programName,
        intensity: dayIntensityForSquare,
        calendarEvents: getEventsForDate(athlete.id, dateString),
      };
    });
  }, [calendarDateRange, viewMode, assignments, assignmentDataCache, selectedAssignmentId, editing.exerciseDistribution, editing.daySplitStates, editing.trainingDays, editing.dailyIntensityData, editing.sessionIntensities, getEventsForDate, athlete.id, liveScheduleMap, programIntensityMap]);

  // Group days into weeks
  const weeks = useMemo(() => groupDaysIntoWeeks(calendarDays), [calendarDays]);

  // Calculate date range display
  const dateRangeDisplay = useMemo(() => {
    if (viewMode === 'master' && editing.selectedAssignment) {
      return `${format(parseDateStr(editing.selectedAssignment.startDate), 'MMM d')} - ${format(parseDateStr(editing.selectedAssignment.endDate), 'MMM d, yyyy')}`;
    }
    if (calendarDays.length === 0) return '';
    const firstDay = calendarDays[0].date;
    const lastDay = calendarDays[calendarDays.length - 1].date;
    return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'MMM d, yyyy')}`;
  }, [calendarDays, viewMode, editing.selectedAssignment]);

  const handlePrevious = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const handleNext = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowAssignDialog(true);
  };

  const handleAddSession = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    if (!selectedAssignmentId) return;

    // New session index = current count before the increment.
    // daySplitStates[day] is 0 for off-days, undefined for days outside the
    // plan range, and ≥1 for plan days — all normalised to 0 via ?? 0.
    const newSessionIndex = editing.daySplitStates[dateString] ?? 0;

    // Increment the session count in the editing state FIRST so the
    // calendar display shows the new session immediately.
    editing.handleAddSession(dateString);

    // Open the WorkoutSessionSheet for the newly created (empty) session.
    setSelectedSessionInfo({
      dayDate: dateString,
      sessionIndex: newSessionIndex,
      assignmentId: selectedAssignmentId,
    });
    setSessionSheetOpen(true);
  };

  const handleSessionClick = useCallback((dayDate: string, sessionIndex: number, assignmentId: string) => {
    // FINAL SAFETY NET: Reject clicks within 600ms of last drag end
    if (Date.now() - lastDragEndRef.current < 600) {
      return;
    }

    // Use the provided assignmentId directly (no guessing)
    if (assignmentId) {
      // Set the selected assignment BEFORE opening the sheet
      setSelectedAssignmentId(assignmentId);
    }
    
    setSelectedSessionInfo({
      dayDate,
      sessionIndex,
      assignmentId,
    });
    setSessionSheetOpen(true);
  }, []);

  // Handle drag start - arm click suppression immediately
  const handleSessionDragStart = useCallback(() => {
    suppressNextClickRef.current = true;
  }, []);

  // Handle session drag-and-drop between days
  const handleSessionDragEnd = useCallback((result: DropResult) => {
    // CRITICAL: Set drag end timestamp IMMEDIATELY at the top (synchronous via ref)
    // This ensures onClick handlers see it BEFORE React re-renders
    lastDragEndRef.current = Date.now();
    
    // Arm global click suppression and set auto-reset timeout
    suppressNextClickRef.current = true;
    if (suppressNextClickTimeoutRef.current) {
      clearTimeout(suppressNextClickTimeoutRef.current);
    }
    suppressNextClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 800);
    
    if (!result.destination) {
      return;
    }

    const sourceDayDate = result.source.droppableId;
    const destDayDate = result.destination.droppableId;

    // Parse session index from draggableId
    // Format: "assignmentId-YYYY-MM-DD-sessionIndex"
    const draggableId = result.draggableId;
    const parts = draggableId.split('-');
    // Last part is the session index
    const sourceSessionIndex = parseInt(parts[parts.length - 1], 10);

    // Same day - no move needed (could add reordering later)
    if (sourceDayDate === destDayDate) {
      return;
    }
    
    // Validate parsed index
    if (isNaN(sourceSessionIndex)) {
      console.error('[handleSessionDragEnd] Could not parse session index from draggableId:', draggableId);
      return;
    }
    
    // Use the hook's handler for moving sessions (which also toasts)
    editing.handleMoveSession(sourceDayDate, sourceSessionIndex, destDayDate);
  }, [editing]);

  const handleAssignProgram = useCallback(async (assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => {
    // When an assignment is already active, merge program sessions into it instead of
    // creating a separate assignment. This keeps all sessions equal regardless of origin.
    const mergeIntoExisting = !!selectedAssignmentId;

    // Create the assignment record only when there is no existing assignment to merge into
    const newAssignment = mergeIntoExisting
      ? null
      : await athleteData.createCalendarAssignment(athlete.id, assignment);

    // Process program workout data with shifted dates
    if ((mergeIntoExisting || newAssignment) && assignment.programId) {
      // Read directly from localStorage to ensure we get latest data (bypasses stale React state)
      let program: TrainingProgram | null = null;
      try {
        const stored = localStorage.getItem('trainingPrograms');
        if (stored) {
          const parsed = JSON.parse(stored);
          program = parsed.programs?.find((p: TrainingProgram) => p.id === assignment.programId) || null;
        }
      } catch (e) {
        console.error('[handleAssignProgram] Error reading program from localStorage:', e);
      }
      
      // Fallback to hook's getProgram if localStorage read fails
      if (!program) {
        program = getProgram(assignment.programId);
      }

      // If program.parameterValues is missing (Supabase copy may be stale — saved before
      // periodization was filled), recover from the wizard's localStorage key.
      // Validate the recovered data belongs to this program by checking that at least
      // one key in localStorage['parameterValues'] matches a mesocycle ID in this program.
      if (program && (!program.parameterValues || Object.keys(program.parameterValues).length === 0)) {
        try {
          const localPvStr = localStorage.getItem('parameterValues');
          if (localPvStr) {
            const localPv = JSON.parse(localPvStr) as Record<string, unknown>;
            if (localPv && Object.keys(localPv).length > 0) {
              // Extract mesocycle IDs from the program's stored mesocycle structure
              const mesoData = Array.isArray(program.mesocycleData)
                ? program.mesocycleData
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : (program.mesocycleData as any)?.mesocycles;
              const programMesoIds = new Set<string>(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Array.isArray(mesoData) ? mesoData.map((m: any) => m.id).filter(Boolean) : []
              );
              // Accept if there are no IDs to validate (optimistic) or at least one key matches
              const hasMatch = programMesoIds.size === 0 ||
                Object.keys(localPv).some(k => programMesoIds.has(k));
              if (hasMatch) {
                program = { ...program, parameterValues: localPv };
              }
            }
          }
        } catch {
          // ignore — fall through with empty parameterValues
        }
      }

      if (program) {
        // Compute a robust originalStartDate from the earliest valid date in SELECTED mesocycles' data.
        // Filter by selectedMesocycleIds so that assigning only meso 2 anchors the shift to meso 2's
        // own start, not the whole program's start. Without this, sessions land at
        // D2 + meso2_offset_within_program instead of D2.
        // Order of precedence: trainingDays > exerciseDistribution > dailyIntensityData > duration.startDate
        let originalStartDate: Date | null = null;

        const selectedMesoIdsForOrigin = new Set(assignment.selectedMesocycleIds || []);

        // Try trainingDays first (filtered to selected mesocycles when IDs are available)
        if (program.trainingDays && Array.isArray(program.trainingDays) && program.trainingDays.length > 0) {
          const relevantDays = selectedMesoIdsForOrigin.size > 0
            ? program.trainingDays.filter((d: any) => !d.mesocycleId || selectedMesoIdsForOrigin.has(d.mesocycleId))
            : program.trainingDays;
          const source = relevantDays.length > 0 ? relevantDays : program.trainingDays;
          const validDates = source
            .map((d: any) => new Date(d.date + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }

        // Try exerciseDistribution (no mesocycleId on exercises; validDates filter below handles selection)
        if (!originalStartDate && program.exerciseDistribution && program.exerciseDistribution.length > 0) {
          const validDates = program.exerciseDistribution
            .map((ex: any) => new Date(ex.dayDate + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }

        // Try dailyIntensityData (filtered to selected mesocycles when IDs are available)
        if (!originalStartDate && program.dailyIntensityData && program.dailyIntensityData.length > 0) {
          const relevantIntensity = selectedMesoIdsForOrigin.size > 0
            ? program.dailyIntensityData.filter((di: any) => !di.mesocycleId || selectedMesoIdsForOrigin.has(di.mesocycleId))
            : program.dailyIntensityData;
          const source = relevantIntensity.length > 0 ? relevantIntensity : program.dailyIntensityData;
          const validDates = source
            .map((di: any) => new Date(di.date + 'T12:00:00'))
            .filter((d: Date) => !isNaN(d.getTime()));
          if (validDates.length > 0) {
            originalStartDate = new Date(Math.min(...validDates.map(d => d.getTime())));
          }
        }
        
        // Fallback to duration.startDate
        if (!originalStartDate && program.duration?.startDate) {
          const parsed = new Date(program.duration.startDate);
          if (!isNaN(parsed.getTime())) {
            originalStartDate = parsed;
          }
        }
        
        // If still no valid date, show error and cleanup
        if (!originalStartDate) {
          console.error('[handleAssignProgram] Could not determine original start date');
          if (newAssignment) await athleteData.deleteCalendarAssignment(newAssignment.id);
          toast({
            title: "Assignment failed",
            description: "Could not determine the program's start date. Please ensure the program has valid training data.",
            variant: "destructive",
          });
          return;
        }
        
        // Normalize both dates to UTC midnight for accurate day-based shifting
        // This prevents timezone-related off-by-one errors
        const normalizedOriginalStart = new Date(Date.UTC(
          originalStartDate.getFullYear(),
          originalStartDate.getMonth(),
          originalStartDate.getDate()
        ));
        
        const assignmentDate = parseDateStr(assignment.startDate);
        const normalizedNewStart = new Date(Date.UTC(
          assignmentDate.getFullYear(),
          assignmentDate.getMonth(),
          assignmentDate.getDate()
        ));

        const dayOffset = (normalizedNewStart.getTime() - normalizedOriginalStart.getTime()) / 86400000;

        try {
          // Shift all program data to match the new start date using normalized dates
          const shiftedExercises = program.exerciseDistribution 
            ? shiftExerciseDates(program.exerciseDistribution, normalizedOriginalStart, normalizedNewStart)
            : [];
          
          // Get daily intensity data - try program object first, then global localStorage key
          let sourceDailyIntensity = program.dailyIntensityData;
          if (!sourceDailyIntensity || sourceDailyIntensity.length === 0) {
            try {
              const globalIntensity = localStorage.getItem('dailyIntensityData');
              if (globalIntensity) {
                sourceDailyIntensity = JSON.parse(globalIntensity);
              }
            } catch (e) {
              // ignore
            }
          }
            
          const shiftedDailyIntensity = sourceDailyIntensity
            ? shiftDailyIntensityDates(sourceDailyIntensity, normalizedOriginalStart, normalizedNewStart)
            : [];
            
          const shiftedSections = program.sessionSections
            ? Array.isArray(program.sessionSections)
              ? shiftSessionSectionDates(program.sessionSections, normalizedOriginalStart, normalizedNewStart)
              : program.sessionSections
            : [];
            
          const shiftedSupersets = program.supersets
            ? shiftSupersetDates(program.supersets as any, normalizedOriginalStart, normalizedNewStart)
            : {};
            
          const shiftedTrainingDays = program.trainingDays
            ? shiftTrainingDaysDates(program.trainingDays, normalizedOriginalStart, normalizedNewStart)
            : [];
            
          // Derive split states with three-tier fallback:
          // 1. program.daySplitStates (most accurate — includes multi-session days)
          // 2. program.trainingDays (has per-day intensity; off days → 0 sessions)
          // 3. program.dailyIntensityData (per-day intensity from the loading wave)
          const sourceSplitStates: Record<string, number> =
            program.daySplitStates && Object.keys(program.daySplitStates).length > 0
              ? program.daySplitStates
              : (program.trainingDays ?? []).length > 0
                ? (program.trainingDays!).reduce<Record<string, number>>((acc, day) => {
                    acc[day.date] = day.sessions ?? (day.intensity === '0' ? 0 : 1);
                    return acc;
                  }, {})
                : (program.dailyIntensityData ?? []).reduce<Record<string, number>>((acc, di) => {
                    acc[di.date] = di.intensity === '0' ? 0 : 1;
                    return acc;
                  }, {});

          const shiftedDaySplitStates = shiftDaySplitStatesDates(
            sourceSplitStates,
            normalizedOriginalStart,
            normalizedNewStart
          );

          // Build validDates by filtering shiftedTrainingDays by selected
          // mesocycle/microcycle IDs. Training days carry mesocycleId and
          // microcycleId AND are shifted with the same offset as exercises —
          // so their dates are the reliable source of truth for which dates
          // belong to the selected mesos/micros.
          //
          // The previous approach (building validDates from assignedMesocycles
          // startDate/endDate) was wrong because assignedMesocycles dates are
          // recalculated to start from the assignment date, while exercises are
          // shifted relative to the FULL program's earliest date. This caused a
          // date mismatch for partial meso/micro selections.
          const selectedMesoIds = new Set(assignment.selectedMesocycleIds || []);
          const selectedMicroIds = new Set(assignment.selectedMicrocycleIds || []);

          // A training day passes the filter when:
          // - it has a mesocycleId that is in selectedMesoIds, OR it has no
          //   mesocycleId (old data — include unconditionally to stay safe)
          // - same rule for microcycleId
          let filteredTrainingDays = shiftedTrainingDays.filter(td => {
            const mesoOk = !td.mesocycleId || selectedMesoIds.size === 0 || selectedMesoIds.has(td.mesocycleId);
            const microOk = !td.microcycleId || selectedMicroIds.size === 0 || selectedMicroIds.has(td.microcycleId);
            return mesoOk && microOk;
          });

          // ID mismatch guard: if the filter emptied the list but the program has
          // training days, the stored mesocycle IDs don't match the selected ones
          // (e.g. plan re-saved after mesocycle structure was regenerated). Fall
          // back to all shifted training days so the calendar is never blank.
          if (filteredTrainingDays.length === 0 && shiftedTrainingDays.length > 0) {
            filteredTrainingDays = shiftedTrainingDays;
          }

          // Build validDates from the filtered training days.
          let validDates = new Set<string>(filteredTrainingDays.map((td: any) => td.date));

          // Fallback for old programs whose training days carry no meso/micro IDs:
          // derive valid dates from the recalculated assignedMesocycles date ranges.
          // This path may be slightly off for partial selections but avoids data loss.
          if (validDates.size === 0 && (assignment.assignedMesocycles || []).length > 0) {
            assignment.assignedMesocycles.forEach(meso => {
              const mesoStart = parseDateStr(meso.startDate);
              const mesoEnd = parseDateStr(meso.endDate);
              eachDayOfInterval({ start: mesoStart, end: mesoEnd }).forEach(day => {
                validDates.add(format(day, 'yyyy-MM-dd'));
              });
            });
          }

          // Filter all shifted data to validDates.
          // If validDates is still empty, skip filtering (include everything).
          const filteredExercises = validDates.size > 0
            ? shiftedExercises.filter(ex => validDates.has(ex.dayDate))
            : shiftedExercises;
          const filteredSections = validDates.size > 0
            ? shiftedSections.filter(s => validDates.has(s.dayDate))
            : shiftedSections;
          const filteredSupersets = validDates.size > 0
            ? Object.fromEntries(Object.entries(shiftedSupersets).filter(([d]) => validDates.has(d)))
            : shiftedSupersets;
          let filteredDailyIntensity = validDates.size > 0
            ? shiftedDailyIntensity.filter(di => validDates.has(di.date))
            : shiftedDailyIntensity;
          const filteredDaySplitStates = validDates.size > 0
            ? Object.fromEntries(Object.entries(shiftedDaySplitStates).filter(([d]) => validDates.has(d)))
            : shiftedDaySplitStates;

          // Fallback: if the program had no daySplitStates or trainingDays stored,
          // build them from the assignment's already-shifted mesocycles so the
          // calendar can always display sessions for a non-selected assignment
          // via the cache rendering path (which relies on these fields).
          let finalDaySplitStates = filteredDaySplitStates;
          let finalTrainingDays = filteredTrainingDays;

          // If training days are still empty but shifted daily intensity data is
          // available, build them from that. This covers plans where only
          // dailyIntensityData was saved (skipped microcycle planning step).
          if (finalTrainingDays.length === 0 && shiftedDailyIntensity.length > 0) {
            finalTrainingDays = shiftedDailyIntensity.map((di: any) => ({
              date: di.date,
              dayOfWeek: new Date(di.date + 'T12:00:00').getDay(),
              dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(di.date + 'T12:00:00').getDay()],
              mesocycleId: di.mesocycleId,
              microcycleId: di.microcycleId,
              isTestDay: false,
              isEventDay: false,
              isTrainingDay: di.intensity !== '0',
              intensity: di.intensity,
              sessions: di.intensity === '0' ? 0 : 1,
              sessionNames: di.intensity === '0' ? [] : ['Session 1'],
            }));
            // Sync split states from this derived training days list
            if (Object.keys(finalDaySplitStates).length === 0) {
              finalDaySplitStates = finalTrainingDays.reduce<Record<string, number>>((acc, td: any) => {
                acc[td.date] = td.sessions;
                return acc;
              }, {});
            }
          }

          if (Object.keys(finalDaySplitStates).length === 0 && assignment.assignedMesocycles?.length > 0) {
            const splitStates: Record<string, number> = {};
            const trainingDaysList: any[] = [];

            // Build a lookup from shiftedDailyIntensity for per-day overrides
            const dailyIntensityLookup = new Map<string, string>();
            shiftedDailyIntensity.forEach((di: any) => {
              if (di.date && di.intensity) dailyIntensityLookup.set(di.date, di.intensity);
            });

            assignment.assignedMesocycles.forEach(meso => {
              const mesoStart = parseDateStr(meso.startDate);
              const mesoEnd = parseDateStr(meso.endDate);
              const allDays = eachDayOfInterval({ start: mesoStart, end: mesoEnd });
              let microOffset = 0;
              (meso.microcycles || []).forEach(micro => {
                const microIntensity = (micro.intensity || meso.intensity || '5') as string;
                for (let i = 0; i < micro.duration; i++) {
                  const day = allDays[microOffset + i];
                  if (!day) continue;
                  const dateString = format(day, 'yyyy-MM-dd');
                  // Per-day intensity overrides microcycle intensity
                  const intensity = dailyIntensityLookup.get(dateString) || microIntensity;
                  const numSessions = intensity === '0' ? 0 : 1;
                  splitStates[dateString] = numSessions;
                  trainingDaysList.push({
                    date: dateString,
                    dayOfWeek: day.getDay(),
                    dayName: format(day, 'EEEE'),
                    mesocycleId: meso.id,
                    microcycleId: micro.id,
                    isTestDay: false,
                    isEventDay: false,
                    isTrainingDay: intensity !== '0',
                    intensity,
                    sessions: numSessions,
                    sessionNames: numSessions > 0 ? ['Session 1'] : [],
                  });
                }
                microOffset += micro.duration;
              });
            });

            finalDaySplitStates = splitStates;
            if (finalTrainingDays.length === 0) {
              finalTrainingDays = trainingDaysList;
            }
          }

          // SYNC: build filteredDailyIntensity from finalTrainingDays if it came out empty.
          // This covers the common case where program.dailyIntensityData was absent or its
          // dates didn't overlap with validDates (e.g. the plan was saved before step 2).
          if (filteredDailyIntensity.length === 0 && finalTrainingDays.length > 0) {
            filteredDailyIntensity = finalTrainingDays.map((td: any) => ({
              date: td.date,
              intensity: td.intensity,
              mesocycleId: td.mesocycleId,
              microcycleId: td.microcycleId,
            }));
          }

          // CLAMP: off-intensity days must have 0 sessions.
          // Guard: never zero out a date that was explicitly set to >0 sessions in the
          // program's own daySplitStates — those represent deliberate coach decisions and
          // the dailyIntensityData may be stale (e.g. saved before loading-wave was done).
          const programmedSessionDates = new Set(
            Object.entries(filteredDaySplitStates)
              .filter(([, count]) => (count as number) > 0)
              .map(([date]) => date)
          );
          filteredDailyIntensity.forEach((di: any) => {
            if (di.intensity === '0' && !programmedSessionDates.has(di.date)) {
              finalDaySplitStates[di.date] = 0;
            }
          });
          // Sync finalTrainingDays to match clamped intensity
          finalTrainingDays = finalTrainingDays.map((td: any) => {
            const di = filteredDailyIntensity.find((d: any) => d.date === td.date);
            if (di && di.intensity !== td.intensity) {
              const isOff = di.intensity === '0';
              if (isOff && programmedSessionDates.has(td.date)) return td;
              return {
                ...td,
                intensity: di.intensity,
                sessions: isOff ? 0 : (td.sessions || 1),
                sessionNames: isOff ? [] : (td.sessionNames?.length ? td.sessionNames : ['Session 1']),
                isTrainingDay: !isOff,
              };
            }
            return td;
          });

          // Transfer tests & events to calendarEvents (one entry per scheduled date)
          const transferTestsEvents = async () => {
            try {
              const existingEvents = getEventsForAthlete(athlete.id);
              const existingKey = (type: string, title: string, date: string) =>
                `${type}|${title}|${date}`;
              const existingSet = new Set(
                existingEvents.map(e => existingKey(e.type, e.title, e.date))
              );

              // Collect all events first, then write in a single store update to avoid
              // stale-closure races where sequential addCalendarEvent calls all read the
              // same snapshot and only the last one survives.
              const toAdd: Array<Omit<CalendarEvent, 'id'>> = [];

              (assignment.reviewedSubGoals || []).forEach(sg => {
                sg.scheduledDates.forEach(d => {
                  const date = d.substring(0, 10);
                  if (existingSet.has(existingKey('test', sg.testMethod, date))) return;
                  toAdd.push({
                    type: 'test',
                    title: sg.testMethod,
                    date,
                    parameterId: sg.parameterLinkedId || undefined,
                    targetValue: sg.goalValue ? String(sg.goalValue) : undefined,
                    notes: sg.comments || undefined,
                  });
                });
              });
              (assignment.reviewedEvents || []).forEach(evt => {
                evt.scheduledDates.forEach(d => {
                  const date = d.substring(0, 10);
                  if (existingSet.has(existingKey('event', evt.name, date))) return;
                  toAdd.push({
                    type: 'event',
                    title: evt.name,
                    date,
                    notes: evt.comments || undefined,
                  });
                });
              });

              if (toAdd.length > 0) {
                await addCalendarEvents(athlete.id, toAdd);
              }
            } catch (evtError) {
              console.error('[handleAssignProgram] Error transferring tests/events:', evtError);
            }
          };

          if (mergeIntoExisting) {
            // MERGE PATH: add program sessions into the current active assignment
            editing.mergeSessionData(
              filteredExercises,
              filteredSections,
              filteredSupersets,
              finalTrainingDays,
              finalDaySplitStates,
              filteredDailyIntensity,
              program.parameterValues || {},
            );
            // Update the assignment's date range so isWithinInterval renders the correct cells
            if (selectedAssignmentId) {
              const existingAssignment = assignments.find(a => a.id === selectedAssignmentId);
              const newStartIso = assignment.startDate;
              const allDates = finalTrainingDays.map((td: any) => td.date).sort();
              const newEndDate = allDates.length > 0
                ? new Date(allDates[allDates.length - 1] + 'T12:00:00').toISOString()
                : assignment.startDate;
              const updatedStart = existingAssignment
                ? (new Date(existingAssignment.startDate) < new Date(newStartIso) ? existingAssignment.startDate : newStartIso)
                : newStartIso;
              const updatedEnd = existingAssignment && existingAssignment.endDate
                ? (new Date(existingAssignment.endDate) > new Date(newEndDate) ? existingAssignment.endDate : newEndDate)
                : newEndDate;
              await athleteData.updateCalendarAssignment(selectedAssignmentId, {
                startDate: updatedStart,
                endDate: updatedEnd,
              });
            }
            // Sync merged data to athlete_schedule
            // Use React state first; fall back to a direct Supabase query if connections
            // haven't finished loading yet (avoids the race condition on first render).
            let mergeConnectionId = getConnectionForAthlete(athlete.id)?.id;
            if (!mergeConnectionId && user) {
              const { data: connRow } = await supabase
                .from('athlete_connections')
                .select('id')
                .eq('athlete_local_id', athlete.id)
                .eq('coach_user_id', user.id)
                .maybeSingle();
              mergeConnectionId = connRow?.id;
            }
            if (mergeConnectionId) {
              syncAthleteSchedule(
                mergeConnectionId,
                assignment as AthleteCalendarAssignment,
                finalTrainingDays,
                filteredExercises,
                program.name ?? program.wizardData?.planName ?? 'Training Plan',
                program.parameterValues || {},
                filteredSections,
                toolboxData?.entries,
                filteredSupersets,
                undefined, // sessionIntensities not available at assign time
                enrichEvents(getEventsForAthlete(athlete.id)),
              ).catch(e => console.error('[ASSIGN] ✗ athlete schedule sync (merge) failed:', e));
            } else {
              console.warn('[ASSIGN] merge: no connection found for athlete', athlete.id,
                '— schedule not synced. Create an invite link for this athlete to enable app sync.');
            }

            await transferTestsEvents();
          } else if (newAssignment) {
            // CREATE PATH: save to new assignment key and switch to it
            const storageKey = `athlete-assignment-${newAssignment.id}`;
            const dataToSave = {
              exerciseDistribution: filteredExercises,
              sessionSections: filteredSections,
              supersets: filteredSupersets,
              parameterValues: program.parameterValues || {},
              dailyIntensity: filteredDailyIntensity,
              trainingDays: finalTrainingDays,
              daySplitStates: finalDaySplitStates,
              copiedFromProgram: program.id,
              copiedAt: new Date().toISOString(),
            };

            localStorage.setItem(storageKey, JSON.stringify(dataToSave));

            // Sync to athlete_schedule so the athlete app can read sessions.
            // Use React state first; fall back to a direct Supabase query if connections
            // haven't finished loading yet (avoids the race condition on first render).
            let createConnectionId = getConnectionForAthlete(athlete.id)?.id;
            if (!createConnectionId && user) {
              const { data: connRow } = await supabase
                .from('athlete_connections')
                .select('id')
                .eq('athlete_local_id', athlete.id)
                .eq('coach_user_id', user.id)
                .maybeSingle();
              createConnectionId = connRow?.id;
            }
            if (createConnectionId) {
              syncAthleteSchedule(
                createConnectionId,
                newAssignment,
                dataToSave.trainingDays,
                dataToSave.exerciseDistribution,
                program.name ?? program.wizardData?.planName ?? 'Training Plan',
                dataToSave.parameterValues || {},
                dataToSave.sessionSections,
                toolboxData?.entries,
                dataToSave.supersets,
                undefined, // sessionIntensities not available at assign time
                enrichEvents(getEventsForAthlete(athlete.id)),
              ).catch(e => console.error('[ASSIGN] ✗ athlete schedule sync failed:', e));
            } else {
              console.warn('[ASSIGN] create: no connection found for athlete', athlete.id,
                '— schedule not synced. Create an invite link for this athlete to enable app sync.');
            }

            await transferTestsEvents();

            // Update cache immediately
            setAssignmentDataCache(prev => ({
              ...prev,
              [newAssignment.id]: dataToSave,
            }));

            // Auto-select the new assignment so its editing state loads immediately
            setSelectedAssignmentId(newAssignment.id);
          }
        } catch (shiftError) {
          console.error('[handleAssignProgram] Error shifting dates:', shiftError);
          if (newAssignment) {
            athleteData.deleteCalendarAssignment(newAssignment.id);
          }
          toast({
            title: "Assignment failed",
            description: "An error occurred while processing the program data. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setShowAssignDialog(false);
    setSelectedDate(null);
  }, [athlete.id, athleteData, getProgram, addCalendarEvent, getEventsForAthlete, selectedAssignmentId, editing.mergeSessionData, user]);

  const handleDeleteAssignment = async () => {
    if (!deleteAssignment) return;
    const assignmentToDelete = deleteAssignment;
    setDeleteAssignment(null);

    // Remove from assignments list
    athleteData.deleteCalendarAssignment(assignmentToDelete.id);

    // Clean up localStorage entry for this assignment
    localStorage.removeItem(`athlete-assignment-${assignmentToDelete.id}`);

    // If this was the selected assignment, deselect it
    if (selectedAssignmentId === assignmentToDelete.id) {
      setSelectedAssignmentId(null);
    }

    // Delete athlete_schedule rows for every date covered by this assignment
    const connection = getConnectionForAthlete(athlete.id);
    if (connection) {
      const datesToDelete: string[] = [];
      for (const meso of assignmentToDelete.assignedMesocycles) {
        const start = new Date(meso.startDate.slice(0, 10) + 'T12:00:00');
        const end = new Date(meso.endDate.slice(0, 10) + 'T12:00:00');
        for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
          datesToDelete.push(d.toISOString().slice(0, 10));
        }
      }
      if (datesToDelete.length > 0) {
        const BATCH = 200;
        for (let i = 0; i < datesToDelete.length; i += BATCH) {
          const batch = datesToDelete.slice(i, i + BATCH);
          const { error } = await supabase
            .from('athlete_schedule')
            .delete()
            .eq('athlete_connection_id', connection.id)
            .in('date', batch);
          if (error) {
            console.error('[deleteAssignment] ✗ failed to remove schedule rows:', error.message);
          }
        }
      }
    }
  };

  const handleDeleteAssignmentById = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) {
      setDeleteAssignment(assignment);
    }
  };

  const handleViewModeChange = (mode: string) => {
    if (mode) {
      setViewMode(mode as ViewMode);
    }
  };

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const isMasterMode = viewMode === 'master';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          {/* Navigation and Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* Left: Title with Calendar Icon */}
            <div className="flex items-center gap-2 min-w-0 shrink">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <span className="text-base font-semibold whitespace-nowrap">Athlete Calendar</span>
              <span className="text-sm text-muted-foreground ml-1 truncate">
                {dateRangeDisplay}
              </span>
            </div>

            {/* Center/Right: Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* View Mode Toggle (Calendar vs Master Planner) */}
              <ToggleGroup type="single" value={isMasterMode ? 'master' : 'calendar'} onValueChange={(v) => {
                if (v === 'master') {
                  setViewMode('master');
                } else if (v === 'calendar') {
                  setViewMode('4week');
                }
              }}>
                <ToggleGroupItem value="calendar" aria-label="Calendar view" className="h-8 px-3 gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs">Calendar</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="master" aria-label="Master Planner view" className="h-8 px-3 gap-1.5">
                  <Columns className="h-4 w-4" />
                  <span className="text-xs">Master Planner</span>
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Review Plan — visible when selected assignment has ended */}
              {(() => {
                const sel = editing.selectedAssignment;
                if (!sel) return null;
                const ended = parseDateStr(sel.endDate) < new Date();
                if (!ended) return null;
                const hasReview =
                  sel.outcomeRating != null ||
                  sel.outcomeGoalAchievement != null ||
                  sel.outcomeLoadTolerance != null ||
                  (sel.outcomeNotes ?? '').trim().length > 0;
                return (
                  <Button
                    variant={hasReview ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setReviewAssignment(sel)}
                  >
                    <ClipboardList className="h-4 w-4" />
                    {hasReview ? 'Edit Review' : 'Review Plan'}
                  </Button>
                );
              })()}

              {/* Master Planner specific controls */}
              {isMasterMode && (
                <>
                  {/* Weeks-per-view toggle */}
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {([1, 2, 4] as const).map(w => (
                      <Button
                        key={w}
                        variant={masterWeeksToDisplay === w ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setMasterWeeksToDisplay(w)}
                        className="h-7 px-3 text-xs"
                      >
                        {w}W
                      </Button>
                    ))}
                  </div>

                  {/* Day of Week Selector */}
                  <Select 
                    value={selectedDayOfWeek.toString()} 
                    onValueChange={(v) => setSelectedDayOfWeek(parseInt(v))}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((day, idx) => (
                        <SelectItem key={idx} value={(idx + 1).toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Assignment Selector (if multiple) */}
                  {assignments.length > 1 && (
                    <Select 
                      value={selectedAssignmentId || ''} 
                      onValueChange={setSelectedAssignmentId}
                    >
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="Select Program" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignments.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.programName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}

              {/* Calendar view controls */}
              {!isMasterMode && (
                <>
                  {/* Navigation */}
                  <Button variant="outline" size="icon" onClick={handlePrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleToday}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* AI Assistant button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  setFocusedSessionCtx(undefined);
                  setAiOpenTrigger(prev => prev + 1);
                }}
              >
                <Bot className="h-4 w-4" />
                <span className="text-xs">AI Assistant</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          {isMasterMode ? (
            // Master Planner Grid
            assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p>No programs assigned yet.</p>
                <p className="text-sm">Assign a program to view the Master Planner.</p>
              </div>
            ) : !editing.selectedAssignment ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select a program to view
              </div>
            ) : (
              <MasterPlannerGrid
                calendarDays={editing.allAssignmentDays}
                selectedDayOfWeek={selectedDayOfWeek}
                onSessionClick={(dayDate, sessionIndex) => {
                  if (selectedAssignmentId) {
                    setSelectedSessionInfo({
                      dayDate,
                      sessionIndex,
                      assignmentId: selectedAssignmentId,
                    });
                    setSessionSheetOpen(true);
                  }
                }}
                dailyIntensityData={editing.dailyIntensityData}
                parameterValues={editing.parameterValues}
                currentMesocycle={currentMesocycleFromAssignment}
                trainingDays={editing.trainingDays}
                toolboxData={toolboxData}
                weeksToDisplay={masterWeeksToDisplay}
                onWeeksToDisplayChange={setMasterWeeksToDisplay}
                onParameterChange={editing.handleParameterChange}
                sessionSections={editing.sessionSections}
                supersets={editing.supersets}
                onSessionNameChange={editing.handleSessionNameChange}
                onSessionCommentChange={editing.handleSessionCommentChange}
                onSectionCommentChange={editing.handleSectionCommentChange}
                onExerciseNotesChange={editing.handleExerciseNotesChange}
                onExerciseEachSideChange={editing.handleExerciseEachSideChange}
                onExerciseAutoCalcChange={editing.handleExerciseAutoCalcChange}
                onDayIntensityChange={editing.handleDayIntensityChange}
                onSessionIntensityChange={editing.handleSessionIntensityChange}
                onSectionReorder={editing.handleSectionReorder}
                onExerciseReorder={editing.handleExerciseReorder}
                onAddSectionToSession={editing.handleAddSectionToSession}
                onAddExerciseToSection={editing.handleAddExerciseToSection}
                onExerciseDuplicate={editing.handleExerciseDuplicate}
                onExerciseDelete={editing.handleExerciseDelete}
                onToggleSuperset={editing.handleToggleSuperset}
                onSectionDuplicate={editing.handleSectionDuplicate}
                onSectionDelete={editing.handleSectionDelete}
                onCopySession={editing.handleCopySession}
                onDeleteSession={handleDeleteSession}
                onPasteSession={editing.handlePasteSession}
                copiedSession={editing.copiedSession}
                onCopyDay={editing.handleCopyDay}
                onClearDay={handleClearDay}
                onPasteDay={editing.handlePasteDay}
                copiedDay={editing.copiedDay}
                onAddSession={editing.handleAddSession}
                allExerciseDistribution={editing.exerciseDistribution}
                onExerciseChange={editing.handleExerciseChange}
                selectedAthleteId={athlete.id}
                athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
                  p => p.athleteId === athlete.id
                )}
              />
            )
          ) : (
            // Calendar View
            <div className="min-w-[756px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-3">
                {weekDayHeaders.map(day => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Week Rows */}
              <DragDropContext onDragStart={handleSessionDragStart} onDragEnd={handleSessionDragEnd}>
                <div className="space-y-4">
                  {weeks.map((week, idx) => (
                    <AthleteCalendarWeekRow
                      key={`week-${idx}`}
                      week={week}
                      weekIdx={idx}
                      onSessionClick={handleSessionClick}
                      onDayClick={handleDayClick}
                      onAddSession={handleAddSession}
                      onDeleteAssignment={handleDeleteAssignmentById}
                      // Week operations
                      copiedWeek={editing.copiedWeek}
                      onCopyWeek={editing.handleCopyWeek}
                      onClearWeek={handleClearWeek}
                      onPasteWeek={editing.handlePasteWeek}
                      // Day operations
                      copiedDay={editing.copiedDay}
                      onCopyDay={editing.handleCopyDay}
                      onClearDay={handleClearDay}
                      onPasteDay={editing.handlePasteDay}
                      // Session operations
                      copiedSession={editing.copiedSession}
                      onCopySession={editing.handleCopySession}
                      onDeleteSession={handleDeleteSession}
                      onPasteSession={editing.handlePasteSession}
                      // Intensity editing
                      onIntensityChange={editing.handleDayIntensityChange}
                      // Ref-based drag end timestamp for click suppression
                      lastDragEndRef={lastDragEndRef}
                      // Athlete context for baseline auto-fill
                      athleteId={athlete.id}
                      athletePerformanceParameters={athleteData.athletePerformanceParameters.filter(
                        p => p.athleteId === athlete.id
                      )}
                      athleteBiometrics={athleteData.getAthleteBiometrics(athlete.id)}
                      onAddCalendarEvent={handleAddCalendarEvent}
                      onDeleteCalendarEvent={handleDeleteCalendarEvent}
                      sessionLogs={sessionLogs}
                      onCompletedSessionClick={handleCompletedSessionClick}
                    />
                  ))}
                </div>
              </DragDropContext>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Completed Session Sheet */}
      <CompletedSessionSheet
        log={selectedCompletedLog}
        open={completedSheetOpen}
        onClose={() => { setCompletedSheetOpen(false); setSelectedCompletedLog(null); }}
      />

      {/* Plan Review Dialog */}
      {reviewAssignment && (
        <PlanReviewDialog
          open={!!reviewAssignment}
          onOpenChange={(open) => { if (!open) setReviewAssignment(null); }}
          assignment={reviewAssignment}
          onSave={(updates) => {
            athleteData.updateCalendarAssignment(reviewAssignment.id, updates);
            setReviewAssignment(null);
          }}
        />
      )}

      {/* Assign Program Dialog */}
      <AssignProgramDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        programs={programs}
        selectedDate={selectedDate || new Date()}
        onAssign={handleAssignProgram}
        athleteId={athlete.id}
        athletePerformanceParameters={athleteData.getAthletePerformanceParameters(athlete.id)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAssignment} onOpenChange={() => setDeleteAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteAssignment?.programName}" from the calendar?
              This will not delete the original training program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workout Session Sheet for viewing/editing sessions */}
      {selectedSessionInfo && selectedSessionInfo.dayDate && selectedSessionInfo.assignmentId !== undefined && (
        <WorkoutSessionSheet
          isOpen={sessionSheetOpen}
          onClose={() => {
            setSessionSheetOpen(false);
            setSelectedSessionInfo(null);
          }}
          dayDate={selectedSessionInfo.dayDate}
          sessionIndex={selectedSessionInfo.sessionIndex}
          totalSessionsOnDay={editing.daySplitStates[selectedSessionInfo.dayDate] || 1}
          exercises={editing.exerciseDistribution.filter(
            ex => ex.dayDate === selectedSessionInfo.dayDate && ex.sessionIndex === selectedSessionInfo.sessionIndex
          ).map(ex => ({
            ...ex,
            id: ex.id || `${ex.exerciseId}-${ex.dayDate}-${ex.sessionIndex}`,
          }))}
          mesocycleId={(() => {
            // Find the correct mesocycleId from trainingDays for this date
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId) return trainingDay.mesocycleId;
            // Fallback to first mesocycle
            return editing.selectedAssignment?.assignedMesocycles[0]?.id || '';
          })()}
          microcycleIndex={(() => {
            // Find the correct microcycleIndex from trainingDays for this date
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId && trainingDay?.microcycleId) {
              const meso = editing.selectedAssignment?.assignedMesocycles?.find(m => m.id === trainingDay.mesocycleId);
              if (meso) {
                const idx = (meso.microcycles || []).findIndex(mic => mic.id === trainingDay.microcycleId);
                if (idx >= 0) return idx;
              }
            }
            return 0;
          })()}
          microcycleDates={(() => {
            // Compute the date range of the microcycle containing this session.
            // WorkoutSessionSheet uses this to calculate the chronological session index
            // (i.e. which occurrence of a method within the microcycle this exercise is),
            // so it can look up the correct periodization-table parameters slot.
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            if (trainingDay?.mesocycleId && trainingDay?.microcycleId) {
              const meso = editing.selectedAssignment?.assignedMesocycles?.find(m => m.id === trainingDay.mesocycleId);
              if (meso) {
                // Count day-offset of this microcycle within the mesocycle
                let dayOffset = 0;
                let microDuration = 7;
                for (const mc of meso.microcycles || []) {
                  if (mc.id === trainingDay.microcycleId) {
                    microDuration = mc.duration;
                    break;
                  }
                  dayOffset += mc.duration;
                }
                // Build dates using noon-local anchoring to avoid DST off-by-one.
                // meso.startDate may be 'yyyy-MM-dd' or a full ISO string — normalise first.
                const mesoDateStr = meso.startDate.length > 10
                  ? format(parseDateStr(meso.startDate), 'yyyy-MM-dd')
                  : meso.startDate;
                const [my, mm, md] = mesoDateStr.split('-').map(Number);
                const mesoStart = new Date(my, mm - 1, md, 12, 0, 0);
                return Array.from({ length: microDuration }, (_, i) => {
                  const d = new Date(mesoStart.getTime() + (dayOffset + i) * 86400000);
                  return format(d, 'yyyy-MM-dd');
                });
              }
            }
            // Fallback: return all training day dates (covers the whole assignment)
            return editing.trainingDays.map(td => td.date);
          })()}
          parameterValues={editing.parameterValues}
          onSaveParameters={(mesocycleId, microcycleIndex, methodId, sessionIndex, exerciseId, parameters) => {
            // Derive which params should be visible in the athlete app grid (showInGridByDefault only)
            const baseMethodKey = methodId.includes('::') ? methodId.split('::')[0] : methodId;
            const visibleParamNames = (toolboxData?.entries ?? [])
              .filter(e => {
                const key = e.subCategory ? `${e.category} - ${e.subCategory}` : e.category;
                return key === baseMethodKey && e.showInGridByDefault && !e.isFrequencyParameter && !e.isSetParameter && !e.isRestParameter;
              })
              .map(e => e.parameterName);
            editing.handleExerciseParameterSave(
              selectedSessionInfo.dayDate,
              sessionIndex,
              exerciseId,
              parameters,
              visibleParamNames,
            );
          }}
          dailyIntensityData={editing.dailyIntensityData}
          sessionNameFromState={(() => {
            const trainingDay = editing.trainingDays.find(td => td.date === selectedSessionInfo.dayDate);
            return trainingDay?.sessionNames?.[selectedSessionInfo.sessionIndex] || `Session ${selectedSessionInfo.sessionIndex + 1}`;
          })()}
          onRenameSession={editing.handleSessionNameChange}
          onIntensityChange={editing.handleDayIntensityChange}
          onSessionIntensityChange={editing.handleSessionIntensityChange}
          sessionSections={editing.sessionSections}
          supersets={editing.supersets}
          onSectionsChange={(sections) => editing.setSessionSections(sections)}
          onSupersetsChange={(s) => editing.setSupersets(s)}
          toolboxData={toolboxData}
          allExerciseDistribution={editing.exerciseDistribution.map(ex => ({
            ...ex,
            id: ex.id || `${ex.exerciseId}-${ex.dayDate}-${ex.sessionIndex}`,
          }))}
          onDistributionChange={(distribution) => {
            editing.setExerciseDistribution(distribution as any);
          }}
          useExternalIntensityOnly={true}
          isAdHocSession={true}
          liveScheduleEntry={liveScheduleMap.get(selectedSessionInfo.dayDate)}
          onOpenAIAssistant={(ctx: FocusedSessionContext) => {
            setFocusedSessionCtx(ctx);
            setAiOpenTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* AI Assistant — athlete calendar context */}
      <WizardAIAssistant
        stepLabel="Athlete Calendar"
        wizardContext={athleteAIContext}
        globalContext={globalAIContext}
        ragContext={ragContext || undefined}
        coachMemoryContext={coachMemoryContext || undefined}
        focusedSessionContext={focusedSessionCtx}
        forceOpen={aiOpenTrigger}
        assistantRole={`You are reviewing the training calendar and current status for athlete "${athlete.firstName ?? ''} ${athlete.lastName ?? ''}".
Help the coach with: training load management, session design, exercise selection, intensity progression, upcoming test preparation, program structure analysis, and any sports science questions related to this athlete's training.
You can also help with database management (parameters, exercises, toolbox) and program planning.
When the coach opens the AI from within a session card, the "Currently Viewing" section above shows the exact session — use that context to give session-specific advice.`}
        onApplySuggestion={handleAIApply}
      />
    </div>
  );
}
