import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import { parseDateStr } from '@/utils/dateUtils';
import { TrainingDay } from '@/types/daily-intensity';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { SessionSection, ExerciseDistribution } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabelFull, getBorgStyleLight, migrateLegacyIntensity } from '@/utils/intensityScale';
import { DayHeader } from './DayHeader';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  Copy,
  Loader2,
  Trophy,
  Calendar as CalendarIcon,
} from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

export interface MethodSessionArchitectureProps {
  mesocycle: ExtendedMesocycle;
  allMesocycles: ExtendedMesocycle[];
  trainingDays: TrainingDay[];
  /** Record<methodName, mesocycleId[]> — written by MesocyclePage, read-only here */
  methodAllocations: Record<string, string[]>;
  /** Record<baseMethodName, exerciseCategory[]> — derived from exercisesByMethod, split-state-independent */
  methodExerciseCategories?: Record<string, string[]>;
  /** Record<dayDate, methodId[]> */
  dayMethodAssignments: Record<string, string[]>;
  onDayMethodAssignmentsChange: (assignments: Record<string, string[]>) => void;
  sessionSections: SessionSection[];
  onSectionsChange: (sections: SessionSection[]) => void;
  /** Passed for read-only context display when the user navigates back from Step 2 */
  exerciseDistribution: ExerciseDistribution[];
  daySplitStates: Record<string, number>;
  onDayIntensityChange: (dayDate: string, intensity: IntensityLevel) => void;
  onSessionIntensityChange: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  onAddSession: (dayDate: string) => void;
  onRemoveSession: (dayDate: string, sessionIndex: number) => void;
  onRenameSession: (dayDate: string, sessionIndex: number, newName: string) => void;
  /** Returns the periodization-table target frequency for a method in a specific microcycle */
  getMethodFrequencyTarget?: (methodId: string, microcycleId: string) => number;
  /** True if the method has at least one periodization value in the mesocycle (copy only copies these) */
  isMethodCharacterizedInMesocycle?: (methodKey: string, mesocycleId: string) => boolean;
  /** Controlled selected microcycle index (lifted to page for pill navigation) */
  selectedMicrocycleIndex?: number;
  onSelectedMicrocycleIndexChange?: (index: number) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns a subtle background style object using Borg CR10 colors */
function subtleBg(intensity: IntensityLevel): React.CSSProperties {
  return getBorgStyleLight(migrateLegacyIntensity(intensity), 0.15);
}

/** Returns the sub-category part of "Category - SubCategory", else the full string */
function shortName(methodId: string) {
  // Strip ::exerciseCategory suffix first, then the method prefix
  const base = methodId.includes('::') ? methodId.split('::')[0] : methodId;
  const idx = base.indexOf(' - ');
  return idx > -1 ? base.slice(idx + 3) : base;
}

/**
 * Human-readable display label for a draggable/assigned key.
 * Plain method  → "Power"
 * method::cat   → "Strength › Hinge"
 */
function displayLabel(key: string): string {
  if (key.includes('::')) {
    const sepIdx = key.indexOf('::');
    const base = key.slice(0, sepIdx);
    const cat  = key.slice(sepIdx + 2);
    return `${shortName(base)} › ${cat}`;
  }
  return shortName(key);
}

/** Returns just the exercise-category label from a "method::category" key */
function exCatLabel(fullKey: string) {
  const idx = fullKey.indexOf('::');
  return idx > -1 ? fullKey.slice(idx + 2) : fullKey;
}

/** True when the key contains an exercise-category suffix */
function hasExCat(fullKey: string) {
  return fullKey.includes('::');
}

// ─── component ────────────────────────────────────────────────────────────────

export function MethodSessionArchitecture({
  mesocycle,
  allMesocycles,
  trainingDays,
  methodAllocations,
  methodExerciseCategories,
  dayMethodAssignments,
  onDayMethodAssignmentsChange,
  sessionSections,
  onSectionsChange,
  exerciseDistribution,
  daySplitStates,
  onDayIntensityChange,
  onSessionIntensityChange,
  onAddSession,
  onRemoveSession,
  onRenameSession,
  getMethodFrequencyTarget,
  isMethodCharacterizedInMesocycle,
  selectedMicrocycleIndex: selectedMicrocycleIndexProp,
  onSelectedMicrocycleIndexChange,
}: MethodSessionArchitectureProps) {
  const { toast } = useToast();

  // local UI state
  const [renamingSession, setRenamingSession] = useState<{
    dayDate: string; sessionIndex: number; value: string;
  } | null>(null);
  const [sessionIntensityPopovers, setSessionIntensityPopovers] = useState<Set<string>>(new Set());
  const [sessionCommentsMap, setSessionCommentsMap] = useState<Record<string, string>>({});
  const [sessionIntensityMap, setSessionIntensityMap] = useState<Record<string, IntensityLevel>>({});
  const [copyingMicrocycleId, setCopyingMicrocycleId] = useState<string | null>(null);
  const [clearingMicrocycleId, setClearingMicrocycleId] = useState<string | null>(null);
  const [clearingMesocycleId, setClearingMesocycleId] = useState<string | null>(null);
  const [confirmCopyMesocycle, setConfirmCopyMesocycle] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  /** Methods with exercise-category cards — collapsed unless listed here */
  const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());
  // ── selected microcycle: controlled by parent when prop provided, else local ──
  const [selectedMicrocycleIndexLocal, setSelectedMicrocycleIndexLocal] = useState(0);
  const selectedMicrocycleIndex = selectedMicrocycleIndexProp ?? selectedMicrocycleIndexLocal;
  const setSelectedMicrocycleIndex = useCallback((v: number | ((prev: number) => number)) => {
    const next = typeof v === 'function' ? v(selectedMicrocycleIndex) : v;
    setSelectedMicrocycleIndexLocal(next);
    onSelectedMicrocycleIndexChange?.(next);
  }, [selectedMicrocycleIndex, onSelectedMicrocycleIndexChange]);

