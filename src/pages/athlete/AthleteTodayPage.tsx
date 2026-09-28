import { useState } from 'react';
import { BedDouble, Dumbbell, ChevronRight, Activity, CalendarDays, CheckCircle2, ClipboardCheck, Check, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAthleteApp, AthleteScheduleEntry, AthleteCalendarEvent, SessionLog } from '@/hooks/useAthleteApp';
import { useAthleteTestResults } from '@/hooks/useAthleteTestResults';
import { TestResultDialog, type TestResultTarget } from '@/components/athlete-app/TestResultDialog';
import { TestDetailsDialog } from '@/components/athlete-app/TestDetailsDialog';
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

function RestDayCard({ coachNote }: { coachNote?: string | null }) {
  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardContent className="pt-6 pb-5 px-4 space-y-3">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BedDouble className="h-7 w-7 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-700">Planned Rest Day</p>
            <p className="text-sm text-slate-400 mt-0.5">Recovery is part of the plan.</p>
          </div>
        </div>

        {coachNote && (
          <div className="rounded-xl bg-white border border-slate-200 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              From your coach
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{coachNote}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TestCard({
  ev,
  lastValue,
  result,
  onEnterResult,
  onShowDetails,
}: {
  ev: AthleteCalendarEvent;
  lastValue: string | null;
  /** Result already entered for this test today */
  result?: string;
  onEnterResult?: (ev: AthleteCalendarEvent) => void;
  onShowDetails: (ev: AthleteCalendarEvent) => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
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
          {lastValue && (
            <p className="text-xs text-amber-700 mt-0.5">
              <span className="font-medium">Last:</span> {lastValue}
            </p>
          )}
          {ev.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.notes}</p>
          )}
        </div>
      </div>
      {(ev.instructions || ev.videoUrl) && (
        <button
          onClick={() => onShowDetails(ev)}
          className="mt-2.5 w-full min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-amber-800 border border-amber-200 bg-white hover:bg-amber-50 active:bg-amber-100 rounded-md transition-colors"
        >
          <Info className="h-4 w-4" />
          Test details
        </button>
      )}
      {result !== undefined ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-sm text-green-700 font-medium">
          <Check className="h-4 w-4 shrink-0" />
          Result: {result}
        </div>
      ) : ev.parameterId && onEnterResult ? (
        <button
          onClick={() => onEnterResult(ev)}
          className="mt-2 w-full min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-md transition-colors"
        >
          <ClipboardCheck className="h-4 w-4" />
          Enter result
        </button>
      ) : null}
    </div>
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
  today,
  getSessionLog,
  resultsByDate,
  lastValueLabelFor,
  onEnterTestResult,
  onShowTestDetails,
}: {
  entry: AthleteScheduleEntry | null;
  today: string; // yyyy-MM-dd
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
  resultsByDate: Map<string, string>;
  lastValueLabelFor: (parameterId: string | undefined, unit?: string) => string | null;
  onEnterTestResult: (ev: AthleteCalendarEvent) => void;
  onShowTestDetails: (ev: AthleteCalendarEvent) => void;
}) {
  const hasSessions = (entry?.sessions.length ?? 0) > 0;
  const tests  = (entry?.events ?? []).filter(e => e.type === 'test');
  const events = (entry?.events ?? []).filter(e => e.type === 'event');
  // Coach note on a rest day: first event with notes (events are shown as cards too)
  const coachNote = !hasSessions && tests.length === 0 ? (events.find(e => e.notes)?.notes ?? null) : null;

  const testCards = tests.map(ev => (
    <TestCard
      key={ev.id}
      ev={ev}
      lastValue={lastValueLabelFor(ev.parameterId, ev.unit)}
      result={ev.parameterId ? resultsByDate.get(`${ev.parameterId}:${today}`) : undefined}
      onEnterResult={onEnterTestResult}
      onShowDetails={onShowTestDetails}
    />
  ));

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Today's Schedule
      </p>

      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}

      {tests.length > 0 && (
        // Tests take the day's main card when there's no session (no "Planned Rest Day" then)
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-900">
              {tests.length === 1 ? 'You have a test today!' : `You have ${tests.length} tests today!`}
            </p>
            {testCards}
          </CardContent>
        </Card>
      )}

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
      ) : tests.length === 0 ? (
        <RestDayCard coachNote={coachNote} />
      ) : null}
    </div>
  );
}

/** The next training day's sessions — each opens the session like from the Plan tab */
function NextSessionSection({
  entry,
  getSessionLog,
}: {
  entry: AthleteScheduleEntry;
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Next Session · {formatNextDate(entry.date)}
      </p>
      {entry.sessions.map((session, index) => (
        <SessionCard
          key={session.id}
          session={session}
          entry={entry}
          index={index}
          log={getSessionLog(entry.date, session.id)}
        />
      ))}
    </div>
  );
}

