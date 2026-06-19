import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ChevronRight, ChevronLeft, Activity, CalendarDays, CheckCircle2, GripVertical, ClipboardCheck, BedDouble, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog } from '@/hooks/useAthleteApp';
import { supabase } from '@/lib/supabase';
import { IntensityBadge } from '@/components/athlete-app/IntensityBadge';
import { cn } from '@/lib/utils';

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing dateStr (Monday-based weeks). */
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format date as DD.MM. (no year) */
function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mon}.`;
}

/** Format date as DD.MM.YYYY */
function fmtFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mon}.${d.getFullYear()}`;
}

function formatWeekRange(mondayStr: string): string {
  const sunday = addDays(mondayStr, 6);
  return `${fmtShort(mondayStr)} – ${fmtFull(sunday)}`;
}

function formatDayHeader(dateStr: string): { weekday: string; dateLabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  entry,
  index,
  isPast,
  log,
  canMove,
  isDragging,
  dragHandleProps,
}: {
  session: AthleteScheduleEntry['sessions'][0];
  entry: AthleteScheduleEntry;
  index: number;
  isPast: boolean;
  log?: SessionLog | null;
  canMove?: boolean;
  isDragging?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        'transition-all',
        isDragging ? 'ring-2 ring-primary border-primary shadow-lg opacity-90' : '',
        log
          ? 'border-green-200 bg-green-50/50'
          : isPast
            ? 'opacity-50'
            : ''
      )}
    >
      <CardContent className="flex items-center justify-between p-3">
        {/* Drag handle — only shown when move is enabled and session not yet logged */}
        {canMove && !log && (
          <div
            {...dragHandleProps}
            className="mr-2 p-1 -ml-1 touch-manipulation text-muted-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to move session"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-80"
          onClick={() => !isDragging && navigate('/athlete/session', { state: { entry, sessionIdx: index, log } })}
        >
          <div className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
            log ? 'bg-green-100' : 'bg-primary/10'
          )}>
            {log
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              : <Dumbbell className="h-3.5 w-3.5 text-primary" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{session.name}</p>
            <p className="text-xs text-muted-foreground">
              {(session.exercises?.length ?? session.exerciseCount)} exercise{(session.exercises?.length ?? session.exerciseCount) !== 1 ? 's' : ''}
              {session.duration ? ` · ~${session.duration} min` : ''}
            </p>
            {log ? (
              <p className="text-xs font-medium text-green-700 mt-0.5">
                Completed
                {log.durationSeconds ? ` · ${Math.round(log.durationSeconds / 60)} min` : ''}
                {log.borgRating !== null ? ` · RPE ${log.borgRating}` : ''}
                {log.borgRating !== null && log.durationSeconds
                  ? ` · sRPE: ${log.borgRating * Math.round(log.durationSeconds / 60)} AU`
                  : ''}
              </p>
            ) : session.intensity ? (
              <div className="mt-1.5">
                <IntensityBadge intensity={session.intensity} />
              </div>
            ) : null}
          </div>
        </div>
        {!canMove && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CardContent>
    </Card>
  );
}

