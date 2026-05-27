import { BedDouble, Dumbbell, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAthleteApp, AthleteScheduleEntry } from '@/hooks/useAthleteApp';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { IntensityBadge, getDotColor } from '@/components/athlete-app/IntensityBadge';

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

function TrainingEntry({ entry }: { entry: AthleteScheduleEntry }) {
  const navigate = useNavigate();

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
          entry.sessions.map((session, index) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:bg-muted/60 active:scale-[0.98] transition-all"
              onClick={() => navigate('/athlete/session', { state: { entry, sessionIdx: index } })}
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
