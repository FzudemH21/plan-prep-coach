import React, { useState, useMemo } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ExtendedMesocycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { ExerciseLibraryPanel } from './ExerciseLibraryPanel';
import { SessionColumnView } from './SessionColumnView';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseDistribution {
  id: string;
  exerciseId: string;
  exerciseName: string;
  methodId: string;
  categoryName: string;
  subCategory?: string;
  dayDate: string;
  sessionIndex: number;
  order: number;
  sectionId?: string;
  supersetId?: string;
}

interface SessionSection {
  id: string;
  dayDate: string;
  sessionIndex: number;
  name: string;
  order: number;
}

interface SupersetMapping {
  [dayDate: string]: {
    [sessionIndex: number]: {
      [supersetId: string]: string[]; // array of exercise IDs
    };
  };
}

interface EnhancedExerciseDistributionProps {
  mesocycle: ExtendedMesocycle;
  trainingDays: TrainingDay[];
  exerciseSelectionData: Record<string, CellData>;
  exerciseDistribution: ExerciseDistribution[];
  sessionSections: SessionSection[];
  supersets: SupersetMapping;
  onDistributionChange: (distribution: ExerciseDistribution[]) => void;
  onSectionsChange: (sections: SessionSection[]) => void;
  onSupersetsChange: (supersets: SupersetMapping) => void;
  getIntensityColor: (intensity: IntensityLevel) => string;
}

