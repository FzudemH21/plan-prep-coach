import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameMonth, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Athlete, AthleteCalendarAssignment } from '@/types/athlete';
import { AssignProgramDialog } from './AssignProgramDialog';
import { useTrainingPrograms } from '@/hooks/useTrainingPrograms';
import { useAthletes } from '@/hooks/useAthletes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AthleteCalendarWeekRow } from './AthleteCalendarWeekRow';
import { AthleteCalendarDay, AthleteCalendarSession } from './AthleteCalendarDayCell';
import { cn } from '@/lib/utils';

interface AthleteCalendarViewProps {
  athlete: Athlete;
}

type ViewMode = '1week' | '2week' | '4week';

// Intensity color helper matching the training calendar
const getIntensityColor = (intensity: string): string => {
  switch (intensity) {
    case 'off': return 'bg-gray-200';
    case 'deload': return 'bg-blue-200';
    case 'easy': return 'bg-green-300';
    case 'easy-moderate': return 'bg-green-400';
    case 'moderate': return 'bg-yellow-300';
    case 'moderate-hard': return 'bg-orange-400';
    case 'hard': return 'bg-red-400';
    case 'extremely-hard': return 'bg-red-600';
    default: return 'bg-gray-200';
  }
};

export function AthleteCalendarView({ athlete }: AthleteCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('4week');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<AthleteCalendarAssignment | null>(null);

  const { programs } = useTrainingPrograms();
  const athleteData = useAthletes();

  const assignments = useMemo(() => {
    return athleteData.getAthleteCalendarAssignments(athlete.id);
  }, [athleteData, athlete.id]);

  // Calculate calendar days based on view mode
  const calendarDays = useMemo((): AthleteCalendarDay[] => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    let end: Date;

    switch (viewMode) {
      case '1week':
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case '2week':
        end = endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 1 });
        break;
      case '4week':
      default:
        end = endOfWeek(addWeeks(currentDate, 3), { weekStartsOn: 1 });
        break;
    }

    const days = eachDayOfInterval({ start, end });

    return days.map(date => {
      const dateString = format(date, 'yyyy-MM-dd');

      // Find assignments that overlap with this date
      const dayAssignments = assignments.filter(assignment => {
        const assignmentStart = new Date(assignment.startDate);
        const assignmentEnd = new Date(assignment.endDate);
        return isWithinInterval(date, { start: assignmentStart, end: assignmentEnd });
      });

      // Extract session data from assignments for this specific day
      const sessions: AthleteCalendarSession[] = [];
      let testNames: string[] = [];
      let eventNames: string[] = [];
      let assignmentId: string | undefined;
      let programName: string | undefined;

      dayAssignments.forEach(assignment => {
        assignmentId = assignment.id;
        programName = assignment.programName;

        // Calculate which day within the assignment this is
        const assignmentStart = new Date(assignment.startDate);
        const dayOffset = Math.floor((date.getTime() - assignmentStart.getTime()) / (1000 * 60 * 60 * 24));

        // Find the corresponding mesocycle and microcycle
        let currentOffset = 0;
        for (const meso of assignment.assignedMesocycles) {
          const mesoStart = new Date(meso.startDate);
          const mesoEnd = new Date(meso.endDate);
          
          if (date >= mesoStart && date <= mesoEnd) {
            // This day is within this mesocycle
            const dayWithinMeso = Math.floor((date.getTime() - mesoStart.getTime()) / (1000 * 60 * 60 * 24));
            
            // Find which microcycle this day belongs to
            let microOffset = 0;
            for (const micro of meso.microcycles) {
              if (dayWithinMeso >= microOffset && dayWithinMeso < microOffset + micro.duration) {
                // This day is within this microcycle
                const dayWithinMicro = dayWithinMeso - microOffset;
                
                // Create a session for this day (simplified - assumes one session per day)
                // In reality, you'd parse the full session data from the assignment
                const sessionId = `${assignment.id}-${dateString}-0`;
                sessions.push({
                  id: sessionId,
                  sessionIndex: 0,
                  sessionName: `${meso.name} - Day ${dayWithinMicro + 1}`,
                  exerciseCount: Math.floor(Math.random() * 8) + 3, // Placeholder - would come from actual data
                  intensity: meso.intensity || 'moderate',
                });
                break;
              }
              microOffset += micro.duration;
            }
            break;
          }
          currentOffset += meso.duration;
        }
      });

      return {
        date,
        dateString,
        isCurrentMonth: isSameMonth(date, currentDate),
        sessions,
        testNames: testNames.length > 0 ? testNames : undefined,
        eventNames: eventNames.length > 0 ? eventNames : undefined,
        assignmentId,
        programName,
      };
    });
  }, [currentDate, viewMode, assignments]);

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: AthleteCalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Calculate date range display
  const dateRangeDisplay = useMemo(() => {
    if (calendarDays.length === 0) return '';
    const firstDay = calendarDays[0].date;
    const lastDay = calendarDays[calendarDays.length - 1].date;
    return `${format(firstDay, 'MMM d')} - ${format(lastDay, 'MMM d, yyyy')}`;
  }, [calendarDays]);

  const handlePrevious = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const handleNext = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setShowAssignDialog(true);
  };

  const handleAssignProgram = (assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => {
    athleteData.createCalendarAssignment(athlete.id, assignment);
    setShowAssignDialog(false);
    setSelectedDate(null);
  };

  const handleDeleteAssignment = () => {
    if (deleteAssignment) {
      athleteData.deleteCalendarAssignment(deleteAssignment.id);
      setDeleteAssignment(null);
    }
  };

  const handleDeleteAssignmentById = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) {
      setDeleteAssignment(assignment);
    }
  };

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          {/* Navigation and Controls Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <span className="text-sm font-medium text-muted-foreground ml-2">
                {dateRangeDisplay}
              </span>
            </div>

            {/* Center: View Mode Selector */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(['1week', '2week', '4week'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                  className="h-7 px-3 text-xs"
                >
                  {mode === '1week' ? '1 Week' : mode === '2week' ? '2 Week' : '4 Week'}
                </Button>
              ))}
            </div>

            {/* Right: Assign Program Button */}
            <Button
              onClick={() => {
                setSelectedDate(new Date());
                setShowAssignDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Program
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDayHeaders.map(day => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Week Rows */}
          <div className="space-y-6">
            {weeks.map((week, idx) => (
              <AthleteCalendarWeekRow
                key={`week-${idx}`}
                week={week}
                weekIdx={idx}
                onDayClick={handleDayClick}
                onDeleteAssignment={handleDeleteAssignmentById}
                getIntensityColor={getIntensityColor}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignments
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium">{assignment.programName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(assignment.startDate), 'MMM d, yyyy')} - {format(new Date(assignment.endDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {assignment.assignedMesocycles.length} mesocycle(s)
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteAssignment(assignment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Program Dialog */}
      <AssignProgramDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        programs={programs}
        selectedDate={selectedDate || new Date()}
        onAssign={handleAssignProgram}
        athleteId={athlete.id}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAssignment} onOpenChange={() => setDeleteAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteAssignment?.programName}" from the calendar?
              This will not delete the original training program.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
