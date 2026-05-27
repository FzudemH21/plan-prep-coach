import React from 'react';
import { BorgLevel, BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabel, getBorgValue, getBorgFromValue, getBorgStyleLight, migrateLegacyIntensity } from '@/utils/intensityScale';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { format, parseISO } from 'date-fns';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/useCalendarEvents';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

// Band height per level: 100% / 11 levels
const BAND_HEIGHT = 100 / 11;

interface IntensityColumnProps {
  day: TrainingDay;
  intensity: IntensityLevel;
  onIntensityChange: (date: string, intensity: IntensityLevel) => void;
  tooltipContent?: string;
  isLastDayOfMicrocycle: boolean;
  isLastDayOfMesocycle: boolean;
  calendarEventsForDay?: CalendarEvent[];
}

const IntensityColumn: React.FC<IntensityColumnProps> = ({
  day,
  intensity,
  onIntensityChange,
  tooltipContent,
  isLastDayOfMicrocycle,
  isLastDayOfMesocycle,
  calendarEventsForDay = [],
}) => {
  const { data: parametersData } = useParametersDataV2();
  const parameters = parametersData?.parameters ?? [];

  // Migrate any legacy intensity value on read
  const safeIntensity: BorgLevel = migrateLegacyIntensity(intensity);

  const hookTests = calendarEventsForDay.filter(e => e.type === 'test');
  const hookEventItems = calendarEventsForDay.filter(e => e.type === 'event');
  const hasTests = day.isTestDay || hookTests.length > 0;
  const hasEvents = day.isEventDay || hookEventItems.length > 0;

  const getTestName = (ev: CalendarEvent): string => {
    if (ev.parameterId) {
      const param = parameters.find(p => p.id === ev.parameterId);
      if (param) return param.name;
    }
    return ev.title;
  };

  const allTestNames = [
    ...(day.testNames || []),
    ...hookTests.map(getTestName),
  ];
  const allEventNames = [
    ...(day.eventNames || []),
    ...hookEventItems.map(e => e.title),
  ];

  const chartHeight = 200;

  // Map BorgLevel (0–10) to column fill height (proportional to numeric value)
  const borgValue = getBorgValue(safeIntensity);
  const columnHeightPct = (borgValue / 10) * 100;
  const actualHeight = (columnHeightPct / 100) * chartHeight;

  // Click on the chart area to set intensity based on click position
  const handleColumnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = rect.bottom - e.clientY; // distance from bottom
    const clickPct = (clickY / rect.height) * 100;
    // Map percentage to Borg level 0–10
    const borgIdx = Math.max(0, Math.min(10, Math.round((clickPct / 100) * 10)));
    onIntensityChange(day.date, getBorgFromValue(borgIdx) as IntensityLevel);
  };

  // Generate 11 grid lines (one per band boundary)
  const generateGridLines = () => {
    return Array.from({ length: 12 }, (_, i) => i * BAND_HEIGHT).map((pct) => (
      <div
        key={pct}
        className="absolute w-full border-t border-border/50 z-10"
        style={{
          bottom: `${pct}%`,
          borderStyle: pct === 0 || pct === 100 ? 'solid' : 'dashed',
        }}
      />
    ));
  };

  const getBorderClasses = () => {
    if (isLastDayOfMesocycle) return 'border-r-4 border-border/80';
    if (isLastDayOfMicrocycle) return 'border-r-2 border-border/70';
    return 'border-r border-border/60';
  };

  // Subtle tinted background using inline style (Borg colors)
  const subtleBgStyle = getBorgStyleLight(safeIntensity, 0.10);

  const dayHeader = (
    <div
      className={cn(
        "relative h-16 text-center text-xs rounded-md border border-border w-full mb-2 flex flex-col items-center justify-center",
        hasTests && !hasEvents && 'bg-amber-50 border-amber-400 dark:bg-amber-950/20',
        !hasTests && hasEvents && 'bg-blue-50 border-blue-400 dark:bg-blue-950/20',
      )}
      style={
        hasTests && hasEvents
          ? {
              border: '1px solid transparent',
              backgroundImage:
                'linear-gradient(hsl(var(--card)), hsl(var(--card))), linear-gradient(to right, #f59e0b 50%, #3b82f6 50%)',
              backgroundOrigin: 'padding-box, border-box',
              backgroundClip: 'padding-box, border-box',
            }
          : !hasTests && !hasEvents
          ? subtleBgStyle
          : undefined
      }
    >
      <div className="font-medium">{format(parseISO(day.date), 'MMM d')}</div>
      <div className="text-xs">{day.dayName}</div>

      <div className="absolute -top-1 -right-1 flex gap-0.5">
        {allTestNames.length > 0 && (
          <HoverCard openDelay={100}>
            <HoverCardTrigger asChild>
              <div className="cursor-pointer">
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  <Trophy className="h-3 w-3" />
                </Badge>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-auto max-w-xs p-3 z-[200]" side="top" align="center" sideOffset={5}>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {allTestNames.length > 1 ? 'Tests:' : 'Test:'}
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {allTestNames.map((testName, idx) => (
                    <div key={idx}>• {testName}</div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        )}

        {allEventNames.length > 0 && (
          <HoverCard openDelay={100}>
            <HoverCardTrigger asChild>
              <div className="cursor-pointer">
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  <Calendar className="h-3 w-3" />
                </Badge>
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-auto max-w-xs p-3 z-[200]" side="top" align="center" sideOffset={5}>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {allEventNames.length > 1 ? 'Events:' : 'Event:'}
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {allEventNames.map((eventName, idx) => (
                    <div key={idx}>• {eventName}</div>
                  ))}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col w-[100px] shrink-0 box-border ${getBorderClasses()}`}>
      {dayHeader}

      <div
        className="relative cursor-pointer transition-all duration-200 hover:shadow-md w-full"
        style={{ height: `${chartHeight}px` }}
        onClick={handleColumnClick}
      >
        {/* Background column */}
        <div
          className="absolute bottom-0 w-full bg-muted/30 border border-border rounded-t z-0"
          style={{ height: `${chartHeight}px` }}
        />

        {/* Grid lines */}
        {generateGridLines()}

        {/* Intensity fill */}
        <div
          className={`absolute bottom-0 w-full rounded-t transition-all duration-300 border-2 z-20 ${
            hasTests ? 'border-amber-400' : hasEvents ? 'border-blue-400' : 'border-transparent'
          }`}
          style={{
            height: `${actualHeight}px`,
            backgroundColor: getBorgBg(safeIntensity),
          }}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-t z-30" />
      </div>

      {/* Intensity label */}
      <div className="text-xs mt-2 text-center font-medium w-[100px] whitespace-nowrap overflow-hidden text-ellipsis">
        {safeIntensity} – {getBorgLabel(safeIntensity)}
      </div>
    </div>
  );
};

export default IntensityColumn;
