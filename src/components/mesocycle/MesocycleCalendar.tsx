import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mesocycle } from "@/types/training";
import { DayPicker, DayProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { addDays, format, isWithinInterval, startOfDay } from "date-fns";

interface MesocycleCalendarProps {
  mesocycles: Mesocycle[];
  startDate?: Date;
  showFullPlan?: boolean;
  totalWeeks?: number;
}

export default function MesocycleCalendar({ 
  mesocycles, 
  startDate = new Date(), 
  showFullPlan = false, 
  totalWeeks = 0 
}: MesocycleCalendarProps) {
  // Calculate dates for all mesocycles
  const calculateMesocycleDates = () => {
    let currentDate = startOfDay(startDate);
    
    return mesocycles.map((mesocycle) => {
      const start = new Date(currentDate);
      const end = addDays(currentDate, (mesocycle.duration * 7) - 1);
      
      // Move current date to start of next mesocycle
      currentDate = addDays(end, 1);
      
      return {
        ...mesocycle,
        startDate: start,
        endDate: end
      };
    });
  };

  const mesocyclesWithDates = calculateMesocycleDates();

  // Find which mesocycle a given date belongs to
  const getMesocycleForDate = (date: Date) => {
    return mesocyclesWithDates.find(meso => 
      isWithinInterval(date, { start: meso.startDate, end: meso.endDate })
    );
  };

  // Get week number within a mesocycle
  const getWeekInMesocycle = (date: Date, mesocycle: any) => {
    const daysDiff = Math.floor((date.getTime() - mesocycle.startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(daysDiff / 7) + 1;
  };

  // Get intensity color using design system tokens
  const getIntensityColorClass = (intensity: string) => {
    const colorMap = {
      "off": "bg-[hsl(var(--intensity-off))] text-[hsl(var(--intensity-foreground))]",
      "deload": "bg-[hsl(var(--intensity-deload))] text-[hsl(var(--intensity-foreground))]",
      "easy": "bg-[hsl(var(--intensity-easy))] text-[hsl(var(--intensity-foreground))]",
      "easy-moderate": "bg-[hsl(var(--intensity-easy-moderate))] text-[hsl(var(--intensity-foreground))]",
      "moderate": "bg-[hsl(var(--intensity-moderate))] text-[hsl(var(--intensity-foreground))]",
      "moderate-hard": "bg-[hsl(var(--intensity-moderate-hard))] text-[hsl(var(--intensity-foreground))]",
      "hard": "bg-[hsl(var(--intensity-hard))] text-[hsl(var(--intensity-foreground))]",
      "extremely-hard": "bg-[hsl(var(--intensity-extremely-hard))] text-[hsl(var(--intensity-foreground))]"
    };
    return colorMap[intensity as keyof typeof colorMap] || "bg-muted text-muted-foreground";
  };

  // Filter out weeks with no training
  const getTrainingWeeks = () => {
    if (mesocyclesWithDates.length === 0) return [];
    
    const trainingWeeks = [];
    for (const meso of mesocyclesWithDates) {
      if (meso.intensity !== "off") {
        trainingWeeks.push({
          start: meso.startDate,
          end: meso.endDate
        });
      }
    }
    return trainingWeeks;
  };

  // Custom day component
  const CustomDay = ({ date, ...props }: DayProps) => {
    const mesocycle = getMesocycleForDate(date);
    const weekNumber = mesocycle ? getWeekInMesocycle(date, mesocycle) : null;
    
    return (
      <div 
        className={cn(
          "relative w-full h-16 p-1 rounded border cursor-default",
          mesocycle 
            ? getIntensityColorClass(mesocycle.intensity)
            : "bg-background border-border text-foreground"
        )}
      >
        <div className="text-xs font-medium">
          {format(date, 'd')}
        </div>
        {mesocycle && (
          <div className="absolute inset-x-0 bottom-0 p-1">
            <div className="text-[10px] font-medium truncate">
              {mesocycle.name}
            </div>
            <div className="text-[9px] opacity-75">
              W{weekNumber}
            </div>
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
          <h4 className="text-sm font-medium">Mesocycle Legend</h4>
          <div className="flex flex-wrap gap-2">
            {mesocyclesWithDates.map((meso, index) => (
              <Badge 
                key={meso.id}
                variant="outline" 
                className={cn("text-xs", getIntensityColorClass(meso.intensity))}
              >
                {meso.name} ({meso.duration}w)
              </Badge>
            ))}
          </div>
        </div>

        {/* Calendar */}
        {mesocycles.length > 0 && (
          <div className="w-full overflow-x-auto">
            <DayPicker
              mode="range"
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
              className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              modifiersClassNames={{
                selected: "",
                today: "ring-2 ring-primary"
              }}
              disabled={(date) => {
                // Hide days that are not part of any mesocycle
                return !getMesocycleForDate(date);
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