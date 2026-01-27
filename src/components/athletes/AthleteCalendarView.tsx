import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Athlete, AthleteCalendarAssignment } from '@/types/athlete';
import { AssignProgramDialog } from './AssignProgramDialog';
import { useTrainingPrograms, TrainingProgram } from '@/hooks/useTrainingPrograms';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AthleteCalendarViewProps {
  athlete: Athlete;
}

// Color palette for assignments (will cycle through)
const ASSIGNMENT_COLORS = [
  'bg-blue-500/80 hover:bg-blue-500',
  'bg-green-500/80 hover:bg-green-500',
  'bg-purple-500/80 hover:bg-purple-500',
  'bg-orange-500/80 hover:bg-orange-500',
  'bg-pink-500/80 hover:bg-pink-500',
  'bg-cyan-500/80 hover:bg-cyan-500',
];

export function AthleteCalendarView({ athlete }: AthleteCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<AthleteCalendarAssignment | null>(null);
  
  const { programs } = useTrainingPrograms();
  const athleteData = useAthletes();
  
  const assignments = useMemo(() => {
    return athleteData.getAthleteCalendarAssignments(athlete.id);
  }, [athleteData, athlete.id]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Generate all dates for the calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  // Get assignments that overlap with a specific date
  const getAssignmentsForDate = (date: Date) => {
    return assignments.filter(assignment => {
      const start = new Date(assignment.startDate);
      const end = new Date(assignment.endDate);
      return isWithinInterval(date, { start, end });
    });
  };

  // Get color for an assignment
  const getAssignmentColor = (assignmentId: string) => {
    const index = assignments.findIndex(a => a.id === assignmentId);
    return ASSIGNMENT_COLORS[index % ASSIGNMENT_COLORS.length];
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
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

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg font-semibold min-w-[180px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => {
            setSelectedDate(new Date());
            setShowAssignDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Program
          </Button>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day Headers */}
            {weekDays.map(day => (
              <div 
                key={day} 
                className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            
            {/* Calendar Days */}
            {calendarDays.map((day, index) => {
              const dayAssignments = getAssignmentsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={index}
                  className={`
                    min-h-[100px] p-1 bg-background cursor-pointer transition-colors
                    hover:bg-muted/50
                    ${!isCurrentMonth ? 'bg-muted/30' : ''}
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  <div className={`
                    text-right text-sm p-1
                    ${!isCurrentMonth ? 'text-muted-foreground/50' : ''}
                    ${isToday ? 'bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center ml-auto' : ''}
                  `}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Assignment indicators */}
                  <div className="space-y-1 mt-1">
                    <TooltipProvider>
                      {dayAssignments.slice(0, 2).map(assignment => {
                        const isStart = isSameDay(new Date(assignment.startDate), day);
                        const isEnd = isSameDay(new Date(assignment.endDate), day);
                        
                        return (
                          <Tooltip key={assignment.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`
                                  text-xs text-white px-1 py-0.5 truncate cursor-pointer
                                  ${getAssignmentColor(assignment.id)}
                                  ${isStart ? 'rounded-l' : ''}
                                  ${isEnd ? 'rounded-r' : ''}
                                  ${!isStart && !isEnd ? '' : ''}
                                `}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteAssignment(assignment);
                                }}
                              >
                                {isStart ? assignment.programName : ''}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-medium">{assignment.programName}</p>
                                <p className="text-muted-foreground">
                                  {format(new Date(assignment.startDate), 'MMM d')} - {format(new Date(assignment.endDate), 'MMM d, yyyy')}
                                </p>
                                <p className="text-muted-foreground">
                                  {assignment.assignedMesocycles.length} mesocycle(s)
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                    {dayAssignments.length > 2 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayAssignments.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
                      <div className={`w-3 h-3 rounded-full ${getAssignmentColor(assignment.id).split(' ')[0]}`} />
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