/** Upcoming days with sessions, tests or events; sessions open directly, tests show their details */
function ComingUp({
  days,
  getSessionLog,
  onShowTestDetails,
}: {
  days: AthleteScheduleEntry[];
  getSessionLog: (date: string, sessionId: string) => SessionLog | null;
  onShowTestDetails: (ev: AthleteCalendarEvent) => void;
}) {
  const navigate = useNavigate();
  if (days.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coming Up</p>
      <div className="rounded-xl border divide-y">
        {days.map(e => {
          const { day, num } = formatShortDate(e.date);
          const tests = e.events.filter(ev => ev.type === 'test');
          const events = e.events.filter(ev => ev.type !== 'test');
          return (
            <div key={e.date} className="flex gap-3 p-3">
              <div className="w-10 shrink-0 flex flex-col items-center pt-0.5">
                <span className="text-xs text-muted-foreground">{day}</span>
                <span className="text-sm font-semibold">{num}</span>
                {e.sessions.length > 0 && (
                  <span className={cn('w-2 h-2 rounded-full mt-1', getDotColor(e.intensity ?? null))} />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {e.sessions.map((session, index) => {
                  const log = getSessionLog(e.date, session.id);
                  return (
                    <button
                      key={session.id}
                      onClick={() => navigate('/athlete/session', { state: { entry: e, sessionIdx: index, log } })}
                      className={cn(
                        'w-full min-h-[44px] flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors active:scale-[0.99]',
                        log ? 'border-green-200 bg-green-50/60' : 'hover:bg-muted/60 active:bg-muted',
                      )}
                    >
                      {log
                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        : <Dumbbell className="h-4 w-4 text-primary shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{session.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {session.exerciseCount} exercise{session.exerciseCount !== 1 ? 's' : ''}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
                {tests.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onShowTestDetails(ev)}
                    className="w-full min-h-[44px] flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-left active:bg-amber-100"
                  >
                    <Activity className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-amber-900 truncate">Test: {ev.title}</span>
                    <Info className="h-4 w-4 text-amber-700 shrink-0" />
                  </button>
                ))}
                {events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 min-h-[44px]">
                    <CalendarDays className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-blue-900 truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const COMING_UP_DAYS = 7;

export default function AthleteTodayPage() {
  const { connection, schedule, loading, error, getTodayEntry, getSessionLog, submitTestResult } = useAthleteApp();
  const { todayCheckin, openCheckin } = useOutletContext<AthleteLayoutContext>();
  const { resultsByDate, lastValueLabelFor, markSaved } = useAthleteTestResults(connection);
  const [testTarget, setTestTarget] = useState<TestResultTarget | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<AthleteCalendarEvent | null>(null);

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

  // "Next session": the next training day, when nothing is left to do today
  const todaySessionsDone = (todayEntry?.sessions ?? []).every(s => !!getSessionLog(today, s.id));
  const nextTrainingDay = todaySessionsDone
    ? schedule.find(e => e.date > today && e.sessions.length > 0) ?? null
    : null;

  // "Coming up": the next days with sessions, tests or events (the Next-session day isn't repeated)
  const comingUpEnd = addDays(today, COMING_UP_DAYS);
  const comingUp = schedule.filter(e =>
    e.date > today && e.date <= comingUpEnd &&
    e.date !== nextTrainingDay?.date &&
    (e.sessions.length > 0 || e.events.length > 0)
  );

  return (
    <>
      <TestResultDialog
        target={testTarget}
        connectionId={connection?.id}
        lastValueLabel={testTarget ? lastValueLabelFor(testTarget.ev.parameterId, testTarget.ev.unit) : null}
        submitTestResult={submitTestResult}
        onSaved={markSaved}
        onClose={() => setTestTarget(null)}
      />
      <TestDetailsDialog
        event={detailsEvent}
        lastValueLabel={detailsEvent ? lastValueLabelFor(detailsEvent.parameterId, detailsEvent.unit) : null}
        onClose={() => setDetailsEvent(null)}
      />

      <div className="p-4 space-y-6">
        {/* Greeting */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}{connection ? `, ${connection.athleteName.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
          </div>
          {connection?.monitoringEnabled === true && todayCheckin !== undefined && (
            <button
              onClick={openCheckin}
              className="shrink-0 mt-1 flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20 rounded-full px-3 py-1.5 transition-colors"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {todayCheckin ? 'Edit check-in' : 'Log check-in'}
            </button>
          )}
        </div>

        <TodaySchedule
          entry={todayEntry}
          today={today}
          getSessionLog={getSessionLog}
          resultsByDate={resultsByDate}
          lastValueLabelFor={lastValueLabelFor}
          onEnterTestResult={ev => setTestTarget({ ev, date: today })}
          onShowTestDetails={setDetailsEvent}
        />

        {nextTrainingDay && (
          <NextSessionSection entry={nextTrainingDay} getSessionLog={getSessionLog} />
        )}

        <ComingUp days={comingUp} getSessionLog={getSessionLog} onShowTestDetails={setDetailsEvent} />
      </div>
    </>
  );
}
