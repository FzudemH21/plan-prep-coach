import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, BookOpen, Trophy, Plus, X,
  ChevronDown, ChevronRight as ChevronRightIcon,
  CheckCircle2, AlertTriangle, Loader2, CalendarIcon,
} from 'lucide-react';
import { format, differenceInDays, addDays, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAuth } from '@/hooks/useAuth';
import { syncAthleteSchedule, type AthleteFormulaData } from '@/utils/athleteScheduleSync';
import { epley1RM } from '@/hooks/useExerciseMetrics';
import { supabase } from '@/lib/supabase';
import {
  shiftExerciseDates,
  shiftDailyIntensityDates,
  shiftSessionSectionDates,
  shiftSupersetDates,
  shiftTrainingDaysDates,
  shiftDaySplitStatesDates,
  recalculateMesocycleDates,
} from '@/utils/dateShifting';
import { useToast } from '@/hooks/use-toast';
import type { AssignedMesocycle, ReviewedSubGoal, ReviewedEvent } from '@/types/athlete';
import type { SubGoal, Event as TrainingEvent } from '@/types/training';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normDate(dateStr: string): Date {
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
}

function findOriginalStartDate(program: TrainingProgram): Date | null {
  if (program.trainingDays && program.trainingDays.length > 0) {
    const dates = program.trainingDays
      .map((td: { date?: string }) => td.date ? normDate(td.date) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (dates.length > 0) return new Date(Math.min(...dates.map(d => d.getTime())));
  }
  if (program.exerciseDistribution && program.exerciseDistribution.length > 0) {
    const dates = program.exerciseDistribution
      .map((ex: { dayDate?: string }) => ex.dayDate ? normDate(ex.dayDate) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (dates.length > 0) return new Date(Math.min(...dates.map(d => d.getTime())));
  }
  if (program.dailyIntensityData && program.dailyIntensityData.length > 0) {
    const dates = program.dailyIntensityData
      .map((di: { date?: string }) => di.date ? normDate(di.date) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
    if (dates.length > 0) return new Date(Math.min(...dates.map(d => d.getTime())));
  }
  if (program.duration?.startDate) {
    const d = normDate(program.duration.startDate);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function isAssignable(p: TrainingProgram): boolean {
  if (!p.mesocycleData) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mesocycles = Array.isArray(p.mesocycleData) ? p.mesocycleData : (p.mesocycleData as any).mesocycles;
  if (!Array.isArray(mesocycles) || mesocycles.length === 0) return false;
  return (
    (Array.isArray(p.exerciseDistribution) && p.exerciseDistribution.length > 0) ||
    (Array.isArray(p.trainingDays) && p.trainingDays.length > 0) ||
    (p.daySplitStates != null && Object.keys(p.daySplitStates).length > 0) ||
    (Array.isArray(p.dailyIntensityData) && p.dailyIntensityData.length > 0)
  );
}

function parseProgramMesocycles(program: TrainingProgram): AssignedMesocycle[] {
  if (!program.mesocycleData) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mesoData: any[] = Array.isArray(program.mesocycleData)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? program.mesocycleData : (program.mesocycleData as any).mesocycles ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mesoData.map((m: any, i: number): AssignedMesocycle => ({
    id: m.id ?? `meso-${i}`,
    name: m.name ?? `Mesocycle ${i + 1}`,
    startDate: m.startDate ?? new Date().toISOString(),
    endDate: m.endDate ?? new Date().toISOString(),
    weeks: m.weeks ?? Math.ceil((m.duration ?? 7) / 7),
    duration: m.duration ?? 7,
    intensity: m.intensity ?? 'moderate',
    sessionsPerWeek: m.sessionsPerWeek ?? 3,
    sessionLength: m.sessionLength ?? 60,
    trainingQualities: m.trainingQualities ?? [],
    allocatedSubGoals: m.allocatedSubGoals ?? [],
    microcycles: (m.microcycles ?? []).map((mc: { id?: string; name?: string; duration?: number; intensity?: string }, mi: number) => ({
      id: mc.id ?? `micro-${i}-${mi}`,
      name: mc.name ?? `Week ${mi + 1}`,
      duration: mc.duration ?? 7,
      intensity: mc.intensity ?? 'moderate',
    })),
  }));
}

function buildTestsAndEvents(
  program: TrainingProgram,
  startDate: Date,
  athletePerformanceParameters: { athleticismParameterId?: string; values: { value: string; recordedAt: string }[] }[]
): { tests: ReviewedSubGoal[]; events: ReviewedEvent[] } {
  if (!program.macrocycleData) return { tests: [], events: [] };

  const macro = program.macrocycleData;
  const originalStart = program.duration?.startDate ? parseDateStr(program.duration.startDate) : null;
  const dayOffset = originalStart ? differenceInDays(startDate, originalStart) : 0;

  const shiftDate = (d: string) => addDays(new Date(d + (d.length === 10 ? 'T12:00:00' : '')), dayOffset).toISOString();

  // Sub-goals
  const reviewed: ReviewedSubGoal[] = (macro.subGoals as SubGoal[] ?? []).map(sg => {
    let baseline = sg.preTestValue || 0;
    if (sg.parameterLinkedId) {
      const p = athletePerformanceParameters.find(pp => pp.athleticismParameterId === sg.parameterLinkedId);
      if (p?.values.length) {
        const sorted = [...p.values].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        baseline = parseFloat(sorted[0].value) || baseline;
      }
    }
    return {
      id: sg.id,
      testMethod: sg.testMethod,
      baselineValue: baseline,
      goalValue: sg.goalValue || 0,
      unit: sg.unit || '',
      comments: sg.comments || '',
      scheduledDates: (sg.testDates || []).map(shiftDate),
      parameterLinkedId: sg.parameterLinkedId,
    };
  });

  // SMART goals with test dates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (macro.smartGoals as any[] ?? []).forEach((sg: any) => {
    if (!sg.testDates?.length) return;
    let baseline = sg.baselineValue || 0;
    if (sg.linkedParameterId) {
      const p = athletePerformanceParameters.find(pp => pp.athleticismParameterId === sg.linkedParameterId);
      if (p?.values.length) {
        const sorted = [...p.values].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
        baseline = parseFloat(sorted[0].value) || baseline;
      }
    }
    reviewed.push({
      id: sg.id,
      testMethod: sg.description,
      baselineValue: baseline,
      goalValue: sg.desiredValue || 0,
      unit: sg.unit || '',
      comments: '',
      scheduledDates: sg.testDates.map(shiftDate),
      parameterLinkedId: sg.linkedParameterId,
    });
  });

  // Deduplicate tests
  const dedupedTests: ReviewedSubGoal[] = [];
  const seenTests = new Map<string, number>();
  reviewed.forEach(sg => {
    const key = `${sg.testMethod}-${sg.parameterLinkedId ?? ''}`;
    if (seenTests.has(key)) {
      const idx = seenTests.get(key)!;
      dedupedTests[idx] = { ...dedupedTests[idx], scheduledDates: [...dedupedTests[idx].scheduledDates, ...sg.scheduledDates] };
    } else {
      seenTests.set(key, dedupedTests.length);
      dedupedTests.push({ ...sg });
    }
  });

  // Events
  const reviewedEvts: ReviewedEvent[] = (macro.events as TrainingEvent[] ?? []).map(evt => ({
    id: evt.id,
    name: evt.name,
    comments: evt.comments || '',
    scheduledDates: (evt.eventDates || []).map(shiftDate),
  }));

  // Deduplicate events
  const dedupedEvents: ReviewedEvent[] = [];
  const seenEvents = new Map<string, number>();
  reviewedEvts.forEach(evt => {
    if (seenEvents.has(evt.name)) {
      const idx = seenEvents.get(evt.name)!;
      dedupedEvents[idx] = { ...dedupedEvents[idx], scheduledDates: [...dedupedEvents[idx].scheduledDates, ...evt.scheduledDates] };
    } else {
      seenEvents.set(evt.name, dedupedEvents.length);
      dedupedEvents.push({ ...evt });
    }
  });

  return { tests: dedupedTests, events: dedupedEvents };
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'pick-program', label: 'Program' },
  { key: 'meso', label: 'Mesocycles' },
  { key: 'tests-events', label: 'Tests & Events' },
] as const;

type Step = typeof STEPS[number]['key'];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 py-2 shrink-0">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className={cn(
              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors',
              i === idx ? 'bg-primary text-primary-foreground' : i < idx ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {i + 1}
            </div>
            <span className={cn('text-[10px] whitespace-nowrap', i === idx ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('h-px w-10 mb-3.5 mx-1', i < idx ? 'bg-primary' : 'bg-muted')} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Date edit modal ───────────────────────────────────────────────────────────

interface DateEditModalProps {
  open: boolean;
  value: string;
  onUpdate: (newDate: string) => void;
  onRemove: () => void;
  onClose: () => void;
  isNew?: boolean;
}

function DateEditModal({ open, value, onUpdate, onRemove, onClose, isNew }: DateEditModalProps) {
  const [dateVal, setDateVal] = useState(value);
  useEffect(() => { setDateVal(value); }, [value]);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[320px]">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Date' : 'Edit Date'}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <input
            type="date"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <DialogFooter className="flex gap-2 flex-col sm:flex-row">
          {!isNew && (
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button size="sm" className="flex-1" disabled={!dateVal} onClick={() => { if (dateVal) { onUpdate(dateVal); onClose(); } }}>
            {isNew ? 'Add' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoachMobileAssignProgramPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { athletes, createCalendarAssignment, getAthletePerformanceParameters, getAthleteBiometrics, biometricDefinitions } = useAthletes();
  const { connections } = useAthleteConnections();
  const { programs } = useTrainingPrograms();
  const { data: toolboxData } = useToolboxData();
  const { data: parametersData } = useParametersDataV2();
  const { user } = useAuth();

  const athlete = athletes.find(a => a.id === athleteId);
  const connection = connections.find(c => c.athleteLocalId === athleteId);
  const athleteParams = athleteId ? getAthletePerformanceParameters(athleteId) : [];

  const urlDate = searchParams.get('startDate') ?? new Date().toISOString().slice(0, 10);

  // ── Core state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('pick-program');
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [startDateStr, setStartDateStr] = useState<string>(urlDate);
  const [selectedMesoIds, setSelectedMesoIds] = useState<string[]>([]);
  const [selectedMicroIds, setSelectedMicroIds] = useState<string[]>([]);
  const [expandedMesoIds, setExpandedMesoIds] = useState<string[]>([]);
  const [reviewedTests, setReviewedTests] = useState<ReviewedSubGoal[]>([]);
  const [reviewedEvents, setReviewedEvents] = useState<ReviewedEvent[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Date edit modal
  const [dateModal, setDateModal] = useState<{
    type: 'test' | 'event';
    outerIdx: number;
    dateIdx: number | null;
    value: string;
  } | null>(null);

  const availablePrograms = useMemo(() => programs.filter(isAssignable), [programs]);

  const startDate = useMemo(() => new Date(startDateStr + 'T12:00:00'), [startDateStr]);

  // When a program is selected, default-select all mesos/micros and build tests/events
  const programMesocycles = useMemo(
    () => (selectedProgram ? parseProgramMesocycles(selectedProgram) : []),
    [selectedProgram]
  );

  useEffect(() => {
    if (programMesocycles.length > 0) {
      const mesoIds = programMesocycles.map(m => m.id);
      const microIds = programMesocycles.flatMap(m => m.microcycles.map(mc => mc.id));
      setSelectedMesoIds(mesoIds);
      setSelectedMicroIds(microIds);
      setExpandedMesoIds(mesoIds);
    }
  }, [programMesocycles]);

  // Rebuild tests/events whenever program or startDate changes
  useEffect(() => {
    if (!selectedProgram) { setReviewedTests([]); setReviewedEvents([]); return; }
    const { tests, events } = buildTestsAndEvents(selectedProgram, startDate, athleteParams);
    setReviewedTests(tests);
    setReviewedEvents(events);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, startDateStr]);

  // Filtered + recalculated mesocycles
  const finalMesocycles = useMemo((): AssignedMesocycle[] => {
    if (programMesocycles.length === 0) return [];
    let filtered = programMesocycles.filter(m => selectedMesoIds.includes(m.id));
    filtered = filtered.map(meso => ({
      ...meso,
      microcycles: meso.microcycles.filter(mc => selectedMicroIds.includes(mc.id)),
    })).filter(meso => meso.microcycles.length > 0);
    return recalculateMesocycleDates(filtered, startDate);
  }, [programMesocycles, selectedMesoIds, selectedMicroIds, startDate]);

  const endDate = useMemo(() => {
    if (finalMesocycles.length === 0) return startDate;
    return parseDateStr(finalMesocycles[finalMesocycles.length - 1].endDate);
  }, [finalMesocycles, startDate]);

  const totalWeeks = useMemo(() => finalMesocycles.reduce((s, m) => s + m.weeks, 0), [finalMesocycles]);

  const originalStartDate = useMemo(
    () => selectedProgram ? findOriginalStartDate(selectedProgram) : null,
    [selectedProgram]
  );

  const dayOffset = useMemo(() => {
    if (!originalStartDate) return 0;
    const normNew = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
    return (normNew.getTime() - originalStartDate.getTime()) / 86_400_000;
  }, [originalStartDate, startDate]);

  const isPastDate = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return startDate < today;
  }, [startDate]);

  const dateMismatch = useMemo(() => {
    if (!selectedProgram?.duration?.startDate || dayOffset === 0) return null;
    return { days: Math.abs(dayOffset), direction: dayOffset > 0 ? 'forward' : 'backward' as const };
  }, [selectedProgram, dayOffset]);

  // ── Meso/micro toggles ──────────────────────────────────────────────────────

  const toggleMeso = (mesoId: string) => {
    const meso = programMesocycles.find(m => m.id === mesoId);
    if (!meso) return;
    const microIds = meso.microcycles.map(mc => mc.id);
    if (selectedMesoIds.includes(mesoId)) {
      setSelectedMesoIds(prev => prev.filter(id => id !== mesoId));
      setSelectedMicroIds(prev => prev.filter(id => !microIds.includes(id)));
    } else {
      setSelectedMesoIds(prev => [...prev, mesoId]);
      setSelectedMicroIds(prev => [...prev, ...microIds.filter(id => !prev.includes(id))]);
    }
  };

  const toggleMicro = (mesoId: string, microId: string) => {
    const meso = programMesocycles.find(m => m.id === mesoId);
    if (!meso) return;
    if (selectedMicroIds.includes(microId)) {
      const remaining = selectedMicroIds.filter(id => id !== microId);
      setSelectedMicroIds(remaining);
      if (!meso.microcycles.some(mc => mc.id !== microId && remaining.includes(mc.id))) {
        setSelectedMesoIds(prev => prev.filter(id => id !== mesoId));
      }
    } else {
      setSelectedMicroIds(prev => [...prev, microId]);
      if (!selectedMesoIds.includes(mesoId)) setSelectedMesoIds(prev => [...prev, mesoId]);
    }
  };

  const toggleExpanded = (mesoId: string) => {
    setExpandedMesoIds(prev => prev.includes(mesoId) ? prev.filter(id => id !== mesoId) : [...prev, mesoId]);
  };

  // ── Assign ──────────────────────────────────────────────────────────────────

  const handleAssign = async () => {
    if (!selectedProgram || !athlete || assigning || finalMesocycles.length === 0) return;
    if (!connection) {
      toast({ title: 'No connection', description: 'This athlete has not been invited yet.', variant: 'destructive' });
      return;
    }

    setAssigning(true);
    try {
      let program = { ...selectedProgram };

      // Recover parameterValues from localStorage if Supabase copy is stale
      if (!program.parameterValues || Object.keys(program.parameterValues).length === 0) {
        try {
          const localPv = localStorage.getItem('parameterValues');
          if (localPv) {
            const parsed = JSON.parse(localPv) as Record<string, unknown>;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mesoData: any[] = Array.isArray(program.mesocycleData)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? program.mesocycleData : (program.mesocycleData as any)?.mesocycles ?? [];
            const programMesoIds = new Set<string>(mesoData.map((m: { id?: string }) => m.id).filter(Boolean));
            if (Object.keys(parsed).some(k => programMesoIds.has(k))) {
              program = { ...program, parameterValues: parsed as Record<string, unknown> };
            }
          }
        } catch { /* ignore */ }
      }

      let sourceDailyIntensity = program.dailyIntensityData;
      if (!sourceDailyIntensity?.length) {
        try {
          const raw = localStorage.getItem('dailyIntensityData');
          if (raw) sourceDailyIntensity = JSON.parse(raw);
        } catch { /* ignore */ }
      }

      const normNew = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
      const normOrig = originalStartDate ?? normNew;

      const shiftedExercises = program.exerciseDistribution
        ? shiftExerciseDates(program.exerciseDistribution, normOrig, normNew) : [];
      const shiftedDailyIntensity = sourceDailyIntensity
        ? shiftDailyIntensityDates(sourceDailyIntensity, normOrig, normNew) : [];
      const shiftedSections = program.sessionSections
        ? Array.isArray(program.sessionSections)
          ? shiftSessionSectionDates(program.sessionSections, normOrig, normNew)
          : program.sessionSections
        : [];
      const shiftedSupersets = program.supersets
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? shiftSupersetDates(program.supersets as any, normOrig, normNew) : {};
      const shiftedTrainingDays = program.trainingDays
        ? shiftTrainingDaysDates(program.trainingDays, normOrig, normNew) : [];

      const sourceSplitStates: Record<string, number> =
        program.daySplitStates && Object.keys(program.daySplitStates).length > 0
          ? program.daySplitStates
          : (program.trainingDays ?? []).length > 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (program.trainingDays!).reduce<Record<string, number>>((acc, day: any) => {
                acc[day.date] = day.sessions ?? (day.intensity === '0' ? 0 : 1);
                return acc;
              }, {})
            : (sourceDailyIntensity ?? []).reduce<Record<string, number>>((acc, di: { date: string; intensity: string }) => {
                acc[di.date] = di.intensity === '0' ? 0 : 1;
                return acc;
              }, {});

      const shiftedDaySplitStates = shiftDaySplitStatesDates(sourceSplitStates, normOrig, normNew);

      // Build validDates from filtered training days (filter by selected meso/micro IDs)
      const selMesoSet = new Set(selectedMesoIds);
      const selMicroSet = new Set(selectedMicroIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let filteredTrainingDays = shiftedTrainingDays.filter((td: any) => {
        const mesoOk = !td.mesocycleId || selMesoSet.size === 0 || selMesoSet.has(td.mesocycleId);
        const microOk = !td.microcycleId || selMicroSet.size === 0 || selMicroSet.has(td.microcycleId);
        return mesoOk && microOk;
      });
      if (filteredTrainingDays.length === 0 && shiftedTrainingDays.length > 0) {
        filteredTrainingDays = shiftedTrainingDays;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let validDates = new Set<string>(filteredTrainingDays.map((td: any) => td.date));
      if (validDates.size === 0 && finalMesocycles.length > 0) {
        finalMesocycles.forEach(meso => {
          eachDayOfInterval({ start: parseDateStr(meso.startDate), end: parseDateStr(meso.endDate) }).forEach(day => {
            validDates.add(format(day, 'yyyy-MM-dd'));
          });
        });
      }

      const filteredExercises = validDates.size > 0 ? shiftedExercises.filter(ex => validDates.has(ex.dayDate)) : shiftedExercises;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredSections = validDates.size > 0 ? (shiftedSections as any[]).filter((s: any) => validDates.has(s.dayDate)) : shiftedSections;
      const filteredSupersets = validDates.size > 0 ? Object.fromEntries(Object.entries(shiftedSupersets).filter(([d]) => validDates.has(d))) : shiftedSupersets;
      const filteredDailyIntensity = validDates.size > 0 ? shiftedDailyIntensity.filter(di => validDates.has(di.date)) : shiftedDailyIntensity;
      const filteredDaySplitStates = validDates.size > 0 ? Object.fromEntries(Object.entries(shiftedDaySplitStates).filter(([d]) => validDates.has(d))) : shiftedDaySplitStates;

      // Fallback: build training days from daily intensity if none exist
      let finalTrainingDays = filteredTrainingDays;
      let finalDaySplitStates = filteredDaySplitStates;
      if (finalTrainingDays.length === 0 && shiftedDailyIntensity.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalTrainingDays = filteredDailyIntensity.map((di: any) => ({
          date: di.date,
          dayOfWeek: new Date(di.date + 'T12:00:00').getDay(),
          dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(di.date + 'T12:00:00').getDay()],
          mesocycleId: di.mesocycleId,
          microcycleId: di.microcycleId,
          isTestDay: false, isEventDay: false,
          isTrainingDay: di.intensity !== '0',
          intensity: di.intensity,
          sessions: di.intensity === '0' ? 0 : 1,
          sessionNames: di.intensity === '0' ? [] : ['Session 1'],
        }));
        if (Object.keys(finalDaySplitStates).length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalDaySplitStates = finalTrainingDays.reduce<Record<string, number>>((acc, td: any) => {
            acc[td.date] = td.sessions; return acc;
          }, {});
        }
      }

      // Merge per-day intensities from dailyIntensityData into finalTrainingDays.
      // The wizard stores intensity separately from trainingDays, so trainingDays items
      // arrive without an intensity field. syncAthleteSchedule writes td.intensity to the
      // athlete_schedule.intensity column — without this merge that column is always null
      // and the desktop calendar falls back to the generic 'moderate' placeholder.
      if (filteredDailyIntensity.length > 0) {
        const intensityByDate = new Map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filteredDailyIntensity.map((di: any) => [di.date as string, di.intensity as string])
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalTrainingDays = finalTrainingDays.map((td: any) => ({
          ...td,
          intensity: td.intensity ?? intensityByDate.get(td.date) ?? null,
        }));
      }

      const assignment = await createCalendarAssignment(athlete.id, {
        athleteId: athlete.id,
        programId: program.id,
        programName: program.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        originalStartDate: program.duration?.startDate ?? startDate.toISOString(),
        originalEndDate: program.duration?.endDate ?? endDate.toISOString(),
        selectedMesocycleIds: selectedMesoIds,
        selectedMicrocycleIds: selectedMicroIds,
        assignedMesocycles: finalMesocycles,
        reviewedSubGoals: reviewedTests.length > 0 ? reviewedTests : undefined,
        reviewedEvents: reviewedEvents.length > 0 ? reviewedEvents : undefined,
      });

      if (connection.connectedAt) {
        // Build athlete formula data so calculated params (e.g. Weight = Intensity × e1RM)
        // are pre-computed at assign time, matching the desktop assign flow.
        let athleteFormulaData: AthleteFormulaData | undefined;
        try {
          const biometricsById = new Map<string, { name: string; value: number }>();
          for (const def of biometricDefinitions) {
            if (def.type !== 'quantitative') continue;
            const bioEntry = getAthleteBiometrics(athlete.id)
              .find(b => b.biometricDefinitionId === def.id);
            if (!bioEntry || bioEntry.values.length === 0) continue;
            const latest = [...bioEntry.values].sort(
              (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
            )[0];
            const num = parseFloat(latest.value);
            if (!isNaN(num)) biometricsById.set(def.id, { name: def.name, value: num });
          }

          const perfParamsById = new Map<string, { name: string; value: number }>();
          for (const pp of getAthletePerformanceParameters(athlete.id)) {
            if (pp.values.length === 0) continue;
            const perfDef = parametersData?.parameters.find(p => p.id === pp.athleticismParameterId);
            if (!perfDef) continue;
            const latest = [...pp.values].sort(
              (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
            )[0];
            const num = parseFloat(latest.value);
            if (!isNaN(num)) perfParamsById.set(pp.athleticismParameterId, { name: perfDef.name, value: num });
          }

          const e1RMByExercise = new Map<string, number>();
          if (user) {
            type RawSet = { setNumber: number; values: Record<string, string>; completed: boolean };
            type RawExLog = { exerciseName: string; isCircuit?: boolean; sets?: RawSet[] };
            const [paramTagResult, logsResult] = await Promise.all([
              supabase
                .from('exercise_param_tags')
                .select('exercise_name, weight_param, reps_param, rir_param')
                .eq('coach_user_id', user.id),
              supabase
                .from('athlete_session_logs')
                .select('date, sets_logged')
                .eq('athlete_connection_id', connection.id)
                .not('completed_at', 'is', null)
                .order('date', { ascending: false }),
            ]);
            const paramTagMap = new Map<string, { weightParam: string; repsParam: string; rirParam?: string }>();
            for (const row of paramTagResult.data ?? []) {
              paramTagMap.set((row.exercise_name as string).toLowerCase(), {
                weightParam: row.weight_param as string,
                repsParam: row.reps_param as string,
                rirParam: (row.rir_param as string | null) ?? undefined,
              });
            }
            for (const row of logsResult.data ?? []) {
              for (const exLog of (row.sets_logged as RawExLog[]) ?? []) {
                if (exLog.isCircuit) continue;
                const exNameLower = (exLog.exerciseName ?? '').toLowerCase();
                if (e1RMByExercise.has(exNameLower)) continue;
                const tags = paramTagMap.get(exNameLower);
                if (!tags) continue;
                let bestE1RM: number | null = null;
                for (const set of exLog.sets ?? []) {
                  if (!set.completed) continue;
                  const w = parseFloat(set.values?.[tags.weightParam] ?? '');
                  const r = parseFloat(set.values?.[tags.repsParam] ?? '');
                  if (isNaN(w) || isNaN(r) || w <= 0 || r <= 0) continue;
                  const rir = tags.rirParam ? parseFloat(set.values?.[tags.rirParam] ?? '0') : 0;
                  const est = epley1RM(w, r, isNaN(rir) ? 0 : rir);
                  if (bestE1RM === null || est > bestE1RM) bestE1RM = est;
                }
                if (bestE1RM !== null) e1RMByExercise.set(exNameLower, bestE1RM);
              }
            }
          }
          athleteFormulaData = { e1RMByExercise, biometricsById, perfParamsById };
        } catch (formulaErr) {
          console.warn('[assign] formula data build failed, skipping formula pre-computation', formulaErr);
        }

        await syncAthleteSchedule(
          connection.id,
          assignment,
          finalTrainingDays,
          filteredExercises,
          program.name,
          program.parameterValues ?? {},
          Array.isArray(filteredSections) ? filteredSections : [],
          toolboxData?.entries,
          filteredSupersets,
          undefined,
          undefined,
          athleteFormulaData,
        );
      }

      if (dateMismatch) {
        toast({
          title: 'Dates shifted',
          description: `Sessions shifted ${dateMismatch.days} day${dateMismatch.days !== 1 ? 's' : ''} ${dateMismatch.direction} from the original plan.`,
        });
      }

      toast({
        title: 'Program assigned',
        description: connection.connectedAt
          ? `${program.name} synced to ${athlete.firstName}'s app.`
          : `${program.name} assigned. Connect the athlete to sync sessions.`,
      });

      navigate(`/coach-mobile/athletes/${athleteId}`, { state: { tab: 'training' } });
    } catch (err) {
      console.error('[assign] error', err);
      toast({ title: 'Assignment failed', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  // ── Date modal helpers ──────────────────────────────────────────────────────

  const openDateEdit = (type: 'test' | 'event', outerIdx: number, dateIdx: number | null, currentVal: string) => {
    setDateModal({ type, outerIdx, dateIdx, value: currentVal });
  };

  const closeDateModal = () => setDateModal(null);

  const handleDateUpdate = (newDateStr: string) => {
    if (!dateModal) return;
    const iso = new Date(newDateStr + 'T12:00:00').toISOString();
    if (dateModal.type === 'test') {
      setReviewedTests(prev => prev.map((t, i) => {
        if (i !== dateModal.outerIdx) return t;
        const dates = [...t.scheduledDates];
        if (dateModal.dateIdx === null) dates.push(iso);
        else dates[dateModal.dateIdx] = iso;
        return { ...t, scheduledDates: dates };
      }));
    } else {
      setReviewedEvents(prev => prev.map((e, i) => {
        if (i !== dateModal.outerIdx) return e;
        const dates = [...e.scheduledDates];
        if (dateModal.dateIdx === null) dates.push(iso);
        else dates[dateModal.dateIdx] = iso;
        return { ...e, scheduledDates: dates };
      }));
    }
  };

  const handleDateRemove = () => {
    if (!dateModal || dateModal.dateIdx === null) return;
    const { type, outerIdx, dateIdx } = dateModal;
    if (type === 'test') {
      setReviewedTests(prev => prev.map((t, i) =>
        i !== outerIdx ? t : { ...t, scheduledDates: t.scheduledDates.filter((_, j) => j !== dateIdx) }
      ));
    } else {
      setReviewedEvents(prev => prev.map((e, i) =>
        i !== outerIdx ? e : { ...e, scheduledDates: e.scheduledDates.filter((_, j) => j !== dateIdx) }
      ));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!athlete) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground text-sm">
        Athlete not found.
      </div>
    );
  }

  const goBack = () => {
    if (step === 'pick-program') navigate(-1);
    else if (step === 'meso') setStep('pick-program');
    else setStep('meso');
  };

  const stepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 pt-4 pb-2 border-b">
        <button
          onClick={goBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold flex-1 truncate">Assign Program</h1>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Step 1: Pick program ── */}
      {step === 'pick-program' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Athlete + start date */}
          <div className="shrink-0 px-4 pb-3 space-y-3 border-b">
            <p className="text-xs text-muted-foreground">
              Assigning to <span className="font-medium text-foreground">{athlete.firstName} {athlete.lastName}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</Label>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {isPastDate && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Start date is in the past.
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {availablePrograms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No programs available</p>
                <p className="text-xs text-muted-foreground">Create a training program in the desktop wizard first.</p>
              </div>
            ) : (
              <div className="px-4 pb-6 space-y-2 pt-3">
                {availablePrograms.map(p => {
                  const orig = findOriginalStartDate(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProgram(p); setStep('meso'); }}
                      className="w-full flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 active:bg-muted text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.duration?.weeks ? `${p.duration.weeks} weeks` : 'Duration unknown'}
                          {orig ? ` · planned ${format(orig, 'MMM d, yyyy')}` : ''}
                        </p>
                        {p.macrocycleData?.smartGoals?.[0]?.description && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                            {p.macrocycleData.smartGoals[0].description}
                          </p>
                        )}
                      </div>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Mesocycles ── */}
      {step === 'meso' && selectedProgram && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Date shift warning */}
          {(isPastDate || dateMismatch) && (
            <div className="shrink-0 px-4 pt-3 space-y-2">
              {isPastDate && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <p className="text-xs">Start date is in the past.</p>
                </div>
              )}
              {dateMismatch && (
                <div className="flex items-start gap-2 rounded-lg bg-muted border px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    All sessions shift <strong>{dateMismatch.days} day{dateMismatch.days !== 1 ? 's' : ''} {dateMismatch.direction}</strong> from the original plan.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {programMesocycles.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                No mesocycles found in this program.
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {programMesocycles.map(meso => {
                  const isExpanded = expandedMesoIds.includes(meso.id);
                  const isMesoSelected = selectedMesoIds.includes(meso.id);
                  const selMicroCount = meso.microcycles.filter(mc => selectedMicroIds.includes(mc.id)).length;
                  return (
                    <div key={meso.id} className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Checkbox
                          checked={isMesoSelected}
                          onCheckedChange={() => toggleMeso(meso.id)}
                          className="shrink-0"
                        />
                        <button
                          onClick={() => toggleExpanded(meso.id)}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{meso.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {meso.weeks} week{meso.weeks !== 1 ? 's' : ''} · {meso.duration} days
                              {isMesoSelected && selMicroCount < meso.microcycles.length && (
                                <span className="ml-1 text-primary">({selMicroCount}/{meso.microcycles.length} selected)</span>
                              )}
                            </p>
                          </div>
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t px-4 py-2 space-y-2 bg-muted/30">
                          {meso.microcycles.map(micro => {
                            const isMicroSel = selectedMicroIds.includes(micro.id);
                            return (
                              <div key={micro.id} className="flex items-center gap-3 py-1">
                                <div className="w-4 shrink-0" />
                                <Checkbox
                                  checked={isMicroSel}
                                  onCheckedChange={() => toggleMicro(meso.id, micro.id)}
                                  className="shrink-0"
                                />
                                <span className="text-sm flex-1">{micro.name}</span>
                                <span className="text-xs text-muted-foreground">{micro.duration} days</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Summary row */}
                {finalMesocycles.length > 0 && (
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-1.5 mt-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Schedule</p>
                    {finalMesocycles.map((m) => (
                      <div key={m.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate">{m.name}</span>
                        <span className="shrink-0 ml-2">
                          {format(parseDateStr(m.startDate), 'MMM d')} – {format(parseDateStr(m.endDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{totalWeeks} weeks · ends {format(endDate, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 border-t">
            <Button
              className="w-full"
              disabled={finalMesocycles.length === 0}
              onClick={() => setStep('tests-events')}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Tests & Events ── */}
      {step === 'tests-events' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            {reviewedTests.length === 0 && reviewedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <Trophy className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No tests or events</p>
                <p className="text-xs text-muted-foreground">This program has no tests or events defined. You can assign it directly.</p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-3">
                {/* Tests */}
                {reviewedTests.map((sg, idx) => (
                  <div key={`test-${idx}`} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                      <p className="text-sm font-semibold truncate flex-1">
                        {sg.testMethod}{sg.unit ? ` [${sg.unit}]` : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Baseline</Label>
                        <Input
                          type="number"
                          value={sg.baselineValue || ''}
                          onChange={e => setReviewedTests(prev => prev.map((t, i) => i === idx ? { ...t, baselineValue: parseFloat(e.target.value) || 0 } : t))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Goal</Label>
                        <Input
                          type="number"
                          value={sg.goalValue || ''}
                          onChange={e => setReviewedTests(prev => prev.map((t, i) => i === idx ? { ...t, goalValue: parseFloat(e.target.value) || 0 } : t))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comments</Label>
                      <Input
                        value={sg.comments || ''}
                        onChange={e => setReviewedTests(prev => prev.map((t, i) => i === idx ? { ...t, comments: e.target.value } : t))}
                        className="h-8 text-sm"
                        placeholder="Notes…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Test Dates</Label>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {sg.scheduledDates.map((d, di) => (
                          <button
                            key={di}
                            onClick={() => openDateEdit('test', idx, di, new Date(d).toISOString().slice(0, 10))}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium active:opacity-70 transition-opacity"
                          >
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(d), 'MMM d, yyyy')}
                          </button>
                        ))}
                        <button
                          onClick={() => openDateEdit('test', idx, null, new Date().toISOString().slice(0, 10))}
                          className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-accent active:opacity-70 transition-opacity"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Events */}
                {reviewedEvents.map((evt, idx) => (
                  <div key={`event-${idx}`} className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-blue-500 shrink-0" />
                      <p className="text-sm font-semibold truncate flex-1">{evt.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comments</Label>
                      <Input
                        value={evt.comments || ''}
                        onChange={e => setReviewedEvents(prev => prev.map((e, i) => i === idx ? { ...e, comments: e.target.value } : e))}
                        className="h-8 text-sm"
                        placeholder="Notes…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Event Dates</Label>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {evt.scheduledDates.map((d, di) => (
                          <button
                            key={di}
                            onClick={() => openDateEdit('event', idx, di, new Date(d).toISOString().slice(0, 10))}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium active:opacity-70 transition-opacity"
                          >
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(d), 'MMM d, yyyy')}
                          </button>
                        ))}
                        <button
                          onClick={() => openDateEdit('event', idx, null, new Date().toISOString().slice(0, 10))}
                          className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-accent active:opacity-70 transition-opacity"
                        >
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 border-t">
            <Button
              className="w-full gap-2"
              onClick={handleAssign}
              disabled={assigning || finalMesocycles.length === 0}
            >
              {assigning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Assigning…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Assign Program</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Date edit modal */}
      <DateEditModal
        open={dateModal !== null}
        value={dateModal?.value ?? ''}
        isNew={dateModal?.dateIdx === null}
        onUpdate={handleDateUpdate}
        onRemove={handleDateRemove}
        onClose={closeDateModal}
      />
    </div>
  );
}
