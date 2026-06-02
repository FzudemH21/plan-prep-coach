import { useState, useEffect } from 'react';
import { BedDouble, Dumbbell, ChevronRight, Activity, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog } from '@/hooks/useAthleteApp';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { IntensityBadge, getDotColor } from '@/components/athlete-app/IntensityBadge';
import { DailyCheckinSheet } from '@/components/athlete-app/DailyCheckinSheet';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';

// ── Date / greeting helpers ───────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: d.getDate().toString(),
  };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  entry,
  index,
  log,
}: {
  session: AthleteScheduleEntry['sessions'][0];
  entry: AthleteScheduleEntry;
  index: number;
  log?: SessionLog | null;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        'cursor-pointer active:scale-[0.98] transition-all',
        log ? 'border-green-200 bg-green-50/50 hover:bg-green-50/80' : 'hover:bg-muted/60'
      )}
      onClick={() => navigate('/athlete/session', { state: { entry, sessionIdx: index, log } })}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            log ? 'bg-green-100' : 'bg-primary/10'
          )}>
            {log
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <Dumbbell className="h-4 w-4 text-primary" />}
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
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  );
}

function RestDay() {
  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
        <BedDouble className="h-9 w-9 text-slate-400" />
        <div className="text-center">
          <p className="font-semibold text-slate-600">Rest Day</p>
          <p className="text-sm text-slate-400 mt-1">Recovery is part of the plan.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TestCard({ ev }: { ev: AthleteCalendarEvent }) {
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardContent className="flex items-start gap-3 p-3">
        <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <Activity className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-amber-900">{ev.title}</p>
          {ev.targetValue && (
            <p className="text-xs text-amber-700 mt-0.5">
              <span className="font-medium">Goal:</span> {ev.targetValue}{ev.unit ? ` ${ev.unit}` : ''}
            </p>
          )}
          {ev.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EventCard({ ev }: { ev: AthleteCalendarEvent }) {
  return (
    <Card className="border-blue-200 bg-blue-50/60">
      <CardContent className="flex items-start gap-3 p-3">
        <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <CalendarDays className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-blue-900">{ev.title}</p>
          {ev.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TodaySchedule({
  entry,
  getSessionLog,
}: {
  entry: AthleteScheduleEntry | null;
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
}) {
  const hasSessions = (entry?.sessions.length ?? 0) > 0;
  const tests  = (entry?.events ?? []).filter(e => e.type === 'test');
  const events = (entry?.events ?? []).filter(e => e.type === 'event');

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Today's Schedule
      </p>

      {/* Day-level intensity */}
      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

      {/* Tests — above sessions */}
      {tests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Tests</p>
          {tests.map(ev => <TestCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* Events — above sessions */}
      {events.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Events</p>
          {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* Sessions */}
      {hasSessions ? (
        <div className="space-y-2">
          {entry!.sessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              entry={entry!}
              index={index}
              log={getSessionLog(entry!.date, session.id)}
            />
          ))}
        </div>
      ) : (
        <RestDay />
      )}
    </div>
  );
}

function UpcomingStrip({ schedule }: { schedule: AthleteScheduleEntry[] }) {
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const scheduleMap = new Map(schedule.map(e => [e.date, e]));
  const upcomingDates = Array.from({ length: 5 }, (_, i) => addDays(today, i + 1));

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coming Up</p>
      <div className="flex gap-2">
        {upcomingDates.map(dateStr => {
          const { day, num } = formatShortDate(dateStr);
          const e = scheduleMap.get(dateStr);
          const hasTraining = (e?.sessions.length ?? 0) > 0;
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-xs text-muted-foreground">{day}</span>
              <span className="text-sm font-medium">{num}</span>
              <div className={cn('w-2 h-2 rounded-full', hasTraining ? getDotColor(e?.intensity ?? null) : 'bg-slate-200')} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AthleteTodayPage() {
  const { connection, schedule, loading, error, getTodayEntry, getSessionLog } = useAthleteApp();
  const athleteId = connection?.athleteLocalId ?? null;
  const { todayCheckin, saveCheckin } = useDailyCheckin(athleteId);
  const [checkinOpen, setCheckinOpen] = useState(false);

  // Open check-in sheet once per day if not yet completed and monitoring is enabled
  useEffect(() => {
    if (!loading && todayCheckin === null && connection?.monitoringEnabled !== false) {
      const t = setTimeout(() => setCheckinOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [loading, todayCheckin, connection?.monitoringEnabled]);

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

  const todayEntry = getTodayEntry();

  return (
    <>
      <DailyCheckinSheet
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSave={saveCheckin}
        athleteName={connection?.athleteName}
      />

      <div className="p-4 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">
            {getGreeting()}{connection ? `, ${connection.athleteName.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
        </div>

        {/* Today's schedule — always rendered (shows Rest Day if no sessions/events) */}
        <TodaySchedule entry={todayEntry} getSessionLog={getSessionLog} />

        {/* Upcoming strip */}
        <UpcomingStrip schedule={schedule} />
      </div>
    </>
  );
}
