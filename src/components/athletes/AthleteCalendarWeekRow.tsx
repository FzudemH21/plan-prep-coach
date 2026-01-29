import { format } from 'date-fns';
import { AthleteCalendarDayCell, AthleteCalendarDay } from './AthleteCalendarDayCell';

interface AthleteCalendarWeekRowProps {
  week: AthleteCalendarDay[];
  weekIdx: number;
  onSessionClick?: (dayDate: string, sessionIndex: number, assignmentId: string) => void;
  onDayClick?: (date: Date) => void;
  onAddSession?: (date: Date) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  getIntensityColor?: (intensity: string) => string;
}

export function AthleteCalendarWeekRow({
  week,
  weekIdx,
  onSessionClick,
  onDayClick,
  onAddSession,
  onDeleteAssignment,
  getIntensityColor,
}: AthleteCalendarWeekRowProps) {
  return (
    <div className="space-y-2">
      {/* Week Header */}
      <div className="flex items-center gap-2 pl-1 min-h-[32px]">
        <div className="text-xs text-muted-foreground flex-1">
          Week of {format(week[0].date, 'MMM d')}
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {week.map(day => (
          <AthleteCalendarDayCell
            key={day.dateString}
            day={day}
            onSessionClick={onSessionClick}
            onDayClick={onDayClick}
            onAddSession={onAddSession}
            onDeleteAssignment={onDeleteAssignment}
            getIntensityColor={getIntensityColor}
          />
        ))}
      </div>
    </div>
  );
}
