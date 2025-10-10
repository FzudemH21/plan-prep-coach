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
  
  // Intensity levels as full bands
  const intensityData = [
    { level: "extremely-hard", bottom: 87.5, top: 100, label: "Extremely Hard" },
    { level: "hard", bottom: 75, top: 87.5, label: "Hard" },
    { level: "moderate-hard", bottom: 62.5, top: 75, label: "Moderate Hard" },
    { level: "moderate", bottom: 50, top: 62.5, label: "Moderate" },
    { level: "easy-moderate", bottom: 37.5, top: 50, label: "Easy Moderate" },
    { level: "easy", bottom: 25, top: 37.5, label: "Easy" },
    { level: "deload", bottom: 12.5, top: 25, label: "Deload" },
    { level: "off", bottom: 0, top: 12.5, label: "Off" }
  ];

  return (
    <div className="w-[150px] flex flex-col items-end bg-background">
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
        
        {/* Intensity level bands */}
        {intensityData.map((item) => (
          <div
            key={item.level}
            className="absolute right-0 flex items-center"
            style={{ 
              bottom: `${item.bottom}%`, 
              height: `${item.top - item.bottom}%`
            }}
          >
            <span className="text-xs font-medium text-right pr-2 w-28 text-foreground whitespace-nowrap">
              {item.label}
            </span>
            <div 
              className={`w-6 h-full ${getIntensityColor(item.level as IntensityLevel)} flex items-center justify-center`}
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