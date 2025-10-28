import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntensityLevel } from '@/types/training';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DayHeaderProps {
  date: string; // ISO date string
  intensity: IntensityLevel;
  intensityLevels?: IntensityLevel[];
  getIntensityColor?: (intensity: IntensityLevel) => string;
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  sessionCount: number;
}

export function DayHeader({
  date,
  intensity,
  intensityLevels,
  getIntensityColor,
  onDayIntensityChange,
  sessionCount,
}: DayHeaderProps) {
  const [intensityPopoverOpen, setIntensityPopoverOpen] = useState(false);
  
  const parsedDate = parseISO(date);
  const dayOfWeek = format(parsedDate, 'EEEE').toUpperCase(); // "WEDNESDAY"
  const monthDay = format(parsedDate, 'MMM d, yyyy'); // "Oct 8, 2025"
  
  const intensityClass = getIntensityColor 
    ? getIntensityColor(intensity) 
    : 'bg-muted text-muted-foreground';

  return (
    <div className="w-full border-b-2 border-border pb-2 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground">
            {dayOfWeek}
          </span>
          <span className="text-sm font-medium">
            {monthDay}
          </span>
        </div>
        
        {/* Day Intensity Badge - Editable only for single-session days */}
        {getIntensityColor && intensityLevels && onDayIntensityChange ? (
          <Popover open={intensityPopoverOpen} onOpenChange={setIntensityPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "text-xs font-medium px-2 py-1 h-auto hover:opacity-80",
                  intensityClass
                )}
                disabled={sessionCount > 1} // Only editable for single-session days
              >
                {intensity.replace('-', ' ').toUpperCase()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="space-y-2">
                <div className="text-sm font-medium">Change Day Intensity</div>
                {intensityLevels.map((level) => (
                  <Button
                    key={level}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-xs",
                      level === intensity && "bg-accent"
                    )}
                    onClick={() => {
                      onDayIntensityChange(date, level);
                      setIntensityPopoverOpen(false);
                    }}
                  >
                    <span
                      className={cn(
                        "inline-block w-3 h-3 rounded-full mr-2",
                        getIntensityColor(level)
                      )}
                    />
                    {level.replace('-', ' ')}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className={cn("text-xs font-medium px-2 py-1 rounded", intensityClass)}>
            {intensity.replace('-', ' ').toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
