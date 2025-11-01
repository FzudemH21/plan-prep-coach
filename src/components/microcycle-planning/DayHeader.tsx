import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Trophy, Calendar } from 'lucide-react';
import { IntensityLevel } from '@/types/training';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DayHeaderProps {
  date: string; // ISO date string
  intensity: IntensityLevel;
  intensityLevels?: IntensityLevel[];
  getIntensityColor?: (intensity: IntensityLevel) => string;
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  sessionCount: number;
  testNames?: string[];
  eventNames?: string[];
}

export function DayHeader({
  date,
  intensity,
  intensityLevels,
  getIntensityColor,
  onDayIntensityChange,
  sessionCount,
  testNames,
  eventNames,
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
          
          {/* Date row with inline badges */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {monthDay}
            </span>
            
            {/* Test/Event Badges - Now inline with date */}
            {(testNames && testNames.length > 0 || eventNames && eventNames.length > 0) && (
              <div className="flex gap-1">
                {testNames && testNames.length > 0 && (
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className="h-5 px-1.5 text-xs cursor-help"
                        >
                          <Trophy className="h-3 w-3 mr-1" />
                          {testNames.length > 1 ? `${testNames.length} Tests` : 'Test'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">
                            {testNames.length > 1 ? 'Tests:' : 'Test:'}
                          </p>
                          <div className="text-xs space-y-0.5">
                            {testNames.map((testName, idx) => (
                              <div key={idx}>• {testName}</div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {eventNames && eventNames.length > 0 && (
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="secondary" 
                          className="h-5 px-1.5 text-xs cursor-help"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {eventNames.length > 1 ? `${eventNames.length} Events` : 'Event'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">
                            {eventNames.length > 1 ? 'Events:' : 'Event:'}
                          </p>
                          <div className="text-xs space-y-0.5">
                            {eventNames.map((eventName, idx) => (
                              <div key={idx}>• {eventName}</div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Day Intensity Badge - Always editable, syncs with Step 3 */}
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
