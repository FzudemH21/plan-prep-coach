import React from 'react';
import { IntensityLevel } from '@/types/training';
import { TrainingDay } from '@/types/daily-intensity';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface IntensityColumnProps {
  day: TrainingDay;
  intensity: IntensityLevel;
  onIntensityChange: (date: string, intensity: IntensityLevel) => void;
  tooltipContent?: string;
  isLastDayOfMicrocycle: boolean;
  isLastDayOfMesocycle: boolean;
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
}

const IntensityColumn: React.FC<IntensityColumnProps> = ({
  day,
  intensity,
  onIntensityChange,
  tooltipContent,
  isLastDayOfMicrocycle,
  isLastDayOfMesocycle,
  intensityLevels,
  getIntensityColor
}) => {
  const chartHeight = 200; // Fixed chart area height
  
  // Calculate column height based on intensity level
  const calculateColumnHeight = (intensityLevel: IntensityLevel): number => {
    // Map intensity levels to heights that align with grid (0% to 100%)
    const heightMappings = {
      "off": 0,
      "deload": 12.5,
      "easy": 25,
      "easy-moderate": 37.5,
      "moderate": 50,
      "moderate-hard": 62.5,
      "hard": 75,
      "extremely-hard": 87.5
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
    
    // Map click position to intensity levels based on grid lines
    let targetIntensity: IntensityLevel = "off";
    
    if (clickPercentage >= 81.25) targetIntensity = "extremely-hard"; // 87.5% midpoint
    else if (clickPercentage >= 68.75) targetIntensity = "hard"; // 75% midpoint  
    else if (clickPercentage >= 56.25) targetIntensity = "moderate-hard"; // 62.5% midpoint
    else if (clickPercentage >= 43.75) targetIntensity = "moderate"; // 50% midpoint
    else if (clickPercentage >= 31.25) targetIntensity = "easy-moderate"; // 37.5% midpoint
    else if (clickPercentage >= 18.75) targetIntensity = "easy"; // 25% midpoint
    else if (clickPercentage >= 6.25) targetIntensity = "deload"; // 12.5% midpoint
    else targetIntensity = "off";
    
    onIntensityChange(day.date, targetIntensity);
  };

  // Generate horizontal grid lines
  const generateGridLines = () => {
    const gridPercentages = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
    return gridPercentages.map((percentage, index) => (
      <div
        key={percentage}
        className="absolute w-full border-t border-border/20"
        style={{ 
          bottom: `${percentage}%`,
          borderStyle: percentage === 0 || percentage === 100 ? 'solid' : 'dashed'
        }}
      />
    ));
  };

  // Get border classes for microcycle/mesocycle boundaries
  const getBorderClasses = () => {
    let borderClasses = 'border-r border-r-slate-200';
    
    if (isLastDayOfMesocycle) {
      borderClasses = 'border-r-2 border-r-slate-400';
    } else if (isLastDayOfMicrocycle) {
      borderClasses = 'border-r-2 border-r-slate-300';
    }
    
    return borderClasses;
  };

  const columnElement = (
    <div className={`flex flex-col min-w-[80px] px-1 ${getBorderClasses()}`}>
      {/* Fixed Day header - always at top */}
      <div className={`text-center text-xs p-1 rounded w-full mb-2 ${
        day.isTestDay ? 'bg-blue-100 border border-blue-300' : 
        day.isEventDay ? 'bg-orange-100 border border-orange-300' : 'bg-primary/10'
      }`}>
        <div className="font-medium">{format(new Date(day.date), 'MMM d')}</div>
        <div className="text-xs">{day.dayName}</div>
        {day.isTestDay && (
          <div className="text-xs font-semibold text-blue-700 bg-blue-200 rounded px-1 mt-1">
            TEST
          </div>
        )}
        {day.isEventDay && (
          <div className="text-xs font-semibold text-orange-700 bg-orange-200 rounded px-1 mt-1">
            EVENT
          </div>
        )}
      </div>
      
      {/* Fixed Chart container with grid */}
      <div 
        className="relative cursor-pointer transition-all duration-200 hover:shadow-md w-full"
        style={{ height: `${chartHeight}px` }}
        onClick={handleColumnClick}
      >
        {/* Grid lines */}
        {generateGridLines()}
        
        {/* Background column (full height, light gray) */}
        <div 
          className="absolute bottom-0 w-full bg-muted/30 border border-border rounded-t"
          style={{ height: `${chartHeight}px` }}
        />
        
        {/* Intensity column */}
        <div 
          className={`absolute bottom-0 w-full rounded-t transition-all duration-300 border-2 ${getIntensityColor(intensity)} ${
            day.isTestDay ? 'border-blue-400' :
            day.isEventDay ? 'border-orange-400' : 'border-transparent'
          }`}
          style={{ height: `${actualHeight}px` }}
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-t" />
      </div>
      
      {/* Fixed Intensity label - always at bottom */}
      <div className="text-xs mt-2 text-center capitalize font-medium">
        {intensity.replace('-', ' ')}
      </div>
    </div>
  );

  // Wrap with tooltip if there are tests or events
  if (tooltipContent) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">
            {columnElement}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="whitespace-pre-line">
            {tooltipContent}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return columnElement;
};

export default IntensityColumn;