import React from 'react';
import { IntensityLevel } from '@/types/training';

interface IntensityScaleProps {
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
}

const IntensityScale: React.FC<IntensityScaleProps> = ({
  intensityLevels,
  getIntensityColor
}) => {
  const chartHeight = 200; // Match IntensityColumn height
  
  // Intensity levels with their positions (matching IntensityColumn)
  const intensityData = [
    { level: "extremely-hard", position: 87.5, label: "Extremely Hard" },
    { level: "hard", position: 75, label: "Hard" },
    { level: "moderate-hard", position: 62.5, label: "Moderate Hard" },
    { level: "moderate", position: 50, label: "Moderate" },
    { level: "easy-moderate", position: 37.5, label: "Easy Moderate" },
    { level: "easy", position: 25, label: "Easy" },
    { level: "deload", position: 12.5, label: "Deload" },
    { level: "off", position: 0, label: "Off" }
  ];

  return (
    <div className="flex flex-col items-end mr-4">
      {/* Scale header - spacer to align with day headers */}
      <div className="text-xs p-1 mb-2 h-[3.5rem] flex items-end justify-end">
        <span className="font-medium text-muted-foreground">Intensity</span>
      </div>
      
      {/* Scale container */}
      <div 
        className="relative w-24"
        style={{ height: `${chartHeight}px` }}
      >
        {/* Grid lines background */}
        {[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100].map((percentage) => (
          <div
            key={percentage}
            className="absolute w-full border-t border-border/20"
            style={{ 
              bottom: `${percentage}%`,
              borderStyle: percentage === 0 || percentage === 100 ? 'solid' : 'dashed'
            }}
          />
        ))}
        
        {/* Intensity level labels */}
        {intensityData.map((item) => (
          <div
            key={item.level}
            className="absolute right-0 flex items-center"
            style={{ bottom: `${item.position}%`, transform: 'translateY(50%)' }}
          >
            <span className="text-xs font-medium text-right pr-2 min-w-20">
              {item.label}
            </span>
            <div 
              className={`w-3 h-3 rounded-sm border ${getIntensityColor(item.level as IntensityLevel)}`}
            />
          </div>
        ))}
      </div>
      
      {/* Scale footer - spacer to align with intensity labels */}
      <div className="text-xs mt-2 h-4" />
    </div>
  );
};

export default IntensityScale;