  // ── derived: days in this mesocycle ─────────────────────────────────────────
  const mesocycleDays = useMemo(() => {
    const start =
      typeof mesocycle.startDate === 'string'
        ? mesocycle.startDate.split('T')[0]
        : format(mesocycle.startDate as Date, 'yyyy-MM-dd');
    const end =
      typeof mesocycle.endDate === 'string'
        ? mesocycle.endDate.split('T')[0]
        : format(mesocycle.endDate as Date, 'yyyy-MM-dd');
    return trainingDays.filter(d => d?.date && d.date >= start && d.date <= end);
  }, [trainingDays, mesocycle]);

  // ── derived: days grouped by microcycle (preserving meso order) ─────────────
  const daysByMicrocycle = useMemo(() => {
    const map = new Map<string, { microcycle: Microcycle; days: TrainingDay[] }>();
    mesocycleDays.forEach(day => {
      if (!map.has(day.microcycleId)) {
        const micro = mesocycle.microcycles.find(m => m.id === day.microcycleId);
        if (micro) map.set(day.microcycleId, { microcycle: micro, days: [] });
      }
      map.get(day.microcycleId)?.days.push(day);
    });
    const sorted = new Map<string, { microcycle: Microcycle; days: TrainingDay[] }>();
    mesocycle.microcycles.forEach(m => {
      if (map.has(m.id)) sorted.set(m.id, map.get(m.id)!);
    });
    return sorted;
  }, [mesocycleDays, mesocycle]);

  // ── derived: only methods explicitly allocated to this mesocycle ─────────────
  // Strip any "::category" split suffix so the panel is always split-state-independent.
  const allMethods = useMemo(() => {
    const seen = new Set<string>();
    return Object.keys(methodAllocations)
      .filter(m => methodAllocations[m]?.includes(mesocycle.id))
      .map(m => m.split('::')[0])
      .filter(m => !seen.has(m) && seen.add(m) !== undefined);
  }, [methodAllocations, mesocycle.id]);