function DaySection({
  dateStr,
  entry,
  isToday,
  getSessionLog,
  canMove,
  onEnterTestResult,
  existingTestResults,
}: {
  dateStr: string;
  entry: AthleteScheduleEntry | null;
  isToday: boolean;
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
  canMove?: boolean;
  onEnterTestResult: (ev: AthleteCalendarEvent, date: string) => void;
  existingTestResults: Map<string, string>;
}) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const isPast = dateStr < today;
  const { weekday, dateLabel } = formatDayHeader(dateStr);
  const hasSessions = (entry?.sessions.length ?? 0) > 0;

  return (
    <div
      className={cn(
        'rounded-xl p-3 space-y-2',
        isToday && 'bg-primary/5 ring-1 ring-primary/20 mx-px',
      )}
    >
      {/* Day header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'text-sm font-semibold',
          isToday ? 'text-primary' : isPast ? 'text-muted-foreground' : 'text-foreground'
        )}>
          {weekday}
        </span>
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
        {isToday && (
          <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
            Today
          </span>
        )}
      </div>

      {/* Intensity badge */}
      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

      {/* Tests & events */}
      {(entry?.events ?? []).length > 0 && (
        <div className="space-y-1.5">
          {entry!.events.map((ev: AthleteCalendarEvent) => (
            <div
              key={ev.id}
              className={cn(
                'rounded-lg px-2.5 py-2 border text-xs',
                isPast ? 'opacity-60' : '',
                ev.type === 'test'
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-blue-200 bg-blue-50/60',
              )}
            >
              <div className="flex items-start gap-2">
                {ev.type === 'test'
                  ? <Activity className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  : <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', ev.type === 'test' ? 'text-amber-800' : 'text-blue-800')}>
                    {ev.title}
                  </p>
                  {ev.type === 'test' && ev.targetValue && (
                    <p className="text-amber-700 mt-0.5">
                      <span className="font-medium">Goal:</span> {ev.targetValue}{ev.unit ? ` ${ev.unit}` : ''}
                    </p>
                  )}
                  {ev.notes && (
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{ev.notes}</p>
                  )}
                </div>
              </div>
              {/* Enter result / locked result */}
              {ev.type === 'test' && ev.parameterId && (() => {
                const resultValue = existingTestResults.get(`${ev.parameterId}:${dateStr}`);
                if (resultValue !== undefined) {
                  return (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 font-medium">
                      <Check className="h-3 w-3 shrink-0" />
                      Result: {resultValue}
                    </div>
                  );
                }
                if (!isPast) {
                  return (
                    <button
                      onClick={() => onEnterTestResult(ev, dateStr)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-md py-1.5 transition-colors"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Enter result
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Sessions or rest */}
      <Droppable droppableId={dateStr} type="session">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'space-y-1.5 min-h-[4px] rounded-lg transition-colors',
              snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-primary/30 p-1'
            )}
          >
            {hasSessions ? (
              entry!.sessions.map((session, idx) => {
                const log = getSessionLog(dateStr, session.id);
                return (
                  <Draggable
                    key={session.id}
                    draggableId={session.id}
                    index={idx}
                    isDragDisabled={!canMove || !!log}
                  >
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                      >
                        <SessionCard
                          session={session}
                          entry={entry!}
                          index={idx}
                          isPast={isPast}
                          log={log}
                          canMove={canMove}
                          isDragging={dragSnapshot.isDragging}
                          dragHandleProps={dragProvided.dragHandleProps}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })
            ) : (
              <div className={cn(
                'flex items-center gap-1.5 text-xs py-1',
                isPast ? 'text-muted-foreground/40' : 'text-slate-400'
              )}>
                <BedDouble className="h-3.5 w-3.5 shrink-0" />
                <span>Rest day</span>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AthletePlanPage() {
  const { connection, schedule, loading, error, getSessionLog, moveSession, submitTestResult } = useAthleteApp();

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const currentWeekMonday = getMondayOf(today);
  const weeksAhead = connection?.weeksAhead ?? 4;

  const maxWeekMonday = getMondayOf(addDays(today, weeksAhead * 7));

  const minWeekMonday = useMemo(() => {
    if (schedule.length === 0) return currentWeekMonday;
    return getMondayOf(schedule[0].date);
  }, [schedule, currentWeekMonday]);

  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekMonday);
  const canMove = connection?.allowRearrangeWorkouts ?? false;

  // ── Existing test results (parameterId:date → value) ─────────────────────
  const [existingTestResults, setExistingTestResults] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!connection?.id) return;
    supabase
      .from('athlete_test_results')
      .select('parameter_id, value, recorded_at')
      .eq('athlete_connection_id', connection.id)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of (data ?? []) as { parameter_id: string; value: string; recorded_at: string }[]) {
          const date = row.recorded_at.slice(0, 10);
          const key = `${row.parameter_id}:${date}`;
          if (!map.has(key)) map.set(key, row.value);
        }
        setExistingTestResults(map);
      });
  }, [connection?.id]);

  // ── Test result sheet state ───────────────────────────────────────────────
  const [testSheetEvent, setTestSheetEvent] = useState<{ ev: AthleteCalendarEvent; date: string } | null>(null);
  const [testValue, setTestValue] = useState('');
  const [testNote, setTestNote] = useState('');
  const [testSaving, setTestSaving] = useState(false);
  const [testSaved, setTestSaved] = useState(false);

  const openTestSheet = (ev: AthleteCalendarEvent, date: string) => {
    setTestSheetEvent({ ev, date });
    setTestValue('');
    setTestNote('');
    setTestSaved(false);
  };

  const handleSaveTestResult = async () => {
    if (!testSheetEvent || !testValue.trim() || !testSheetEvent.ev.parameterId) return;
    setTestSaving(true);
    try {
      const recordedAt = new Date(`${testSheetEvent.date}T12:00:00`).toISOString();
      await submitTestResult(testSheetEvent.ev.parameterId, testValue.trim(), recordedAt, testNote.trim() || undefined);
      setExistingTestResults(prev => new Map(prev).set(`${testSheetEvent.ev.parameterId!}:${testSheetEvent.date}`, testValue.trim()));
      setTestSaved(true);
      setTimeout(() => setTestSheetEvent(null), 1200);
    } finally {
      setTestSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const clampedWeek = selectedWeek > maxWeekMonday ? maxWeekMonday : selectedWeek;
  const prevWeek = addDays(clampedWeek, -7);
  const nextWeek = addDays(clampedWeek, 7);
  const canGoPrev = prevWeek >= minWeekMonday;
  const canGoNext = nextWeek <= maxWeekMonday;

  const scheduleMap = useMemo(() => {
    const m = new Map<string, AthleteScheduleEntry>();
    schedule.forEach(e => m.set(e.date, e));
    return m;
  }, [schedule]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(clampedWeek, i)),
    [clampedWeek]
  );

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromDate = result.source.droppableId;
    const toDate = result.destination.droppableId;
    if (fromDate === toDate) return;
    moveSession(result.draggableId, fromDate, toDate);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Week navigation header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
        <button
          onClick={() => setSelectedWeek(prevWeek)}
          disabled={!canGoPrev}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0',
            canGoPrev
              ? 'hover:bg-muted active:bg-muted/80'
              : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <p className="flex-1 text-center text-sm font-semibold tabular-nums">
          {formatWeekRange(clampedWeek)}
        </p>

        <button
          onClick={() => setSelectedWeek(nextWeek)}
          disabled={!canGoNext}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0',
            canGoNext
              ? 'hover:bg-muted active:bg-muted/80'
              : 'opacity-30 cursor-not-allowed'
          )}
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day list */}
      <DragDropContext onDragEnd={onDragEnd}>
        <ScrollArea className="flex-1 px-4">
          <div className="py-3 pb-4">
            {weekDays.map((dateStr, i) => (
              <div key={dateStr}>
                {i > 0 && <div className="my-3 border-t border-border" />}
                <DaySection
                  dateStr={dateStr}
                  entry={scheduleMap.get(dateStr) ?? null}
                  isToday={dateStr === today}
                  getSessionLog={getSessionLog}
                  canMove={canMove}
                  onEnterTestResult={openTestSheet}
                  existingTestResults={existingTestResults}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DragDropContext>

      {/* Test result entry dialog */}
      <Dialog open={!!testSheetEvent} onOpenChange={open => { if (!open) setTestSheetEvent(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {testSheetEvent?.ev.title ?? 'Enter result'}
            </DialogTitle>
            {testSheetEvent?.ev.targetValue && (
              <DialogDescription>
                Goal: {testSheetEvent.ev.targetValue}{testSheetEvent.ev.unit ? ` ${testSheetEvent.ev.unit}` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Result{testSheetEvent?.ev.unit ? ` (${testSheetEvent.ev.unit})` : ''}
              </label>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Enter value…"
                value={testValue}
                onChange={e => setTestValue(e.target.value)}
                className="text-base h-11"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                Note <span className="font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Any context, conditions, remarks…"
                value={testNote}
                onChange={e => setTestNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full h-11"
              disabled={!testValue.trim() || testSaving || testSaved}
              onClick={handleSaveTestResult}
            >
              {testSaved ? '✓ Saved' : testSaving ? 'Saving…' : 'Save result'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
