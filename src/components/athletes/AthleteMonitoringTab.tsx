import { Activity } from 'lucide-react';
import { Athlete } from '@/types/athlete';

interface Props {
  athlete: Athlete;
}

export function AthleteMonitoringTab({ athlete: _athlete }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
      <Activity className="h-10 w-10 opacity-30" />
      <p className="text-sm font-medium">Monitoring — coming soon</p>
      <p className="text-xs opacity-70">Wellness trends, pain history and illness flags will appear here.</p>
    </div>
  );
}
