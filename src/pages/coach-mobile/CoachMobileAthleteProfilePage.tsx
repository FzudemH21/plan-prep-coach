import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Dumbbell, Link2, CheckCircle2, Clock, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry } from '@/hooks/useAthleteApp';
import { format, parseISO } from 'date-fns';
import { IntensityBadge } from '@/components/athlete-app/IntensityBadge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const PALETTE = [
  'bg-blue-500','bg-emerald-500','bg-violet-500',
  'bg-orange-500','bg-pink-500','bg-teal-500','bg-rose-500','bg-indigo-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  return new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(d.getTime() + diff * 86_400_000).toISOString().slice(0, 10);
}

function fmtShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}

function fmtFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatWeekRange(mondayStr: string): string {
  return `${fmtShort(mondayStr)} – ${fmtFull(addDays(mondayStr, 6))}`;
}

function formatDayHeader(dateStr: string): { weekday: string; dateLabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  };
}

// ── Schedule hook (coach-side read) ───────────────────────────────────────────

function useAthleteSchedule(connectionId: string | null) {
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connectionId) return;
    setLoading(true);

    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate() - 14);
    const to   = new Date(today); to.setDate(today.getDate() + 90);
    const fmt  = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    supabase
      .from('athlete_schedule')
      .select('*')
      .eq('athlete_connection_id', connectionId)
      .gte('date', fmt(from))
      .lte('date', fmt(to))
      .order('date', { ascending: true })
      .then(({ data }) => {
        setSchedule(
          (data ?? []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            date: row.date as string,
            intensity: row.intensity as string | null,
            sessions: (row.sessions as AthleteScheduleEntry['sessions']) || [],
            events: (row.events as AthleteScheduleEntry['events']) || [],
            programName: row.program_name as string | null,
            mesocycleName: row.mesocycle_name as string | null,
            microcycleName: row.microcycle_name as string | null,
          }))
        );
        setLoading(false);
      });
  }, [connectionId]);

  return { schedule, loading };
}

// ── Component ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'training';

