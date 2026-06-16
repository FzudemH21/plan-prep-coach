import { useState } from 'react';
import { BedDouble, Dumbbell, ChevronRight, Activity, CalendarDays, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog } from '@/hooks/useAthleteApp';
import { cn } from '@/lib/utils';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { IntensityBadge, getDotColor } from '@/components/athlete-app/IntensityBadge';
import type { DailyCheckin } from '@/hooks/useDailyCheckin';

interface AthleteLayoutContext {
  todayCheckin: DailyCheckin | null | undefined;
  openCheckin: () => void;
}

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

function formatNextDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / 86400000);
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

interface NextSessionInfo {
  date: string;
  sessionName: string;
  sessionCount: number;
}

function RestDayCard({
  nextSession,
  coachNote,
}: {
  nextSession: NextSessionInfo | null;
  coachNote?: string | null;
}) {
  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardContent className="pt-6 pb-5 px-4 space-y-3">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BedDouble className="h-7 w-7 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-700">Planned Rest Day</p>
            <p className="text-sm text-slate-400 mt-0.5">Recovery is part of the plan.</p>
          </div>
        </div>

        {/* Coach note */}
        {coachNote && (
          <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              From your coach
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{coachNote}</p>
          </div>
        )}

        {/* Next session */}
        {nextSession && (
          <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-3.5 py-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Dumbbell className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Next session
              </p>
              <p className="text-sm font-medium text-slate-700 truncate">
                {nextSession.sessionName}
                {nextSession.sessionCount > 1 ? ` +${nextSession.sessionCount - 1} more` : ''}
              </p>
              <p className="text-xs text-slate-400">{formatNextDate(nextSession.date)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestCard({ ev, onEnterResult }: { ev: AthleteCalendarEvent; onEnterResult?: (ev: AthleteCalendarEvent) => void }) {
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
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
        </div>
        {ev.parameterId && onEnterResult && (
          <button
            onClick={() => onEnterResult(ev)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-md py-1.5 transition-colors"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Enter result
          </button>
        )}
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
  schedule,
  today,
  getSessionLog,
  onEnterTestResult,
}: {
  entry: AthleteScheduleEntry | null;
  schedule: AthleteScheduleEntry[];
  today: string; // yyyy-MM-dd
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
  onEnterTestResult: (ev: AthleteCalendarEvent) => void;
}) {
  const hasSessions = (entry?.sessions.length ?? 0) > 0;
  const tests  = (entry?.events ?? []).filter(e => e.type === 'test');
  const events = (entry?.events ?? []).filter(e => e.type === 'event');

  // Rest-day enrichment: next upcoming training day + optional coach note
  const nextSession: NextSessionInfo | null = !hasSessions
    ? (() => {
        const next = schedule.find(e => e.date > today && e.sessions.length > 0);
        return next
          ? { date: next.date, sessionName: next.sessions[0].name, sessionCount: next.sessions.length }
          : null;
      })()
    : null;

  // Coach note: first event with notes on this day (events are still shown as EventCards above)
  const coachNote = !hasSessions
    ? (events.find(e => e.notes)?.notes ?? null)
    : null;

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
          {tests.map(ev => <TestCard key={ev.id} ev={ev} onEnterResult={onEnterTestResult} />)}
        </div>
      )}

      {/* Events — above sessions (training days only; rest days show note inside RestDayCard) */}
      {hasSessions && events.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Events</p>
          {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {/* Sessions or Rest day */}
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
        <RestDayCard nextSession={nextSession} coachNote={coachNote} />
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
  const { connection, schedule, loading, error, getTodayEntry, getSessionLog, submitTestResult } = useAthleteApp();
  const { todayCheckin, openCheckin } = useOutletContext<AthleteLayoutContext>();

  // ── Test result sheet ───────────────────────────────────────────────────────
  const [testSheetEvent, setTestSheetEvent] = useState<AthleteCalendarEvent | null>(null);
  const [testValue, setTestValue] = useState('');
  const [testNote, setTestNote] = useState('');
  const [testSaving, setTestSaving] = useState(false);
  const [testSaved, setTestSaved] = useState(false);

  const openTestSheet = (ev: AthleteCalendarEvent) => {
    setTestSheetEvent(ev);
    setTestValue('');
    setTestNote('');
    setTestSaved(false);
  };

  const handleSaveTestResult = async () => {
    if (!testSheetEvent || !testValue.trim() || !testSheetEvent.parameterId) return;
    setTestSaving(true);
    try {
      const recordedAt = new Date().toISOString();
      await submitTestResult(testSheetEvent.parameterId, testValue.trim(), recordedAt, testNote.trim() || undefined);
      setTestSaved(true);
      setTimeout(() => setTestSheetEvent(null), 1200);
    } finally {
      setTestSaving(false);
    }
  };
  // ───────────────────────────────────────────────────────────────────────────

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
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

  return (
    <>
      {/* Test result dialog */}
      <Dialog open={!!testSheetEvent} onOpenChange={open => { if (!open) setTestSheetEvent(null); }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {testSheetEvent?.title ?? 'Enter result'}
            </DialogTitle>
            {testSheetEvent?.targetValue && (
              <DialogDescription>
                Goal: {testSheetEvent.targetValue}{testSheetEvent.unit ? ` ${testSheetEvent.unit}` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-1">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Result{testSheetEvent?.unit ? ` (${testSheetEvent.unit})` : ''}
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

      <div className="p-4 space-y-6">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}{connection ? `, ${connection.athleteName.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
          </div>
          {connection?.monitoringEnabled !== false && todayCheckin !== undefined && (
            <button
              onClick={openCheckin}
              className="shrink-0 mt-1 flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20 rounded-full px-3 py-1.5 transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {todayCheckin ? 'Edit check-in' : 'Log check-in'}
            </button>
          )}
        </div>

        {/* Today's schedule */}
        <TodaySchedule
          entry={todayEntry}
          schedule={schedule}
          today={today}
          getSessionLog={getSessionLog}
          onEnterTestResult={openTestSheet}
        />

        {/* Upcoming strip */}
        <UpcomingStrip schedule={schedule} />
      </div>
    </>
  );
}
