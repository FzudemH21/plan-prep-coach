import React from 'react';
import { IntensityLevel } from '@/types/training';
import { Microcycle } from '@/features/planner/types';

interface MicrocycleIntensityColumnProps {
  microcycle: Microcycle;
  mesocycleId: string;
  intensity: IntensityLevel;
  onIntensityChange: (mesocycleId: string, microcycleId: string, intensity: IntensityLevel) => void;
  isLastMicrocycleOfMesocycle: boolean;
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
}

const MicrocycleIntensityColumn: React.FC<MicrocycleIntensityColumnProps> = ({
  microcycle,
  mesocycleId,
  intensity,
  onIntensityChange,
  isLastMicrocycleOfMesocycle,
  intensityLevels,
  getIntensityColor
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

  return (
    <div className={`flex flex-col w-20 box-border ${getBorderClasses()}`}>
      {/* Microcycle header */}
      <div className="relative h-16 text-center text-xs rounded w-full mb-2 flex flex-col items-center justify-center bg-primary/10">
        <div className="font-medium">{microcycle.name}</div>
        <div className="text-xs">{microcycle.duration}d</div>
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
      <div className="text-xs mt-2 text-center capitalize font-medium w-20 whitespace-nowrap overflow-hidden text-ellipsis">
        {intensity.replace('-', ' ')}
      </div>
    </div>
  );
};

export default MicrocycleIntensityColumn;