export default function CoachMobileAthleteProfilePage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  const today = new Date().toISOString().slice(0, 10);
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOf(today));

  const { athletes, calendarAssignments } = useAthletes();
  const { connections } = useAthleteConnections();

  const athlete = athletes.find(a => a.id === athleteId);
  const connection = connections.find(c => c.athleteLocalId === athleteId);
  const { schedule, loading: schedLoading } = useAthleteSchedule(connection?.id ?? null);

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm">
        Athlete not found.
      </div>
    );
  }

  const fullName = `${athlete.firstName} ${athlete.lastName}`;
  const bg = avatarColor(fullName);
  const ini = `${athlete.firstName?.[0] ?? ''}${athlete.lastName?.[0] ?? ''}`.toUpperCase();
  const sports = athlete.sports?.length ? athlete.sports : athlete.sport ? [athlete.sport] : [];
  const isConnected = !!connection?.connectedAt;
  const isPending   = connection && !connection.connectedAt;

  const assignments = calendarAssignments.filter(ca => ca.athleteId === athleteId);

  // ── Week navigation ──────────────────────────────────────────────────────────
  const prevMonday = addDays(weekMonday, -7);
  const nextMonday = addDays(weekMonday, 7);
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const scheduleMap = new Map(schedule.map(e => [e.date, e]));

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={() => navigate('/coach-mobile/athletes')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Profile card */}
      <div className="px-4 pb-4 flex flex-col items-center text-center gap-2 shrink-0">
        <div className={`w-16 h-16 rounded-full ${bg} flex items-center justify-center`}>
          <span className="text-xl font-bold text-white">{ini}</span>
        </div>
        <div>
          <h2 className="text-xl font-bold">{fullName}</h2>
          {sports.length > 0 && (
            <p className="text-sm text-muted-foreground">{sports.join(' · ')}</p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            isConnected ? 'bg-emerald-100 text-emerald-700'
            : isPending  ? 'bg-amber-100 text-amber-700'
            : 'bg-muted text-muted-foreground'
          )}
        >
          {isConnected ? <><CheckCircle2 className="h-3 w-3" /> Connected</>
          : isPending   ? <><Clock className="h-3 w-3" /> Invite pending</>
          : 'No athlete app'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4 shrink-0">
        {(['overview', 'training'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 pb-2 text-sm font-medium capitalize border-b-2 transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' ? (
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-4 pb-6">

            {/* Athlete app connection */}
            {connection && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Athlete App
                </h3>
                {isConnected ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Connected since {connection.connectedAt
                      ? format(parseISO(connection.connectedAt), 'MMM d, yyyy')
                      : '—'}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Invite code:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-base font-mono font-bold tracking-widest">
                        {connection.inviteCode}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(connection.inviteCode)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Athlete info */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Info
              </h3>
              {[
                { label: 'Birthday', value: athlete.birthday ? format(parseISO(athlete.birthday + 'T12:00:00'), 'MMM d, yyyy') : '—' },
                { label: 'Sex',      value: athlete.sex ?? '—' },
                { label: 'Team',     value: athlete.team ?? '—' },
                { label: 'Sport(s)', value: sports.length ? sports.join(', ') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>

            {/* Assigned plans */}
            {assignments.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Assigned Plans
                </h3>
                {assignments.map(a => (
                  <div key={a.id} className="text-sm">
                    <p className="font-medium truncate">{a.programName}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.startDate ? format(new Date(a.startDate), 'MMM d') : '?'} – {a.endDate ? format(new Date(a.endDate), 'MMM d, yyyy') : '?'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

      ) : (
        /* ── Training tab ── */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Week navigation header — matches athlete Plan page style */}
          <div className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
            <button
              onClick={() => setWeekMonday(prevMonday)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="flex-1 text-center text-sm font-semibold tabular-nums">
              {formatWeekRange(weekMonday)}
            </p>
            <button
              onClick={() => setWeekMonday(nextMonday)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted/80 shrink-0"
              aria-label="Next week"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" />
            </button>
          </div>

          {schedLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Loading schedule…
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-4 space-y-2 py-3 pb-6">
                {weekDays.map(dateStr => {
                  const entry    = scheduleMap.get(dateStr) ?? null;
                  const isToday  = dateStr === today;
                  const isPast   = dateStr < today;
                  const { weekday, dateLabel } = formatDayHeader(dateStr);
                  const hasSessions = (entry?.sessions.length ?? 0) > 0;

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'rounded-xl p-3 space-y-2',
                        isToday && 'bg-primary/5 ring-1 ring-primary/20',
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

                      {/* Daily intensity badge */}
                      {entry?.intensity && <IntensityBadge intensity={entry.intensity} />}

                      {/* Sessions or rest day */}
                      {hasSessions ? (
                        <div className="space-y-1.5">
                          {entry!.sessions.map((s, sIdx) => (
                            <Card
                              key={s.id}
                              className={cn('transition-opacity cursor-pointer active:scale-[0.98]', isPast && 'opacity-60')}
                              onClick={() => navigate(`/coach-mobile/athletes/${athleteId}/session`, {
                                state: { entry, sessionIdx: sIdx },
                              })}
                            >
                              <CardContent className="flex items-center gap-3 p-3">
                                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  <Dumbbell className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{s.name || 'Session'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.exerciseCount} exercise{s.exerciseCount !== 1 ? 's' : ''}
                                  </p>
                                  {s.intensity && (
                                    <div className="mt-1.5">
                                      <IntensityBadge intensity={s.intensity} />
                                    </div>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className={cn(
                          'flex items-center gap-1.5 text-xs py-1',
                          isPast ? 'text-muted-foreground/40' : 'text-slate-400'
                        )}>
                          <BedDouble className="h-3.5 w-3.5 shrink-0" />
                          <span>Rest day</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
