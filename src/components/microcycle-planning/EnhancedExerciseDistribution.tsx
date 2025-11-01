import React, { useState, useMemo, useEffect } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ExtendedMesocycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { ExerciseLibraryPanel } from './ExerciseLibraryPanel';
import { SessionColumnView } from './SessionColumnView';
import { DayHeader } from './DayHeader';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react';
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
  comments?: string;
}

interface SupersetMapping {
  [dayDate: string]: {
    [sessionIndex: number]: {
      [sectionId: string]: {  // section ID or "__unsectioned__" for session-level
        [supersetId: string]: string[]; // array of exercise IDs
      };
    };
  };
}

interface EnhancedExerciseDistributionProps {
  mesocycle: ExtendedMesocycle;
  allMesocycles: ExtendedMesocycle[];
  trainingDays: TrainingDay[];
  exerciseSelectionData: Record<string, CellData>;
  exerciseDistribution: ExerciseDistribution[];
  sessionSections: SessionSection[];
  supersets: SupersetMapping;
  onDistributionChange: (distribution: ExerciseDistribution[]) => void;
  onSectionsChange: (sections: SessionSection[]) => void;
  onSupersetsChange: (supersets: SupersetMapping) => void;
  getIntensityColor: (intensity: IntensityLevel) => string;
  onAddSession: (dayDate: string) => void;
  onRemoveSession: (dayDate: string, sessionIndex: number) => void;
  onRenameSession?: (dayDate: string, sessionIndex: number, newName: string) => void;
  onSessionIntensityChange?: (dayDate: string, sessionIndex: number, intensity: IntensityLevel) => void;
  onDayIntensityChange?: (dayDate: string, intensity: IntensityLevel) => void;
  intensityLevels?: IntensityLevel[];
}

