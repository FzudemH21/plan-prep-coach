import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { AlertTriangle, CalendarIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { TrainingProgram } from '@/hooks/useTrainingPrograms';
import { AthleteCalendarAssignment, AssignedMesocycle, AssignedMicrocycle } from '@/types/athlete';
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
}

export function AssignProgramDialog({
  open,
  onOpenChange,
  programs,
  selectedDate,
  onAssign,
  athleteId,
}: AssignProgramDialogProps) {
  const { toast } = useToast();
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(selectedDate);
  const [selectedMesocycleIds, setSelectedMesocycleIds] = useState<string[]>([]);
  const [selectedMicrocycleIds, setSelectedMicrocycleIds] = useState<string[]>([]);
  const [expandedMesocycles, setExpandedMesocycles] = useState<string[]>([]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStartDate(selectedDate);
      setSelectedProgramId('');
      setSelectedMesocycleIds([]);
      setSelectedMicrocycleIds([]);
      setExpandedMesocycles([]);
    }
  }, [open, selectedDate]);

  // Get selected program
  const selectedProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId);
  }, [programs, selectedProgramId]);

  // Parse mesocycles from program data
  const programMesocycles = useMemo((): AssignedMesocycle[] => {
    if (!selectedProgram?.mesocycleData) return [];
    
    const mesoData = selectedProgram.mesocycleData;
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
    };
    
    onAssign(assignment);
  };

  const availablePrograms = programs.filter(p => p.mesocycleData && Array.isArray(p.mesocycleData) && p.mesocycleData.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Assign Training Program</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-140px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Step 1: Select Program */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">1. Select Program</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a training program..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No programs available
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

            {/* Step 2: Select Start Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">2. Start Date</Label>
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
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Mismatch Warning */}
            {dateMismatchWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Date mismatch:</strong> This program was originally created for {dateMismatchWarning.originalStart} - {dateMismatchWarning.originalEnd} ({dateMismatchWarning.daysDiff} days difference). Dates will be shifted to match your selection.
                </AlertDescription>
              </Alert>
            )}

            {/* Step 3: Select Mesocycles & Microcycles */}
            {selectedProgram && programMesocycles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">3. Select Mesocycles & Microcycles</Label>
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
              </div>
            )}

            {/* Preview */}
            {finalMesocycles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview</Label>
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Program:</span>
                    <span className="text-sm font-medium">{selectedProgram?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Start Date:</span>
                    <span className="text-sm font-medium">{format(startDate, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">End Date:</span>
                    <span className="text-sm font-medium">{format(endDate, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Duration:</span>
                    <span className="text-sm font-medium">
                      {finalMesocycles.reduce((sum, m) => sum + m.duration, 0)} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mesocycles:</span>
                    <span className="text-sm font-medium">{finalMesocycles.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedProgram || finalMesocycles.length === 0}
          >
            Assign Program
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
