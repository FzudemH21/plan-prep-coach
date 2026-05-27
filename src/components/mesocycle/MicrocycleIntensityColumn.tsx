import React from 'react';
import { BorgLevel, getBorgBg, getBorgLabel, getBorgValue, getBorgFromValue, getBorgStyleLight, migrateLegacyIntensity } from '@/utils/intensityScale';
import { IntensityLevel } from '@/types/training';
import { Microcycle } from '@/features/planner/types';
import { Trophy, CalendarDays } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Band height per level: 100% / 11 levels
const BAND_HEIGHT = 100 / 11;

interface TestDetail {
  name: string;
  goal?: string;
  dates: Date[];
}

interface EventDetail {
  name: string;
  dates: Date[];
}

interface MicrocycleIntensityColumnProps {
  microcycle: Microcycle;
  mesocycleId: string;
  intensity: IntensityLevel;
  onIntensityChange: (mesocycleId: string, microcycleId: string, intensity: IntensityLevel) => void;
  isLastMicrocycleOfMesocycle: boolean;
  testDetails?: TestDetail[];
  eventDetails?: EventDetail[];
  startDate?: Date;
  endDate?: Date;
}

const MicrocycleIntensityColumn: React.FC<MicrocycleIntensityColumnProps> = ({
  microcycle,
  mesocycleId,
  intensity,
  onIntensityChange,
  isLastMicrocycleOfMesocycle,
  testDetails = [],
  eventDetails = [],
  startDate,
  endDate,
}) => {
  // Migrate any legacy intensity value on read
  const safeIntensity: BorgLevel = migrateLegacyIntensity(intensity);

  const chartHeight = 200;

  // Map BorgLevel (0–10) to column fill height
  const borgValue = getBorgValue(safeIntensity);
  const columnHeightPct = (borgValue / 10) * 100;
  const actualHeight = (columnHeightPct / 100) * chartHeight;

  const handleColumnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = rect.bottom - e.clientY;
    const clickPct = (clickY / rect.height) * 100;
    const borgIdx = Math.max(0, Math.min(10, Math.round((clickPct / 100) * 10)));
    onIntensityChange(mesocycleId, microcycle.id, getBorgFromValue(borgIdx) as IntensityLevel);
  };

  const generateGridLines = () =>
    Array.from({ length: 12 }, (_, i) => i * BAND_HEIGHT).map((pct) => (
      <div
        key={pct}
        className="absolute w-full border-t border-border/50 z-10"
        style={{
          bottom: `${pct}%`,
          borderStyle: pct === 0 || pct === 100 ? 'solid' : 'dashed',
        }}
      />
    ));

  const getBorderClasses = () =>
    isLastMicrocycleOfMesocycle ? 'border-r-4 border-border/80' : 'border-r border-border/60';

  const subtleBgStyle = getBorgStyleLight(safeIntensity, 0.10);
  const hasIcons = testDetails.length > 0 || eventDetails.length > 0;

  return (
    <div className={cn('flex flex-col w-[160px] shrink-0 box-border border-l border-border/40', getBorderClasses())}>
      {/* Microcycle header */}
      <div
        className="h-24 text-center text-xs rounded-md border border-border w-full mb-2 flex flex-col p-1"
        style={subtleBgStyle}
      >
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="font-medium truncate w-full px-1" title={microcycle.name}>
            {microcycle.name}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {startDate && endDate ? (
              <>
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')} ({microcycle.duration}d)
              </>
            ) : (
              `${microcycle.duration}d`
            )}
          </div>
        </div>

        {hasIcons && (
          <div className="flex items-center justify-center gap-1 pt-1 border-t border-border/30 mt-auto">
            {testDetails.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer">
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      <Trophy className="h-3 w-3" />
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Tests:</p>
                    {testDetails.map((test, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        <div>• {test.goal ? `${test.goal}: ` : ''}{test.name}</div>
                        <div className="pl-2 text-[10px]">
                          {test.dates.map((d) => format(d, 'MMM d')).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {eventDetails.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-pointer">
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      <CalendarDays className="h-3 w-3" />
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Events:</p>
                    {eventDetails.map((event, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        <div>• {event.name}</div>
                        <div className="pl-2 text-[10px]">
                          {event.dates.map((d) => format(d, 'MMM d')).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Chart container */}
      <div
        className="relative cursor-pointer transition-all duration-200 hover:shadow-md w-full"
        style={{ height: `${chartHeight}px` }}
        onClick={handleColumnClick}
      >
        <div
          className="absolute bottom-0 w-full bg-muted/30 border border-border rounded-t z-0"
          style={{ height: `${chartHeight}px` }}
        />

        {generateGridLines()}

        <div
          className="absolute bottom-0 w-full rounded-t transition-all duration-300 border-2 border-transparent z-20"
          style={{
            height: `${actualHeight}px`,
            backgroundColor: getBorgBg(safeIntensity),
          }}
        />

        <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-t z-30" />
      </div>

      {/* Intensity label */}
      <div className="text-xs mt-2 text-center font-medium w-[160px] whitespace-nowrap overflow-hidden text-ellipsis">
        {safeIntensity} – {getBorgLabel(safeIntensity)}
      </div>
    </div>
  );
};

export default MicrocycleIntensityColumn;
