import { BedDouble, Dumbbell, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAthleteApp, AthleteScheduleEntry } from '@/hooks/useAthleteApp';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  // Borg CR10
  '0': { label: '0 – Rest', color: 'bg-slate-100 text-slate-600' },
  '1': { label: '1 – Very Easy', color: 'bg-green-100 text-green-700' },
  '2': { label: '2 – Easy', color: 'bg-green-200 text-green-800' },
  '3': { label: '3 – Moderate', color: 'bg-yellow-100 text-yellow-700' },
  '4': { label: '4 – Somewhat Hard', color: 'bg-yellow-200 text-yellow-800' },
  '5': { label: '5 – Hard', color: 'bg-orange-200 text-orange-800' },
  '6': { label: '6 – Hard+', color: 'bg-orange-300 text-orange-900' },
  '7': { label: '7 – Very Hard', color: 'bg-red-200 text-red-800' },
  '8': { label: '8 – Very Hard+', color: 'bg-red-300 text-red-900' },
  '9': { label: '9 – Extremely Hard', color: 'bg-red-400 text-red-950' },
  '10': { label: '10 – Maximal', color: 'bg-red-600 text-white' },
  // Legacy 8-level
  off: { label: 'Off', color: 'bg-slate-100 text-slate-600' },
  deload: { label: 'Deload', color: 'bg-blue-100 text-blue-700' },
  easy: { label: 'Easy', color: 'bg-green-100 text-green-700' },
  'easy-moderate': { label: 'Easy-Moderate', color: 'bg-green-200 text-green-800' },
  moderate: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  'moderate-hard': { label: 'Moderate-Hard', color: 'bg-orange-200 text-orange-800' },
  hard: { label: 'Hard', color: 'bg-red-200 text-red-800' },
  'extremely-hard': { label: 'Extremely Hard', color: 'bg-red-500 text-white' },
};

function getDotColor(intensity: string | null): string {
  if (!intensity) return 'bg-slate-300';
  const num = parseInt(intensity);
  if (!isNaN(num)) {
    if (num <= 2) return 'bg-green-400';
    if (num <= 4) return 'bg-yellow-400';
    if (num <= 6) return 'bg-orange-400';
    return 'bg-red-500';
  }
  if (intensity === 'easy' || intensity === 'easy-moderate') return 'bg-green-400';
  if (intensity === 'moderate') return 'bg-yellow-400';
  if (intensity === 'moderate-hard' || intensity === 'hard') return 'bg-orange-400';
  if (intensity === 'extremely-hard') return 'bg-red-500';
  return 'bg-slate-300';
}

function IntensityBadge({ intensity }: { intensity: string | null }) {
  if (!intensity) return null;
  const config = INTENSITY_CONFIG[intensity] ?? { label: intensity, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', config.color)}>
      {config.label}
    </span>
  );
}

function TrainingEntry({ entry }: { entry: AthleteScheduleEntry }) {
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      {/* Intensity + context */}
      <div className="flex flex-col gap-2">
        <IntensityBadge intensity={entry.intensity} />
        {(entry.mesocycleName || entry.programName) && (
          <p className="text-sm text-muted-foreground">
            {[entry.mesocycleName, entry.programName].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Session cards */}
      <div className="space-y-2">
        {entry.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions scheduled.</p>
        ) : (
          entry.sessions.map(session => (
            <Card
              key={session.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toast({ title: 'Session detail coming soon' })}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{session.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.exerciseCount} exercise{session.exerciseCount !== 1 ? 's' : ''}
                      {session.duration ? ` · ~${session.duration} min` : ''}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function RestDay() {
  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
        <BedDouble className="h-10 w-10 text-slate-400" />
        <div className="text-center">
          <p className="font-semibold text-slate-600">Rest Day</p>
          <p className="text-sm text-slate-400 mt-1">Recovery is part of the plan.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingStrip({ entries }: { entries: AthleteScheduleEntry[] }) {
  const today = new Date().toISOString().slice(0, 10);
  // Skip today (already shown above), show next 5
  const upcoming = entries.filter(e => e.date > today).slice(0, 5);
  if (upcoming.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coming Up</p>
      <div className="flex gap-2">
        {upcoming.map(entry => {
          const { day, num } = formatShortDate(entry.date);
          const hasTraining = entry.sessions.length > 0;
          return (
            <div key={entry.date} className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-xs text-muted-foreground">{day}</span>
              <span className="text-sm font-medium">{num}</span>
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  hasTraining ? getDotColor(entry.intensity) : 'bg-slate-200'
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AthleteTodayPage() {
  const { connection, loading, error, getTodayEntry, getUpcomingDays } = useAthleteApp();

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
  const upcomingDays = getUpcomingDays(6); // today + 5 upcoming

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {getGreeting()}{connection ? `, ${connection.athleteName.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* Today */}
      {todayEntry ? <TrainingEntry entry={todayEntry} /> : <RestDay />}

      {/* Upcoming strip */}
      <UpcomingStrip entries={upcomingDays} />
    </div>
  );
}
