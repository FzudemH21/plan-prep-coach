import React, { useMemo } from 'react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { IntensityLevel } from '@/types/training';
import IntensityScale from './IntensityScale';
import MicrocycleIntensityColumn from './MicrocycleIntensityColumn';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { addDays } from 'date-fns';

interface SubGoal {
  testDates?: string[];
  description?: string;
  testMethod?: string;
  goal?: string;
}

interface Event {
  eventDates?: string[];
  name?: string;
}

interface TestDetail {
  name: string;
  goal?: string;
  dates: Date[];
}

interface EventDetail {
  name: string;
  dates: Date[];
}

interface MicrocycleIntensityPlanningProps {
  mesocycles: ExtendedMesocycle[];
  intensityLevels: IntensityLevel[];
  getIntensityColor: (intensity: IntensityLevel) => string;
  onMicrocycleIntensityChange: (mesocycleId: string, microcycleId: string, intensity: IntensityLevel) => void;
  onCopyMesocycle?: (mesocycleId: string) => void;
  subGoals?: SubGoal[];
  events?: Event[];
  planStartDate?: Date;
}

const MicrocycleIntensityPlanning: React.FC<MicrocycleIntensityPlanningProps> = ({
  mesocycles,
  intensityLevels,
  getIntensityColor,
  onMicrocycleIntensityChange,
  onCopyMesocycle,
  subGoals = [],
  events = [],
  planStartDate
}) => {
  // Calculate microcycle date ranges
  const microcycleDates = useMemo(() => {
    const dates = new Map<string, { start: Date; end: Date }>();
    let currentDate = planStartDate || new Date();
    
    mesocycles.forEach(meso => {
      meso.microcycles.forEach(micro => {
        const startDate = new Date(currentDate);
        const endDate = addDays(currentDate, micro.duration - 1);
        dates.set(micro.id, { start: startDate, end: endDate });
        currentDate = addDays(endDate, 1);
      });
    });
    
    return dates;
  }, [mesocycles, planStartDate]);

  // Get tests in date range with their names and individual dates
  const getTestsInRange = (start: Date, end: Date): TestDetail[] => {
    const testMap = new Map<string, { goal?: string; dates: Date[] }>();
    
    subGoals.forEach(sg => {
      const testName = sg.testMethod || sg.description || 'Test';
      sg.testDates?.forEach(td => {
        const testDate = new Date(td);
        if (testDate >= start && testDate <= end) {
          const existing = testMap.get(testName);
          if (existing) {
            existing.dates.push(testDate);
          } else {
            testMap.set(testName, { goal: sg.goal, dates: [testDate] });
          }
        }
      });
    });
    
    return Array.from(testMap.entries()).map(([name, data]) => ({ 
      name, 
      goal: data.goal,
      dates: data.dates.sort((a, b) => a.getTime() - b.getTime())
    }));
  };

  // Get events in date range with their names and individual dates
  const getEventsInRange = (start: Date, end: Date): EventDetail[] => {
    const eventMap = new Map<string, Date[]>();
    
    events.forEach(e => {
      const eventName = e.name || 'Event';
      e.eventDates?.forEach(ed => {
        const eventDate = new Date(ed);
        if (eventDate >= start && eventDate <= end) {
          const existing = eventMap.get(eventName);
          if (existing) {
            existing.push(eventDate);
          } else {
            eventMap.set(eventName, [eventDate]);
          }
        }
      });
    });
    
    return Array.from(eventMap.entries()).map(([name, dates]) => ({ 
      name, 
      dates: dates.sort((a, b) => a.getTime() - b.getTime())
    }));
  };
  
  return (
    <div className="space-y-4">
      {/* Horizontal scrollable grid */}
      <div className="w-full min-w-0 border rounded-lg">
        <div className="force-scrollbar-x overflow-y-hidden pb-4" style={{ scrollbarWidth: 'thin' }}>
          <div className="w-max p-4">
            {/* Mesocycle Headers */}
            <div className="flex mb-4">
              <div className="sticky left-0 bg-background z-20 w-[150px] shrink-0">
                <div className="text-sm font-semibold text-center py-2">Microcycle Intensity</div>
              </div>
              <div className="flex flex-nowrap">
                {mesocycles.map((meso, mesoIndex) => {
                  const width = meso.microcycles.length * 80; // 80px per microcycle
                  return meso.microcycles.length > 0 ? (
                    <div 
                      key={meso.id}
                      className={`relative text-center border-r-2 font-semibold border-r-slate-400 ${getIntensityColor(meso.intensity)} py-2 shrink-0`}
                      style={{ width: `${width}px` }}
                    >
                      {meso.name}
                      {mesoIndex > 0 && onCopyMesocycle && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyMesocycle(meso.id);
                          }}
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-white hover:bg-white/90 shadow-sm border border-border"
                          title="Copy intensity pattern from previous mesocycle"
                        >
                          <Copy className="h-3 w-3 text-foreground" />
                        </Button>
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
                      const dateRange = microcycleDates.get(micro.id);
                      const testDetails = dateRange ? getTestsInRange(dateRange.start, dateRange.end) : [];
                      const eventDetails = dateRange ? getEventsInRange(dateRange.start, dateRange.end) : [];
                      
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
                          testDetails={testDetails}
                          eventDetails={eventDetails}
                          startDate={dateRange?.start}
                          endDate={dateRange?.end}
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
        Click on any column to adjust the intensity for that microcycle. These intensities will be used in Step 2 for daily planning.
      </div>
    </div>
  );
};

export default MicrocycleIntensityPlanning;
