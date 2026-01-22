import React from 'react';
import { IntensityLevel } from '@/types/training';
import { Microcycle } from '@/features/planner/types';
import { Trophy, CalendarDays } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
  testDetails?: TestDetail[];
  eventDetails?: EventDetail[];
  startDate?: Date;
  endDate?: Date;
}

// Helper to get subtle intensity-tinted background (same color, transparent)
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

const MicrocycleIntensityColumn: React.FC<MicrocycleIntensityColumnProps> = ({
  microcycle,
  mesocycleId,
  intensity,
  onIntensityChange,
  isLastMicrocycleOfMesocycle,
  intensityLevels,
  getIntensityColor,
  testDetails = [],
  eventDetails = [],
  startDate,
  endDate
}) => {
  const chartHeight = 200; // Fixed chart area height
  
  // Calculate column height based on intensity level (full band heights)
  const calculateColumnHeight = (intensityLevel: IntensityLevel): number => {
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
    
    onIntensityChange(mesocycleId, microcycle.id, targetIntensity);
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

  // Get border classes for mesocycle boundaries
  const getBorderClasses = () => {
    let borderClasses = 'border-r border-border/60'; // Default microcycle border
    
    if (isLastMicrocycleOfMesocycle) {
      borderClasses = 'border-r-4 border-border/80';
    }
    
    return borderClasses;
  };

  const hasIcons = testDetails.length > 0 || eventDetails.length > 0;

  return (
    <div className={cn("flex flex-col w-[120px] shrink-0 box-border border-l border-border/40", getBorderClasses())}>
      {/* Microcycle header */}
      <div className={cn("h-24 text-center text-xs rounded-md border border-border w-full mb-2 flex flex-col p-1", getSubtleIntensityBg(intensity))}>
        {/* Content wrapper - vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Microcycle name */}
          <div className="font-medium truncate w-full px-1" title={microcycle.name}>{microcycle.name}</div>
          
          {/* Date range with duration */}
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
        
        {/* Icons row - always at bottom when present */}
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
                          {test.dates.map(d => format(d, 'MMM d')).join(', ')}
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
                          {event.dates.map(d => format(d, 'MMM d')).join(', ')}
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
          className={`absolute bottom-0 w-full rounded-t transition-all duration-300 border-2 border-transparent z-20 ${getIntensityColor(intensity)}`}
          style={{ height: `${actualHeight}px` }}
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-t z-30" />
      </div>
      
      {/* Fixed Intensity label - prevent width changes */}
      <div className="text-xs mt-2 text-center capitalize font-medium w-[120px] whitespace-nowrap overflow-hidden text-ellipsis">
        {intensity.replace('-', ' ')}
      </div>
    </div>
  );
};

export default MicrocycleIntensityColumn;
