import React from 'react';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { format } from 'date-fns';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/useCalendarEvents';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

interface IntensityColumnProps {
  day: TrainingDay;
  intensity: IntensityLevel;
  onIntensityChange: (date: string, intensity: IntensityLevel) => void;
  tooltipContent?: string;
  isLastDayOfMicrocycle: boolean;
  isLastDayOfMesocycle: boolean;
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
  calendarEventsForDay?: CalendarEvent[];
}

// Helper to get subtle intensity-tinted background for day headers
const getSubtleIntensityBg = (intensity: IntensityLevel): string => {
  const bgMappings: Record<IntensityLevel, string> = {
    "off": "bg-[hsl(var(--intensity-off)/0.10)]",
    "deload": "bg-[hsl(var(--intensity-deload)/0.10)]",
    "easy": "bg-[hsl(var(--intensity-easy)/0.10)]",
    "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate)/0.10)]",
    "moderate": "bg-[hsl(var(--intensity-moderate)/0.10)]",
    "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard)/0.10)]",
    "hard": "bg-[hsl(var(--intensity-hard)/0.10)]",
    "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard)/0.15)]"
  };
  return bgMappings[intensity] || "bg-primary/10";
};

const IntensityColumn: React.FC<IntensityColumnProps> = ({
  day,
  intensity,
  onIntensityChange,
  tooltipContent,
  isLastDayOfMicrocycle,
  isLastDayOfMesocycle,
  intensityLevels,
  getIntensityColor,
  calendarEventsForDay = [],
}) => {
  const { data: parametersData } = useParametersDataV2();
  const parameters = parametersData?.parameters ?? [];

  const hookTests = calendarEventsForDay.filter(e => e.type === 'test');
  const hookEventItems = calendarEventsForDay.filter(e => e.type === 'event');
  const hasTests = day.isTestDay || hookTests.length > 0;
  const hasEvents = day.isEventDay || hookEventItems.length > 0;

  // Live name lookup for hook tests: parameterId → name, fallback to title
  const getTestName = (ev: CalendarEvent): string => {
    if (ev.parameterId) {
      const param = parameters.find(p => p.id === ev.parameterId);
      if (param) return param.name;
    }
    return ev.title;
  };

  // Merge test/event names from both sources for tooltips
  const allTestNames = [
    ...(day.testNames || []),
    ...hookTests.map(getTestName),
  ];
  const allEventNames = [
    ...(day.eventNames || []),
    ...hookEventItems.map(e => e.title),
  ];
  const chartHeight = 200; // Fixed chart area height
  
  // Calculate column height based on intensity level (full band heights)
  const calculateColumnHeight = (intensityLevel: IntensityLevel): number => {
    // Map intensity levels to full band heights
    const heightMappings = {
      "off": 12.5,
      "deload": 25,
      "easy": 37.5,
      "easy-moderate": 50,
      "moderate": 62.5,
      "moderate-hard": 75,
      "hard": 87.5,
      "extremely-hard": 100
    };
    
    return heightMappings[intensityLevel] || 0;
  };

  const columnHeight = calculateColumnHeight(intensity);
  const actualHeight = (columnHeight / 100) * chartHeight;

  // Handle column click with precise intensity mapping
  const handleColumnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = rect.bottom - e.clientY; // Distance from bottom
    const clickPercentage = (clickY / rect.height) * 100;
    
    // Map click position to intensity levels based on full band ranges
    let targetIntensity: IntensityLevel = "off";
    
    if (clickPercentage >= 87.5) targetIntensity = "extremely-hard";
    else if (clickPercentage >= 75) targetIntensity = "hard";
    else if (clickPercentage >= 62.5) targetIntensity = "moderate-hard";
    else if (clickPercentage >= 50) targetIntensity = "moderate";
    else if (clickPercentage >= 37.5) targetIntensity = "easy-moderate";
    else if (clickPercentage >= 25) targetIntensity = "easy";
    else if (clickPercentage >= 12.5) targetIntensity = "deload";
    else targetIntensity = "off";
    
    onIntensityChange(day.date, targetIntensity);
  };

  // Generate horizontal grid lines
  const generateGridLines = () => {
    const gridPercentages = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
    return gridPercentages.map((percentage, index) => (
      <div
        key={percentage}
        className="absolute w-full border-t border-border/50 z-10"
        style={{ 
          bottom: `${percentage}%`,
          borderStyle: percentage === 0 || percentage === 100 ? 'solid' : 'dashed'
        }}
      />
    ));
  };

  // Get border classes for microcycle/mesocycle boundaries
  const getBorderClasses = () => {
    let borderClasses = 'border-r border-border/60'; // Default day border
    
    if (isLastDayOfMesocycle) {
      borderClasses = 'border-r-4 border-border/80';
    } else if (isLastDayOfMicrocycle) {
      borderClasses = 'border-r-2 border-border/70';
    }
    
    return borderClasses;
  };

  const dayHeader = (
    <div
      className={cn(
        "relative h-16 text-center text-xs rounded-md border border-border w-full mb-2 flex flex-col items-center justify-center",
        !hasTests && !hasEvents && getSubtleIntensityBg(intensity),
        hasTests && !hasEvents && 'bg-amber-50 border-amber-400 dark:bg-amber-950/20',
        !hasTests && hasEvents && 'bg-blue-50 border-blue-400 dark:bg-blue-950/20',
      )}
      style={hasTests && hasEvents ? {
        border: '1px solid transparent',
        backgroundImage: 'linear-gradient(hsl(var(--card)), hsl(var(--card))), linear-gradient(to right, #f59e0b 50%, #3b82f6 50%)',
        backgroundOrigin: 'padding-box, border-box',
        backgroundClip: 'padding-box, border-box',
      } : undefined}
    >
      <div className="font-medium">{format(new Date(day.date), 'MMM d')}</div>
      <div className="text-xs">{day.dayName}</div>

      {/* Test/Event Icons with Hover Cards */}
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
            <HoverCardContent
              className="w-auto max-w-xs p-3 z-[200]"
              side="top"
              align="center"
              sideOffset={5}
            >
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
            <HoverCardContent
              className="w-auto max-w-xs p-3 z-[200]"
              side="top"
              align="center"
              sideOffset={5}
            >
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

  const columnElement = (
    <div className={`flex flex-col w-[100px] shrink-0 box-border ${getBorderClasses()}`}>
      {/* Day header */}
      {dayHeader}
      
      {/* Fixed Chart container with grid */}
      <div 
        className="relative cursor-pointer transition-all duration-200 hover:shadow-md w-full"
        style={{ height: `${chartHeight}px` }}
        onClick={handleColumnClick}
      >
        {/* Background column (full height, light gray) */}
        <div 
          className="absolute bottom-0 w-full bg-muted/30 border border-border rounded-t z-0"
          style={{ height: `${chartHeight}px` }}
        />
        
        {/* Grid lines */}
        {generateGridLines()}
        
        {/* Intensity column */}
        <div
          className={`absolute bottom-0 w-full rounded-t transition-all duration-300 border-2 z-20 ${getIntensityColor(intensity)} ${
            hasTests ? 'border-amber-400' :
            hasEvents ? 'border-blue-400' : 'border-transparent'
          }`}
          style={{ height: `${actualHeight}px` }}
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-t z-30" />
      </div>
      
      {/* Fixed Intensity label - prevent width changes */}
      <div className="text-xs mt-2 text-center capitalize font-medium w-[100px] whitespace-nowrap overflow-hidden text-ellipsis">
        {intensity.replace('-', ' ')}
      </div>
    </div>
  );

  return columnElement;
};

export default IntensityColumn;