export function EnhancedExerciseDistribution({
  mesocycle,
  allMesocycles,
  trainingDays,
  exerciseSelectionData,
  exerciseDistribution,
  sessionSections,
  supersets,
  onDistributionChange,
  onSectionsChange,
  onSupersetsChange,
  getIntensityColor,
  onAddSession,
  onRemoveSession,
  onRenameSession,
  onSessionIntensityChange,
  onDayIntensityChange,
  intensityLevels,
}: EnhancedExerciseDistributionProps) {
  const { toast } = useToast();
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string | null>(null);
  const [copyingMicrocycleId, setCopyingMicrocycleId] = useState<string | null>(null);
  const [copyingMesocycle, setCopyingMesocycle] = useState(false);
  const [sessionCommentsMap, setSessionCommentsMap] = useState<Record<string, string>>({});
  const [clearingMicrocycleId, setClearingMicrocycleId] = useState<string | null>(null);

  // Load session comments from localStorage on mount
  useEffect(() => {
    if (!mesocycle?.id) return;
    
    const loadSessionComments = () => {
      const commentsMap: Record<string, string> = {};
      trainingDays.forEach(day => {
        const sessionsCount = day.sessionNames?.length || 1;
        for (let i = 0; i < sessionsCount; i++) {
          const key = `sessionComments_${mesocycle.id}_${day.date}_${i}`;
          const comments = localStorage.getItem(key);
          if (comments) {
            commentsMap[key] = comments;
          }
        }
      });
      setSessionCommentsMap(commentsMap);
    };
    
    loadSessionComments();
  }, [mesocycle?.id, trainingDays]);

  // Debounced localStorage save function
  const debouncedSaveToLocalStorage = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (key: string, value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        localStorage.setItem(key, value);
      }, 300);
    };
  }, []);

  // Filter training days for current mesocycle and group by week
  const currentMesocycleDays = useMemo(() => {
    return trainingDays.filter(day => {
      // Safety check for invalid day
      if (!day || !day.date) {
        console.error('EnhancedExerciseDistribution: Invalid day in trainingDays', day);
        return false;
      }
      
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

  // Helper to find superset in mapping
  const findSessionSuperset = (
    dayDate: string,
    sessionIndex: number,
    exerciseId: string,
    sectionId?: string
  ): { supersetId: string; ids: string[] } | undefined => {
    const sectionKey = sectionId || '__unsectioned__';
    const sectionSupersets = supersets[dayDate]?.[sessionIndex]?.[sectionKey];
    if (!sectionSupersets) return undefined;
    
    for (const [ssId, ids] of Object.entries(sectionSupersets)) {
      if (ids.includes(exerciseId)) {
        return { supersetId: ssId, ids };
      }
    }
    return undefined;
  };

  // Helper to get all exercises in a superset using the SupersetMapping
  const getSupersetExercises = (
    exerciseId: string,
    exercises: ExerciseDistribution[],
    dayDate: string,
    sessionIndex: number,
    sectionId?: string
  ): ExerciseDistribution[] => {
    const match = findSessionSuperset(dayDate, sessionIndex, exerciseId, sectionId);
    if (!match) {
      const single = exercises.find(ex => ex.id === exerciseId);
      return single ? [single] : [];
    }
    
    const idSet = new Set(match.ids);
    return exercises
      .filter(ex => idSet.has(ex.id))
      .sort((a, b) => a.order - b.order);
  };

  // Helper to get superset ID for an exercise
  const getSupersetIdForExercise = (
    dayDate: string,
    sessionIndex: number,
    exerciseId: string,
    sectionId?: string
  ): string | undefined => {
    return findSessionSuperset(dayDate, sessionIndex, exerciseId, sectionId)?.supersetId;
  };

  // Block type for atomic superset handling
  type Block = { items: ExerciseDistribution[]; supersetId?: string };

  // Build blocks from exercises - treats contiguous superset exercises as a single block
  const buildBlocks = (
    list: ExerciseDistribution[],
    dayDate: string,
    sessionIndex: number,
    sectionId?: string
  ): Block[] => {
    const blocks: Block[] = [];
    for (const ex of list) {
      const ss = getSupersetIdForExercise(dayDate, sessionIndex, ex.id, sectionId);
      const last = blocks[blocks.length - 1];
      if (last && last.supersetId && last.supersetId === ss) {
        last.items.push(ex);
      } else {
        blocks.push({ items: [ex], supersetId: ss });
      }
    }
    return blocks;
  };

  // Map an item index to the nearest block boundary
  const mapItemIndexToBlockIndex = (
    blocks: Block[],
    itemIndex: number,
    preferAfter?: boolean
  ): number => {
    let prefix = 0;
    for (let i = 0; i < blocks.length; i++) {
      const size = blocks[i].items.length;
      const start = prefix;
      const end = prefix + size;
      
      if (itemIndex === start) return i;
      if (itemIndex > start && itemIndex < end) {
        // Inside block i - snap to nearest edge
        if (preferAfter === true) return i + 1;
        if (preferAfter === false) return i;
        // Use distance to determine nearest edge
        const distToStart = itemIndex - start;
        const distToEnd = end - itemIndex;
        return distToStart <= distToEnd ? i : i + 1;
      }
      if (itemIndex === end) return i + 1;
      prefix = end;
    }
    return blocks.length;
  };

  // Compute safe insertion index when moving a block
  const computeInsertIndexFromBlocks = (
    blocks: Block[],
    sourceBlockIndex: number,
    destItemIndex: number,
    preferAfter: boolean
  ): number => {
    const destBlockIndex = mapItemIndexToBlockIndex(blocks, destItemIndex, preferAfter);
    const blocksAfterRemoval = blocks.slice(0, sourceBlockIndex).concat(blocks.slice(sourceBlockIndex + 1));
    const adjustedDestBlockIndex = destBlockIndex > sourceBlockIndex ? destBlockIndex - 1 : destBlockIndex;
    
    // Sum sizes before adjustedDestBlockIndex
    let insertIndex = 0;
    for (let i = 0; i < adjustedDestBlockIndex; i++) {
      insertIndex += blocksAfterRemoval[i].items.length;
    }
    return insertIndex;
  };

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

      // Use block-aware insertion to avoid splitting supersets
      const blocks = buildBlocks(sessionExercises, dayDate, parseInt(sessionIndex), undefined);
      const safeInsertIndex = mapItemIndexToBlockIndex(blocks, destination.index, false);
      
      // Calculate actual item index from block index
      let insertIndex = 0;
      for (let i = 0; i < safeInsertIndex; i++) {
        insertIndex += blocks[i].items.length;
      }

      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId,
        categoryName,
        subCategory: exercise.subCategory,
        dayDate,
        sessionIndex: parseInt(sessionIndex),
        order: insertIndex,
      };

      sessionExercises.splice(insertIndex, 0, newExercise);
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
        // Reordering within a section (single exercise only, supersets are session-level)
        const sectionId = source.droppableId.replace('section-', '');
        const sectionExercises = exerciseDistribution
          .filter(ex => ex.sectionId === sectionId)
          .sort((a, b) => a.order - b.order);
        
        const draggedExercise = sectionExercises[source.index];
        
        // Remove dragged exercise
        const remainingExercises = sectionExercises.filter(ex => ex.id !== draggedExercise.id);
        
        // Insert at destination
        remainingExercises.splice(destination.index, 0, draggedExercise);
        
        remainingExercises.forEach((ex, idx) => ex.order = idx);
        
        const otherExercises = exerciseDistribution.filter(ex => ex.sectionId !== sectionId);
        onDistributionChange([...otherExercises, ...remainingExercises]);
        return;
      }
      
      if (source.droppableId.startsWith('session-')) {
        // Reordering within unsectioned area - using block-aware logic
        const [dayDate, sessionIndex] = source.droppableId.replace('session-', '').split('::');
        const sessionExercises = exerciseDistribution
          .filter(ex => ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId)
          .sort((a, b) => a.order - b.order);

        // Build blocks to treat supersets atomically
        const blocks = buildBlocks(sessionExercises, dayDate, parseInt(sessionIndex), undefined);
        
        // Find which block contains the dragged exercise
        const sourceBlockIndex = blocks.findIndex(b => b.items.some(x => x.id === draggableId));
        if (sourceBlockIndex === -1) return;
        
        const sourceBlock = blocks[sourceBlockIndex];
        
            // Determine drag direction based on visual positions
            // Find the visual end position of the source block
            const sourceBlockEndIndex = sourceBlock.items.reduce((maxIdx, item) => {
              const visualIdx = sessionExercises.findIndex(ex => ex.id === item.id);
              return Math.max(maxIdx, visualIdx);
            }, -1);

            const preferAfter = destination.index > sourceBlockEndIndex;
        
        // Compute safe insertion index
        const insertIndex = computeInsertIndexFromBlocks(blocks, sourceBlockIndex, destination.index, preferAfter);
        
        // Remove all exercises from source block
        const remainingExercises = sessionExercises.filter(
          ex => !sourceBlock.items.find(se => se.id === ex.id)
        );
        
        // Insert all block exercises at safe index
        remainingExercises.splice(insertIndex, 0, ...sourceBlock.items);
        
        // Re-index
        remainingExercises.forEach((ex, idx) => ex.order = idx);

        const otherExercises = exerciseDistribution.filter(
          ex => !(ex.dayDate === dayDate && ex.sessionIndex === parseInt(sessionIndex) && !ex.sectionId)
        );

        onDistributionChange([...otherExercises, ...remainingExercises]);
        return;
      }
    }

    // Handle moving FROM section TO unsectioned session area
    if (type === 'EXERCISE' && source.droppableId.startsWith('section-') && destination.droppableId.startsWith('session-')) {
      const sourceSectionId = source.droppableId.replace('section-', '');
      const [destDayDate, destSessionIndex] = destination.droppableId.replace('session-', '').split('::');
      
      const sourceSection = sessionSections.find(s => s.id === sourceSectionId);
      if (!sourceSection) return;
      
      const sourceExercises = exerciseDistribution
        .filter(ex => ex.sectionId === sourceSectionId)
        .sort((a, b) => a.order - b.order);
      
      const destExercises = exerciseDistribution
        .filter(ex => ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);
      
      // Get all exercises in the superset (now section-aware)
      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceSection.dayDate,
        sourceSection.sessionIndex,
        sourceSectionId
      );
      
      // Remove all superset exercises from source
      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );
      
      // Update all superset exercises
      supersetExercises.forEach(ex => {
        ex.dayDate = destDayDate;
        ex.sessionIndex = parseInt(destSessionIndex);
        ex.sectionId = undefined;
      });
      
      // Update SupersetMapping: move superset from section to unsectioned
      const newSupersets = structuredClone(supersets);
      const match = findSessionSuperset(sourceSection.dayDate, sourceSection.sessionIndex, draggableId, sourceSectionId);
      
      if (match) {
        // Remove from source section
        const sectionKey = sourceSectionId;
        const srcSectionSupersets = newSupersets[sourceSection.dayDate]?.[sourceSection.sessionIndex]?.[sectionKey];
        if (srcSectionSupersets) {
          const movedIds = new Set(supersetExercises.map(ex => ex.id));
          srcSectionSupersets[match.supersetId] = srcSectionSupersets[match.supersetId].filter(id => !movedIds.has(id));
          
          // Clean up empty superset
          if (srcSectionSupersets[match.supersetId].length < 2) {
            delete srcSectionSupersets[match.supersetId];
          }
          
          // Clean up empty section
          if (Object.keys(srcSectionSupersets).length === 0) {
            delete newSupersets[sourceSection.dayDate][sourceSection.sessionIndex][sectionKey];
          }
        }
        
        // Add to destination unsectioned area
        if (!newSupersets[destDayDate]) newSupersets[destDayDate] = {};
        if (!newSupersets[destDayDate][parseInt(destSessionIndex)]) {
          newSupersets[destDayDate][parseInt(destSessionIndex)] = {};
        }
        if (!newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__']) {
          newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__'] = {};
        }
        
        const destUnsectionedSupersets = newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__'];
        
        // Find next available superset ID in unsectioned area
        const existingIds = Object.keys(destUnsectionedSupersets)
          .map(k => {
            const match = k.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newSupersetId = `superset-${nextId}`;
        
        // Create new superset with moved exercise IDs
        destUnsectionedSupersets[newSupersetId] = supersetExercises.map(ex => ex.id);
        
        onSupersetsChange(newSupersets);
      }
      
      // Use block-aware insertion to avoid splitting supersets
      const blocks = buildBlocks(destExercises, destDayDate, parseInt(destSessionIndex), undefined);
      const safeBlockIndex = mapItemIndexToBlockIndex(blocks, destination.index, false);
      
      // Calculate actual item index from block index
      let insertIndex = 0;
      for (let i = 0; i < safeBlockIndex; i++) {
        insertIndex += blocks[i].items.length;
      }
      
      // Insert all superset exercises at safe destination
      destExercises.splice(insertIndex, 0, ...supersetExercises);
      
      remainingSourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => ex.sectionId !== sourceSectionId && 
             !(ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
      );
      
      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...destExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: `${exerciseText} moved`, description: 'Moved to main session area' });
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
      
      // Get all exercises in the superset using mapping (from unsectioned area)
      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceDayDate,
        parseInt(sourceSessionIndex),
        undefined  // from unsectioned area
      );
      
      // Remove all superset exercises from source
      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );
      
      // Update all superset exercises
      supersetExercises.forEach(ex => {
        ex.dayDate = destSection.dayDate;
        ex.sessionIndex = destSection.sessionIndex;
        ex.sectionId = destSectionId;
      });
      
      // Update SupersetMapping: move superset from unsectioned to section
      const newSupersets = structuredClone(supersets);
      const match = findSessionSuperset(sourceDayDate, parseInt(sourceSessionIndex), draggableId, undefined);
      
      if (match) {
        // Remove from source unsectioned
        const srcUnsectionedSupersets = newSupersets[sourceDayDate]?.[parseInt(sourceSessionIndex)]?.['__unsectioned__'];
        if (srcUnsectionedSupersets) {
          const movedIds = new Set(supersetExercises.map(ex => ex.id));
          srcUnsectionedSupersets[match.supersetId] = srcUnsectionedSupersets[match.supersetId].filter(id => !movedIds.has(id));
          
          // Clean up empty superset
          if (srcUnsectionedSupersets[match.supersetId].length < 2) {
            delete srcUnsectionedSupersets[match.supersetId];
          }
          
          // Clean up empty unsectioned
          if (Object.keys(srcUnsectionedSupersets).length === 0) {
            delete newSupersets[sourceDayDate][parseInt(sourceSessionIndex)]['__unsectioned__'];
          }
        }
        
        // Add to destination section
        if (!newSupersets[destSection.dayDate]) newSupersets[destSection.dayDate] = {};
        if (!newSupersets[destSection.dayDate][destSection.sessionIndex]) {
          newSupersets[destSection.dayDate][destSection.sessionIndex] = {};
        }
        if (!newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId]) {
          newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId] = {};
        }
        
        const destSectionSupersets = newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId];
        
        // Find next available superset ID in section
        const existingIds = Object.keys(destSectionSupersets)
          .map(k => {
            const match = k.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newSupersetId = `superset-${nextId}`;
        
        // Create new superset with moved exercise IDs
        destSectionSupersets[newSupersetId] = supersetExercises.map(ex => ex.id);
        
        onSupersetsChange(newSupersets);
      }
      
      // Insert all superset exercises at destination
      destExercises.splice(destination.index, 0, ...supersetExercises);
      
      remainingSourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => !(ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId) &&
             ex.sectionId !== destSectionId
      );
      
      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...destExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: `${exerciseText} moved to section`, description: `Added to ${destSection.name}` });
      return;
    }

    // Handle moving BETWEEN sections - now superset-aware
    if (type === 'EXERCISE' && source.droppableId.startsWith('section-') && destination.droppableId.startsWith('section-') &&
        source.droppableId !== destination.droppableId) {
      const sourceSectionId = source.droppableId.replace('section-', '');
      const destSectionId = destination.droppableId.replace('section-', '');
      
      const sourceSection = sessionSections.find(s => s.id === sourceSectionId);
      const destSection = sessionSections.find(s => s.id === destSectionId);
      if (!sourceSection || !destSection) return;
      
      const sourceExercises = exerciseDistribution
        .filter(ex => ex.sectionId === sourceSectionId)
        .sort((a, b) => a.order - b.order);
      
      const destExercises = exerciseDistribution
        .filter(ex => ex.sectionId === destSectionId)
        .sort((a, b) => a.order - b.order);
      
      // Get all exercises in the superset (section-aware)
      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceSection.dayDate,
        sourceSection.sessionIndex,
        sourceSectionId
      );
      
      // Remove all superset exercises from source
      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );
      
      // Update all superset exercises
      supersetExercises.forEach(ex => {
        ex.sectionId = destSectionId;
        ex.dayDate = destSection.dayDate;
        ex.sessionIndex = destSection.sessionIndex;
      });
      
      // Update SupersetMapping: move superset from source section to dest section
      const newSupersets = structuredClone(supersets);
      const match = findSessionSuperset(sourceSection.dayDate, sourceSection.sessionIndex, draggableId, sourceSectionId);
      
      if (match) {
        // Remove from source section
        const srcSectionSupersets = newSupersets[sourceSection.dayDate]?.[sourceSection.sessionIndex]?.[sourceSectionId];
        if (srcSectionSupersets) {
          const movedIds = new Set(supersetExercises.map(ex => ex.id));
          srcSectionSupersets[match.supersetId] = srcSectionSupersets[match.supersetId].filter(id => !movedIds.has(id));
          
          // Clean up empty superset
          if (srcSectionSupersets[match.supersetId].length < 2) {
            delete srcSectionSupersets[match.supersetId];
          }
          
          // Clean up empty section
          if (Object.keys(srcSectionSupersets).length === 0) {
            delete newSupersets[sourceSection.dayDate][sourceSection.sessionIndex][sourceSectionId];
          }
        }
        
        // Add to destination section
        if (!newSupersets[destSection.dayDate]) newSupersets[destSection.dayDate] = {};
        if (!newSupersets[destSection.dayDate][destSection.sessionIndex]) {
          newSupersets[destSection.dayDate][destSection.sessionIndex] = {};
        }
        if (!newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId]) {
          newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId] = {};
        }
        
        const destSectionSupersets = newSupersets[destSection.dayDate][destSection.sessionIndex][destSectionId];
        
        // Find next available superset ID in dest section
        const existingIds = Object.keys(destSectionSupersets)
          .map(k => {
            const match = k.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newSupersetId = `superset-${nextId}`;
        
        // Create new superset with moved exercise IDs
        destSectionSupersets[newSupersetId] = supersetExercises.map(ex => ex.id);
        
        onSupersetsChange(newSupersets);
      }
      
      // Insert all superset exercises at destination
      destExercises.splice(destination.index, 0, ...supersetExercises);
      
      remainingSourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);
      
      const otherExercises = exerciseDistribution.filter(
        ex => ex.sectionId !== sourceSectionId && ex.sectionId !== destSectionId
      );
      
      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...destExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: `${exerciseText} moved between sections`, description: `Moved to ${destSection.name}` });
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
      
      // Get all exercises in the superset using mapping (from unsectioned)
      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceDayDate,
        parseInt(sourceSessionIndex),
        undefined  // from unsectioned area
      );
      
      // Remove all superset exercises from source
      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );
      
      // Update all superset exercises
      supersetExercises.forEach(ex => {
        ex.dayDate = destDayDate;
        ex.sessionIndex = parseInt(destSessionIndex);
        ex.sectionId = undefined;
      });

      // Update SupersetMapping: transfer superset from source unsectioned to destination unsectioned
      const newSupersets = structuredClone(supersets);
      const match = findSessionSuperset(sourceDayDate, parseInt(sourceSessionIndex), draggableId, undefined);
      
      if (match) {
        // Remove from source unsectioned
        const srcUnsectionedSupersets = newSupersets[sourceDayDate]?.[parseInt(sourceSessionIndex)]?.['__unsectioned__'];
        if (srcUnsectionedSupersets) {
          const movedIds = new Set(supersetExercises.map(ex => ex.id));
          srcUnsectionedSupersets[match.supersetId] = srcUnsectionedSupersets[match.supersetId].filter(id => !movedIds.has(id));
          
          // Clean up empty superset
          if (srcUnsectionedSupersets[match.supersetId].length < 2) {
            delete srcUnsectionedSupersets[match.supersetId];
          }
          
          // Clean up empty unsectioned
          if (Object.keys(srcUnsectionedSupersets).length === 0) {
            delete newSupersets[sourceDayDate][parseInt(sourceSessionIndex)]['__unsectioned__'];
          }
          
          // Clean up empty session
          if (Object.keys(newSupersets[sourceDayDate][parseInt(sourceSessionIndex)]).length === 0) {
            delete newSupersets[sourceDayDate][parseInt(sourceSessionIndex)];
          }
          
          // Clean up empty day
          if (Object.keys(newSupersets[sourceDayDate] || {}).length === 0) {
            delete newSupersets[sourceDayDate];
          }
        }
        
        // Add to destination unsectioned
        if (!newSupersets[destDayDate]) newSupersets[destDayDate] = {};
        if (!newSupersets[destDayDate][parseInt(destSessionIndex)]) {
          newSupersets[destDayDate][parseInt(destSessionIndex)] = {};
        }
        if (!newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__']) {
          newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__'] = {};
        }
        
        const destUnsectionedSupersets = newSupersets[destDayDate][parseInt(destSessionIndex)]['__unsectioned__'];
        
        // Find next available superset ID
        const existingIds = Object.keys(destUnsectionedSupersets)
          .map(k => {
            const match = k.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newSupersetId = `superset-${nextId}`;
        
        // Create new superset with moved exercise IDs
        destUnsectionedSupersets[newSupersetId] = supersetExercises.map(ex => ex.id);
        
        onSupersetsChange(newSupersets);
      }

      // Use block-aware insertion to avoid splitting supersets
      const destBlocks = buildBlocks(destExercises, destDayDate, parseInt(destSessionIndex), undefined);
      const safeBlockIndex = mapItemIndexToBlockIndex(destBlocks, destination.index, false);
      
      // Calculate actual item index from block index
      let insertIndex = 0;
      for (let i = 0; i < safeBlockIndex; i++) {
        insertIndex += destBlocks[i].items.length;
      }

      // Insert all superset exercises at safe destination
      destExercises.splice(insertIndex, 0, ...supersetExercises);

      remainingSourceExercises.forEach((ex, idx) => ex.order = idx);
      destExercises.forEach((ex, idx) => ex.order = idx);

      const otherExercises = exerciseDistribution.filter(
        ex => !(
          (ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId) ||
          (ex.dayDate === destDayDate && ex.sessionIndex === parseInt(destSessionIndex) && !ex.sectionId)
        )
      );

      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...destExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: `${exerciseText} moved`, description: 'Moved to another session' });
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

  const handleSessionCommentsChange = (dayDate: string, sessionIndex: number, comments: string) => {
    if (!mesocycle?.id) return;
    const key = `sessionComments_${mesocycle.id}_${dayDate}_${sessionIndex}`;
    
    // Update state immediately for instant UI response
    setSessionCommentsMap(prev => ({ ...prev, [key]: comments }));
    
    // Debounce localStorage write
    debouncedSaveToLocalStorage(key, comments);
  };

  const handleSectionCommentsChange = (sectionId: string, comments: string) => {
    const updated = sessionSections.map(s => 
      s.id === sectionId ? { ...s, comments } : s
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

  const handleToggleSuperset = (dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => {
    const sectionKey = sectionId || '__unsectioned__';
    const sectionSupersets = supersets[dayDate]?.[sessionIndex]?.[sectionKey] || {};
    
    // Find if either exercise is in a superset
    let superset1: string | undefined;
    let superset2: string | undefined;
    
    Object.entries(sectionSupersets).forEach(([ssId, exerciseIds]) => {
      if (exerciseIds.includes(exerciseId1)) superset1 = ssId;
      if (exerciseIds.includes(exerciseId2)) superset2 = ssId;
    });

    const newSupersets = { ...supersets };
    if (!newSupersets[dayDate]) newSupersets[dayDate] = {};
    if (!newSupersets[dayDate][sessionIndex]) newSupersets[dayDate][sessionIndex] = {};
    if (!newSupersets[dayDate][sessionIndex][sectionKey]) newSupersets[dayDate][sessionIndex][sectionKey] = {};
    const sectionSuperset = newSupersets[dayDate][sessionIndex][sectionKey];

    if (!superset1 && !superset2) {
      // CREATE: Neither in a superset, create new one
      const existingSupersetIds = Object.keys(sectionSuperset).map(id => {
        const match = id.match(/superset-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
      const newSupersetId = `superset-${nextId}`;
      sectionSuperset[newSupersetId] = [exerciseId1, exerciseId2];
      toast({ title: 'Superset created', description: 'Exercises linked' });
    } else if (superset1 && superset1 === superset2) {
      // UNLINK: Split the superset at this connection point
      const currentIds = sectionSuperset[superset1];
      const index1 = currentIds.indexOf(exerciseId1);
      const index2 = currentIds.indexOf(exerciseId2);
      
      if (Math.abs(index1 - index2) === 1) {
        const splitPoint = Math.min(index1, index2) + 1;
        const firstGroup = currentIds.slice(0, splitPoint);
        const secondGroup = currentIds.slice(splitPoint);
        
        if (firstGroup.length >= 2) {
          sectionSuperset[superset1] = firstGroup;
        } else {
          delete sectionSuperset[superset1];
        }
        
        if (secondGroup.length >= 2) {
          const existingSupersetIds = Object.keys(sectionSuperset).map(id => {
            const match = id.match(/superset-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
          const newSupersetId = `superset-${nextId}`;
          sectionSuperset[newSupersetId] = secondGroup;
        }
        
        toast({ title: 'Exercises unlinked', description: 'Connection removed' });
      }
    } else if (superset1 && superset2 && superset1 !== superset2) {
      // MERGE: Combine two different supersets
      const merged = Array.from(new Set([...(sectionSuperset[superset1] || []), ...(sectionSuperset[superset2] || [])]));
      sectionSuperset[superset1] = merged;
      delete sectionSuperset[superset2];
      toast({ title: 'Supersets merged', description: 'Exercises linked' });
    } else {
      // ADD: One is in a superset, add the other
      const targetSuperset = superset1 || superset2;
      if (targetSuperset) {
        if (!sectionSuperset[targetSuperset].includes(exerciseId1)) {
          sectionSuperset[targetSuperset].push(exerciseId1);
        }
        if (!sectionSuperset[targetSuperset].includes(exerciseId2)) {
          sectionSuperset[targetSuperset].push(exerciseId2);
        }
        toast({ title: 'Exercise added to superset', description: 'Exercise linked' });
      }
    }

    onSupersetsChange(newSupersets);
  };

  const handleCopyFromPreviousMicrocycle = (targetMicrocycleId: string) => {
    setCopyingMicrocycleId(targetMicrocycleId);
    
    try {
      // Find the target mesocycle and microcycle across all mesocycles
      let targetMesoIndex = -1;
      let targetMicroIndex = -1;
      let targetMesocycle: ExtendedMesocycle | null = null;
      let targetMicrocycle: typeof mesocycle.microcycles[0] | null = null;
      
      for (let i = 0; i < allMesocycles.length; i++) {
        const microIndex = allMesocycles[i].microcycles.findIndex(m => m.id === targetMicrocycleId);
        if (microIndex !== -1) {
          targetMesoIndex = i;
          targetMicroIndex = microIndex;
          targetMesocycle = allMesocycles[i];
          targetMicrocycle = allMesocycles[i].microcycles[microIndex];
          break;
        }
      }
      
      if (!targetMesocycle || !targetMicrocycle) {
        toast({ 
          title: 'Error', 
          description: 'Target microcycle not found', 
          variant: 'destructive' 
        });
        return;
      }
      
      // Find the source (previous) microcycle
      let sourceMesocycle: ExtendedMesocycle | null = null;
      let sourceMicrocycle: typeof mesocycle.microcycles[0] | null = null;
      
      if (targetMicroIndex > 0) {
        // Previous microcycle in same mesocycle
        sourceMesocycle = targetMesocycle;
        sourceMicrocycle = targetMesocycle.microcycles[targetMicroIndex - 1];
      } else if (targetMesoIndex > 0) {
        // First microcycle of mesocycle - get last microcycle of previous mesocycle
        sourceMesocycle = allMesocycles[targetMesoIndex - 1];
        sourceMicrocycle = sourceMesocycle.microcycles[sourceMesocycle.microcycles.length - 1];
      } else {
        // Very first microcycle of entire plan
        toast({ 
          title: 'Cannot copy', 
          description: 'This is the first microcycle of the plan',
          variant: 'destructive'
        });
        return;
      }
      
      // DURATION VALIDATION
      if (sourceMicrocycle.duration !== targetMicrocycle.duration) {
        toast({
          title: 'Cannot copy',
          description: `Microcycle durations don't match (source: ${sourceMicrocycle.duration} days, target: ${targetMicrocycle.duration} days)`,
          variant: 'destructive'
        });
        return;
      }
      
      // Get training days for both microcycles (may be from different mesocycles)
      const sourceDays = trainingDays.filter(day => day.microcycleId === sourceMicrocycle!.id);
      const targetDays = trainingDays.filter(day => day.microcycleId === targetMicrocycle!.id);
      
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
            
            Object.entries(sessionSupersets).forEach(([sectionId, sectionSupersets]) => {
              newSupersets[targetDate][Number(sessionIndex)][sectionId] = {};
              
              Object.entries(sectionSupersets).forEach(([supersetId, exerciseIds]) => {
                // Map old exercise IDs to new ones
                const newExerciseIds = exerciseIds
                  .map(oldId => oldToNewExerciseIds[oldId])
                  .filter(id => id !== undefined);
                
                if (newExerciseIds.length > 0) {
                  newSupersets[targetDate][Number(sessionIndex)][sectionId][supersetId] = newExerciseIds;
                }
              });
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

  const handleCopyFromPreviousMesocycle = () => {
    setCopyingMesocycle(true);
    
    try {
      // Find current mesocycle index
      const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
      
      if (currentMesoIndex <= 0) {
        toast({
          title: 'Cannot copy',
          description: 'This is the first mesocycle',
          variant: 'destructive'
        });
        return;
      }
      
      const sourceMesocycle = allMesocycles[currentMesoIndex - 1];
      
      // STRUCTURE VALIDATION: Check if microcycle counts match
      if (sourceMesocycle.microcycles.length !== mesocycle.microcycles.length) {
        toast({
          title: 'Cannot copy',
          description: `Microcycle count doesn't match (source: ${sourceMesocycle.microcycles.length}, target: ${mesocycle.microcycles.length})`,
          variant: 'destructive'
        });
        return;
      }
      
      // Check each microcycle duration
      const durationMismatch = mesocycle.microcycles.some((targetMicro, index) => {
        const sourceMicro = sourceMesocycle.microcycles[index];
        return sourceMicro.duration !== targetMicro.duration;
      });
      
      if (durationMismatch) {
        const sourceStructure = sourceMesocycle.microcycles.map(m => m.duration).join(', ');
        const targetStructure = mesocycle.microcycles.map(m => m.duration).join(', ');
        toast({
          title: 'Cannot copy',
          description: `Microcycle structure doesn't match:\nSource: [${sourceStructure}] days\nTarget: [${targetStructure}] days`,
          variant: 'destructive'
        });
        return;
      }
      
      // All validations passed - proceed with copy
      const newExercises: ExerciseDistribution[] = [];
      const newSections: SessionSection[] = [];
      const newSupersets: SupersetMapping = { ...supersets };
      const oldToNewExerciseIds: Record<string, string> = {};
      
      // Loop through each microcycle pair
      mesocycle.microcycles.forEach((targetMicro, microIndex) => {
        const sourceMicro = sourceMesocycle.microcycles[microIndex];
        
        // Get days for both microcycles
        const sourceDays = trainingDays.filter(d => d.microcycleId === sourceMicro.id);
        const targetDays = trainingDays.filter(d => d.microcycleId === targetMicro.id);
        
        // Day mapping
        const minDays = Math.min(sourceDays.length, targetDays.length);
        const dayMapping: Record<string, string> = {};
        
        for (let i = 0; i < minDays; i++) {
          dayMapping[sourceDays[i].date] = targetDays[i].date;
        }
        
        // Copy exercises for this microcycle pair
        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;
          
          const targetDate = dayMapping[sourceDay.date];
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
        
        // Copy sections for this microcycle pair
        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;
          
          const targetDate = dayMapping[sourceDay.date];
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
        
        // Copy supersets for this microcycle pair
        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;
          
          const targetDate = dayMapping[sourceDay.date];
          const sourceDateSupersets = supersets[sourceDay.date];
          
          if (sourceDateSupersets) {
            newSupersets[targetDate] = {};
            
            Object.entries(sourceDateSupersets).forEach(([sessionIndex, sessionSupersets]) => {
              newSupersets[targetDate][Number(sessionIndex)] = {};
              
              Object.entries(sessionSupersets).forEach(([sectionId, sectionSupersets]) => {
                newSupersets[targetDate][Number(sessionIndex)][sectionId] = {};
                
                Object.entries(sectionSupersets).forEach(([supersetId, exerciseIds]) => {
                  const newExerciseIds = exerciseIds
                    .map(oldId => oldToNewExerciseIds[oldId])
                    .filter(id => id !== undefined);
                  
                  if (newExerciseIds.length > 0) {
                    newSupersets[targetDate][Number(sessionIndex)][sectionId][supersetId] = newExerciseIds;
                  }
                });
              });
            });
          }
        });
      });
      
      // Clear target mesocycle's existing data
      const currentMesocycleDays = trainingDays.filter(day => {
        const mesocycleStartDate = typeof mesocycle.startDate === 'string' 
          ? (mesocycle.startDate as string).split('T')[0] 
          : format(mesocycle.startDate as Date, 'yyyy-MM-dd');
        const mesocycleEndDate = typeof mesocycle.endDate === 'string'
          ? (mesocycle.endDate as string).split('T')[0]
          : format(mesocycle.endDate as Date, 'yyyy-MM-dd');
        return day.date >= mesocycleStartDate && day.date <= mesocycleEndDate;
      });
      
      const targetDates = currentMesocycleDays.map(d => d.date);
      const filteredExercises = exerciseDistribution.filter(
        ex => !targetDates.includes(ex.dayDate)
      );
      const filteredSections = sessionSections.filter(
        s => !targetDates.includes(s.dayDate)
      );
      
      targetDates.forEach(date => {
        delete newSupersets[date];
      });
      
      // Apply copied data
      onDistributionChange([...filteredExercises, ...newExercises]);
      onSectionsChange([...filteredSections, ...newSections]);
      onSupersetsChange(newSupersets);
      
      toast({
        title: 'Mesocycle copied successfully',
        description: `Copied ${newExercises.length} exercises from ${sourceMesocycle.name} to ${mesocycle.name}`,
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'An error occurred while copying the mesocycle',
        variant: 'destructive'
      });
    } finally {
      setCopyingMesocycle(false);
    }
  };

  const handleClearMicrocycle = (microcycleId: string) => {
    const microcycle = mesocycle.microcycles.find(m => m.id === microcycleId);
    if (!microcycle) return;
    
    // Get all days for this microcycle
    const microcycleDays = trainingDays.filter(d => d.microcycleId === microcycleId);
    const dayDates = microcycleDays.map(d => d.date);
    
    // Remove exercises for these days
    const filteredExercises = exerciseDistribution.filter(
      ex => !dayDates.includes(ex.dayDate)
    );
    
    // Remove sections for these days
    const filteredSections = sessionSections.filter(
      s => !dayDates.includes(s.dayDate)
    );
    
    // Remove supersets for these days
    const newSupersets = { ...supersets };
    dayDates.forEach(date => {
      delete newSupersets[date];
    });
    
    // Clear session comments from localStorage
    microcycleDays.forEach(day => {
      const sessionsCount = day.sessionNames?.length || 1;
      for (let i = 0; i < sessionsCount; i++) {
        const key = `sessionComments_${mesocycle.id}_${day.date}_${i}`;
        localStorage.removeItem(key);
        
        // Also remove from state
        setSessionCommentsMap(prev => {
          const newMap = { ...prev };
          delete newMap[key];
          return newMap;
        });
      }
    });
    
    // Clear session intensities from localStorage
    microcycleDays.forEach(day => {
      const sessionsCount = day.sessionNames?.length || 1;
      for (let i = 0; i < sessionsCount; i++) {
        const key = `sessionIntensity_${mesocycle.id}_${day.date}_${i}`;
        localStorage.removeItem(key);
      }
    });
    
    // Update state
    onDistributionChange(filteredExercises);
    onSectionsChange(filteredSections);
    onSupersetsChange(newSupersets);
    
    toast({
      title: 'Microcycle cleared',
      description: `All content removed from ${microcycle.name}`,
    });
  };

  return (
    <>
      {/* Clear Microcycle Confirmation Dialog */}
      <AlertDialog open={!!clearingMicrocycleId} onOpenChange={(open) => !open && setClearingMicrocycleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Microcycle</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all exercises, sessions, sections, and comments from{' '}
              <strong>
                {clearingMicrocycleId && mesocycle.microcycles.find(m => m.id === clearingMicrocycleId)?.name}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clearingMicrocycleId) {
                  handleClearMicrocycle(clearingMicrocycleId);
                  setClearingMicrocycleId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Microcycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-xl font-bold">
                    {mesocycle.name}
                  </h2>
                  {(() => {
                    const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
                    const isFirstMesocycle = currentMesoIndex === 0;
                    
                    if (!isFirstMesocycle) {
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={copyingMesocycle}
                          title={`Copy entire setup from ${allMesocycles[currentMesoIndex - 1].name}`}
                          onClick={handleCopyFromPreviousMesocycle}
                        >
                          {copyingMesocycle ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
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
                    const sessionsCount = day.sessions ?? 1;
                    const gapCount = Math.max(0, sessionsCount - 1);
                    const dayWidth = Math.max(320, sessionsCount * 320 + gapCount * 8);
                    const gapAfterDay = dayIndex < days.length - 1 ? 16 : 0;
                    return total + dayWidth + gapAfterDay;
                  }, 0);
                  
                  // Check if this is the very first microcycle across all mesocycles
                  const isVeryFirstMicrocycle = (() => {
                    const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
                    return currentMesoIndex === 0 && microIndex === 0;
                  })();
                  
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
                {!isVeryFirstMicrocycle && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    disabled={copyingMicrocycleId === microId}
                    title={(() => {
                      const currentMesoIndex = allMesocycles.findIndex(m => m.id === mesocycle.id);
                      if (microIndex > 0) {
                        return `Copy setup from ${mesocycle.microcycles[microIndex - 1].name}`;
                      } else if (currentMesoIndex > 0) {
                        const prevMeso = allMesocycles[currentMesoIndex - 1];
                        const prevMicro = prevMeso.microcycles[prevMeso.microcycles.length - 1];
                        return `Copy setup from ${prevMicro.name} (${prevMeso.name})`;
                      }
                      return 'Copy setup from previous microcycle';
                    })()}
                    onClick={() => handleCopyFromPreviousMicrocycle(microId)}
                  >
                    {copyingMicrocycleId === microId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  title={`Clear all content from ${microcycle.name}`}
                  onClick={() => setClearingMicrocycleId(microId)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
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
                        const sessionsCount = day.sessions ?? 1;
                        
                        // Safety check
                        if (!day || !day.date) {
                          console.error('EnhancedExerciseDistribution: Invalid day object', day);
                          return null;
                        }
                        
                        return (
                          <div key={day.date} className="flex flex-col w-80">
                            {/* Day Header - Shows once per day */}
                <DayHeader
                  date={day.date}
                  intensity={day.intensity || 'moderate'}
                  intensityLevels={intensityLevels}
                  getIntensityColor={getIntensityColor}
                  onDayIntensityChange={onDayIntensityChange}
                  sessionCount={sessionsCount}
                  testNames={day.testNames}
                  eventNames={day.eventNames}
                />
                            
                            {/* Sessions - Multiple can exist under one day */}
                            <div className="flex flex-col gap-2">
                              {Array.from({ length: sessionsCount }).map((_, sessionIndex) => {
                                const sessionExercises = exerciseDistribution
                                  .filter(ex => ex.dayDate === day.date && ex.sessionIndex === sessionIndex)
                                  .sort((a, b) => a.order - b.order);

                                const daySections = sessionSections
                                  .filter(s => s.dayDate === day.date && s.sessionIndex === sessionIndex)
                                  .sort((a, b) => a.order - b.order);

                                const daySupersets = supersets[day.date]?.[sessionIndex] || {};

                                // Get session comments from state
                                const sessionCommentsKey = mesocycle.id ? `sessionComments_${mesocycle.id}_${day.date}_${sessionIndex}` : '';
                                const sessionComments = sessionCommentsKey ? (sessionCommentsMap[sessionCommentsKey] || '') : '';

                                return (
                                  <SessionColumnView
                                    key={`${day.date}-${sessionIndex}`}
                                    day={day}
                                    sessionIndex={sessionIndex}
                                    exercises={sessionExercises}
                                    sections={daySections}
                                    supersets={daySupersets}
                                    totalSessionsOnDay={sessionsCount}
                                    onDeleteExercise={handleDeleteExercise}
                                    onAddSection={() => handleAddSection(day.date, sessionIndex)}
                                    onRenameSection={handleRenameSection}
                                    onDeleteSection={handleDeleteSection}
                                    onToggleSuperset={handleToggleSuperset}
                                    onRemoveSession={onRemoveSession}
                                    onRenameSession={onRenameSession}
                                    onSessionIntensityChange={onSessionIntensityChange}
                                    intensityLevels={intensityLevels}
                                    getIntensityColor={getIntensityColor}
                                    mesocycleId={mesocycle.id}
                                    sessionComments={sessionComments}
                                    onSessionCommentsChange={handleSessionCommentsChange}
                                    onSectionCommentsChange={handleSectionCommentsChange}
                                  />
                                );
                              })}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => onAddSession(day.date)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Session
                              </Button>
                            </div>
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
    </>
  );
}
