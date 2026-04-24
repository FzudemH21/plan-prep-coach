import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, parseISO } from 'date-fns';
import { TrainingDay } from '@/types/daily-intensity';
import { ExtendedMesocycle, Microcycle } from '@/features/planner/types';
import { SessionSection, ExerciseDistribution } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
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
  GripVertical,
  Copy,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface MethodSessionArchitectureProps {
  mesocycle: ExtendedMesocycle;
  allMesocycles: ExtendedMesocycle[];
  trainingDays: TrainingDay[];
  /** Record<methodName, mesocycleId[]> — written by MesocyclePage, read-only here */
  methodAllocations: Record<string, string[]>;
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
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  off: 'OFF',
  deload: 'DELOAD',
  easy: 'EASY',
  'easy-moderate': 'EASY-MOD',
  moderate: 'MODERATE',
  'moderate-hard': 'MOD-HARD',
  hard: 'HARD',
  'extremely-hard': 'EXT. HARD',
};

const SUBTLE_BG: Record<IntensityLevel, string> = {
  off: 'bg-[hsl(var(--intensity-off)/0.15)]',
  deload: 'bg-[hsl(var(--intensity-deload)/0.15)]',
  easy: 'bg-[hsl(var(--intensity-easy)/0.15)]',
  'easy-moderate': 'bg-[hsl(var(--intensity-easy-moderate)/0.15)]',
  moderate: 'bg-[hsl(var(--intensity-moderate)/0.15)]',
  'moderate-hard': 'bg-[hsl(var(--intensity-moderate-hard)/0.15)]',
  hard: 'bg-[hsl(var(--intensity-hard)/0.15)]',
  'extremely-hard': 'bg-[hsl(var(--intensity-extremely-hard)/0.20)]',
};

function subtleBg(intensity: IntensityLevel) {
  return SUBTLE_BG[intensity] ?? 'bg-primary/10';
}

/** Returns the sub-category part of "Category - SubCategory", else the full string */
function shortName(methodId: string) {
  const idx = methodId.indexOf(' - ');
  return idx > -1 ? methodId.slice(idx + 3) : methodId;
}

// ─── component ────────────────────────────────────────────────────────────────

