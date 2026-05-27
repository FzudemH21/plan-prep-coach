import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mesocycle } from "@/types/training";
import { DayPicker, DayProps } from "react-day-picker";
import { addDays, format, isWithinInterval, startOfDay } from "date-fns";
import { Trophy, CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { getBorgBg, getBorgFg, migrateLegacyIntensity } from "@/utils/intensityScale";

interface SubGoal {
  testDates?: string[];
  testMethod?: string;
  description?: string;
}

interface Event {
  eventDates?: string[];
  name?: string;
}

interface MesocycleCalendarProps {
  mesocycles: Mesocycle[];
  startDate?: Date;
  showFullPlan?: boolean;
  totalWeeks?: number;
  subGoals?: SubGoal[];
  events?: Event[];
  athleteId?: string;
}

export default function MesocycleCalendar({
  mesocycles,
  startDate = new Date(),
  showFullPlan = false,
  totalWeeks = 0,
  subGoals = [],
  events = [],
  athleteId,
}: MesocycleCalendarProps) {
  const { getEventsForDate: getCalendarEventsForDate } = useCalendarEvents();
  // Calculate dates for all mesocycles and their microcycles
  const calculateMesocycleDates = () => {
    let currentDate = startOfDay(startDate);
    
    return mesocycles.map((mesocycle) => {
      const mesoStartDate = new Date(currentDate);
      let mesoCurrentDate = new Date(currentDate);
      
      // Calculate microcycle dates
      const microcyclesWithDates = (mesocycle.microcycles || []).map((microcycle) => {
        const microStartDate = new Date(mesoCurrentDate);
        const microEndDate = addDays(mesoCurrentDate, microcycle.duration - 1);
        
        // Move to next microcycle
        mesoCurrentDate = addDays(microEndDate, 1);
        
        return {
          ...microcycle,
          startDate: microStartDate,
          endDate: microEndDate
        };
      });
      
      // Calculate total mesocycle duration
      const totalDays = (mesocycle.microcycles || []).reduce((sum, micro) => sum + micro.duration, 0);
      const mesoEndDate = addDays(mesoStartDate, totalDays - 1);
      
      // Move current date to start of next mesocycle
      currentDate = addDays(mesoEndDate, 1);
      
      return {
        ...mesocycle,
        startDate: mesoStartDate,
        endDate: mesoEndDate,
        microcyclesWithDates
      };
    });
  };

  const mesocyclesWithDates = calculateMesocycleDates();

  // Find which mesocycle and microcycle a given date belongs to
  const getMesocycleForDate = (date: Date) => {
    return mesocyclesWithDates.find(meso => 
      isWithinInterval(date, { start: meso.startDate, end: meso.endDate })
    );
  };

  // Get microcycle for a specific date
  const getMicrocycleForDate = (date: Date, mesocycle: any) => {
    if (!mesocycle?.microcyclesWithDates) return null;
    
    return mesocycle.microcyclesWithDates.find((micro: any) => 
      isWithinInterval(date, { start: micro.startDate, end: micro.endDate })
    );
  };

  // Get intensity style using Borg CR10 scale
  const getIntensityStyle = (intensity: string): React.CSSProperties => {
    const level = migrateLegacyIntensity(intensity);
    return { backgroundColor: getBorgBg(level), color: getBorgFg(level) };
  };

  // Filter out weeks with no training
  const getTrainingWeeks = () => {
    if (mesocyclesWithDates.length === 0) return [];
    
    const trainingWeeks = [];
    for (const meso of mesocyclesWithDates) {
      if (migrateLegacyIntensity(meso.intensity) !== "0") {
        trainingWeeks.push({
          start: meso.startDate,
          end: meso.endDate
        });
      }
    }
    return trainingWeeks;
  };

  // Get tests for a specific date (combines legacy subGoals + new calendarEvents)
  const getTestsForDate = (date: Date): string[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const legacy = (subGoals || [])
      .filter(sg => sg.testDates?.some(td => td.startsWith(dateStr)))
      .map(sg => sg.testMethod || sg.description || 'Test');
    const fromCalendar = athleteId
      ? getCalendarEventsForDate(athleteId, dateStr)
          .filter(e => e.type === 'test')
          .map(e => e.title)
      : [];
    return [...legacy, ...fromCalendar];
  };

  // Get events for a specific date (combines legacy events + new calendarEvents)
  const getEventsForDate = (date: Date): string[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const legacy = (events || [])
      .filter(e => e.eventDates?.some(ed => ed.startsWith(dateStr)))
      .map(e => e.name || 'Event');
    const fromCalendar = athleteId
      ? getCalendarEventsForDate(athleteId, dateStr)
          .filter(e => e.type === 'event')
          .map(e => e.title)
      : [];
    return [...legacy, ...fromCalendar];
  };

  // Custom day component
  const CustomDay = ({ date, displayMonth }: DayProps) => {
    // Hide outside days (days from adjacent months) - check if date's month matches displayMonth
    const isOutsideDay = date.getMonth() !== displayMonth.getMonth();
    if (isOutsideDay) {
      return <div className="w-full h-16" />;
    }

    const mesocycle = getMesocycleForDate(date);
    const microcycle = mesocycle ? getMicrocycleForDate(date, mesocycle) : null;
    const testsOnDate = getTestsForDate(date);
    const eventsOnDate = getEventsForDate(date);
    
    return (
      <div
        className="relative w-full h-16 p-1 rounded border cursor-default"
        style={mesocycle ? getIntensityStyle(mesocycle.intensity) : undefined}
      >
        <div className="flex justify-between items-start">
          <div className="text-xs font-medium">
            {format(date, 'd')}
          </div>
          {/* Test/Event indicators - gray badge with black outline */}
          {(testsOnDate.length > 0 || eventsOnDate.length > 0) && (
            <div className="flex gap-0.5">
              {testsOnDate.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-pointer">
                      <Badge variant="secondary" className="h-4 px-1 text-xs">
                        <Trophy className="h-2.5 w-2.5" />
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Tests:</p>
                      {testsOnDate.map((test, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">• {test}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {eventsOnDate.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-pointer">
                      <Badge variant="secondary" className="h-4 px-1 text-xs">
                        <CalendarDays className="h-2.5 w-2.5" />
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Events:</p>
                      {eventsOnDate.map((event, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground">• {event}</div>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
        {mesocycle && (
          <div className="absolute inset-x-0 bottom-0 p-1">
            <div className="text-[10px] font-medium truncate">
              {mesocycle.name}
            </div>
            {microcycle && (
              <div className="text-[9px] opacity-75">
                {microcycle.name || 'Mic1'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Calculate the date range to display
  const lastMesocycle = mesocyclesWithDates[mesocyclesWithDates.length - 1];
  const endDate = lastMesocycle ? lastMesocycle.endDate : addDays(startDate, 28);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {showFullPlan ? "Full Training Plan Calendar" : "Mesocycle Calendar"}
        </CardTitle>
        <CardDescription>
          {showFullPlan 
            ? `Complete ${totalWeeks}-week training plan overview with mesocycle breakdown`
            : "Visual timeline showing all mesocycles with their durations and intensities"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Legend */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Legend</h4>
          <div className="flex flex-wrap gap-3 items-center">
            {mesocyclesWithDates.map((meso) => (
              <Badge
                key={meso.id}
                variant="outline"
                className="text-xs"
                style={getIntensityStyle(meso.intensity)}
              >
                {meso.name} ({meso.duration}w)
              </Badge>
            ))}
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="h-4 px-1 text-xs">
                <Trophy className="h-2.5 w-2.5" />
              </Badge>
              <span>Test Day</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="h-4 px-1 text-xs">
                <CalendarDays className="h-2.5 w-2.5" />
              </Badge>
              <span>Event Day</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        {mesocycles.length > 0 && (
          <div className="w-full overflow-x-auto">
            <DayPicker
              mode="range"
              showOutsideDays={false}
              selected={{
                from: startDate,
                to: endDate
              }}
              month={startDate}
              weekStartsOn={1}
              numberOfMonths={showFullPlan 
                ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
                : Math.min(3, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
              }
              components={{
                Day: CustomDay
              }}
              className="pointer-events-auto"
              classNames={{
                months: "flex flex-row space-x-4 overflow-x-auto",
                month: "space-y-4 flex-shrink-0",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-16 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "relative w-16 h-16 text-center text-sm p-0"
              }}
              modifiersClassNames={{
                selected: "",
                today: "ring-2 ring-primary"
              }}
              disabled={(date) => {
                // Hide days that are not part of any mesocycle or are "off" days
                const mesocycle = getMesocycleForDate(date);
                return !mesocycle || migrateLegacyIntensity(mesocycle.intensity) === "0";
              }}
            />
          </div>
        )}

        {/* Summary */}
        {mesocyclesWithDates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Total Duration:</span>{" "}
                {mesocyclesWithDates.reduce((sum, meso) => sum + meso.duration, 0)} weeks
              </div>
              <div>
                <span className="text-muted-foreground">Start Date:</span>{" "}
                {format(startDate, 'MMM d, yyyy')}
              </div>
              <div>
                <span className="text-muted-foreground">End Date:</span>{" "}
                {format(endDate, 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}