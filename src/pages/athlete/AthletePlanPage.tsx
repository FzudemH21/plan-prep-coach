import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAthleteApp, AthleteScheduleEntry } from '@/hooks/useAthleteApp';
import { IntensityBadge, getDotColor } from '@/components/athlete-app/IntensityBadge';
import { cn } from '@/lib/utils';

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  return toDateStr(new Date(d.getTime() + n * 86400000));
}

/** Returns the Monday (yyyy-MM-dd) of the week containing dateStr. */
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return toDateStr(new Date(d.getTime() + diff * 86400000));
}

function formatWeekLabel(mondayStr: string, currentWeekMonday: string): string {
  if (mondayStr === currentWeekMonday) return 'This week';
  const next = addDays(currentWeekMonday, 7);
  if (mondayStr === next) return 'Next week';
  const mon = new Date(mondayStr + 'T12:00:00');
  return mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T12:00:00');
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const m = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const s = sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${m} – ${s}`;
}

function formatDayHeader(dateStr: string): { weekday: string; dateLabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  entry,
  index,
  isPast,
}: {
  session: AthleteScheduleEntry['sessions'][0];
  entry: AthleteScheduleEntry;
  index: number;
  isPast: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all active:scale-[0.98]',
        isPast ? 'opacity-50' : 'hover:bg-muted/60'
      )}
      onClick={() => navigate('/athlete/session', { state: { entry, sessionIdx: index } })}
    >
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Dumbbell className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{session.name}</p>
            <p className="text-xs text-muted-foreground">
              {session.exerciseCount} exercise{session.exerciseCount !== 1 ? 's' : ''}
              {session.duration ? ` · ~${session.duration} min` : ''}
            </p>
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
}: {
  dateStr: string;
  entry: AthleteScheduleEntry | null;
  isToday: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = dateStr < today;
  const { weekday, dateLabel } = formatDayHeader(dateStr);
  const hasSessions = (entry?.sessions.length ?? 0) > 0;

  return (
    <div
      id={`day-${dateStr}`}
      className={cn(
        'rounded-xl p-3 space-y-2',
        isToday && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', isToday ? 'text-primary' : isPast ? 'text-muted-foreground' : 'text-foreground')}>
            {weekday}
          </span>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          {isToday && (
            <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
              Today
            </span>
          )}
        </div>
        {entry?.intensity && (
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', getDotColor(entry.intensity))} />
        )}
      </div>

      {/* Intensity badge */}
      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

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
  const { schedule, loading, error } = useAthleteApp();

  const today = new Date().toISOString().slice(0, 10);
  const currentWeekMonday = getMondayOf(today);

  // Build sorted list of unique week mondays that have schedule data,
  // always including the current week.
  const weeks = useMemo(() => {
    const set = new Set<string>([currentWeekMonday]);
    schedule.forEach(e => set.add(getMondayOf(e.date)));
    return Array.from(set).sort();
  }, [schedule, currentWeekMonday]);

  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekMonday);

  // Build schedule lookup map
  const scheduleMap = useMemo(() => {
    const m = new Map<string, AthleteScheduleEntry>();
    schedule.forEach(e => m.set(e.date, e));
    return m;
  }, [schedule]);

  // Days in selected week (Mon–Sun)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
  }, [selectedWeek]);

  // Scroll week strip to selected week pill
  const weekStripRef = useRef<HTMLDivElement>(null);
  const selectedPillRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedPillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedWeek]);

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
      {/* Page header */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-xl font-bold">Plan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{formatWeekRange(selectedWeek)}</p>
      </div>

      {/* Week strip */}
      <div
        ref={weekStripRef}
        className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide shrink-0"
      >
        {weeks.map(monday => {
          const isSelected = monday === selectedWeek;
          return (
            <button
              key={monday}
              ref={isSelected ? selectedPillRef : undefined}
              onClick={() => setSelectedWeek(monday)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {formatWeekLabel(monday, currentWeekMonday)}
            </button>
          );
        })}
      </div>

      {/* Day list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-2 pb-4">
          {weekDays.map(dateStr => (
            <DaySection
              key={dateStr}
              dateStr={dateStr}
              entry={scheduleMap.get(dateStr) ?? null}
              isToday={dateStr === today}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