export function EnhancedExerciseDistribution({
  mesocycle,
  trainingDays,
  exerciseSelectionData,
  exerciseDistribution,
  sessionSections,
  supersets,
  onDistributionChange,
  onSectionsChange,
  onSupersetsChange,
  getIntensityColor,
}: EnhancedExerciseDistributionProps) {
  const { toast } = useToast();
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string | null>(null);
  const [copyingMicrocycleId, setCopyingMicrocycleId] = useState<string | null>(null);

  // Filter training days for current mesocycle and group by week
  const currentMesocycleDays = useMemo(() => {
    return trainingDays.filter(day => {
      // Handle both Date objects and string dates
      const mesocycleStartDate = typeof mesocycle.startDate === 'string' 
        ? (mesocycle.startDate as string).split('T')[0] 
        : format(mesocycle.startDate as Date, 'yyyy-MM-dd');
      const mesocycleEndDate = typeof mesocycle.endDate === 'string'
        ? (mesocycle.endDate as string).split('T')[0]
        : format(mesocycle.endDate as Date, 'yyyy-MM-dd');
      return day.date >= mesocycleStartDate && day.date <= mesocycleEndDate;
    });
  }, [trainingDays, mesocycle]);

  // Group days by microcycle - using the microcycleId already stored in TrainingDay
  const daysByMicrocycle = useMemo(() => {
    const grouped = new Map<string, { microcycle: any; days: TrainingDay[] }>();
    
    // Group days by their microcycleId
    currentMesocycleDays.forEach(day => {
      if (!grouped.has(day.microcycleId)) {
        // Find the corresponding microcycle from mesocycle.microcycles
        const micro = mesocycle.microcycles.find(m => m.id === day.microcycleId);
        if (micro) {
          grouped.set(day.microcycleId, { microcycle: micro, days: [] });
        }
      }
      
      const entry = grouped.get(day.microcycleId);
      if (entry) {
        entry.days.push(day);
      }
    });
    
    // Sort the map by microcycle order in mesocycle.microcycles
    const sortedGrouped = new Map<string, { microcycle: any; days: TrainingDay[] }>();
    mesocycle.microcycles.forEach(micro => {
      if (grouped.has(micro.id)) {
        sortedGrouped.set(micro.id, grouped.get(micro.id)!);
      }
    });
    
    return sortedGrouped;
  }, [currentMesocycleDays, mesocycle]);

  // Group exercises by method and category
  const exercisesByMethod = useMemo(() => {
    const grouped: Record<string, Record<string, Array<{
      exerciseId: string;
      exerciseName: string;
      subCategory?: string;
    }>>> = {};

    Object.entries(exerciseSelectionData).forEach(([key, cellData]) => {
      if (cellData.mesocycleId !== mesocycle.id) return;

      const methodId = cellData.methodId;
      const categoryName = cellData.categoryName || 'Uncategorized';

      if (!grouped[methodId]) {
        grouped[methodId] = {};
      }
      if (!grouped[methodId][categoryName]) {
        grouped[methodId][categoryName] = [];
      }

      cellData.exercises.forEach(ex => {
        // Avoid duplicates
        if (!grouped[methodId][categoryName].find(e => e.exerciseId === ex.exerciseId)) {
          grouped[methodId][categoryName].push({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            subCategory: ex.subCategory,
          });
        }
      });
    });

    return grouped;
  }, [exerciseSelectionData, mesocycle.id]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;

    // Handle dragging from library to unsectioned session area
    if (type === 'EXERCISE' && source.droppableId.startsWith('library-') && destination.droppableId.startsWith('session-')) {
      const [methodId, categoryName] = source.droppableId.replace('library-', '').split('::');
      const [dayDate, sessionIndex] = destination.droppableId.replace('session-', '').split('::');
      
      const exercise = exercisesByMethod[methodId]?.[categoryName]?.[source.index];
      if (!exercise) return;

      const sessionExercises = exerciseDistribution.filter(
        ex => ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId
      ).sort((a, b) => a.order - b.order);

      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId,
        categoryName,
        subCategory: exercise.subCategory,
        dayDate,
        sessionIndex: parseInt(sessionIndex),
        order: destination.index,
      };

      sessionExercises.splice(destination.index, 0, newExercise);
      sessionExercises.forEach((ex, idx) => ex.order = idx);

      const otherExercises = exerciseDistribution.filter(
        ex => !(ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId)
      );

      onDistributionChange([...otherExercises, ...sessionExercises]);
      toast({ title: 'Exercise added', description: `${exercise.exerciseName} added to session` });
      return;
    }

    // Handle dragging from library into a specific section
    if (type === 'EXERCISE' && source.droppableId.startsWith('library-') && destination.droppableId.startsWith('section-')) {
      const [methodId, categoryName] = source.droppableId.replace('library-', '').split('::');
      const sectionId = destination.droppableId.replace('section-', '');
      
      const section = sessionSections.find(s => s.id === sectionId);
      if (!section) return;
      
      const exercise = exercisesByMethod[methodId]?.[categoryName]?.[source.index];
      if (!exercise) return;
      
      const sectionExercises = exerciseDistribution.filter(
        ex => ex.sectionId === sectionId
      ).sort((a, b) => a.order - b.order);
      
      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId,
        categoryName,
        subCategory: exercise.subCategory,
        dayDate: section.dayDate,
        sessionIndex: section.sessionIndex,
        order: destination.index,
        sectionId: sectionId,
      };
      
      sectionExercises.splice(destination.index, 0, newExercise);
      sectionExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(ex => ex.sectionId !== sectionId);
      
      onDistributionChange([...otherExercises, ...sectionExercises]);
      toast({ title: 'Exercise added to section', description: `${exercise.exerciseName} added to ${section.name}` });
      return;
    }

    // Handle reordering within the same droppable (section or unsectioned area)
    if (type === 'EXERCISE' && source.droppableId === destination.droppableId) {
      if (source.droppableId.startsWith('section-')) {
        // Reordering within a section
        const sectionId = source.droppableId.replace('section-', '');
        const sectionExercises = exerciseDistribution
          .filter(ex => ex.sectionId === sectionId)
          .sort((a, b) => a.order - b.order);
        
        const [movedExercise] = sectionExercises.splice(source.index, 1);
        sectionExercises.splice(destination.index, 0, movedExercise);
        
        sectionExercises.forEach((ex, idx) => ex.order = idx);
        
        const otherExercises = exerciseDistribution.filter(ex => ex.sectionId !== sectionId);
        onDistributionChange([...otherExercises, ...sectionExercises]);
        return;
      }
      
      if (source.droppableId.startsWith('session-')) {
        // Reordering within unsectioned area
        const [dayDate, sessionIndex] = source.droppableId.replace('session-', '').split('::');
        const sessionExercises = exerciseDistribution
          .filter(ex => ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId)
          .sort((a, b) => a.order - b.order);

        const [movedExercise] = sessionExercises.splice(source.index, 1);
        sessionExercises.splice(destination.index, 0, movedExercise);

        sessionExercises.forEach((ex, idx) => ex.order = idx);

        const otherExercises = exerciseDistribution.filter(
          ex => !(ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId)
        );

        onDistributionChange([...otherExercises, ...sessionExercises]);
        return;
      }
    }

    // Handle moving FROM section TO unsectioned session area
    if (type === 'EXERCISE' && source.droppableId.startsWith('section-') && destination.droppableId.startsWith('session-')) {
      const sectionId = source.droppableId.replace('section-', '');
      const [destDayDate, destSessionIndex] = destination.droppableId.replace('session-', '').split('::');
      
      const sourceExercises = exerciseDistribution
        .filter(ex => ex.sectionId === sectionId)
        .sort((a, b) => a.order - b.order);
      
      const destExercises = exerciseDistribution
        .filter(ex => ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);
      
      const [movedExercise] = sourceExercises.splice(source.index, 1);
      movedExercise.dayDate = destDayDate;
      movedExercise.sessionIndex = parseInt(destSessionIndex);
      movedExercise.sectionId = undefined;
      movedExercise.supersetId = undefined;
      
      destExercises.splice(destination.index, 0, movedExercise);
      
      sourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => ex.sectionId !== sectionId && 
             !(ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
      );
      
      onDistributionChange([...otherExercises, ...sourceExercises, ...destExercises]);
      toast({ title: 'Exercise moved', description: 'Moved to main session area' });
      return;
    }

    // Handle moving FROM unsectioned session area TO section
    if (type === 'EXERCISE' && source.droppableId.startsWith('session-') && destination.droppableId.startsWith('section-')) {
      const [sourceDayDate, sourceSessionIndex] = source.droppableId.replace('session-', '').split('::');
      const destSectionId = destination.droppableId.replace('section-', '');
      
      const sourceExercises = exerciseDistribution
        .filter(ex => ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);
      
      const destExercises = exerciseDistribution
        .filter(ex => ex.sectionId === destSectionId)
        .sort((a, b) => a.order - b.order);
      
      const destSection = sessionSections.find(s => s.id === destSectionId);
      if (!destSection) return;
      
      const [movedExercise] = sourceExercises.splice(source.index, 1);
      movedExercise.dayDate = destSection.dayDate;
      movedExercise.sessionIndex = destSection.sessionIndex;
      movedExercise.sectionId = destSectionId;
      movedExercise.supersetId = undefined;
      
      destExercises.splice(destination.index, 0, movedExercise);
      
      sourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => !(ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId) &&
             ex.sectionId !== destSectionId
      );
      
      onDistributionChange([...otherExercises, ...sourceExercises, ...destExercises]);
      toast({ title: 'Exercise moved to section', description: `Added to ${destSection.name}` });
      return;
    }

    // Handle moving BETWEEN sections
    if (type === 'EXERCISE' && source.droppableId.startsWith('section-') && destination.droppableId.startsWith('section-') &&
        source.droppableId !== destination.droppableId) {
      const sourceSectionId = source.droppableId.replace('section-', '');
      const destSectionId = destination.droppableId.replace('section-', '');
      
      const sourceExercises = exerciseDistribution
        .filter(ex => ex.sectionId === sourceSectionId)
        .sort((a, b) => a.order - b.order);
      
      const destExercises = exerciseDistribution
        .filter(ex => ex.sectionId === destSectionId)
        .sort((a, b) => a.order - b.order);
      
      const destSection = sessionSections.find(s => s.id === destSectionId);
      if (!destSection) return;
      
      const [movedExercise] = sourceExercises.splice(source.index, 1);
      movedExercise.sectionId = destSectionId;
      movedExercise.dayDate = destSection.dayDate;
      movedExercise.sessionIndex = destSection.sessionIndex;
      movedExercise.supersetId = undefined;
      
      destExercises.splice(destination.index, 0, movedExercise);
      
      sourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => ex.sectionId !== sourceSectionId && ex.sectionId !== destSectionId
      );
      
      onDistributionChange([...otherExercises, ...sourceExercises, ...destExercises]);
      toast({ title: 'Exercise moved between sections', description: `Moved to ${destSection.name}` });
      return;
    }

    // Handle moving between unsectioned session areas (different days/sessions)
    if (type === 'EXERCISE' && source.droppableId !== destination.droppableId && 
        source.droppableId.startsWith('session-') && destination.droppableId.startsWith('session-')) {
      const [sourceDayDate, sourceSessionIndex] = source.droppableId.replace('session-', '').split('::');
      const [destDayDate, destSessionIndex] = destination.droppableId.replace('session-', '').split('::');

      const sourceExercises = exerciseDistribution
        .filter(ex => ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);

      const destExercises = exerciseDistribution
        .filter(ex => ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);

      const [movedExercise] = sourceExercises.splice(source.index, 1);
      movedExercise.dayDate = destDayDate;
      movedExercise.sessionIndex = parseInt(destSessionIndex);
      movedExercise.sectionId = undefined;
      movedExercise.supersetId = undefined;

      destExercises.splice(destination.index, 0, movedExercise);

      sourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);

      const otherExercises = exerciseDistribution.filter(
        ex => !(
          (ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId) ||
          (ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
        )
      );

      onDistributionChange([...otherExercises, ...sourceExercises, ...destExercises]);
      toast({ title: 'Exercise moved', description: 'Exercise moved to another session' });
    }
  };

  const handleDeleteExercise = (exerciseDistId: string) => {
    const exercise = exerciseDistribution.find(ex => ex.id === exerciseDistId);
    if (!exercise) return;

    // Remove exercise
    const updated = exerciseDistribution.filter(ex => ex.id !== exerciseDistId);

    // Reorder remaining exercises in the same session
    const sessionExercises = updated
      .filter(ex => ex.dayDate === exercise.dayDate && ex.sessionIndex === exercise.sessionIndex)
      .sort((a, b) => a.order - b.order);

    sessionExercises.forEach((ex, idx) => ex.order = idx);

    const otherExercises = updated.filter(
      ex => !(ex.dayDate === exercise.dayDate && ex.sessionIndex === exercise.sessionIndex)
    );

    onDistributionChange([...otherExercises, ...sessionExercises]);
    toast({ title: 'Exercise removed', description: `${exercise.exerciseName} removed from session` });
  };

  const handleAddSection = (dayDate: string, sessionIndex: number) => {
    const existingSections = sessionSections.filter(
      s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
    );
    const nextOrder = existingSections.length > 0 
      ? Math.max(...existingSections.map(s => s.order)) + 1 
      : 0;

    const newSection: SessionSection = {
      id: `section-${Date.now()}-${Math.random()}`,
      dayDate,
      sessionIndex,
      name: `Section ${existingSections.length + 1}`,
      order: nextOrder,
    };

    onSectionsChange([...sessionSections, newSection]);
    toast({ title: 'Section added', description: newSection.name });
  };

  const handleRenameSection = (sectionId: string, newName: string) => {
    const updated = sessionSections.map(s => 
      s.id === sectionId ? { ...s, name: newName } : s
    );
    onSectionsChange(updated);
  };

  const handleDeleteSection = (sectionId: string) => {
    // Remove section
    const updated = sessionSections.filter(s => s.id !== sectionId);
    onSectionsChange(updated);

    // Clear sectionId from exercises
    const updatedExercises = exerciseDistribution.map(ex =>
      ex.sectionId === sectionId ? { ...ex, sectionId: undefined } : ex
    );
    onDistributionChange(updatedExercises);

    toast({ title: 'Section deleted', description: 'Section removed' });
  };

  const handleToggleSuperset = (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string) => {
    const daySupersets = supersets[dayDate]?.[sessionIndex] || {};
    
    // Find if either exercise is in a superset
    let superset1: string | undefined;
    let superset2: string | undefined;
    
    Object.entries(daySupersets).forEach(([ssId, exerciseIds]) => {
      if (exerciseIds.includes(exerciseId1)) superset1 = ssId;
      if (exerciseIds.includes(exerciseId2)) superset2 = ssId;
    });

    const newSupersets = { ...supersets };
    if (!newSupersets[dayDate]) newSupersets[dayDate] = {};
    if (!newSupersets[dayDate][sessionIndex]) newSupersets[dayDate][sessionIndex] = {};
    const daySuperset = newSupersets[dayDate][sessionIndex];

    if (!superset1 && !superset2) {
      // CREATE: Neither in a superset, create new one
      const existingSupersetIds = Object.keys(daySuperset).map(id => {
        const match = id.match(/superset-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
      const newSupersetId = `superset-${nextId}`;
      daySuperset[newSupersetId] = [exerciseId1, exerciseId2];
      toast({ title: 'Superset created', description: 'Exercises linked' });
    } else if (superset1 && superset1 === superset2) {
      // UNLINK: Split the superset at this connection point
      const currentIds = daySuperset[superset1];
      const index1 = currentIds.indexOf(exerciseId1);
      const index2 = currentIds.indexOf(exerciseId2);
      
      if (Math.abs(index1 - index2) === 1) {
        const splitPoint = Math.min(index1, index2) + 1;
        const firstGroup = currentIds.slice(0, splitPoint);
        const secondGroup = currentIds.slice(splitPoint);
        
        if (firstGroup.length >= 2) {
          daySuperset[superset1] = firstGroup;
        } else {
          delete daySuperset[superset1];
        }
        
        if (secondGroup.length >= 2) {
          const existingSupersetIds = Object.keys(daySuperset).map(id => {
            const match = id.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
          const newSupersetId = `superset-${nextId}`;
          daySuperset[newSupersetId] = secondGroup;
        }
        
        toast({ title: 'Exercises unlinked', description: 'Connection removed' });
      }
    } else if (superset1 && superset2 && superset1 !== superset2) {
      // MERGE: Combine two different supersets
      const merged = Array.from(new Set([...(daySuperset[superset1] || []), ...(daySuperset[superset2] || [])]));
      daySuperset[superset1] = merged;
      delete daySuperset[superset2];
      toast({ title: 'Supersets merged', description: 'Exercises linked' });
    } else {
      // ADD: One is in a superset, add the other
      const targetSuperset = superset1 || superset2;
      if (targetSuperset) {
        if (!daySuperset[targetSuperset].includes(exerciseId1)) {
          daySuperset[targetSuperset].push(exerciseId1);
        }
        if (!daySuperset[targetSuperset].includes(exerciseId2)) {
          daySuperset[targetSuperset].push(exerciseId2);
        }
        toast({ title: 'Exercise added to superset', description: 'Exercise linked' });
      }
    }

    onSupersetsChange(newSupersets);
  };

  const handleCopyFromPreviousMicrocycle = (targetMicrocycleId: string) => {
    setCopyingMicrocycleId(targetMicrocycleId);
    
    try {
      // Find target microcycle index
      const targetIndex = mesocycle.microcycles.findIndex(m => m.id === targetMicrocycleId);
      
      // First microcycle has no previous one
      if (targetIndex <= 0) {
        toast({ 
          title: 'Cannot copy', 
          description: 'This is the first microcycle',
          variant: 'destructive'
        });
        return;
      }
      
      // Get source (previous) microcycle
      const sourceMicrocycle = mesocycle.microcycles[targetIndex - 1];
      const targetMicrocycle = mesocycle.microcycles[targetIndex];
      
      // Get days for both microcycles
      const sourceDays = daysByMicrocycle.get(sourceMicrocycle.id)?.days || [];
      const targetDays = daysByMicrocycle.get(targetMicrocycleId)?.days || [];
      
      if (sourceDays.length === 0) {
        toast({ 
          title: 'Nothing to copy', 
          description: 'Previous microcycle has no exercises',
          variant: 'destructive'
        });
        return;
      }
      
      // Create day mapping (source day index -> target day date)
      const dayMapping: Record<number, string> = {};
      const minDays = Math.min(sourceDays.length, targetDays.length);
      
      for (let i = 0; i < minDays; i++) {
        dayMapping[i] = targetDays[i].date;
      }
      
      // Copy exercises
      const newExercises: ExerciseDistribution[] = [];
      const oldToNewExerciseIds: Record<string, string> = {}; // For superset mapping
      
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return; // Skip if target has fewer days
        
        const targetDate = dayMapping[dayIndex];
        const sourceDateExercises = exerciseDistribution.filter(
          ex => ex.dayDate === sourceDay.date
        );
        
        sourceDateExercises.forEach(exercise => {
          const newId = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          oldToNewExerciseIds[exercise.id] = newId;
          
          newExercises.push({
            ...exercise,
            id: newId,
            dayDate: targetDate,
          });
        });
      });
      
      // Copy sections
      const newSections: SessionSection[] = [];
      
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;
        
        const targetDate = dayMapping[dayIndex];
        const sourceDateSections = sessionSections.filter(
          s => s.dayDate === sourceDay.date
        );
        
        sourceDateSections.forEach(section => {
          newSections.push({
            ...section,
            id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dayDate: targetDate,
          });
        });
      });
      
      // Copy supersets with new exercise IDs
      const newSupersets: SupersetMapping = { ...supersets };
      
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;
        
        const targetDate = dayMapping[dayIndex];
        const sourceDateSupersets = supersets[sourceDay.date];
        
        if (sourceDateSupersets) {
          newSupersets[targetDate] = {};
          
          Object.entries(sourceDateSupersets).forEach(([sessionIndex, sessionSupersets]) => {
            newSupersets[targetDate][Number(sessionIndex)] = {};
            
            Object.entries(sessionSupersets).forEach(([supersetId, exerciseIds]) => {
              // Map old exercise IDs to new ones
              const newExerciseIds = exerciseIds
                .map(oldId => oldToNewExerciseIds[oldId])
                .filter(id => id !== undefined);
              
              if (newExerciseIds.length > 0) {
                newSupersets[targetDate][Number(sessionIndex)][supersetId] = newExerciseIds;
              }
            });
          });
        }
      });
      
      // Remove existing exercises, sections, and supersets for target days
      const targetDates = targetDays.map(d => d.date);
      const filteredExercises = exerciseDistribution.filter(
        ex => !targetDates.includes(ex.dayDate)
      );
      const filteredSections = sessionSections.filter(
        s => !targetDates.includes(s.dayDate)
      );
      
      targetDates.forEach(date => {
        delete newSupersets[date];
      });
      
      // Add new data
      onDistributionChange([...filteredExercises, ...newExercises]);
      onSectionsChange([...filteredSections, ...newSections]);
      onSupersetsChange(newSupersets);
      
      toast({
        title: 'Copied successfully',
        description: `Copied ${newExercises.length} exercises from ${sourceMicrocycle.name} to ${targetMicrocycle.name}`,
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'An error occurred while copying',
        variant: 'destructive'
      });
    } finally {
      setCopyingMicrocycleId(null);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <ExerciseLibraryPanel
            exercisesByMethod={exercisesByMethod}
            exerciseDistribution={exerciseDistribution}
            mesocycle={mesocycle}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70} minSize={60}>
          <div className="h-full overflow-x-auto p-4">
            <div className="w-max min-w-full">
              
              {/* Mesocycle Header */}
              <div className={cn("mb-4 border-b pb-3", getIntensityColor(mesocycle.intensity))}>
                <h2 className="text-xl font-bold text-center">
                  {mesocycle.name}
                </h2>
                <p className="text-sm text-center mt-1">
                  {(() => {
                    const mesocycleStartDate = typeof mesocycle.startDate === 'string' 
                      ? (mesocycle.startDate as string).split('T')[0] 
                      : format(mesocycle.startDate as Date, 'yyyy-MM-dd');
                    const mesocycleEndDate = typeof mesocycle.endDate === 'string'
                      ? (mesocycle.endDate as string).split('T')[0]
                      : format(mesocycle.endDate as Date, 'yyyy-MM-dd');
                    return `${format(parseISO(mesocycleStartDate), 'MMM d, yyyy')} - ${format(parseISO(mesocycleEndDate), 'MMM d, yyyy')}`;
                  })()}
                </p>
              </div>
              
              {/* Microcycle Headers Row */}
              <div className="flex mb-2 border-b">
                {Array.from(daysByMicrocycle.entries()).map(([microId, { microcycle, days }], microIndex) => {
                  // Calculate total width for this microcycle
                  // Each SessionColumnView is w-80 (320px)
                  // gap-2 (8px) between sessions within a day
                  // gap-4 (16px) between days
                  const totalWidth = days.reduce((total, day, dayIndex) => {
                    const sessionsCount = day.sessions || 1;
                    const dayWidth = (sessionsCount * 320) + ((sessionsCount - 1) * 8);
                    const gapAfterDay = dayIndex < days.length - 1 ? 16 : 0;
                    return total + dayWidth + gapAfterDay;
                  }, 0);
                  
                  const isFirstMicrocycle = microIndex === 0;
                  
                  return (
            <div 
              key={microId}
              className={cn(
                "text-center font-semibold py-2 border-r-2 border-border",
                getIntensityColor(microcycle.intensity)
              )}
              style={{ width: `${totalWidth}px` }}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{microcycle.name}</span>
                {!isFirstMicrocycle && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    disabled={copyingMicrocycleId === microId}
                    title={`Copy setup from ${mesocycle.microcycles[microIndex - 1].name}`}
                    onClick={() => handleCopyFromPreviousMicrocycle(microId)}
                  >
                    {copyingMicrocycleId === microId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
                  );
                })}
              </div>
              
              {/* Day Columns */}
              <div className="flex gap-4">
                {Array.from(daysByMicrocycle.entries()).map(([microId, { days }], index) => (
                  <React.Fragment key={microId}>
                    {index > 0 && (
                      <div className="w-1 bg-border shrink-0" />
                    )}
                    <div className="flex gap-4">
                      {days.map((day) => {
                        const sessionsCount = day.sessions || 1;
                        return (
                          <div key={day.date} className="flex gap-2">
                            {Array.from({ length: sessionsCount }).map((_, sessionIndex) => {
                              const sessionExercises = exerciseDistribution
                                .filter(ex => ex.dayDate === day.date && ex.sessionIndex === sessionIndex)
                                .sort((a, b) => a.order - b.order);

                              const daySections = sessionSections
                                .filter(s => s.dayDate === day.date && s.sessionIndex === sessionIndex)
                                .sort((a, b) => a.order - b.order);

                              const daySupersets = supersets[day.date]?.[sessionIndex] || {};

                              return (
                                <SessionColumnView
                                  key={`${day.date}-${sessionIndex}`}
                                  day={day}
                                  sessionIndex={sessionIndex}
                                  exercises={sessionExercises}
                                  sections={daySections}
                                  supersets={daySupersets}
                                  onDeleteExercise={handleDeleteExercise}
                                  onAddSection={() => handleAddSection(day.date, sessionIndex)}
                                  onRenameSection={handleRenameSection}
                                  onDeleteSection={handleDeleteSection}
                                  onToggleSuperset={handleToggleSuperset}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </DragDropContext>
  );
}
