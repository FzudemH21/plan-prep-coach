import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Dumbbell, Flame, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface SessionLog {
  id: string;
  date: string;
  sessionName: string;
  borgRating: number | null;
  completedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLogDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Consecutive days with ≥1 completed session ending on or before today (streak). */
function calcStreak(logs: SessionLog[]): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map(l => l.date));
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let cursor = today;
  while (days.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T12:00:00');
    cursor = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
  }
  return streak;
}

const BORG_LABELS: Record<number, string> = {
  0: 'Rest', 1: 'Very, Very Easy', 2: 'Easy', 3: 'Moderate',
  4: 'Somewhat Hard', 5: 'Hard', 7: 'Very Hard', 10: 'Maximal',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) {
  return (
    <Card className="flex-1">
      <CardContent className="flex flex-col items-center justify-center py-4 gap-1">
        <div className="text-muted-foreground mb-0.5">{icon}</div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground text-center">{label}</span>
      </CardContent>
    </Card>
  );
}

function SessionLogRow({ log }: { log: SessionLog }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{log.sessionName}</p>
        <p className="text-xs text-muted-foreground">{formatLogDate(log.date)}</p>
      </div>
      {log.borgRating !== null && (
        <span className="text-xs text-muted-foreground shrink-0">
          RPE {log.borgRating}
          {BORG_LABELS[log.borgRating] ? ` · ${BORG_LABELS[log.borgRating]}` : ''}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AthleteProfilePage() {
  const navigate = useNavigate();
  const { connection } = useAthleteApp();
  const { signOut } = useAuth();

  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (!connection) return;
    supabase
      .from('athlete_session_logs')
      .select('id, date, session_name, borg_rating, completed_at')
      .eq('athlete_connection_id', connection.id)
      .order('completed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs(
          (data ?? []).map(r => ({
            id: r.id as string,
            date: r.date as string,
            sessionName: r.session_name as string,
            borgRating: r.borg_rating as number | null,
            completedAt: r.completed_at as string,
          }))
        );
        setLogsLoading(false);
      });
  }, [connection]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/athlete/login');
  };

  const initials = connection ? getInitials(connection.athleteName) : '?';
  const streak = calcStreak(logs);
  const totalSessions = logs.length;
  const recentLogs = logs.slice(0, 10);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5 pb-8">

        {/* Avatar + name */}
        <div className="flex flex-col items-center text-center pt-4 pb-2">
          <div className="w-18 h-18 rounded-full bg-primary flex items-center justify-center mb-3 w-[72px] h-[72px]">
            <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <h1 className="text-xl font-bold">
            {connection?.athleteName ?? 'Athlete'}
          </h1>
          {connection?.athleteEmail && (
            <p className="text-sm text-muted-foreground mt-0.5">{connection.athleteEmail}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <StatCard
            value={logsLoading ? '–' : totalSessions}
            label="Sessions completed"
            icon={<Dumbbell className="h-4 w-4" />}
          />
          <StatCard
            value={logsLoading ? '–' : streak}
            label={streak === 1 ? 'Day streak' : 'Day streak'}
            icon={<Flame className={cn('h-4 w-4', streak > 0 && 'text-orange-500')} />}
          />
        </div>

        {/* Recent activity */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Recent Sessions</p>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
            ) : (
              recentLogs.map(log => <SessionLogRow key={log.id} log={log} />)
            )}
          </CardContent>
        </Card>

        {/* Sign out */}
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>

      </div>
    </ScrollArea>
  );
}
