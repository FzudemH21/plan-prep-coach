import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ChevronRight, ChevronLeft, Activity, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog } from '@/hooks/useAthleteApp';
import { IntensityBadge } from '@/components/athlete-app/IntensityBadge';
import { cn } from '@/lib/utils';

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

/** Monday of the week containing dateStr (Monday-based weeks). */
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(d.getTime() + diff * 86400000).toISOString().slice(0, 10);
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
}: {
  session: AthleteScheduleEntry['sessions'][0];
  entry: AthleteScheduleEntry;
  index: number;
  isPast: boolean;
  log?: SessionLog | null;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all active:scale-[0.98]',
        log
          ? 'border-green-200 bg-green-50/50 hover:bg-green-50/80'
          : isPast
            ? 'opacity-50 hover:bg-muted/60'
            : 'hover:bg-muted/60'
      )}
      onClick={() => navigate('/athlete/session', { state: { entry, sessionIdx: index, log } })}
    >
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
            log ? 'bg-green-100' : 'bg-primary/10'
          )}>
            {log
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              : <Dumbbell className="h-3.5 w-3.5 text-primary" />}
          </div>
          <div>
            <p className="font-medium text-sm">{session.name}</p>
            <p className="text-xs text-muted-foreground">
              {session.exerciseCount} exercise{session.exerciseCount !== 1 ? 's' : ''}
              {session.duration ? ` · ~${session.duration} min` : ''}
            </p>
            {log ? (
              <p className="text-xs font-medium text-green-700 mt-0.5">
                Completed
                {log.durationSeconds ? ` · ${Math.round(log.durationSeconds / 60)} min` : ''}
                {log.borgRating !== null ? ` · RPE ${log.borgRating}` : ''}
                {log.borgRating !== null && log.durationSeconds
                  ? ` · Load: ${log.borgRating * Math.round(log.durationSeconds / 60)} AU`
                  : ''}
              </p>
            ) : session.intensity ? (
              <div className="mt-1.5">
                <IntensityBadge intensity={session.intensity} />
              </div>
            ) : null}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

function DaySection({
  dateStr,
  entry,
  isToday,
  getSessionLog,
}: {
  dateStr: string;
  entry: AthleteScheduleEntry | null;
  isToday: boolean;
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = dateStr < today;
  const { weekday, dateLabel } = formatDayHeader(dateStr);
  const hasSessions = (entry?.sessions.length ?? 0) > 0;

  return (
    <div
      className={cn(
        'rounded-xl p-3 space-y-2',
        isToday && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between">
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
      </div>

      {/* Intensity badge */}
      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

      {/* Tests & events — above sessions */}
      {(entry?.events ?? []).length > 0 && (
        <div className="space-y-1.5">
          {entry!.events.map((ev: AthleteCalendarEvent) => (
            <div
              key={ev.id}
              className={cn(
                'flex items-start gap-2 rounded-lg px-2.5 py-2 border text-xs',
                isPast ? 'opacity-50' : '',
                ev.type === 'test'
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-blue-200 bg-blue-50/60',
              )}
            >
              {ev.type === 'test'
                ? <Activity className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                : <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
              <div className="min-w-0">
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
          ))}
        </div>
      )}

      {/* Sessions or rest */}
      {hasSessions ? (
        <div className="space-y-1.5">
          {entry!.sessions.map((session, idx) => (
            <SessionCard
              key={session.id}
              session={session}
              entry={entry!}
              index={idx}
              isPast={isPast}
              log={getSessionLog(dateStr, session.id)}
            />
          ))}
        </div>
      ) : (
        <p className={cn('text-xs', isPast ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
          Rest day
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AthletePlanPage() {
  const { connection, schedule, loading, error, getSessionLog } = useAthleteApp();

  const today = new Date().toISOString().slice(0, 10);
  const currentWeekMonday = getMondayOf(today);
  const weeksAhead = connection?.weeksAhead ?? 4;

  // Max week the athlete is allowed to see
  const maxWeekMonday = getMondayOf(addDays(today, weeksAhead * 7));

  // Min week: earliest Monday in schedule data (don't go further back than that)
  const minWeekMonday = useMemo(() => {
    if (schedule.length === 0) return currentWeekMonday;
    return getMondayOf(schedule[0].date);
  }, [schedule, currentWeekMonday]);

  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekMonday);

  // Keep selectedWeek clamped if weeksAhead changes
  const clampedWeek = selectedWeek > maxWeekMonday ? maxWeekMonday : selectedWeek;

  const prevWeek = addDays(clampedWeek, -7);
  const nextWeek = addDays(clampedWeek, 7);
  const canGoPrev = prevWeek >= minWeekMonday;
  const canGoNext = nextWeek <= maxWeekMonday;

  // Schedule lookup map
  const scheduleMap = useMemo(() => {
    const m = new Map<string, AthleteScheduleEntry>();
    schedule.forEach(e => m.set(e.date, e));
    return m;
  }, [schedule]);

  // Days Mon–Sun for the selected week
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(clampedWeek, i)),
    [clampedWeek]
  );

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
    <div className="flex flex-col h-full">
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
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2 py-3 pb-4">
          {weekDays.map(dateStr => (
            <DaySection
              key={dateStr}
              dateStr={dateStr}
              entry={scheduleMap.get(dateStr) ?? null}
              isToday={dateStr === today}
              getSessionLog={getSessionLog}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