  // ── derived: methods grouped by parent category label ───────────────────────
  const methodsByCategory = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    allMethods.forEach(m => {
      const cat = m.includes(' - ') ? m.split(' - ')[0] : 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    });
    return grouped;
  }, [allMethods]);

  // ── derived: flat draggable list — expand methods with exercise categories ────
  const flatAvailable = useMemo(() => {
    const result: string[] = [];
    allMethods.forEach(methodId => {
      const cats = methodExerciseCategories?.[methodId];
      if (cats && cats.length > 0) {
        cats.forEach(cat => result.push(`${methodId}::${cat}`));
      } else {
        result.push(methodId);
      }
    });
    return result;
  }, [allMethods, methodExerciseCategories]);

  // ── derived: selected microcycle entry ──────────────────────────────────────
  const microcycleEntries = useMemo(() => Array.from(daysByMicrocycle.entries()), [daysByMicrocycle]);
  const clampedMicrocycleIndex = Math.min(selectedMicrocycleIndex, Math.max(0, microcycleEntries.length - 1));
  const selectedEntry = microcycleEntries[clampedMicrocycleIndex] ?? null;

  // ── derived: assignment frequency per method in the selected microcycle ──────
  const methodFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!selectedEntry) return counts;
    const [selectedMicroId, { days }] = selectedEntry;
    days.filter(d => d.microcycleId === selectedMicroId && d.intensity !== 'off').forEach(day => {
      const seen = new Set<string>();
      for (let si = 0; si < 4; si++) {
        (dayMethodAssignments[`${day.date}_${si}`] ?? []).forEach(m => seen.add(m));
      }
      seen.forEach(m => { counts[m] = (counts[m] ?? 0) + 1; });
    });
    return counts;
  }, [selectedEntry, dayMethodAssignments]);

  // ── derived: periodization target frequency per draggable key ────────────────
  const methodTargetFrequency = useMemo(() => {
    const targets: Record<string, number> = {};
    if (!getMethodFrequencyTarget || !selectedEntry) return targets;
    const [microId] = selectedEntry;
    flatAvailable.forEach(key => {
      const freq = getMethodFrequencyTarget(key, microId);
      if (freq > 0) targets[key] = freq;
    });
    return targets;
  }, [getMethodFrequencyTarget, selectedEntry, flatAvailable]);

  // ── init: expand all categories whenever methodsByCategory changes ──────────
  useEffect(() => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      Object.keys(methodsByCategory).forEach(cat => next.add(cat));
      return next;
    });
  }, [methodsByCategory]);

  // ── init: load session intensities from localStorage ─────────────────────────
  useEffect(() => {
    const map: Record<string, IntensityLevel> = {};
    mesocycleDays.forEach(day => {
      const cnt = day.intensity === 'off' ? 0 : (daySplitStates[day.date] ?? 1);
      for (let i = 0; i < cnt; i++) {
        const stored = localStorage.getItem(
          `sessionIntensity_${mesocycle.id}_${day.date}_${i}`
        ) as IntensityLevel | null;
        if (stored) map[`${day.date}_${i}`] = stored;
      }
    });
    setSessionIntensityMap(map);
  }, [mesocycle.id, mesocycleDays, daySplitStates]);

  // ── init: load session comments from localStorage ────────────────────────────
  useEffect(() => {
    const map: Record<string, string> = {};
    mesocycleDays.forEach(day => {
      const cnt = day.intensity === 'off' ? 0 : (daySplitStates[day.date] ?? 1);
      for (let i = 0; i < cnt; i++) {
        const raw = localStorage.getItem(
          `workoutSessions_${mesocycle.id}_${day.date}_${i}`
        );
        if (raw) {
          try {
            const { comments } = JSON.parse(raw) as { comments?: string };
            if (comments) map[`${day.date}_${i}`] = comments;
          } catch { /* ignore */ }
        }
      }
    });
    setSessionCommentsMap(map);
  }, [mesocycle.id, mesocycleDays, daySplitStates]);

  // ── handlers: method assignment (session-level) ──────────────────────────────
  const addMethodToSession = useCallback(
    (dayDate: string, sessionIndex: number, methodId: string) => {
      const key = `${dayDate}_${sessionIndex}`;
      const current = dayMethodAssignments[key] ?? [];
      if (current.includes(methodId)) return;
      onDayMethodAssignmentsChange({
        ...dayMethodAssignments,
        [key]: [...current, methodId],
      });
    },
    [dayMethodAssignments, onDayMethodAssignmentsChange]
  );

  const removeMethodFromSession = useCallback(
    (dayDate: string, sessionIndex: number, methodId: string) => {
      const key = `${dayDate}_${sessionIndex}`;
      const current = dayMethodAssignments[key] ?? [];
      onDayMethodAssignmentsChange({
        ...dayMethodAssignments,
        [key]: current.filter(m => m !== methodId),
      });
    },
    [dayMethodAssignments, onDayMethodAssignmentsChange]
  );

  // ── handlers: sessions ───────────────────────────────────────────────────────
  const handleSessionIntensityChange = useCallback(
    (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => {
      onSessionIntensityChange(dayDate, sessionIndex, intensity);
      setSessionIntensityMap(prev => ({
        ...prev,
        [`${dayDate}_${sessionIndex}`]: intensity,
      }));
    },
    [onSessionIntensityChange]
  );

  const saveSessionComment = useCallback(
    (dayDate: string, sessionIndex: number, comment: string) => {
      const key = `workoutSessions_${mesocycle.id}_${dayDate}_${sessionIndex}`;
      const existing = localStorage.getItem(key);
      let parsed: Record<string, unknown> = {};
      try { if (existing) parsed = JSON.parse(existing) as Record<string, unknown>; } catch { /* ignore */ }
      localStorage.setItem(key, JSON.stringify({ ...parsed, comments: comment }));
      setSessionCommentsMap(prev => ({ ...prev, [`${dayDate}_${sessionIndex}`]: comment }));
    },
    [mesocycle.id]
  );

  // ── copy helpers ────────────────────────────────────────────────────────────
  // Copies one microcycle's day→method assignments onto another, day by day and session by
  // session, into `assignments` (mutated). A method is only copied if it's characterised in the
  // target mesocycle — i.e. has at least one periodization value there (an unassigned method
  // never has one) — and only up to its periodization frequency in the target microcycle.
  const copyMicrocycleAssignments = useCallback(
    (
      sourceMicrocycleId: string,
      targetMicrocycleId: string,
      targetMesocycleId: string,
      assignments: Record<string, string[]>
    ): { skipped: Set<string> } => {
      const sourceDays = trainingDays.filter(d => d.microcycleId === sourceMicrocycleId);
      const targetDays = trainingDays.filter(d => d.microcycleId === targetMicrocycleId);
      const skipped = new Set<string>();
      const placed: Record<string, number> = {};
      const caps: Record<string, number> = {};

      const isAllowed = (method: string): boolean => {
        if (isMethodCharacterizedInMesocycle && !isMethodCharacterizedInMesocycle(method, targetMesocycleId)) {
          skipped.add(method);
          return false;
        }
        if (getMethodFrequencyTarget) {
          if (!(method in caps)) caps[method] = getMethodFrequencyTarget(method, targetMicrocycleId);
          if (caps[method] === 0) return false;                // not assigned in target microcycle
          if ((placed[method] ?? 0) >= caps[method]) return false; // frequency cap reached
        }
        return true;
      };

      const minDays = Math.min(sourceDays.length, targetDays.length);
      for (let i = 0; i < minDays; i++) {
        const sourceDate = sourceDays[i].date;
        const targetDate = targetDays[i].date;
        // Rest days (Borg "0") have no sessions — same rule as the day columns below
        const sourceSessionCount = migrateLegacyIntensity(sourceDays[i].intensity) === '0' ? 0 : (daySplitStates[sourceDate] ?? 1);
        const targetSessionCount = migrateLegacyIntensity(targetDays[i].intensity) === '0' ? 0 : (daySplitStates[targetDate] ?? 1);
        if (targetSessionCount === 0) continue; // never put methods (or new sessions) on a rest day

        for (let si = 0; si < sourceSessionCount; si++) {
          const targetKey = `${targetDate}_${si}`;
          const filteredMethods = (dayMethodAssignments[`${sourceDate}_${si}`] ?? []).filter(isAllowed);
          filteredMethods.forEach(method => { placed[method] = (placed[method] ?? 0) + 1; });

          if (filteredMethods.length > 0) {
            assignments[targetKey] = filteredMethods;
          } else if (si < targetSessionCount) {
            // Clear target slot if nothing to copy into it
            delete assignments[targetKey];
          }
        }

        // Target sessions the source day doesn't have get cleared — the copy mirrors the source
        for (let si = sourceSessionCount; si < targetSessionCount; si++) {
          delete assignments[`${targetDate}_${si}`];
        }

        // Add sessions to target day if source had more
        for (let j = 0; j < sourceSessionCount - targetSessionCount; j++) {
          onAddSession(targetDate);
        }
      }
      return { skipped };
    },
    [trainingDays, dayMethodAssignments, daySplitStates, getMethodFrequencyTarget, isMethodCharacterizedInMesocycle, onAddSession]
  );

  const describeCopyResult = (base: string, skipped: Set<string>, targetName: string) =>
    skipped.size === 0
      ? base
      : `${base} Not copied — no periodization values in ${targetName}: ${[...skipped].map(m => m.replace('::', ' › ')).join(', ')}.`;

  // ── copy from previous microcycle ───────────────────────────────────────────
  const handleCopyFromPreviousMicrocycle = useCallback(
    (targetMicrocycleId: string) => {
      setCopyingMicrocycleId(targetMicrocycleId);
      try {
        // Locate target microcycle across all mesocycles
        let targetMesoIndex = -1;
        let targetMicroInMesoIndex = -1;
        for (let i = 0; i < allMesocycles.length; i++) {
          const idx = allMesocycles[i].microcycles.findIndex(m => m.id === targetMicrocycleId);
          if (idx !== -1) {
            targetMesoIndex = i;
            targetMicroInMesoIndex = idx;
            break;
          }
        }
        if (targetMesoIndex === -1) return;

        // Find source microcycle
        let sourceMicrocycleId: string | null = null;
        if (targetMicroInMesoIndex > 0) {
          sourceMicrocycleId = allMesocycles[targetMesoIndex].microcycles[targetMicroInMesoIndex - 1].id;
        } else if (targetMesoIndex > 0) {
          const prevMeso = allMesocycles[targetMesoIndex - 1];
          sourceMicrocycleId = prevMeso.microcycles[prevMeso.microcycles.length - 1].id;
        } else {
          toast({ title: 'Cannot copy', description: 'This is the first microcycle of the plan', variant: 'destructive' });
          return;
        }

        if (!trainingDays.some(d => d.microcycleId === sourceMicrocycleId)) {
          toast({ title: 'Nothing to copy', description: 'Previous microcycle has no sessions', variant: 'destructive' });
          return;
        }

        const newAssignments: Record<string, string[]> = { ...dayMethodAssignments };
        const { skipped } = copyMicrocycleAssignments(
          sourceMicrocycleId, targetMicrocycleId, allMesocycles[targetMesoIndex].id, newAssignments
        );
        onDayMethodAssignmentsChange(newAssignments);
        toast({
          title: 'Copied',
          description: describeCopyResult('Method assignments copied from previous microcycle.', skipped, allMesocycles[targetMesoIndex].name),
        });
      } finally {
        setCopyingMicrocycleId(null);
      }
    },
    [allMesocycles, trainingDays, dayMethodAssignments, copyMicrocycleAssignments, onDayMethodAssignmentsChange, toast]
  );

  // ── copy whole previous mesocycle ───────────────────────────────────────────
  // Week 1 ← previous mesocycle's week 1, week 2 ← week 2, …; if this mesocycle has more
  // microcycles than the previous one, the extra weeks repeat the previous mesocycle's last week.
  const handleCopyFromPreviousMesocycle = useCallback(() => {
    const mesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
    const previous = mesoIndex > 0 ? allMesocycles[mesoIndex - 1] : null;
    if (!previous || previous.microcycles.length === 0) {
      toast({ title: 'Cannot copy', description: 'There is no previous mesocycle to copy from', variant: 'destructive' });
      return;
    }
    const newAssignments: Record<string, string[]> = { ...dayMethodAssignments };
    const skipped = new Set<string>();
    mesocycle.microcycles.forEach((micro, i) => {
      const source = previous.microcycles[Math.min(i, previous.microcycles.length - 1)];
      copyMicrocycleAssignments(source.id, micro.id, mesocycle.id, newAssignments).skipped.forEach(m => skipped.add(m));
    });
    onDayMethodAssignmentsChange(newAssignments);
    toast({
      title: 'Copied',
      description: describeCopyResult(`Method setup copied from ${previous.name}.`, skipped, mesocycle.name),
    });
  }, [allMesocycles, mesocycle, dayMethodAssignments, copyMicrocycleAssignments, onDayMethodAssignmentsChange, toast]);

  // ── clear microcycle ─────────────────────────────────────────────────────────
  const handleClearMicrocycle = useCallback(
    (microcycleId: string) => {
      const micro = mesocycle.microcycles.find(m => m.id === microcycleId);
      if (!micro) return;
      const dayDates = trainingDays
        .filter(d => d.microcycleId === microcycleId)
        .map(d => d.date);
      const newAssignments = { ...dayMethodAssignments };
      dayDates.forEach(date => {
        for (let si = 0; si < 8; si++) {
          delete newAssignments[`${date}_${si}`];
        }
      });
      onDayMethodAssignmentsChange(newAssignments);
      toast({ title: 'Microcycle cleared', description: `Method assignments removed from ${micro.name}` });
    },
    [mesocycle.microcycles, trainingDays, dayMethodAssignments, onDayMethodAssignmentsChange, toast]
  );

  // ── clear mesocycle ───────────────────────────────────────────────────────────
  const handleClearMesocycle = useCallback(
    (mesocycleId: string) => {
      const meso = allMesocycles.find(m => m.id === mesocycleId);
      if (!meso) return;
      const dayDates = trainingDays
        .filter(d => meso.microcycles.some(mc => mc.id === d.microcycleId))
        .map(d => d.date);
      const newAssignments = { ...dayMethodAssignments };
      dayDates.forEach(date => {
        for (let si = 0; si < 8; si++) {
          delete newAssignments[`${date}_${si}`];
        }
      });
      onDayMethodAssignmentsChange(newAssignments);
      toast({ title: 'Mesocycle cleared', description: `All method assignments removed from ${meso.name}` });
    },
    [allMesocycles, trainingDays, dayMethodAssignments, onDayMethodAssignmentsChange, toast]
  );

  // ── dnd ──────────────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === 'method-pool' &&
        destination.droppableId.startsWith('session-drop::')
      ) {
        const parts = destination.droppableId.split('::');
        const dayDate = parts[1];
        const sessionIndex = parseInt(parts[2], 10);
        const methodId = draggableId.slice('method::'.length);
        addMethodToSession(dayDate, sessionIndex, methodId);
      }
    },
    [addMethodToSession]
  );

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <>
    {/* Clear Microcycle Confirmation */}
    <AlertDialog open={!!clearingMicrocycleId} onOpenChange={(open) => !open && setClearingMicrocycleId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Microcycle</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all method assignments from{' '}
            <strong>{clearingMicrocycleId && mesocycle.microcycles.find(m => m.id === clearingMicrocycleId)?.name}</strong>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (clearingMicrocycleId) { handleClearMicrocycle(clearingMicrocycleId); setClearingMicrocycleId(null); } }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Copy previous mesocycle Confirmation */}
    <AlertDialog open={confirmCopyMesocycle} onOpenChange={setConfirmCopyMesocycle}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Copy method setup from previous mesocycle?</AlertDialogTitle>
          <AlertDialogDescription>
            Each microcycle of <strong>{mesocycle.name}</strong> gets the method assignments of the matching
            microcycle of <strong>{allMesocycles[allMesocycles.findIndex(m => m.id === mesocycle.id) - 1]?.name}</strong>,
            replacing what's there now. Methods without periodization values in {mesocycle.name} are left out,
            and each method is only placed as often as its periodization frequency allows.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { handleCopyFromPreviousMesocycle(); setConfirmCopyMesocycle(false); }}>
            Copy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Clear Mesocycle Confirmation */}
    <AlertDialog open={!!clearingMesocycleId} onOpenChange={(open) => !open && setClearingMesocycleId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Entire Mesocycle</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all method assignments from every microcycle in{' '}
            <strong>{mesocycle.name}</strong>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { if (clearingMesocycleId) { handleClearMesocycle(clearingMesocycleId); setClearingMesocycleId(null); } }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <TooltipProvider>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex h-full w-full">

          {/* ── LEFT PANEL: method list ─────────────────────────────────────── */}
          <div className="w-[220px] shrink-0 border-r flex flex-col max-h-[calc(100vh-220px)] sticky top-0">
            <div className="p-3 border-b bg-muted/30 shrink-0">
              <h3 className="text-sm font-semibold">Training Methods</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drag onto a session to assign
              </p>
            </div>

            <Droppable droppableId="method-pool" isDropDisabled={true}>
              {provided => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 overflow-y-auto p-2 space-y-0.5"
                >
                  {Object.keys(methodsByCategory).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center p-3">
                      No methods found. Configure methods in Mesocycle Characterization.
                    </p>
                  )}

                  {Object.entries(methodsByCategory).map(([category, methods]) => {
                    if (methods.length === 0) return null;
                    return (
                      <div key={category}>
                        {/* Category header */}
                        <button
                          onClick={() =>
                            setExpandedCategories(prev => {
                              const next = new Set(prev);
                              next.has(category) ? next.delete(category) : next.add(category);
                              return next;
                            })
                          }
                          className="w-full flex items-center gap-1 px-1 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground rounded"
                        >
                          {expandedCategories.has(category)
                            ? <ChevronDown className="h-3 w-3 shrink-0" />
                            : <ChevronRight className="h-3 w-3 shrink-0" />}
                          <span className="truncate text-left flex-1">{category}</span>
                        </button>

                        {expandedCategories.has(category) && (
                          <div className="ml-2 space-y-0.5 mb-1">
                            {methods.map(methodId => {
                              const exCats = methodExerciseCategories?.[methodId];
                              const hasCategories = exCats && exCats.length > 0;

                              const renderCard = (draggableKey: string) => {
                                const idx = flatAvailable.indexOf(draggableKey);
                                const label = hasExCat(draggableKey)
                                  ? exCatLabel(draggableKey)
                                  : shortName(draggableKey);
                                return (
                                  <Draggable
                                    key={`method::${draggableKey}`}
                                    draggableId={`method::${draggableKey}`}
                                    index={idx}
                                  >
                                    {(drag, snapshot) => (
                                      <div
                                        ref={drag.innerRef}
                                        {...drag.draggableProps}
                                        {...drag.dragHandleProps}
                                        className={cn(
                                          'flex items-center gap-1.5 px-2 py-1.5 rounded text-xs',
                                          'cursor-grab active:cursor-grabbing select-none',
                                          'border border-transparent hover:border-border hover:bg-accent/50',
                                          snapshot.isDragging && 'bg-accent shadow-lg border-border'
                                        )}
                                        title={draggableKey}
                                      >
                                        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">{label}</span>
                                        {(() => {
                                          const actual = methodFrequency[draggableKey] ?? 0;
                                          const target = methodTargetFrequency[draggableKey] ?? 0;
                                          if (target === 0 && actual === 0) return null;
                                          const totalDots = Math.max(target, actual);
                                          if (totalDots > 7) return (
                                            <span className={cn(
                                              'shrink-0 text-[10px] font-bold leading-none px-1 py-0.5 rounded',
                                              actual === 0 ? 'text-muted-foreground' :
                                              actual < target ? 'text-amber-600 bg-amber-50 dark:bg-amber-950' :
                                              actual === target ? 'text-green-600 bg-green-50 dark:bg-green-950' :
                                              'text-red-600 bg-red-50 dark:bg-red-950'
                                            )}>
                                              {actual}/{target}
                                            </span>
                                          );
                                          return (
                                            <div className="flex gap-[3px] shrink-0 items-center" title={`${actual} of ${target} sessions placed`}>
                                              {Array.from({ length: totalDots }, (_, i) => (
                                                <div key={i} className={cn(
                                                  'h-1.5 w-1.5 rounded-full transition-colors',
                                                  i < actual && i < target
                                                    ? actual === target ? 'bg-green-500' : 'bg-amber-400'
                                                    : i < actual && i >= target
                                                      ? 'bg-red-500'
                                                      : 'bg-muted-foreground/25'
                                                )} />
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              };

                              if (hasCategories) {
                                // Methods with category cards start collapsed for a better overview;
                                // the header still shows how many sessions are placed vs. targeted.
                                const isOpen = expandedMethods.has(methodId);
                                const keys = exCats!.map(cat => `${methodId}::${cat}`);
                                const placedSum = keys.reduce((s, k) => s + (methodFrequency[k] ?? 0), 0);
                                const targetSum = keys.reduce((s, k) => s + (methodTargetFrequency[k] ?? 0), 0);
                                return (
                                  <div key={methodId}>
                                    <button
                                      onClick={() =>
                                        setExpandedMethods(prev => {
                                          const next = new Set(prev);
                                          next.has(methodId) ? next.delete(methodId) : next.add(methodId);
                                          return next;
                                        })
                                      }
                                      className="w-full flex items-center gap-1 px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded select-none"
                                    >
                                      {isOpen
                                        ? <ChevronDown className="h-3 w-3 shrink-0" />
                                        : <ChevronRight className="h-3 w-3 shrink-0" />}
                                      <span className="truncate text-left flex-1">{shortName(methodId)}</span>
                                      {(placedSum > 0 || targetSum > 0) && (
                                        <span
                                          className={cn(
                                            'shrink-0 text-[10px] tabular-nums',
                                            targetSum > 0 && placedSum === targetSum ? 'text-green-600' :
                                            placedSum > targetSum ? 'text-red-600' : 'text-muted-foreground'
                                          )}
                                          title={`${placedSum} of ${targetSum} sessions placed across ${keys.length} categories`}
                                        >
                                          {placedSum}/{targetSum}
                                        </span>
                                      )}
                                    </button>
                                    {isOpen && (
                                      <div className="ml-3 space-y-0.5">
                                        {keys.map(key => renderCard(key))}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              return renderCard(methodId);
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* ── RIGHT: calendar ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto p-4">
            <div className="w-max min-w-full">

              {/* Mesocycle header */}
              <div className="mb-4 rounded-md border border-border pb-3" style={subtleBg(mesocycle.intensity)}>
                <div className="flex items-center justify-center gap-3 px-4 py-2">
                  <h2 className="text-xl font-bold">{mesocycle.name}</h2>
                  <Badge
                    variant="secondary"
                    className="font-semibold"
                    style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(mesocycle.intensity)), color: getBorgFg(migrateLegacyIntensity(mesocycle.intensity)) }}
                  >
                    {getBorgLabelFull(migrateLegacyIntensity(mesocycle.intensity))}
                  </Badge>
                  {allMesocycles.findIndex(m => m.id === mesocycle.id) > 0 && (
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Copy the method setup from the previous mesocycle"
                      onClick={() => setConfirmCopyMesocycle(true)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                    title={`Clear all method assignments from ${mesocycle.name}`}
                    onClick={() => setClearingMesocycleId(mesocycle.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {(() => {
                    const s =
                      typeof mesocycle.startDate === 'string'
                        ? mesocycle.startDate.split('T')[0]
                        : format(mesocycle.startDate as Date, 'yyyy-MM-dd');
                    const e =
                      typeof mesocycle.endDate === 'string'
                        ? mesocycle.endDate.split('T')[0]
                        : format(mesocycle.endDate as Date, 'yyyy-MM-dd');
                    return `${format(parseDateStr(s), 'MMM d, yyyy')} – ${format(parseDateStr(e), 'MMM d, yyyy')}`;
                  })()}
                </p>
              </div>

              {/* Microcycle navigation bar */}
              {selectedEntry && (() => {
                const [microId, { microcycle }] = selectedEntry;
                const isFirst = clampedMicrocycleIndex === 0;
                const isLast = clampedMicrocycleIndex === microcycleEntries.length - 1;
                const isVeryFirst = allMesocycles.findIndex(m => m.id === mesocycle.id) === 0 && isFirst;
                return (
                  <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-md border border-border" style={subtleBg(microcycle.intensity)}>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      disabled={isFirst}
                      onClick={() => setSelectedMicrocycleIndex(i => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 flex-1 justify-center">
                      <span className="font-semibold text-sm">{microcycle.name}</span>
                      <Badge
                        variant="secondary"
                        className="font-semibold text-xs"
                        style={{ backgroundColor: getBorgBg(migrateLegacyIntensity(microcycle.intensity)), color: getBorgFg(migrateLegacyIntensity(microcycle.intensity)) }}
                      >
                        {getBorgLabelFull(migrateLegacyIntensity(microcycle.intensity))}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {clampedMicrocycleIndex + 1} / {microcycleEntries.length}
                      </span>
                      {!isVeryFirst && (
                        <Button
                          size="sm" variant="ghost" className="h-6 w-6 p-0 ml-1"
                          disabled={copyingMicrocycleId === microId}
                          title="Copy method assignments from previous microcycle"
                          onClick={() => handleCopyFromPreviousMicrocycle(microId)}
                        >
                          {copyingMicrocycleId === microId
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button
                        size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        title={`Clear all method assignments from ${microcycle.name}`}
                        onClick={() => setClearingMicrocycleId(microId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      disabled={isLast}
                      onClick={() => setSelectedMicrocycleIndex(i => Math.min(microcycleEntries.length - 1, i + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}

              {/* Day columns — only selected microcycle */}
              <div className="flex gap-4">
                {selectedEntry && (() => {
                  const [, { days }] = selectedEntry;
                  return days.map(day => {
                        // Off days (Borg level "0") always show 0 sessions
                        const migratedDayIntensity = migrateLegacyIntensity(day.intensity);
                        const sessionsCount =
                          migratedDayIntensity === '0' ? 0
                          : (daySplitStates[day.date] ?? day.sessions ?? 1);

                        const hasTest  = (day.testNames?.length  ?? 0) > 0;
                        const hasEvent = (day.eventNames?.length ?? 0) > 0;
                        const hasBoth  = hasTest && hasEvent;
                        return (
                          <div
                            key={day.date}
                            className={cn(
                              'flex flex-col w-80 rounded-md pb-1',
                              hasBoth ? 'border-l-2 border-l-purple-400 pl-2' :
                              hasTest  ? 'border-l-2 border-l-amber-400 pl-2' :
                              hasEvent ? 'border-l-2 border-l-blue-400 pl-2' : ''
                            )}
                          >
                            {/* Day header */}
                            <DayHeader
                              date={day.date}
                              intensity={migratedDayIntensity as IntensityLevel}
                              onDayIntensityChange={onDayIntensityChange}
                              sessionCount={sessionsCount}
                              testNames={day.testNames}
                              eventNames={day.eventNames}
                            />

                            {/* Test / Event strip */}
                            {(hasTest || hasEvent) && (
                              <div className={cn(
                                'flex flex-wrap gap-2 px-2 py-1 mb-1 rounded text-xs',
                                hasBoth ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800' :
                                hasTest  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                                'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                              )}>
                                {hasTest && (
                                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                                    <Trophy className="h-3 w-3 shrink-0" />
                                    {day.testNames!.join(' · ')}
                                  </span>
                                )}
                                {hasEvent && (
                                  <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium">
                                    <CalendarIcon className="h-3 w-3 shrink-0" />
                                    {day.eventNames!.join(' · ')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Sessions */}
                            <div className="flex flex-col gap-2 px-1 mt-1">
                              {Array.from({ length: sessionsCount }, (_, si) => {
                                    const sessionName =
                                      day.sessionNames?.[si] ?? `Session ${si + 1}`;
                                    const intensityKey = `${day.date}_${si}`;
                                    const sessionIntensity = migrateLegacyIntensity(
                                      sessionIntensityMap[intensityKey] ??
                                      (day.intensity ?? '5')
                                    );
                                    const popoverKey = `${day.date}_${si}`;
                                    const isRenamingThisSession =
                                      renamingSession?.dayDate === day.date &&
                                      renamingSession.sessionIndex === si;
                                    return (
                                      <Droppable
                                        key={`session-drop::${day.date}::${si}`}
                                        droppableId={`session-drop::${day.date}::${si}`}
                                      >
                                        {(sessDropProv, sessDropSnap) => (
                                          <div
                                            ref={sessDropProv.innerRef}
                                            {...sessDropProv.droppableProps}
                                            className={cn(
                                              'border border-border rounded-md bg-card transition-colors',
                                              sessDropSnap.isDraggingOver && 'ring-2 ring-primary/40 bg-accent/10'
                                            )}
                                          >
                                        {/* Session header */}
                                        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50">
                                          {isRenamingThisSession ? (
                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                              <Input
                                                value={renamingSession.value}
                                                autoFocus
                                                className="h-5 text-xs px-1 py-0 flex-1"
                                                onChange={e =>
                                                  setRenamingSession(prev =>
                                                    prev ? { ...prev, value: e.target.value } : null
                                                  )
                                                }
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    onRenameSession(
                                                      day.date,
                                                      si,
                                                      renamingSession.value
                                                    );
                                                    setRenamingSession(null);
                                                  }
                                                  if (e.key === 'Escape') setRenamingSession(null);
                                                }}
                                              />
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0 shrink-0"
                                                onClick={() => {
                                                  onRenameSession(
                                                    day.date,
                                                    si,
                                                    renamingSession.value
                                                  );
                                                  setRenamingSession(null);
                                                }}
                                              >
                                                <Check className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              <span className="text-xs font-medium flex-1 truncate">
                                                {sessionName}
                                              </span>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0 opacity-40 hover:opacity-100 shrink-0"
                                                title="Rename session"
                                                onClick={() =>
                                                  setRenamingSession({
                                                    dayDate: day.date,
                                                    sessionIndex: si,
                                                    value: sessionName,
                                                  })
                                                }
                                              >
                                                <Edit2 className="h-2.5 w-2.5" />
                                              </Button>
                                            </>
                                          )}

                                          {/* Session intensity badge */}
                                          <Popover
                                            open={sessionIntensityPopovers.has(popoverKey)}
                                            onOpenChange={open =>
                                              setSessionIntensityPopovers(prev => {
                                                const next = new Set(prev);
                                                open
                                                  ? next.add(popoverKey)
                                                  : next.delete(popoverKey);
                                                return next;
                                              })
                                            }
                                          >
                                            <PopoverTrigger asChild>
                                              <Badge
                                                className="cursor-pointer text-[10px] px-1.5 py-0 h-4 shrink-0"
                                                style={{ backgroundColor: getBorgBg(sessionIntensity), color: getBorgFg(sessionIntensity) }}
                                                title="Change session intensity"
                                              >
                                                {getBorgLabelFull(sessionIntensity).slice(0, 7)}
                                              </Badge>
                                            </PopoverTrigger>
                                            <PopoverContent
                                              className="w-44 p-1"
                                              align="end"
                                            >
                                              {BORG_LEVELS.map(level => (
                                                <button
                                                  key={level}
                                                  onClick={() => {
                                                    handleSessionIntensityChange(
                                                      day.date,
                                                      si,
                                                      level
                                                    );
                                                    setSessionIntensityPopovers(prev => {
                                                      const next = new Set(prev);
                                                      next.delete(popoverKey);
                                                      return next;
                                                    });
                                                  }}
                                                  className="w-full text-left px-2 py-1 text-xs rounded mb-0.5 hover:opacity-90"
                                                  style={{ backgroundColor: getBorgBg(level), color: getBorgFg(level) }}
                                                >
                                                  {getBorgLabelFull(level)}
                                                </button>
                                              ))}
                                            </PopoverContent>
                                          </Popover>

                                          {/* Remove session */}
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 w-5 p-0 opacity-40 hover:opacity-100 hover:text-destructive shrink-0"
                                            title="Remove session"
                                            onClick={() => onRemoveSession(day.date, si)}
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </Button>
                                        </div>

                                        {/* Session body */}
                                        <div className="px-2 py-2 space-y-2">
                                          {/* Method cards assigned to this session */}
                                          {(() => {
                                            const sessionMethods = dayMethodAssignments[`${day.date}_${si}`] ?? [];
                                            return (
                                              <div className="space-y-1.5 min-h-[32px]">
                                                {sessionMethods.map(methodId => (
                                                  <div
                                                    key={methodId}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 shadow-sm"
                                                  >
                                                    <span className="text-xs font-medium leading-snug" title={methodId}>
                                                      {displayLabel(methodId)}
                                                    </span>
                                                    <button
                                                      onClick={() => removeMethodFromSession(day.date, si, methodId)}
                                                      className="shrink-0 rounded hover:bg-destructive/15 hover:text-destructive p-0.5 text-muted-foreground transition-colors"
                                                      title={`Remove ${displayLabel(methodId)}`}
                                                    >
                                                      <X className="h-3 w-3" />
                                                    </button>
                                                  </div>
                                                ))}
                                                {sessDropSnap.isDraggingOver && sessionMethods.length === 0 && (
                                                  <div className="w-full text-center text-xs text-primary border border-dashed border-primary/50 rounded py-2">
                                                    Drop method here
                                                  </div>
                                                )}
                                                {!sessDropSnap.isDraggingOver && sessionMethods.length === 0 && (
                                                  <div className="w-full text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded py-2">
                                                    No methods assigned — drag from the left panel
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}

                                          {/* Session notes */}
                                          <Textarea
                                            placeholder="Session notes…"
                                            value={sessionCommentsMap[`${day.date}_${si}`] ?? ''}
                                            onChange={e =>
                                              saveSessionComment(day.date, si, e.target.value)
                                            }
                                            className="text-xs min-h-[36px] resize-none"
                                            rows={2}
                                          />

                                          {sessDropProv.placeholder}
                                        </div>
                                          </div>
                                        )}
                                      </Droppable>
                                    );
                                  })}
                            </div>

                            {/* Add session */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mx-1 mt-1 mb-1 h-7 w-[calc(100%-8px)] text-xs text-muted-foreground hover:text-foreground border border-dashed border-border/50"
                              onClick={() => onAddSession(day.date)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {sessionsCount === 0 ? 'Start Training Day' : 'Add Session'}
                            </Button>
                          </div>
                        );
                      });
                })()}
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>
    </TooltipProvider>
    </>
  );
}
