import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Dumbbell, Link2, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { supabase } from '@/lib/supabase';
import type { AthleteScheduleEntry } from '@/hooks/useAthleteApp';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  parseISO,
  isSameDay,
} from 'date-fns';

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

// ── Schedule hook (coach-side read) ───────────────────────────────────────────

function useAthleteSchedule(connectionId: string | null) {
  const [schedule, setSchedule] = useState<AthleteScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!connectionId) return;
    setLoading(true);

    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate() - 7);
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
  const [weekOffset, setWeekOffset] = useState(0);

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
  const ini = `${athlete.firstName[0] ?? ''}${athlete.lastName[0] ?? ''}`.toUpperCase();
  const sports = athlete.sports?.length ? athlete.sports : athlete.sport ? [athlete.sport] : [];
  const isConnected = !!connection?.connectedAt;
  const isPending   = connection && !connection.connectedAt;

  const assignments = calendarAssignments.filter(ca => ca.athleteId === athleteId);

  // ── Week navigation ──────────────────────────────────────────────────────────
  const baseDate = weekOffset === 0
    ? new Date()
    : weekOffset > 0
    ? addWeeks(new Date(), weekOffset)
    : subWeeks(new Date(), Math.abs(weekOffset));

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(baseDate, { weekStartsOn: 1 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/coach-mobile/athletes')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent -ml-1"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* Profile card */}
      <div className="px-4 pb-4 flex flex-col items-center text-center gap-2">
        <div className={`w-16 h-16 rounded-full ${bg} flex items-center justify-center`}>
          <span className="text-xl font-bold text-white">{ini}</span>
        </div>
        <div>
          <h2 className="text-xl font-bold">{fullName}</h2>
          {sports.length > 0 && (
            <p className="text-sm text-muted-foreground">{sports.join(' · ')}</p>
          )}
        </div>
        {/* Status pill */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            isConnected
              ? 'bg-emerald-100 text-emerald-700'
              : isPending
              ? 'bg-amber-100 text-amber-700'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isConnected ? (
            <><CheckCircle2 className="h-3 w-3" /> Connected</>
          ) : isPending ? (
            <><Clock className="h-3 w-3" /> Invite pending</>
          ) : (
            'No athlete app'
          )}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
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

      {/* Tab content */}
      {tab === 'overview' ? (
        <div className="flex-1 px-4 py-4 space-y-4">

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
              { label: 'Sex', value: athlete.sex ?? '—' },
              { label: 'Team', value: athlete.team ?? '—' },
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
      ) : (
        /* ── Training tab ── */
        <div className="flex-1 px-4 py-4 space-y-3">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-2 rounded-full hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">
                {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : format(weekStart, 'MMM d')}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
              </p>
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-2 rounded-full hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>

          {schedLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading schedule…</div>
          ) : (
            <div className="space-y-2">
              {days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const entry   = schedule.find(e => e.date === dateStr);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      'flex gap-3 items-start',
                    )}
                  >
                    {/* Day label */}
                    <div
                      className={cn(
                        'shrink-0 w-10 text-center pt-2',
                        isToday ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <p className="text-xs font-semibold uppercase">{format(day, 'EEE')}</p>
                      <p className={cn('text-base font-bold leading-none mt-0.5', isToday && 'text-primary')}>{format(day, 'd')}</p>
                    </div>

                    {/* Sessions */}
                    <div className="flex-1 space-y-1.5">
                      {entry && entry.sessions.length > 0 ? (
                        entry.sessions.map(s => (
                          <div
                            key={s.id}
                            className={cn(
                              'rounded-xl border bg-card px-3 py-2.5',
                              isToday && 'border-primary/30 bg-primary/5'
                            )}
                          >
                            <p className="text-sm font-semibold leading-tight truncate">{s.name || 'Session'}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Dumbbell className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                {s.exerciseCount} exercise{s.exerciseCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2.5 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">Rest day</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
