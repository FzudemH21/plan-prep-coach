import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useAthletes } from '@/hooks/useAthletes';
import type { AthleteScheduleEntry } from '@/hooks/useAthleteApp';

const PALETTE = [
  'bg-blue-500','bg-emerald-500','bg-violet-500',
  'bg-orange-500','bg-pink-500','bg-teal-500','bg-rose-500','bg-indigo-500',
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

interface DayEntry {
  connectionId: string;
  athleteLocalId: string;
  athleteName: string;
  entry: AthleteScheduleEntry | null;
}

export default function CoachMobileTrainingPage() {
  const navigate = useNavigate();
  const { connections } = useAthleteConnections();
  const { athletes } = useAthletes();
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLabel = format(new Date(), 'EEEE, MMMM d');

  useEffect(() => {
    const connected = connections.filter(c => c.connectedAt);
    if (connected.length === 0) {
      setDayEntries([]);
      return;
    }
    setLoading(true);

    const ids = connected.map(c => c.id);

    supabase
      .from('athlete_schedule')
      .select('*')
      .in('athlete_connection_id', ids)
      .eq('date', todayStr)
      .then(({ data }) => {
        const rows = data ?? [];
        const entries: DayEntry[] = connected.map(conn => {
          const row = rows.find(
            (r: Record<string, unknown>) => r.athlete_connection_id === conn.id
          );
          return {
            connectionId: conn.id,
            athleteLocalId: conn.athleteLocalId,
            athleteName: conn.athleteName,
            entry: row
              ? {
                  id: row.id as string,
                  date: row.date as string,
                  intensity: row.intensity as string | null,
                  sessions: (row.sessions as AthleteScheduleEntry['sessions']) || [],
                  events: (row.events as AthleteScheduleEntry['events']) || [],
                  programName: row.program_name as string | null,
                  mesocycleName: row.mesocycle_name as string | null,
                  microcycleName: row.microcycle_name as string | null,
                }
              : null,
          };
        });
        setDayEntries(entries);
        setLoading(false);
      });
  }, [connections, todayStr]);

  const training = dayEntries.filter(e => e.entry && e.entry.sessions.length > 0);
  const rest     = dayEntries.filter(e => !e.entry || e.entry.sessions.length === 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
          Today's Training
        </p>
        <h1 className="text-2xl font-bold">{todayLabel}</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : dayEntries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No connected athletes yet. Invite athletes from the Athlete Database on desktop.
          </p>
        </div>
      ) : (
        <div className="flex-1 px-4 space-y-4">

          {/* Athletes training today */}
          {training.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Training ({training.length})
              </p>
              {training.map(({ athleteLocalId, athleteName, entry }) => {
                const bg = avatarColor(athleteName);
                const ini = athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <button
                    key={athleteLocalId}
                    className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left active:bg-accent/50"
                    onClick={() => navigate(`/coach-mobile/athletes/${athleteLocalId}`)}
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                      <span className="text-xs font-bold text-white">{ini}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{athleteName}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry!.sessions.length} session{entry!.sessions.length !== 1 ? 's' : ''} · {' '}
                        {entry!.sessions.reduce((n, s) => n + s.exerciseCount, 0)} exercises
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </section>
          )}

          {/* Rest day athletes */}
          {rest.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Rest day ({rest.length})
              </p>
              {rest.map(({ athleteLocalId, athleteName }) => {
                const bg = avatarColor(athleteName);
                const ini = athleteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <button
                    key={athleteLocalId}
                    className="w-full flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3 text-left active:bg-accent/50"
                    onClick={() => navigate(`/coach-mobile/athletes/${athleteLocalId}`)}
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-full ${bg} flex items-center justify-center opacity-50`}>
                      <span className="text-xs font-bold text-white">{ini}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-muted-foreground truncate">{athleteName}</p>
                      <p className="text-xs text-muted-foreground">Rest day</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })}
            </section>
          )}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
