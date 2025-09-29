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
  
  // Intensity levels centered within their grid bands
  const intensityData = [
    { level: "extremely-hard", position: 81.25, label: "Extremely Hard" }, // Centered between 75-87.5
    { level: "hard", position: 68.75, label: "Hard" }, // Centered between 62.5-75
    { level: "moderate-hard", position: 56.25, label: "Moderate Hard" }, // Centered between 50-62.5
    { level: "moderate", position: 43.75, label: "Moderate" }, // Centered between 37.5-50
    { level: "easy-moderate", position: 31.25, label: "Easy Moderate" }, // Centered between 25-37.5
    { level: "easy", position: 18.75, label: "Easy" }, // Centered between 12.5-25
    { level: "deload", position: 6.25, label: "Deload" }, // Centered between 0-12.5
    { level: "off", position: 0, label: "Off" } // Keep at bottom
  ];

  return (
    <div className="w-[140px] flex flex-col items-end">
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