import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ChevronRight, ChevronLeft, ChevronDown, Activity, CalendarDays, CheckCircle2, GripVertical, ClipboardCheck, BedDouble, Check, Info } from 'lucide-react';
import { TestDetailsDialog } from '@/components/athlete-app/TestDetailsDialog';
import { TestResultDialog, type TestResultTarget } from '@/components/athlete-app/TestResultDialog';
import { useAthleteTestResults } from '@/hooks/useAthleteTestResults';
import { Card, CardContent } from '@/components/ui/card';
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog, SCHEDULE_PAST_DAYS } from '@/hooks/useAthleteApp';
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
  lastValueLabelFor,
  onShowTestDetails,
}: {
  dateStr: string;
  entry: AthleteScheduleEntry | null;
  isToday: boolean;
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
  canMove?: boolean;
  onEnterTestResult: (ev: AthleteCalendarEvent, date: string) => void;
  existingTestResults: Map<string, string>;
  /** "8.5 s · Jun 15" — the athlete's latest value for a parameter, if any */
  lastValueLabelFor: (parameterId: string | undefined, unit?: string) => string | null;
  onShowTestDetails: (ev: AthleteCalendarEvent) => void;
}) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const isPast = dateStr < today;
  const { weekday, dateLabel } = formatDayHeader(dateStr);
  const hasSessions = (entry?.sessions.length ?? 0) > 0;

  const dayTests = (entry?.events ?? []).filter(ev => ev.type === 'test');
  const dayEvents = (entry?.events ?? []).filter(ev => ev.type !== 'test');
  const [testsOpen, setTestsOpen] = useState(false);
  const testsWithResult = dayTests.filter(ev =>
    ev.parameterId && existingTestResults.get(`${ev.parameterId}:${dateStr}`) !== undefined
  ).length;
  const testWord = dayTests.length === 1 ? 'a test' : `${dayTests.length} tests`;
  const testsLabel = isToday
    ? `You have ${testWord} today!`
    : isPast
      ? `${dayTests.length === 1 ? '1 test' : `${dayTests.length} tests`} on this day`
      : `${dayTests.length === 1 ? '1 test' : `${dayTests.length} tests`} scheduled`;

  const renderEventCard = (ev: AthleteCalendarEvent) => (
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
          {ev.type === 'test' && (() => {
            const last = lastValueLabelFor(ev.parameterId, ev.unit);
            return last ? (
              <p className="text-amber-700 mt-0.5">
                <span className="font-medium">Last:</span> {last}
              </p>
            ) : null;
          })()}
          {ev.notes && (
            <p className="text-muted-foreground mt-0.5 leading-relaxed">{ev.notes}</p>
          )}
        </div>
      </div>
      {/* Test details (instructions / video from the coach) */}
      {ev.type === 'test' && (ev.instructions || ev.videoUrl) && (
        <button
          onClick={() => onShowTestDetails(ev)}
          className="mt-2 w-full min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-amber-800 border border-amber-200 bg-white/70 hover:bg-amber-50 active:bg-amber-100 rounded-md py-2 transition-colors"
        >
          <Info className="h-4 w-4" />
          Test details
        </button>
      )}
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
        // Also for past days — a result can be entered late (the date is set in the dialog)
        return (
          <button
            onClick={() => onEnterTestResult(ev, dateStr)}
            className="mt-2 w-full min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-md py-2 transition-colors"
          >
            <ClipboardCheck className="h-4 w-4" />
            Enter result
          </button>
        );
      })()}
    </div>
  );

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

      {/* Events (competitions, vacation, ...) */}
      {dayEvents.length > 0 && (
        <div className="space-y-1.5">
          {dayEvents.map(renderEventCard)}
        </div>
      )}

      {/* Tests - folded behind one button, tap to see them all and enter results */}
      {dayTests.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setTestsOpen(o => !o)}
            aria-expanded={testsOpen}
            className={cn(
              'w-full min-h-[44px] flex items-center gap-2 rounded-lg px-3 py-2 border text-left transition-colors',
              'border-amber-200 bg-amber-50/80 hover:bg-amber-100 active:bg-amber-200',
              isPast && 'opacity-60',
            )}
          >
            <Activity className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="flex-1 min-w-0 text-sm font-medium text-amber-800">
              {testsLabel}
            </span>
            {testsWithResult > 0 && (
              <span className="shrink-0 text-xs font-medium text-green-700">
                {testsWithResult}/{dayTests.length} done
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-amber-700 shrink-0 transition-transform', testsOpen && 'rotate-180')} />
          </button>
          {testsOpen && dayTests.map(renderEventCard)}
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

  // Past weeks back to the start of the loaded window (not just the first loaded entry, which
  // made it impossible to go back before the current plan's first week)
  const minWeekMonday = useMemo(() => {
    const windowStart = getMondayOf(addDays(today, -SCHEDULE_PAST_DAYS));
    const firstEntry = schedule.length > 0 ? getMondayOf(schedule[0].date) : currentWeekMonday;
    return firstEntry < windowStart ? firstEntry : windowStart;
  }, [schedule, currentWeekMonday, today]);

  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekMonday);
  const canMove = connection?.allowRearrangeWorkouts ?? false;

  // Test results (which tests have a result, latest values) and the result / details dialogs
  const { resultsByDate: existingTestResults, lastValueLabelFor, markSaved } = useAthleteTestResults(connection);
  const [testTarget, setTestTarget] = useState<TestResultTarget | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<AthleteCalendarEvent | null>(null);
  const openTestSheet = (ev: AthleteCalendarEvent, date: string) => setTestTarget({ ev, date });

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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4">
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
                  lastValueLabelFor={lastValueLabelFor}
                  onShowTestDetails={setDetailsEvent}
                />
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>

      {/* Test details: instructions + video from the coach */}
      <TestDetailsDialog
        event={detailsEvent}
        lastValueLabel={detailsEvent ? lastValueLabelFor(detailsEvent.parameterId, detailsEvent.unit) : null}
        onClose={() => setDetailsEvent(null)}
      />

      {/* Test result entry */}
      <TestResultDialog
        target={testTarget}
        connectionId={connection?.id}
        lastValueLabel={testTarget ? lastValueLabelFor(testTarget.ev.parameterId, testTarget.ev.unit) : null}
        submitTestResult={submitTestResult}
        onSaved={markSaved}
        onClose={() => setTestTarget(null)}
      />
    </div>
  );
}