export function MethodSessionArchitecture({
  mesocycle,
  allMesocycles,
  trainingDays,
  methodAllocations,
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
  intensityLevels,
  getIntensityColor,
}: MethodSessionArchitectureProps) {
  const { toast } = useToast();

  // local UI state
  const [renamingSession, setRenamingSession] = useState<{
    dayDate: string; sessionIndex: number; value: string;
  } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sessionIntensityPopovers, setSessionIntensityPopovers] = useState<Set<string>>(new Set());
  const [sessionCommentsMap, setSessionCommentsMap] = useState<Record<string, string>>({});
  const [sessionIntensityMap, setSessionIntensityMap] = useState<Record<string, IntensityLevel>>({});
  const [copyingMicrocycleId, setCopyingMicrocycleId] = useState<string | null>(null);

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
  const allMethods = useMemo(() => {
    return Object.keys(methodAllocations).filter(m =>
      methodAllocations[m]?.includes(mesocycle.id)
    );
  }, [methodAllocations, mesocycle.id]);

  // ── derived: methods grouped by category (all are available for this meso) ───
  const methodsByCategory = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    allMethods.forEach(m => {
      const cat = m.includes(' - ') ? m.split(' - ')[0] : 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    });
    return grouped;
  }, [allMethods]);

  // ── derived: flat list of methods for Draggable index ───────────────────────
  const flatAvailable = useMemo(() => allMethods, [allMethods]);

  // ── init: expand all categories ─────────────────────────────────────────────
  useEffect(() => {
    setExpandedCategories(new Set(Object.keys(methodsByCategory)));
  }, []); // run once on mount

  // ── init: load session intensities from localStorage ─────────────────────────
  useEffect(() => {
    const map: Record<string, IntensityLevel> = {};
    mesocycleDays.forEach(day => {
      const cnt = daySplitStates[day.date] ?? (day.intensity === 'off' ? 0 : 1);
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
      const cnt = daySplitStates[day.date] ?? (day.intensity === 'off' ? 0 : 1);
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

        const sourceDays = trainingDays.filter(d => d.microcycleId === sourceMicrocycleId);
        const targetDays = trainingDays.filter(d => d.microcycleId === targetMicrocycleId);

        if (sourceDays.length === 0) {
          toast({ title: 'Nothing to copy', description: 'Previous microcycle has no sessions', variant: 'destructive' });
          return;
        }

        const minDays = Math.min(sourceDays.length, targetDays.length);
        const newAssignments: Record<string, string[]> = { ...dayMethodAssignments };

        for (let i = 0; i < minDays; i++) {
          const sourceDate = sourceDays[i].date;
          const targetDate = targetDays[i].date;

          const sourceSessionCount = daySplitStates[sourceDate] ?? (sourceDays[i].intensity === 'off' ? 0 : 1);
          const targetSessionCount = daySplitStates[targetDate] ?? (targetDays[i].intensity === 'off' ? 0 : 1);

          // Copy method assignments session by session
          for (let si = 0; si < sourceSessionCount; si++) {
            const sourceKey = `${sourceDate}_${si}`;
            const targetKey = `${targetDate}_${si}`;
            const methods = dayMethodAssignments[sourceKey] ?? [];
            if (methods.length > 0) {
              newAssignments[targetKey] = [...methods];
            }
          }

          // Add sessions to target day if source had more
          const sessionsToAdd = sourceSessionCount - targetSessionCount;
          for (let j = 0; j < sessionsToAdd; j++) {
            onAddSession(targetDate);
          }
        }

        onDayMethodAssignmentsChange(newAssignments);
        toast({ title: 'Copied', description: 'Method assignments copied from previous microcycle' });
      } finally {
        setCopyingMicrocycleId(null);
      }
    },
    [allMesocycles, trainingDays, dayMethodAssignments, daySplitStates, onAddSession, onDayMethodAssignmentsChange, toast]
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
                    const isExpanded = expandedCategories.has(category);
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
                          {isExpanded
                            ? <ChevronDown className="h-3 w-3 shrink-0" />
                            : <ChevronRight className="h-3 w-3 shrink-0" />}
                          <span className="truncate text-left flex-1">{category}</span>
                          <span className="text-[10px] shrink-0">{methods.length}</span>
                        </button>

                        {isExpanded && (
                          <div className="ml-2 space-y-0.5 mb-1">
                            {methods.map(methodId => {
                              const idx = flatAvailable.indexOf(methodId);
                              return (
                                <Draggable
                                  key={`method::${methodId}`}
                                  draggableId={`method::${methodId}`}
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
                                      title={methodId}
                                    >
                                      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="truncate">{shortName(methodId)}</span>
                                    </div>
                                  )}
                                </Draggable>
                              );
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
              <div className={cn('mb-4 rounded-md border border-border pb-3', subtleBg(mesocycle.intensity))}>
                <div className="flex items-center justify-center gap-3 px-4 py-2">
                  <h2 className="text-xl font-bold">{mesocycle.name}</h2>
                  <Badge
                    variant="secondary"
                    className={cn('font-semibold', getIntensityColor(mesocycle.intensity))}
                  >
                    {INTENSITY_LABELS[mesocycle.intensity] ?? mesocycle.intensity.toUpperCase()}
                  </Badge>
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
                    return `${format(parseISO(s), 'MMM d, yyyy')} – ${format(parseISO(e), 'MMM d, yyyy')}`;
                  })()}
                </p>
              </div>

              {/* Microcycle header row */}
              <div className="flex gap-4 mb-2">
                {Array.from(daysByMicrocycle.entries()).map(([microId, { microcycle, days }], microIdx) => {
                  const isVeryFirstMicrocycle = (() => {
                    const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
                    return currentMesoIndex === 0 && microIdx === 0;
                  })();

                  return (
                    <React.Fragment key={microId}>
                      {microIdx > 0 && <div className="w-1 bg-border shrink-0" />}
                      <div
                        className={cn(
                          'relative shrink-0 text-center font-semibold py-3 rounded-md border border-border',
                          subtleBg(microcycle.intensity)
                        )}
                      >
                        {/* invisible sizer */}
                        <div className="invisible pointer-events-none flex gap-4">
                          {days.map((_, i) => <div key={i} className="w-80" />)}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center gap-2">
                          <span>{microcycle.name}</span>
                          <Badge
                            variant="secondary"
                            className={cn('font-semibold', getIntensityColor(microcycle.intensity))}
                          >
                            {INTENSITY_LABELS[microcycle.intensity] ?? microcycle.intensity.toUpperCase()}
                          </Badge>
                          {!isVeryFirstMicrocycle && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              disabled={copyingMicrocycleId === microId}
                              title={(() => {
                                const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
                                if (microIdx > 0) {
                                  return `Copy method assignments from ${mesocycle.microcycles[microIdx - 1].name}`;
                                } else if (currentMesoIndex > 0) {
                                  const prevMeso = allMesocycles[currentMesoIndex - 1];
                                  const prevMicro = prevMeso.microcycles[prevMeso.microcycles.length - 1];
                                  return `Copy method assignments from ${prevMicro.name} (${prevMeso.name})`;
                                }
                                return 'Copy method assignments from previous microcycle';
                              })()}
                              onClick={() => handleCopyFromPreviousMicrocycle(microId)}
                            >
                              {copyingMicrocycleId === microId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Day columns */}
              <div className="flex gap-4">
                {Array.from(daysByMicrocycle.entries()).map(([microId, { days }], groupIdx) => (
                  <React.Fragment key={microId}>
                    {groupIdx > 0 && <div className="w-1 bg-border shrink-0" />}
                    <div className="flex gap-4">
                      {days.map(day => {
                        const sessionsCount =
                          daySplitStates[day.date] ??
                          day.sessions ??
                          (day.intensity === 'off' ? 0 : 1);

                        return (
                          <div
                            key={day.date}
                            className="flex flex-col w-80 rounded-md pb-1"
                          >
                            {/* Day header */}
                            <DayHeader
                              date={day.date}
                              intensity={day.intensity ?? 'moderate'}
                              intensityLevels={intensityLevels}
                              getIntensityColor={getIntensityColor}
                              onDayIntensityChange={onDayIntensityChange}
                              sessionCount={sessionsCount}
                              testNames={day.testNames}
                              eventNames={day.eventNames}
                            />

                            {/* Sessions */}
                            <div className="flex flex-col gap-2 px-1 mt-1">
                              {Array.from({ length: sessionsCount }, (_, si) => {
                                    const sessionName =
                                      day.sessionNames?.[si] ?? `Session ${si + 1}`;
                                    const intensityKey = `${day.date}_${si}`;
                                    const sessionIntensity =
                                      sessionIntensityMap[intensityKey] ??
                                      (day.intensity ?? 'moderate');
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
                                                className={cn(
                                                  'cursor-pointer text-[10px] px-1.5 py-0 h-4 shrink-0',
                                                  getIntensityColor(sessionIntensity)
                                                )}
                                                title="Change session intensity"
                                              >
                                                {(INTENSITY_LABELS[sessionIntensity] ?? sessionIntensity.toUpperCase()).slice(0, 7)}
                                              </Badge>
                                            </PopoverTrigger>
                                            <PopoverContent
                                              className="w-44 p-1"
                                              align="end"
                                            >
                                              {intensityLevels.map(level => (
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
                                                  className={cn(
                                                    'w-full text-left px-2 py-1 text-xs rounded mb-0.5',
                                                    getIntensityColor(level),
                                                    'hover:opacity-90'
                                                  )}
                                                >
                                                  {INTENSITY_LABELS[level] ?? level}
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
                                                    <span className="text-xs font-medium leading-snug">
                                                      {methodId}
                                                    </span>
                                                    <button
                                                      onClick={() => removeMethodFromSession(day.date, si, methodId)}
                                                      className="shrink-0 rounded hover:bg-destructive/15 hover:text-destructive p-0.5 text-muted-foreground transition-colors"
                                                      title={`Remove ${methodId}`}
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
                      })}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>
    </TooltipProvider>
  );
}
