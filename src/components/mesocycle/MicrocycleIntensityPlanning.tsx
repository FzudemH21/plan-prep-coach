import React from 'react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { IntensityLevel } from '@/types/training';
import IntensityScale from './IntensityScale';
import MicrocycleIntensityColumn from './MicrocycleIntensityColumn';
import { TooltipProvider } from '@/components/ui/tooltip';


interface MicrocycleIntensityPlanningProps {
  mesocycles: ExtendedMesocycle[];
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
  onMicrocycleIntensityChange: (mesocycleId: string, microcycleId: string, intensity: IntensityLevel) => void;
  onCopyMesocycle?: (mesocycleId: string) => void;
}

const MicrocycleIntensityPlanning: React.FC<MicrocycleIntensityPlanningProps> = ({
  mesocycles,
  intensityLevels,
  getIntensityColor,
  onMicrocycleIntensityChange,
  onCopyMesocycle
}) => {
  return (
    <div className="space-y-4">
      {/* Horizontal scrollable grid */}
      <div className="w-full min-w-0 border rounded-lg">
        <div className="force-scrollbar-x overflow-y-hidden" style={{ scrollbarWidth: 'thin', maxHeight: '400px' }}>
          <div className="w-max p-4">
            {/* Mesocycle Headers */}
            <div className="flex mb-4">
              <div className="sticky left-0 bg-background z-20 min-w-[140px] mr-4 shrink-0">
                <div className="text-sm font-semibold text-center py-2">Microcycle Intensity</div>
              </div>
              <div className="flex flex-nowrap">
                {mesocycles.map((meso) => {
                  const width = meso.microcycles.length * 80; // 80px per microcycle
                  return meso.microcycles.length > 0 ? (
                    <div 
                      key={meso.id}
                      className={`relative text-center border-r-2 font-semibold border-r-slate-400 ${getIntensityColor(meso.intensity)} py-2 shrink-0`}
                      style={{ width: `${width}px` }}
                    >
                      {meso.name}
                      {onCopyMesocycle && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyMesocycle(meso.id);
                          }}
                          className="absolute top-1 right-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                          title="Copy from previous mesocycle"
                        >
                          📋
                        </button>
                      )}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Column Chart */}
            <div className="flex items-end">
              {/* Intensity Scale - Sticky */}
              <div className="sticky left-0 z-30 bg-background shrink-0">
                <IntensityScale
                  intensityLevels={intensityLevels}
                  getIntensityColor={getIntensityColor}
                />
              </div>

              {/* Microcycle Columns */}
              <TooltipProvider>
                <div className="flex items-end flex-nowrap">
                  {mesocycles.map((meso) => {
                    return meso.microcycles.map((micro, microIndex) => {
                      const isLastMicrocycle = microIndex === meso.microcycles.length - 1;
                      
                      return (
                        <MicrocycleIntensityColumn
                          key={micro.id}
                          microcycle={micro}
                          mesocycleId={meso.id}
                          intensity={micro.intensity}
                          onIntensityChange={onMicrocycleIntensityChange}
                          isLastMicrocycleOfMesocycle={isLastMicrocycle}
                          intensityLevels={intensityLevels}
                          getIntensityColor={getIntensityColor}
                        />
                      );
                    });
                  })}
                </div>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Click on any column to adjust the intensity for that microcycle. These intensities are reflected from Step 1 and will be used in Step 3 for daily planning.
      </div>
    </div>
  );
};

export default MicrocycleIntensityPlanning;
