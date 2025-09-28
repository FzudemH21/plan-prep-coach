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
  // Calculate column height based on intensity level
  const calculateColumnHeight = (intensityLevel: IntensityLevel): number => {
    const intensityIndex = intensityLevels.indexOf(intensityLevel);
    if (intensityIndex === -1) return 10; // fallback for "off"
    
    // Map intensity levels to heights (10% to 100%)
    const heightMappings = {
      "off": 10,
      "deload": 15,
      "easy": 25,
      "easy-moderate": 40,
      "moderate": 55,
      "moderate-hard": 70,
      "hard": 85,
      "extremely-hard": 100
    };
    
    return heightMappings[intensityLevel] || 10;
  };

  const columnHeight = calculateColumnHeight(intensity);
  const maxHeight = 200; // Maximum height in pixels
  const actualHeight = (columnHeight / 100) * maxHeight;

  // Handle column click - cycle through intensity levels
  const handleColumnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Calculate which intensity level based on click position
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = rect.bottom - e.clientY; // Distance from bottom
    const clickPercentage = (clickY / rect.height) * 100;
    
    // Find the closest intensity level based on click position
    let targetIntensity: IntensityLevel = "off";
    
    if (clickPercentage >= 95) targetIntensity = "extremely-hard";
    else if (clickPercentage >= 80) targetIntensity = "hard";
    else if (clickPercentage >= 65) targetIntensity = "moderate-hard";
    else if (clickPercentage >= 50) targetIntensity = "moderate";
    else if (clickPercentage >= 35) targetIntensity = "easy-moderate";
    else if (clickPercentage >= 20) targetIntensity = "easy";
    else if (clickPercentage >= 10) targetIntensity = "deload";
    else targetIntensity = "off";
    
    onIntensityChange(day.date, targetIntensity);
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
    <div className={`flex flex-col items-center justify-end min-w-[80px] px-1 ${getBorderClasses()}`}>
      {/* Day header */}
      <div className={`text-center text-xs mb-2 p-1 rounded w-full ${
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
      
      {/* Column container */}
      <div 
        className="relative cursor-pointer transition-all duration-200 hover:shadow-md w-full"
        style={{ height: `${maxHeight}px` }}
        onClick={handleColumnClick}
      >
        {/* Background column (full height, light gray) */}
        <div 
          className="absolute bottom-0 w-full bg-gray-100 border border-gray-300 rounded-t"
          style={{ height: `${maxHeight}px` }}
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
      
      {/* Intensity label */}
      <div className="text-xs mt-1 text-center capitalize font-medium">
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