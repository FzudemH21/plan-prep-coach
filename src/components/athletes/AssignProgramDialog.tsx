import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AlertTriangle, CalendarIcon, ChevronDown, ChevronRight, Plus, Trophy, X } from 'lucide-react';
import { TrainingProgram } from '@/hooks/useTrainingPrograms';
import { AthleteCalendarAssignment, AssignedMesocycle, AssignedMicrocycle, AthletePerformanceParameter, ReviewedSubGoal, ReviewedEvent } from '@/types/athlete';
import { SubGoal, Event as TrainingEvent } from '@/types/training';
import { recalculateMesocycleDates } from '@/utils/dateShifting';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AssignProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: TrainingProgram[];
  selectedDate: Date;
  onAssign: (assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'>) => void;
  athleteId: string;
  athletePerformanceParameters?: AthletePerformanceParameter[];
}

export function AssignProgramDialog({
  open,
  onOpenChange,
  programs,
  selectedDate,
  onAssign,
  athleteId,
  athletePerformanceParameters = [],
}: AssignProgramDialogProps) {
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [selectedMesocycleIds, setSelectedMesocycleIds] = useState<string[]>([]);
  const [selectedMicrocycleIds, setSelectedMicrocycleIds] = useState<string[]>([]);
  const [expandedMesocycles, setExpandedMesocycles] = useState<string[]>([]);
  const [reviewedSubGoals, setReviewedSubGoals] = useState<ReviewedSubGoal[]>([]);
  const [reviewedEvents, setReviewedEvents] = useState<ReviewedEvent[]>([]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setStartDate(selectedDate);
      setSelectedProgramId('');
      setSelectedMesocycleIds([]);
      setSelectedMicrocycleIds([]);
      setExpandedMesocycles([]);
      setReviewedSubGoals([]);
      setReviewedEvents([]);
    }
  }, [open, selectedDate]);

  // Get selected program
  const selectedProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId);
  }, [programs, selectedProgramId]);

  // Parse mesocycles from program data
  const programMesocycles = useMemo((): AssignedMesocycle[] => {
    if (!selectedProgram?.mesocycleData) return [];
    
    // Handle both formats: direct array or { mesocycles: [...] } object
    const mesoData = Array.isArray(selectedProgram.mesocycleData) 
      ? selectedProgram.mesocycleData 
      : selectedProgram.mesocycleData.mesocycles;
      
    if (!Array.isArray(mesoData)) return [];
    
    return mesoData.map((meso: any, index: number) => ({
      id: meso.id || `meso-${index}`,
      name: meso.name || `Mesocycle ${index + 1}`,
      startDate: meso.startDate || new Date().toISOString(),
      endDate: meso.endDate || new Date().toISOString(),
      weeks: meso.weeks || Math.ceil((meso.duration || 7) / 7),
      duration: meso.duration || 7,
      intensity: meso.intensity || 'moderate',
      sessionsPerWeek: meso.sessionsPerWeek || 3,
      sessionLength: meso.sessionLength || 60,
      trainingQualities: meso.trainingQualities || [],
      allocatedSubGoals: meso.allocatedSubGoals || [],
      microcycles: (meso.microcycles || []).map((micro: any, mIndex: number) => ({
        id: micro.id || `micro-${index}-${mIndex}`,
        name: micro.name || `Week ${mIndex + 1}`,
        duration: micro.duration || 7,
        intensity: micro.intensity || 'moderate',
      })),
    }));
  }, [selectedProgram]);

  // When program changes, select all mesocycles and microcycles by default
  useEffect(() => {
    if (programMesocycles.length > 0) {
      const mesoIds = programMesocycles.map(m => m.id);
      const microIds = programMesocycles.flatMap(m => m.microcycles.map(mc => mc.id));
      setSelectedMesocycleIds(mesoIds);
      setSelectedMicrocycleIds(microIds);
      setExpandedMesocycles(mesoIds);
    }
  }, [programMesocycles]);

  // Extract and shift tests/events from program when program or start date changes
  useEffect(() => {
    if (!selectedProgram?.macrocycleData) {
      setReviewedSubGoals([]);
      setReviewedEvents([]);
      return;
    }

    const macro = selectedProgram.macrocycleData;
    const originalStartDate = selectedProgram.duration?.startDate 
      ? new Date(selectedProgram.duration.startDate) 
      : null;
    
    const dayOffset = originalStartDate 
      ? differenceInDays(startDate, originalStartDate)
      : 0;

    // Process sub-goals (tests)
    const subGoals: SubGoal[] = macro.subGoals || [];
    const reviewed: ReviewedSubGoal[] = subGoals.map(sg => {
      // Shift scheduled dates
      const shiftedDates = (sg.testDates || []).map(d => {
        const shifted = addDays(new Date(d + (d.length === 10 ? 'T12:00:00' : '')), dayOffset);
        return shifted.toISOString();
      });

      // Auto-fill baseline from athlete performance data
      let baseline = sg.preTestValue || 0;
      if (sg.parameterLinkedId && athletePerformanceParameters.length > 0) {
        const athleteParam = athletePerformanceParameters.find(
          pp => pp.athleticismParameterId === sg.parameterLinkedId
        );
        if (athleteParam && athleteParam.values.length > 0) {
          const sorted = [...athleteParam.values].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
          );
          baseline = parseFloat(sorted[0].value) || baseline;
        }
      }

      return {
        id: sg.id,
        testMethod: sg.testMethod,
        baselineValue: baseline,
        goalValue: sg.goalValue || 0,
        unit: sg.unit || '',
        comments: sg.comments || '',
        scheduledDates: shiftedDates,
        parameterLinkedId: sg.parameterLinkedId,
      };
    });

    // Also include SMART goals that have test dates (scheduled via selectedSmartGoal in MacrocyclePage)
    const smartGoals: Array<{ id: string; description: string; baselineValue: number; desiredValue: number; unit: string; linkedParameterId?: string; testDates?: string[] }> = macro.smartGoals || [];
    smartGoals.forEach(sg => {
      if (!sg.testDates || sg.testDates.length === 0) return;
      const shiftedDates = sg.testDates.map(d => {
        const shifted = addDays(new Date(d + (d.length === 10 ? 'T12:00:00' : '')), dayOffset);
        return shifted.toISOString();
      });
      let baseline = sg.baselineValue || 0;
      if (sg.linkedParameterId && athletePerformanceParameters.length > 0) {
        const athleteParam = athletePerformanceParameters.find(
          pp => pp.athleticismParameterId === sg.linkedParameterId
        );
        if (athleteParam && athleteParam.values.length > 0) {
          const sorted = [...athleteParam.values].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
          );
          baseline = parseFloat(sorted[0].value) || baseline;
        }
      }
      reviewed.push({
        id: sg.id,
        testMethod: sg.description,
        baselineValue: baseline,
        goalValue: sg.desiredValue || 0,
        unit: sg.unit || '',
        comments: '',
        scheduledDates: shiftedDates,
        parameterLinkedId: sg.linkedParameterId,
      });
    });

    // Deduplicate tests by testMethod + parameterLinkedId
    const dedupedTests: ReviewedSubGoal[] = [];
    const seenTests = new Map<string, number>();
    reviewed.forEach(sg => {
      const key = `${sg.testMethod}-${sg.parameterLinkedId || ''}`;
      if (seenTests.has(key)) {
        const idx = seenTests.get(key)!;
        dedupedTests[idx] = {
          ...dedupedTests[idx],
          scheduledDates: [...dedupedTests[idx].scheduledDates, ...sg.scheduledDates],
        };
      } else {
        seenTests.set(key, dedupedTests.length);
        dedupedTests.push({ ...sg });
      }
    });

    // Process events
    const events: TrainingEvent[] = macro.events || [];
    const reviewedEvts: ReviewedEvent[] = events.map(evt => {
      const shiftedDates = (evt.eventDates || []).map(d => {
        const shifted = addDays(new Date(d), dayOffset);
        return shifted.toISOString();
      });
      return {
        id: evt.id,
        name: evt.name,
        comments: evt.comments || '',
        scheduledDates: shiftedDates,
      };
    });

    // Deduplicate events by name
    const dedupedEvents: ReviewedEvent[] = [];
    const seenEvents = new Map<string, number>();
    reviewedEvts.forEach(evt => {
      const key = evt.name;
      if (seenEvents.has(key)) {
        const idx = seenEvents.get(key)!;
        dedupedEvents[idx] = {
          ...dedupedEvents[idx],
          scheduledDates: [...dedupedEvents[idx].scheduledDates, ...evt.scheduledDates],
        };
      } else {
        seenEvents.set(key, dedupedEvents.length);
        dedupedEvents.push({ ...evt });
      }
    });

    setReviewedSubGoals(dedupedTests);
    setReviewedEvents(dedupedEvents);
  }, [selectedProgram, startDate, athletePerformanceParameters]);

  // Check for date mismatch
  const dateMismatchWarning = useMemo(() => {
    if (!selectedProgram?.duration?.startDate) return null;
    
    const originalStart = new Date(selectedProgram.duration.startDate);
    const daysDiff = Math.abs(differenceInDays(startDate, originalStart));
    
    if (daysDiff > 14) {
      return {
        originalStart: format(originalStart, 'MMM d, yyyy'),
        originalEnd: selectedProgram.duration.endDate 
          ? format(new Date(selectedProgram.duration.endDate), 'MMM d, yyyy')
          : 'N/A',
        daysDiff,
      };
    }
    return null;
  }, [selectedProgram, startDate]);

  // Calculate final mesocycles with shifted dates
  const finalMesocycles = useMemo((): AssignedMesocycle[] => {
    if (programMesocycles.length === 0) return [];
    
    // Filter to selected mesocycles
    let filtered = programMesocycles.filter(m => selectedMesocycleIds.includes(m.id));
    
    // Filter microcycles within each mesocycle
    filtered = filtered.map(meso => ({
      ...meso,
      microcycles: meso.microcycles.filter(mc => selectedMicrocycleIds.includes(mc.id)),
    })).filter(meso => meso.microcycles.length > 0);
    
    // Recalculate dates based on new start date
    return recalculateMesocycleDates(filtered, startDate);
  }, [programMesocycles, selectedMesocycleIds, selectedMicrocycleIds, startDate]);

  // Calculate end date
  const endDate = useMemo(() => {
    if (finalMesocycles.length === 0) return startDate;
    return new Date(finalMesocycles[finalMesocycles.length - 1].endDate);
  }, [finalMesocycles, startDate]);

  // Toggle mesocycle selection
  const toggleMesocycle = (mesoId: string) => {
    const meso = programMesocycles.find(m => m.id === mesoId);
    if (!meso) return;
    
    const isSelected = selectedMesocycleIds.includes(mesoId);
    const microIds = meso.microcycles.map(mc => mc.id);
    
    if (isSelected) {
      setSelectedMesocycleIds(prev => prev.filter(id => id !== mesoId));
      setSelectedMicrocycleIds(prev => prev.filter(id => !microIds.includes(id)));
    } else {
      setSelectedMesocycleIds(prev => [...prev, mesoId]);
      setSelectedMicrocycleIds(prev => [...prev, ...microIds]);
    }
  };

  // Toggle microcycle selection
  const toggleMicrocycle = (mesoId: string, microId: string) => {
    const meso = programMesocycles.find(m => m.id === mesoId);
    if (!meso) return;
    
    const isSelected = selectedMicrocycleIds.includes(microId);
    
    if (isSelected) {
      const newMicroIds = selectedMicrocycleIds.filter(id => id !== microId);
      setSelectedMicrocycleIds(newMicroIds);
      
      // Check if any microcycles remain for this mesocycle
      const remainingMicros = meso.microcycles.filter(mc => newMicroIds.includes(mc.id));
      if (remainingMicros.length === 0) {
        setSelectedMesocycleIds(prev => prev.filter(id => id !== mesoId));
      }
    } else {
      setSelectedMicrocycleIds(prev => [...prev, microId]);
      // Make sure mesocycle is selected
      if (!selectedMesocycleIds.includes(mesoId)) {
        setSelectedMesocycleIds(prev => [...prev, mesoId]);
      }
    }
  };

  // Toggle mesocycle expansion
  const toggleExpanded = (mesoId: string) => {
    setExpandedMesocycles(prev => 
      prev.includes(mesoId) 
        ? prev.filter(id => id !== mesoId)
        : [...prev, mesoId]
    );
  };

  // Handle assign
  const handleAssign = () => {
    if (!selectedProgram || finalMesocycles.length === 0) return;
    
    // Show warning toast if date mismatch
    if (dateMismatchWarning) {
      toast({
        title: "Date mismatch warning",
        description: `This program was originally created for ${dateMismatchWarning.originalStart} - ${dateMismatchWarning.originalEnd}. Dates have been shifted to match your selection.`,
        variant: "destructive",
      });
    }
    
    const assignment: Omit<AthleteCalendarAssignment, 'id' | 'createdAt'> = {
      athleteId,
      programId: selectedProgram.id,
      programName: selectedProgram.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      originalStartDate: selectedProgram.duration?.startDate || startDate.toISOString(),
      originalEndDate: selectedProgram.duration?.endDate || endDate.toISOString(),
      selectedMesocycleIds,
      selectedMicrocycleIds,
      assignedMesocycles: finalMesocycles,
      reviewedSubGoals: reviewedSubGoals.length > 0 ? reviewedSubGoals : undefined,
      reviewedEvents: reviewedEvents.length > 0 ? reviewedEvents : undefined,
    };
    
    onAssign(assignment);
  };

  // Filter programs that have mesocycle data and some training content
  const availablePrograms = programs.filter(p => {
    // Must have mesocycle data
    if (!p.mesocycleData) return false;
    // Handle both formats: direct array or { mesocycles: [...] } object
    const mesocycles = Array.isArray(p.mesocycleData)
      ? p.mesocycleData
      : p.mesocycleData.mesocycles;
    if (!Array.isArray(mesocycles) || mesocycles.length === 0) return false;

    // Accept if the program has any training content:
    // exercises, training days, day split states, or daily intensity
    const hasExercises = Array.isArray(p.exerciseDistribution) && p.exerciseDistribution.length > 0;
    const hasTrainingDays = Array.isArray(p.trainingDays) && p.trainingDays.length > 0;
    const hasDaySplitStates = p.daySplitStates && Object.keys(p.daySplitStates).length > 0;
    const hasDailyIntensity = Array.isArray(p.dailyIntensityData) && p.dailyIntensityData.length > 0;

    return hasExercises || hasTrainingDays || hasDaySplitStates || hasDailyIntensity;
  });

  const STEPS = [
    { number: 1, label: 'Program & Date' },
    { number: 2, label: 'Mesozyklen' },
    { number: 3, label: 'Tests & Events' },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Training Program</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 py-2">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors',
                    currentStep === step.number
                      ? 'bg-primary text-primary-foreground'
                      : currentStep > step.number
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.number}
                </div>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    currentStep === step.number ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-px w-16 mb-5 mx-1 transition-colors',
                    currentStep > step.number ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Program & Start Date */}
        {currentStep === 1 && (
          <div className="space-y-5 py-2 min-h-[280px]">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Program</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a training program..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No programs with sessions available
                    </SelectItem>
                  ) : (
                    availablePrograms.map(program => (
                      <SelectItem key={program.id} value={program.id}>
                        <div className="flex flex-col">
                          <span>{program.name}</span>
                          {program.duration?.weeks && (
                            <span className="text-xs text-muted-foreground">
                              {program.duration.weeks} weeks
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {dateMismatchWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Date mismatch:</strong> This program was originally created for{' '}
                  {dateMismatchWarning.originalStart} – {dateMismatchWarning.originalEnd}{' '}
                  ({dateMismatchWarning.daysDiff} days difference). Dates will be shifted.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Mesocycles & Microcycles */}
        {currentStep === 2 && (
          <div className="py-2 min-h-[280px]">
            {programMesocycles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mesocycles found in this program.</p>
            ) : (
              <ScrollArea className="h-[300px] pr-3">
                <div className="border rounded-lg divide-y">
                  {programMesocycles.map(meso => {
                    const isExpanded = expandedMesocycles.includes(meso.id);
                    const isMesoSelected = selectedMesocycleIds.includes(meso.id);
                    const selectedMicroCount = meso.microcycles.filter(mc =>
                      selectedMicrocycleIds.includes(mc.id)
                    ).length;

                    return (
                      <Collapsible key={meso.id} open={isExpanded}>
                        <div className="p-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`meso-${meso.id}`}
                              checked={isMesoSelected}
                              onCheckedChange={() => toggleMesocycle(meso.id)}
                            />
                            <CollapsibleTrigger
                              className="flex-1 flex items-center gap-2 hover:bg-muted/50 rounded p-1 -m-1"
                              onClick={() => toggleExpanded(meso.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <label
                                htmlFor={`meso-${meso.id}`}
                                className="flex-1 text-sm font-medium cursor-pointer"
                              >
                                {meso.name}
                              </label>
                              <Badge variant="secondary" className="text-xs">
                                {meso.weeks} weeks ({meso.duration} days)
                              </Badge>
                              {isMesoSelected && selectedMicroCount < meso.microcycles.length && (
                                <Badge variant="outline" className="text-xs">
                                  {selectedMicroCount}/{meso.microcycles.length} selected
                                </Badge>
                              )}
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pl-10 space-y-2">
                            {meso.microcycles.map(micro => {
                              const isMicroSelected = selectedMicrocycleIds.includes(micro.id);
                              return (
                                <div key={micro.id} className="flex items-center gap-3">
                                  <Checkbox
                                    id={`micro-${micro.id}`}
                                    checked={isMicroSelected}
                                    onCheckedChange={() => toggleMicrocycle(meso.id, micro.id)}
                                  />
                                  <label
                                    htmlFor={`micro-${micro.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {micro.name}
                                  </label>
                                  <span className="text-xs text-muted-foreground">
                                    {micro.duration} days
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Step 3: Tests & Events */}
        {currentStep === 3 && (
          <div className="py-2 min-h-[280px]">
            {reviewedSubGoals.length === 0 && reviewedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[260px] text-center gap-2">
                <Trophy className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No tests or events defined in this program.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-3">
                <div className="border rounded-lg divide-y">
                  {reviewedSubGoals.map((sg, idx) => (
                    <div key={`test-${sg.testMethod}-${sg.parameterLinkedId || idx}`} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-sm font-medium">
                          {sg.testMethod}{sg.unit ? ` [${sg.unit}]` : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Baseline</Label>
                          <Input
                            type="number"
                            value={sg.baselineValue || ''}
                            onChange={(e) => {
                              const updated = [...reviewedSubGoals];
                              updated[idx] = { ...sg, baselineValue: parseFloat(e.target.value) || 0 };
                              setReviewedSubGoals(updated);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Goal</Label>
                          <Input
                            type="number"
                            value={sg.goalValue || ''}
                            onChange={(e) => {
                              const updated = [...reviewedSubGoals];
                              updated[idx] = { ...sg, goalValue: parseFloat(e.target.value) || 0 };
                              setReviewedSubGoals(updated);
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Comments</Label>
                        <Input
                          value={sg.comments || ''}
                          onChange={(e) => {
                            const updated = [...reviewedSubGoals];
                            updated[idx] = { ...sg, comments: e.target.value };
                            setReviewedSubGoals(updated);
                          }}
                          className="h-8 text-sm"
                          placeholder="Notes..."
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">Dates:</span>
                        {sg.scheduledDates.map((d, di) => (
                          <Popover key={di}>
                            <div className="flex items-center">
                              <PopoverTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80 gap-1 pr-1"
                                >
                                  {format(new Date(d), 'MMM d, yyyy')}
                                </Badge>
                              </PopoverTrigger>
                              <button
                                className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => {
                                  const newDates = sg.scheduledDates.filter((_, i) => i !== di);
                                  const updated = [...reviewedSubGoals];
                                  updated[idx] = { ...sg, scheduledDates: newDates };
                                  setReviewedSubGoals(updated);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={new Date(d)}
                                onSelect={(newDate) => {
                                  if (newDate) {
                                    const updated = [...reviewedSubGoals];
                                    const newDates = [...sg.scheduledDates];
                                    newDates[di] = newDate.toISOString();
                                    updated[idx] = { ...sg, scheduledDates: newDates };
                                    setReviewedSubGoals(updated);
                                  }
                                }}
                                initialFocus
                                className={cn('p-3 pointer-events-auto')}
                              />
                            </PopoverContent>
                          </Popover>
                        ))}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="p-0.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Add date"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              onSelect={(newDate) => {
                                if (newDate) {
                                  const updated = [...reviewedSubGoals];
                                  updated[idx] = {
                                    ...sg,
                                    scheduledDates: [...sg.scheduledDates, newDate.toISOString()],
                                  };
                                  setReviewedSubGoals(updated);
                                }
                              }}
                              initialFocus
                              className={cn('p-3 pointer-events-auto')}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}

                  {reviewedEvents.map((evt, idx) => (
                    <div key={`event-${evt.name}-${idx}`} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium">{evt.name}</span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Comments</Label>
                        <Input
                          value={evt.comments || ''}
                          onChange={(e) => {
                            const updated = [...reviewedEvents];
                            updated[idx] = { ...evt, comments: e.target.value };
                            setReviewedEvents(updated);
                          }}
                          className="h-8 text-sm"
                          placeholder="Notes..."
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">Dates:</span>
                        {evt.scheduledDates.map((d, di) => (
                          <Popover key={di}>
                            <div className="flex items-center">
                              <PopoverTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80 gap-1 pr-1"
                                >
                                  {format(new Date(d), 'MMM d, yyyy')}
                                </Badge>
                              </PopoverTrigger>
                              <button
                                className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => {
                                  const newDates = evt.scheduledDates.filter((_, i) => i !== di);
                                  const updated = [...reviewedEvents];
                                  updated[idx] = { ...evt, scheduledDates: newDates };
                                  setReviewedEvents(updated);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={new Date(d)}
                                onSelect={(newDate) => {
                                  if (newDate) {
                                    const updated = [...reviewedEvents];
                                    const newDates = [...evt.scheduledDates];
                                    newDates[di] = newDate.toISOString();
                                    updated[idx] = { ...evt, scheduledDates: newDates };
                                    setReviewedEvents(updated);
                                  }
                                }}
                                initialFocus
                                className={cn('p-3 pointer-events-auto')}
                              />
                            </PopoverContent>
                          </Popover>
                        ))}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="p-0.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Add date"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              onSelect={(newDate) => {
                                if (newDate) {
                                  const updated = [...reviewedEvents];
                                  updated[idx] = {
                                    ...evt,
                                    scheduledDates: [...evt.scheduledDates, newDate.toISOString()],
                                  };
                                  setReviewedEvents(updated);
                                }
                              }}
                              initialFocus
                              className={cn('p-3 pointer-events-auto')}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {/* Left side: Cancel (step 1) or Back (steps 2–3) */}
          {currentStep === 1 ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setCurrentStep((s) => (s - 1) as 1 | 2 | 3)}>
              Back
            </Button>
          )}

          {/* Right side: Next or Assign */}
          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={currentStep === 1 ? !selectedProgramId : finalMesocycles.length === 0}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleAssign}
              disabled={!selectedProgram || finalMesocycles.length === 0}
            >
              Assign Program
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
