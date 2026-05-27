import React, { useState } from 'react';
import { format } from 'date-fns';
import { parseDateStr } from '@/utils/dateUtils';
import { Trophy, Calendar } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import { BorgLevel, BORG_LEVELS, getBorgBg, getBorgFg, getBorgLabel, getBorgLabelFull, migrateLegacyIntensity } from '@/utils/intensityScale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

interface DayHeaderProps {
  date: string; // ISO date string
  intensity: IntensityLevel;
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  sessionCount: number;
  testNames?: string[];
  eventNames?: string[];
}

export function DayHeader({
  date,
  intensity,
  onDayIntensityChange,
  sessionCount,
  testNames,
  eventNames,
}: DayHeaderProps) {
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);

  const parsedDate = parseDateStr(date);
  const dayOfWeek = format(parsedDate, 'EEEE').toUpperCase();
  const monthDay = format(parsedDate, 'MMM d, yyyy');

  // Migrate any legacy value on read
  const safeIntensity: BorgLevel = migrateLegacyIntensity(intensity);

  return (
    <div className="w-full border-b-2 border-border pb-2 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground">{dayOfWeek}</span>

          {/* Date row with inline badges */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{monthDay}</span>

            {/* Test/Event Badges */}
            {((testNames && testNames.length > 0) || (eventNames && eventNames.length > 0)) && (
              <div className="flex gap-1">
                {testNames && testNames.length > 0 && (
                  <HoverCard openDelay={100}>
                    <HoverCardTrigger asChild>
                      <div className="cursor-pointer">
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          <Trophy className="h-3 w-3 mr-1" />
                          {testNames.length > 1 ? `${testNames.length} Tests` : 'Test'}
                        </Badge>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" sideOffset={5} className="w-auto max-w-xs p-3 z-[200]">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">{testNames.length > 1 ? 'Tests:' : 'Test:'}</p>
                        <div className="text-xs space-y-0.5">
                          {testNames.map((testName, idx) => (
                            <div key={idx}>• {testName}</div>
                          ))}
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
                {eventNames && eventNames.length > 0 && (
                  <HoverCard openDelay={100}>
                    <HoverCardTrigger asChild>
                      <div className="cursor-pointer">
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {eventNames.length > 1 ? `${eventNames.length} Events` : 'Event'}
                        </Badge>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" sideOffset={5} className="w-auto max-w-xs p-3 z-[200]">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">{eventNames.length > 1 ? 'Events:' : 'Event:'}</p>
                        <div className="text-xs space-y-0.5">
                          {eventNames.map((eventName, idx) => (
                            <div key={idx}>• {eventName}</div>
                          ))}
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Day Intensity Badge — editable when handler provided */}
        {onDayIntensityChange ? (
          <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium px-2 py-1 h-auto hover:opacity-80"
                style={{ backgroundColor: getBorgBg(safeIntensity), color: getBorgFg(safeIntensity) }}
              >
                {getBorgLabelFull(safeIntensity)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <div className="text-sm font-medium">Change Day Intensity</div>
                {BORG_LEVELS.map((level) => (
                  <Button
                    key={level}
                    variant="ghost"
                    size="sm"
                    className={cn('w-full justify-start text-xs', level === safeIntensity && 'bg-accent')}
                    onClick={() => {
                      onDayIntensityChange(date, level as IntensityLevel);
                      setIntensityPopoverOpen(false);
                    }}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-2 border border-black/10"
                      style={{ backgroundColor: getBorgBg(level) }}
                    />
                    {getBorgLabelFull(level)}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span
            className="text-xs font-medium px-2 py-1 rounded"
            style={{ backgroundColor: getBorgBg(safeIntensity), color: getBorgFg(safeIntensity) }}
          >
            {getBorgLabelFull(safeIntensity)}
          </span>
        )}
      </div>
    </div>
  );
}
