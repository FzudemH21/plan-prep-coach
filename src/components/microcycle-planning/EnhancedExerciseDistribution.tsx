import React, { useState, useMemo, useEffect, useCallback } from 'react';

import { DragDropContext, Droppable, Draggable, DropResult, DragStart } from '@hello-pangea/dnd';
import { ExtendedMesocycle } from '@/features/planner/types';
import { TrainingDay } from '@/types/daily-intensity';
import { CellData, ExerciseDistribution, ExerciseSelection, SessionSection, SupersetMapping } from '@/types/microcycle-planning';
import { IntensityLevel } from '@/types/training';
import { ExerciseLibraryPanel } from './ExerciseLibraryPanel';
import { ExerciseLibraryPopup } from './ExerciseLibraryPopup';
import { SessionColumnView } from './SessionColumnView';
import { DayHeader } from './DayHeader';
import { displayMethodLabel } from './methodLabelUtils';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Copy, Loader2, Plus, Trash2, Recycle, Trophy, Calendar as CalendarIcon } from 'lucide-react';
import { useCustomLibraries } from '@/contexts/CustomLibrariesContext';
import type { Circuit } from '@/contexts/CustomLibrariesContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cleanupSupersetsOnExerciseDelete, toggleSuperset } from '@/utils/supersetUtils';
import { CircuitBuilderDialog } from '@/components/templates/CircuitBuilderDialog';

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
  onClearMicrocycle?: (microcycleId: string) => void;
  onClearMesocycle?: (mesocycleId: string) => void;
  copiedSection?: any;
  onCopySection?: (sectionId: string) => void;
  onPasteSection?: (dayDate: string, sessionIndex: number) => void;
  copiedSession?: any;
  onCopySession?: (dayDate: string, sessionIndex: number) => void;
  onPasteSession?: (dayDate: string) => void;
  onMoveSessionUp?: (dayDate: string, sessionIndex: number) => void;
  onMoveSessionDown?: (dayDate: string, sessionIndex: number) => void;
  onUpdateTrainingDay?: (dayDate: string, updates: Partial<TrainingDay>) => void;
  /** From Step 1: key = "${dayDate}_${sessionIndex}" → assigned methodIds */
  dayMethodAssignments?: Record<string, string[]>;
  /** Bidirectional sync: called when an exercise is added inline and needs to be written back */
  onExerciseSelectionDataChange?: (data: Record<string, CellData>) => void;
  /** Controlled selected microcycle index (lifted to page for pill navigation) */
  selectedMicrocycleIndex?: number;
  onSelectedMicrocycleIndexChange?: (index: number) => void;
  /** methodName → mesocycleId[] — used to filter the left panel to assigned methods only */
  methodAllocations?: Record<string, string[]>;
  /** methodName → exerciseCategory[] from the toolbox — methods absent here are not split */
  methodExerciseCategories?: Record<string, string[]>;
  /** Increment to force a re-load of session comments from localStorage */
  sessionCommentsRefreshKey?: number;
}

// ── Pure helpers (no component state — defined outside to avoid re-creation) ──

function formatIntensityLabel(intensity: IntensityLevel): string {
  const labels: Record<IntensityLevel, string> = {
    'off': 'OFF',
    'deload': 'DELOAD',
    'easy': 'EASY',
    'easy-moderate': 'EASY-MODERATE',
    'moderate': 'MODERATE',
    'moderate-hard': 'MODERATE-HARD',
    'hard': 'HARD',
    'extremely-hard': 'EXTREMELY HARD',
  };
  return labels[intensity] || intensity.toUpperCase();
}

function getSubtleIntensityBg(intensity: IntensityLevel): string {
  const bgMappings: Record<IntensityLevel, string> = {
    'off': 'bg-[hsl(var(--intensity-off)/0.15)]',
    'deload': 'bg-[hsl(var(--intensity-deload)/0.15)]',
    'easy': 'bg-[hsl(var(--intensity-easy)/0.15)]',
    'easy-moderate': 'bg-[hsl(var(--intensity-easy-moderate)/0.15)]',
    'moderate': 'bg-[hsl(var(--intensity-moderate)/0.15)]',
    'moderate-hard': 'bg-[hsl(var(--intensity-moderate-hard)/0.15)]',
    'hard': 'bg-[hsl(var(--intensity-hard)/0.15)]',
    'extremely-hard': 'bg-[hsl(var(--intensity-extremely-hard)/0.20)]',
  };
  return bgMappings[intensity] || 'bg-primary/10';
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
  onClearMicrocycle,
  onClearMesocycle,
  onSessionIntensityChange,
  onDayIntensityChange,
  intensityLevels,
  copiedSection,
  onCopySection,
  onPasteSection,
  copiedSession,
  onCopySession,
  onPasteSession,
  onMoveSessionUp,
  onMoveSessionDown,
  onUpdateTrainingDay,
  dayMethodAssignments,
  onExerciseSelectionDataChange,
  selectedMicrocycleIndex: selectedMicrocycleIndexProp,
  onSelectedMicrocycleIndexChange,
  methodAllocations = {},
  methodExerciseCategories,
  sessionCommentsRefreshKey,
}: EnhancedExerciseDistributionProps) {
  const { toast } = useToast();
  const { libraries } = useCustomLibraries();
  const [draggingMethodId, setDraggingMethodId] = useState<string | null>(null);
  const [inlinePicker, setInlinePicker] = useState<{ dayDate: string; sessionIndex: number; sectionId?: string; methodId?: string } | null>(null);
  const [circuitPicker, setCircuitPicker] = useState<{ dayDate: string; sessionIndex: number; sectionId?: string } | null>(null);
  const [circuitBuilderOpen, setCircuitBuilderOpen] = useState(false);
  // ID of the ExerciseDistribution entry being edited via the circuit builder
  const [circuitEditId, setCircuitEditId] = useState<string | null>(null);
  const [methodSelectorPicker, setMethodSelectorPicker] = useState<{ dayDate: string; sessionIndex: number; sectionId?: string; methods: string[] } | null>(null);
  // ── selected microcycle: controlled by parent when prop provided, else local ──
  const [selectedMcIndexLocal, setSelectedMcIndexLocal] = useState(0);
  const selectedMcIndex = selectedMicrocycleIndexProp ?? selectedMcIndexLocal;
  const setSelectedMcIndex = useCallback((v: number | ((prev: number) => number)) => {
    const next = typeof v === 'function' ? v(selectedMcIndex) : v;
    setSelectedMcIndexLocal(next);
    onSelectedMicrocycleIndexChange?.(next);
  }, [selectedMcIndex, onSelectedMicrocycleIndexChange]);
  const [copyingMicrocycleId, setCopyingMicrocycleId] = useState<string | null>(null);
  const [copyingMesocycle, setCopyingMesocycle] = useState(false);
  const [sessionCommentsMap, setSessionCommentsMap] = useState<Record<string, string>>({});
  const [clearingMicrocycleId, setClearingMicrocycleId] = useState<string | null>(null);
  const [clearingMesocycleId, setClearingMesocycleId] = useState<string | null>(null);

  // Helper to swap session comments in local state immediately
  const swapSessionComments = (dayDate: string, indexA: number, indexB: number) => {
    if (!mesocycle?.id) return;
    
    const keyA = `sessionComments_${mesocycle.id}_${dayDate}_${indexA}`;
    const keyB = `sessionComments_${mesocycle.id}_${dayDate}_${indexB}`;
    
    setSessionCommentsMap(prev => {
      const copy = { ...prev };
      const temp = copy[keyA];
      copy[keyA] = copy[keyB];
      copy[keyB] = temp;
      return copy;
    });
  };

  // Wrapper for move up that also swaps comments locally
  const handleMoveSessionUpLocal = (dayDate: string, sessionIndex: number) => {
    if (sessionIndex > 0) {
      swapSessionComments(dayDate, sessionIndex, sessionIndex - 1);
    }
    onMoveSessionUp?.(dayDate, sessionIndex);
  };

  // Wrapper for move down that also swaps comments locally
  const handleMoveSessionDownLocal = (dayDate: string, sessionIndex: number) => {
    const day = trainingDays.find(d => d.date === dayDate);
    const sessionsCount = day?.sessions ?? 1;
    
    if (sessionIndex < sessionsCount - 1) {
      swapSessionComments(dayDate, sessionIndex, sessionIndex + 1);
    }
    onMoveSessionDown?.(dayDate, sessionIndex);
  };

  // Load session comments from localStorage on mount (using workoutSessions_* format for sync with Step 2)
  useEffect(() => {
    if (!mesocycle?.id) return;
    
    const loadSessionComments = () => {
      const commentsMap: Record<string, string> = {};
      trainingDays.forEach(day => {
        const sessionsCount = day.sessionNames?.length || day.sessions || 1;
        for (let i = 0; i < sessionsCount; i++) {
          // Read from workoutSessions_* format (synced with Step 2)
          const key = `workoutSessions_${mesocycle.id}_${day.date}_${i}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const { comments } = JSON.parse(stored);
              if (comments) {
                // Store with internal key format for local state
                commentsMap[`sessionComments_${mesocycle.id}_${day.date}_${i}`] = comments;
              }
            } catch {}
          }
        }
      });
      setSessionCommentsMap(commentsMap);
    };
    
    loadSessionComments();
  }, [mesocycle?.id, trainingDays, sessionCommentsRefreshKey]);

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

  // ── single-microcycle view ────────────────────────────────────────────────────
  const microcycleEntries = useMemo(() => Array.from(daysByMicrocycle.entries()), [daysByMicrocycle]);
  const clampedMcIdx = Math.min(selectedMcIndex, Math.max(0, microcycleEntries.length - 1));
  const selectedMicrocycleEntry = microcycleEntries[clampedMcIdx] ?? null;
  // Keep selectedMicrocycleId in sync for copy/clear handlers that use it
  const selectedMicrocycleId = selectedMicrocycleEntry ? selectedMicrocycleEntry[0] : null;


  // Group exercises by method and category
  const exercisesByMethod = useMemo(() => {
    const grouped: Record<string, Record<string, Array<{
      exerciseId: string;
      exerciseName: string;
      subCategory?: string;
    }>>> = {};

    // Helper to validate category names and filter out corrupted values
    const isValidCategoryName = (name: string | undefined): boolean => {
      if (!name) return false;
      if (name.length <= 2) return false; // "1", "me" etc are not valid
      if (/^(meso|micro|main|undefined|null)\d*$/i.test(name)) return false;
      return true;
    };

    // Helper to add exercise to grouped structure
    const addExercise = (methodId: string, categoryName: string, ex: { exerciseId: string; exerciseName: string; subCategory?: string }) => {
      if (!grouped[methodId]) {
        grouped[methodId] = {};
      }
      if (!grouped[methodId][categoryName]) {
        grouped[methodId][categoryName] = [];
      }
      // Avoid duplicates
      if (!grouped[methodId][categoryName].find(e => e.exerciseId === ex.exerciseId)) {
        grouped[methodId][categoryName].push({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          subCategory: ex.subCategory,
        });
      }
    };

    // 1. Add exercises from exerciseSelectionData (Step 0)
    Object.entries(exerciseSelectionData).forEach(([key, cellData]) => {
      if (cellData.mesocycleId !== mesocycle.id) return;

      const methodId = cellData.methodId;
      const categoryName = isValidCategoryName(cellData.categoryName) ? cellData.categoryName! : '';

      cellData.exercises.forEach(ex => {
        addExercise(methodId, categoryName, ex);
      });
    });

    // Build set of valid exercise IDs from Step 5 selection
    const validExerciseIds = new Set<string>();
    Object.values(exerciseSelectionData).forEach(cellData => {
      if (cellData.mesocycleId !== mesocycle.id) return;
      cellData.exercises.forEach(ex => validExerciseIds.add(ex.exerciseId));
    });

    // 2. Also add exercises from exerciseDistribution (captures exercises added inline in the calendar)
    // BUT only if: (a) the exercise is in Step 5 selection, AND (b) the method already has a Step 5
    // selection entry for this mesocycle — we never introduce a method solely from distribution.
    exerciseDistribution.forEach(ex => {
      if (!validExerciseIds.has(ex.exerciseId)) return;
      const methodId = ex.methodId;
      // Only add to an already-known method (one that has a Step 5 selection entry)
      if (!grouped[methodId]) return;
      const categoryName = isValidCategoryName(ex.categoryName) ? ex.categoryName : '';
      addExercise(methodId, categoryName, {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        subCategory: ex.subCategory,
      });
    });

    // 3. Filter out methods not allocated to this mesocycle (removes stale exerciseSelectionData)
    if (Object.keys(methodAllocations).length > 0) {
      Object.keys(grouped).forEach(methodId => {
        if (!(methodAllocations[methodId] ?? []).includes(mesocycle.id)) {
          delete grouped[methodId];
        }
      });
    }

    return grouped;
  }, [exerciseSelectionData, exerciseDistribution, mesocycle.id, methodAllocations]);

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

  const handleDragStart = useCallback((start: DragStart) => {
    if (start.source.droppableId.startsWith('library-')) {
      const methodId = start.source.droppableId.replace('library-', '').split('::')[0];
      setDraggingMethodId(methodId);
    }
  }, []);

  // ── Inline exercise add: write to distribution + bidirectional sync ──────────
  const handleInlineAddExercises = (exercises: ExerciseSelection[]) => {
    if (!inlinePicker) return;
    const { dayDate, sessionIndex, sectionId: pickerSectionId } = inlinePicker;

    // Determine section to add to
    let updatedSections = [...sessionSections];
    let targetSectionId: string;

    if (pickerSectionId) {
      // Use the section explicitly chosen from a section "+" button
      targetSectionId = pickerSectionId;
    } else {
      // Fallback: auto-create a section if none exists (legacy behaviour)
      const existingSections = sessionSections.filter(
        s => s.dayDate === dayDate && s.sessionIndex === sessionIndex
      ).sort((a, b) => a.order - b.order);

      if (existingSections.length === 0) {
        const newSection: SessionSection = {
          id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dayDate,
          sessionIndex,
          name: 'Section 1',
          order: 0,
        };
        updatedSections = [...sessionSections, newSection];
        targetSectionId = newSection.id;
        onSectionsChange(updatedSections);
      } else {
        targetSectionId = existingSections[0].id;
      }
    }

    // Get current count of exercises in target section for ordering
    const baseOrder = exerciseDistribution.filter(ex => ex.sectionId === targetSectionId).length;

    // Use the method explicitly chosen by the coach (Case A: auto-set; Case B: selected via dialog)
    const primaryMethodId = inlinePicker.methodId ?? '';

    const newDistEntries: ExerciseDistribution[] = exercises.map((ex, i) => ({
      id: `ex-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      methodId: primaryMethodId,
      categoryName: '',
      subCategory: ex.subCategory,
      dayDate,
      sessionIndex,
      order: baseOrder + i,
      sectionId: targetSectionId,
    }));

    onDistributionChange([...exerciseDistribution, ...newDistEntries]);

    // Bidirectional sync: write back to exerciseSelectionData if callback provided
    if (onExerciseSelectionDataChange && primaryMethodId) {
      const updatedSelectionData = { ...exerciseSelectionData };
      exercises.forEach(ex => {
        // Find existing cell for this method+mesocycle
        const existingEntry = Object.entries(updatedSelectionData).find(
          ([, cell]) => cell.methodId === primaryMethodId && cell.mesocycleId === mesocycle.id
        );
        if (existingEntry) {
          const [cellKey, cellData] = existingEntry;
          if (!cellData.exercises.find(e => e.exerciseId === ex.exerciseId)) {
            updatedSelectionData[cellKey] = {
              ...cellData,
              exercises: [...cellData.exercises, ex],
            };
          }
        } else {
          // Create new cell
          const newKey = `${primaryMethodId}::::${mesocycle.id}`;
          updatedSelectionData[newKey] = {
            methodId: primaryMethodId,
            mesocycleId: mesocycle.id,
            exercises: [ex],
          };
        }
      });
      onExerciseSelectionDataChange(updatedSelectionData);
    }

    toast({ title: 'Exercise added', description: `${exercises.length} exercise${exercises.length > 1 ? 's' : ''} added to session` });
    setInlinePicker(null);
  };

  // ── Inline circuit add ───────────────────────────────────────────────────────
  const handleCircuitPickerAdd = (circuit: Circuit, libraryId: string) => {
    if (!circuitPicker) return;
    const { dayDate, sessionIndex, sectionId: pickerSectionId } = circuitPicker;

    // Determine / auto-create target section
    let updatedSections = [...sessionSections];
    let targetSectionId: string;

    if (pickerSectionId) {
      targetSectionId = pickerSectionId;
    } else {
      const existingSections = sessionSections
        .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
        .sort((a, b) => a.order - b.order);

      if (existingSections.length === 0) {
        const newSection: SessionSection = {
          id: `section-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          dayDate,
          sessionIndex,
          name: 'Section 1',
          order: 0,
        };
        updatedSections = [...sessionSections, newSection];
        targetSectionId = newSection.id;
        onSectionsChange(updatedSections);
      } else {
        targetSectionId = existingSections[0].id;
      }
    }

    const baseOrder = exerciseDistribution.filter(ex => ex.sectionId === targetSectionId).length;

    const newEntry: ExerciseDistribution = {
      id: `circuit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      exerciseId: circuit.id,
      exerciseName: circuit.name,
      methodId: '',
      categoryName: '',
      dayDate,
      sessionIndex,
      order: baseOrder,
      sectionId: targetSectionId,
      isCircuit: true,
      circuitId: circuit.id,
      circuitLibraryId: libraryId,
      circuitExercises: circuit.exercises,
      circuitRestBetweenRounds: circuit.restBetweenRounds,
      circuitRestBetweenExercises: circuit.restBetweenExercises,
      circuitComments: circuit.comments,
    };

    onDistributionChange([...exerciseDistribution, newEntry]);
    toast({ title: 'Circuit added', description: `"${circuit.name}" added to session` });
    setCircuitPicker(null);
  };

  const handleDragEnd = (result: DropResult) => {
    setDraggingMethodId(null);
    const { source, destination, draggableId, type } = result;

    if (!destination) return;

    // Handle dragging from library to session area - auto-create section if needed
    if (type === 'EXERCISE' && source.droppableId.startsWith('library-') && destination.droppableId.startsWith('session-')) {
      const [methodId, categoryName] = source.droppableId.replace('library-', '').split('::');
      const [dayDate, sessionIndex] = destination.droppableId.replace('session-', '').split('::');
      const parsedSessionIndex = parseInt(sessionIndex);
      
      // Use exerciseId from draggableId instead of source.index to avoid filter mismatch
      const exerciseId = draggableId.replace('lib-', '');
      
      // Try the specific bucket first
      let exercises = exercisesByMethod[methodId]?.[categoryName] || [];
      let exercise = exercises.find(ex => ex.exerciseId === exerciseId);
      let foundMethodId = methodId;
      let foundCategoryName = categoryName;
      
      // Fallback: search ALL methods/categories for this exerciseId
      if (!exercise) {
        for (const [mId, categories] of Object.entries(exercisesByMethod)) {
          for (const [catName, exs] of Object.entries(categories)) {
            const found = exs.find(ex => ex.exerciseId === exerciseId);
            if (found) {
              exercise = found;
              foundMethodId = mId;
              foundCategoryName = catName;
              break;
            }
          }
          if (exercise) break;
        }
      }
      
      if (!exercise) return;

      // Check if there are existing sections for this session
      const existingSections = sessionSections.filter(
        s => s.dayDate === dayDate && s.sessionIndex === parsedSessionIndex
      );
      
      // If no sections exist, auto-create a default "Main" section
      let targetSectionId: string;
      if (existingSections.length === 0) {
        const newSection: SessionSection = {
          id: `section-${Date.now()}-${Math.random()}`,
          dayDate,
          sessionIndex: parsedSessionIndex,
          name: 'Section 1',
          order: 0,
        };
        targetSectionId = newSection.id;
        
        // Add the new section
        onSectionsChange([...sessionSections, newSection]);
        
        // Create the exercise with the new section
        const newExercise: ExerciseDistribution = {
          id: `ex-${Date.now()}-${Math.random()}`,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          methodId: foundMethodId,
          categoryName: foundCategoryName,
          subCategory: exercise.subCategory,
          dayDate,
          sessionIndex: parsedSessionIndex,
          order: 0,
          sectionId: targetSectionId,
        };
        
        onDistributionChange([...exerciseDistribution, newExercise]);
        toast({ title: 'Exercise added', description: `${exercise.exerciseName} added to new "Section 1" section` });
        return;
      }
      
      // If sections exist, add to the first section by default
      targetSectionId = existingSections.sort((a, b) => a.order - b.order)[0].id;
      
      const sectionExercises = exerciseDistribution.filter(
        ex => ex.sectionId === targetSectionId
      ).sort((a, b) => a.order - b.order);

      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId: foundMethodId,
        categoryName: foundCategoryName,
        subCategory: exercise.subCategory,
        dayDate,
        sessionIndex: parsedSessionIndex,
        order: sectionExercises.length,
        sectionId: targetSectionId,
      };

      onDistributionChange([...exerciseDistribution, newExercise]);
      toast({ title: 'Exercise added', description: `${exercise.exerciseName} added to session` });
      return;
    }

    // Handle dragging from library to "create new section" drop zone
    if (type === 'EXERCISE' && source.droppableId.startsWith('library-') && destination.droppableId.startsWith('new-section-')) {
      // Parse destination: new-section-{dayDate}::{sessionIndex}
      const destParts = destination.droppableId.replace('new-section-', '').split('::');
      const dayDate = destParts[0];
      const parsedSessionIndex = parseInt(destParts[1], 10);
      
      // Extract exercise from library
      const exerciseId = draggableId.replace('lib-', '');
      let exercise: any = null;
      let foundMethodId = '';
      let foundCategoryName = '';
      
      for (const [mId, categories] of Object.entries(exercisesByMethod)) {
        for (const [catName, exs] of Object.entries(categories)) {
          const found = exs.find(ex => ex.exerciseId === exerciseId);
          if (found) {
            exercise = found;
            foundMethodId = mId;
            foundCategoryName = catName;
            break;
          }
        }
        if (exercise) break;
      }
      
      if (!exercise) return;

      // Count existing sections for this session to determine new section name
      const existingSections = sessionSections.filter(
        s => s.dayDate === dayDate && s.sessionIndex === parsedSessionIndex
      );
      const newSectionNumber = existingSections.length + 1;
      
      // Create the new section
      const newSection: SessionSection = {
        id: `section-${Date.now()}-${Math.random()}`,
        dayDate,
        sessionIndex: parsedSessionIndex,
        name: `Section ${newSectionNumber}`,
        order: existingSections.length,
      };
      
      // Add the new section
      onSectionsChange([...sessionSections, newSection]);
      
      // Create the exercise with the new section
      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId: foundMethodId,
        categoryName: foundCategoryName,
        subCategory: exercise.subCategory,
        dayDate,
        sessionIndex: parsedSessionIndex,
        order: 0,
        sectionId: newSection.id,
      };
      
      onDistributionChange([...exerciseDistribution, newExercise]);
      toast({ title: 'Exercise added', description: `${exercise.exerciseName} added to new "Section ${newSectionNumber}" section` });
      return;
    }

    // Handle dragging from library into a specific section
    if (type === 'EXERCISE' && source.droppableId.startsWith('library-') && destination.droppableId.startsWith('section-')) {
      const [methodId, categoryName] = source.droppableId.replace('library-', '').split('::');
      const sectionId = destination.droppableId.replace('section-', '');
      
      const section = sessionSections.find(s => s.id === sectionId);
      if (!section) return;
      
      // Use exerciseId from draggableId instead of source.index to avoid filter mismatch
      const exerciseId = draggableId.replace('lib-', '');
      
      // Try the specific bucket first
      let exercises = exercisesByMethod[methodId]?.[categoryName] || [];
      let exercise = exercises.find(ex => ex.exerciseId === exerciseId);
      let foundMethodId = methodId;
      let foundCategoryName = categoryName;
      
      // Fallback: search ALL methods/categories for this exerciseId
      if (!exercise) {
        for (const [mId, categories] of Object.entries(exercisesByMethod)) {
          for (const [catName, exs] of Object.entries(categories)) {
            const found = exs.find(ex => ex.exerciseId === exerciseId);
            if (found) {
              exercise = found;
              foundMethodId = mId;
              foundCategoryName = catName;
              break;
            }
          }
          if (exercise) break;
        }
      }
      
      if (!exercise) return;
      
      const sectionExercises = exerciseDistribution.filter(
        ex => ex.sectionId === sectionId
      ).sort((a, b) => a.order - b.order);
      
      const newExercise: ExerciseDistribution = {
        id: `ex-${Date.now()}-${Math.random()}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        methodId: foundMethodId,
        categoryName: foundCategoryName,
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

    // Handle moving FROM section TO "create new section" drop zone
    if (type === 'EXERCISE' && source.droppableId.startsWith('section-') && destination.droppableId.startsWith('new-section-')) {
      const sourceSectionId = source.droppableId.replace('section-', '');
      const destParts = destination.droppableId.replace('new-section-', '').split('::');
      const destDayDate = destParts[0];
      const destSessionIndex = parseInt(destParts[1], 10);

      const sourceSection = sessionSections.find(s => s.id === sourceSectionId);
      if (!sourceSection) return;

      const sourceExercises = exerciseDistribution
        .filter(ex => ex.sectionId === sourceSectionId)
        .sort((a, b) => a.order - b.order);

      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceSection.dayDate,
        sourceSection.sessionIndex,
        sourceSectionId
      );

      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );

      const existingSectionsInDest = sessionSections.filter(
        s => s.dayDate === destDayDate && s.sessionIndex === destSessionIndex
      );
      const newSectionNumber = existingSectionsInDest.length + 1;

      const newSection: SessionSection = {
        id: `section-${Date.now()}-${Math.random()}`,
        dayDate: destDayDate,
        sessionIndex: destSessionIndex,
        name: `Section ${newSectionNumber}`,
        order: existingSectionsInDest.length,
      };

      // Compute otherExercises BEFORE mutating, so sectionId is still the original value
      const otherExercises = exerciseDistribution.filter(ex => ex.sectionId !== sourceSectionId);

      supersetExercises.forEach((ex, idx) => {
        ex.sectionId = newSection.id;
        ex.dayDate = destDayDate;
        ex.sessionIndex = destSessionIndex;
        ex.order = idx;
      });

      remainingSourceExercises.forEach((ex, idx) => { ex.order = idx; });

      onSectionsChange([...sessionSections, newSection]);
      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...supersetExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: 'New section created', description: `${exerciseText} moved to ${newSection.name}` });
      return;
    }

    // Handle moving FROM unsectioned session area TO "create new section" drop zone
    if (type === 'EXERCISE' && source.droppableId.startsWith('session-') && destination.droppableId.startsWith('new-section-')) {
      const [sourceDayDate, sourceSessionIndex] = source.droppableId.replace('session-', '').split('::');
      const destParts = destination.droppableId.replace('new-section-', '').split('::');
      const destDayDate = destParts[0];
      const destSessionIndex = parseInt(destParts[1], 10);

      const sourceExercises = exerciseDistribution
        .filter(ex => ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId)
        .sort((a, b) => a.order - b.order);

      const supersetExercises = getSupersetExercises(
        draggableId,
        sourceExercises,
        sourceDayDate,
        parseInt(sourceSessionIndex),
        undefined
      );

      const remainingSourceExercises = sourceExercises.filter(
        ex => !supersetExercises.find(se => se.id === ex.id)
      );

      const existingSectionsInDest = sessionSections.filter(
        s => s.dayDate === destDayDate && s.sessionIndex === destSessionIndex
      );
      const newSectionNumber = existingSectionsInDest.length + 1;

      const newSection: SessionSection = {
        id: `section-${Date.now()}-${Math.random()}`,
        dayDate: destDayDate,
        sessionIndex: destSessionIndex,
        name: `Section ${newSectionNumber}`,
        order: existingSectionsInDest.length,
      };

      // Compute otherExercises BEFORE mutating, so sectionId is still undefined (original value)
      const otherExercises = exerciseDistribution.filter(
        ex => !(ex.dayDate === sourceDayDate && ex.sessionIndex === parseInt(sourceSessionIndex) && !ex.sectionId)
      );

      supersetExercises.forEach((ex, idx) => {
        ex.sectionId = newSection.id;
        ex.dayDate = destDayDate;
        ex.sessionIndex = destSessionIndex;
        ex.order = idx;
      });

      remainingSourceExercises.forEach((ex, idx) => { ex.order = idx; });

      onSectionsChange([...sessionSections, newSection]);
      onDistributionChange([...otherExercises, ...remainingSourceExercises, ...supersetExercises]);
      const exerciseText = supersetExercises.length > 1 ? `${supersetExercises.length} exercises` : 'Exercise';
      toast({ title: 'New section created', description: `${exerciseText} moved to ${newSection.name}` });
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

  const handleDeleteExercise = useCallback((exerciseDistId: string) => {
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
    
    // Clean up supersets - remove deleted exercise from all superset groups
    const cleanedSupersets = cleanupSupersetsOnExerciseDelete(supersets, exerciseDistId);
    onSupersetsChange(cleanedSupersets);
    
    toast({ title: 'Exercise removed', description: `${exercise.exerciseName} removed from session` });
  }, [exerciseDistribution, supersets, onDistributionChange, onSupersetsChange, toast]);

  const handleAddSection = useCallback((dayDate: string, sessionIndex: number) => {
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
  }, [sessionSections, onSectionsChange, toast]);

  const handleRenameSection = useCallback((sectionId: string, newName: string) => {
    const updated = sessionSections.map(s =>
      s.id === sectionId ? { ...s, name: newName } : s
    );
    onSectionsChange(updated);
  }, [sessionSections, onSectionsChange]);

  const handleSessionCommentsChange = useCallback((dayDate: string, sessionIndex: number, comments: string) => {
    if (!mesocycle?.id) return;
    
    // Use workoutSessions_* format for sync with Step 2
    const storageKey = `workoutSessions_${mesocycle.id}_${dayDate}_${sessionIndex}`;
    
    // Read existing data (may contain other properties)
    const existing = localStorage.getItem(storageKey);
    let data: Record<string, any> = {};
    if (existing) {
      try { data = JSON.parse(existing); } catch {}
    }
    data.comments = comments;
    
    // Update state immediately for instant UI response (using internal key format)
    const internalKey = `sessionComments_${mesocycle.id}_${dayDate}_${sessionIndex}`;
    setSessionCommentsMap(prev => ({ ...prev, [internalKey]: comments }));
    
    // Debounce localStorage write
    debouncedSaveToLocalStorage(storageKey, JSON.stringify(data));
  }, [mesocycle?.id, debouncedSaveToLocalStorage]);

  const handleSectionCommentsChange = useCallback((sectionId: string, comments: string) => {
    const updated = sessionSections.map(s =>
      s.id === sectionId ? { ...s, comments } : s
    );
    onSectionsChange(updated);
  }, [sessionSections, onSectionsChange]);

  const handleExerciseNotesChange = useCallback((exerciseId: string, notes: string) => {
    const updated = exerciseDistribution.map(ex =>
      ex.id === exerciseId ? { ...ex, notes } : ex
    );
    onDistributionChange(updated);
  }, [exerciseDistribution, onDistributionChange]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    // Find section to get dayDate and sessionIndex for superset cleanup
    const section = sessionSections.find(s => s.id === sectionId);
    
    // Get all exercises in this section
    const exercisesInSection = exerciseDistribution.filter(ex => ex.sectionId === sectionId);
    const exerciseIdsToDelete = exercisesInSection.map(ex => ex.id);
    
    // Remove the section
    const updatedSections = sessionSections.filter(s => s.id !== sectionId);
    onSectionsChange(updatedSections);

    // Remove all exercises in the section (not just clear sectionId)
    const updatedExercises = exerciseDistribution.filter(ex => ex.sectionId !== sectionId);
    onDistributionChange(updatedExercises);
    
    // Clean up supersets for deleted exercises
    if (section) {
      let updatedSupersets = { ...supersets };
      for (const exerciseId of exerciseIdsToDelete) {
        updatedSupersets = cleanupSupersetsOnExerciseDelete(updatedSupersets, exerciseId);
      }
      onSupersetsChange(updatedSupersets);
    }

    const exerciseCount = exercisesInSection.length;
    toast({
      title: 'Section deleted',
      description: exerciseCount > 0
        ? `Section and ${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} removed`
        : 'Section removed'
    });
  }, [sessionSections, exerciseDistribution, supersets, onSectionsChange, onDistributionChange, onSupersetsChange, toast]);

  const handleSectionReorder = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const section = sessionSections.find(s => s.id === sectionId);
    if (!section) return;
    
    const { dayDate, sessionIndex } = section;
    
    // Get sections for this specific session, sorted by order
    const sessionSpecificSections = sessionSections
      .filter(s => s.dayDate === dayDate && s.sessionIndex === sessionIndex)
      .sort((a, b) => a.order - b.order);
    
    // Find current section index
    const currentIndex = sessionSpecificSections.findIndex(s => s.id === sectionId);
    if (currentIndex < 0) return;
    
    // Calculate new index
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sessionSpecificSections.length) return;
    
    // Swap sections
    const reordered = [...sessionSpecificSections];
    [reordered[currentIndex], reordered[newIndex]] = [reordered[newIndex], reordered[currentIndex]];
    
    // Reassign order values
    const reorderedWithOrder = reordered.map((s, idx) => ({ ...s, order: idx }));
    
    // Update sessionSections state (keep other sessions' sections unchanged)
    const otherSections = sessionSections.filter(
      s => !(s.dayDate === dayDate && s.sessionIndex === sessionIndex)
    );
    onSectionsChange([...otherSections, ...reorderedWithOrder]);

    toast({ title: "Section reordered" });
  }, [sessionSections, onSectionsChange, toast]);

  const handleToggleSuperset = useCallback((dayDate: string, sessionIndex: number, exerciseId1: string, exerciseId2: string, sectionId?: string) => {
    const result = toggleSuperset(supersets, dayDate, sessionIndex, exerciseId1, exerciseId2, sectionId);
    onSupersetsChange(result.newSupersets);

    if (result.action === 'created') {
      toast({ title: 'Superset created', description: result.message });
    } else if (result.action === 'unlinked') {
      toast({ title: 'Exercises unlinked', description: result.message });
    } else if (result.action === 'merged') {
      toast({ title: 'Supersets merged', description: result.message });
    } else if (result.action === 'linked') {
      toast({ title: 'Exercise added to superset', description: result.message });
    }
  }, [supersets, onSupersetsChange, toast]);

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
      
      // Copy sections first to create oldToNewSectionIds mapping
      const newSections: SessionSection[] = [];
      const oldToNewSectionIds: Record<string, string> = {};
      
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;
        
        const targetDate = dayMapping[dayIndex];
        const sourceDateSections = sessionSections.filter(
          s => s.dayDate === sourceDay.date
        );
        
        sourceDateSections.forEach(section => {
          const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          oldToNewSectionIds[section.id] = newSectionId;
          
          newSections.push({
            ...section,
            id: newSectionId,
            dayDate: targetDate,
          });
        });
      });
      
      // Build the set of exercise IDs valid for the target microcycle from exerciseSelectionData.
      // A cell applies to the target microcycle when:
      //   - it belongs to the target mesocycle, AND
      //   - either it has no microcycleId (mesocycle-level selection, applies to all microcycles)
      //     or its microcycleId matches the target microcycle.
      const targetValidExerciseIds = new Set<string>();
      Object.values(exerciseSelectionData).forEach(cellData => {
        if (cellData.mesocycleId !== targetMesocycle!.id) return;
        if (cellData.microcycleId && cellData.microcycleId !== targetMicrocycleId) return;
        cellData.exercises.forEach(ex => targetValidExerciseIds.add(ex.exerciseId));
      });

      // Copy exercises with updated sectionIds, filtered to target microcycle's selection
      const newExercises: ExerciseDistribution[] = [];
      const oldToNewExerciseIds: Record<string, string> = {};

      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;

        const targetDate = dayMapping[dayIndex];
        const sourceDateExercises = exerciseDistribution.filter(
          ex => ex.dayDate === sourceDay.date
        );

        sourceDateExercises.forEach(exercise => {
          // Skip exercises not selected for the target microcycle
          if (!targetValidExerciseIds.has(exercise.exerciseId)) return;

          const newId = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          oldToNewExerciseIds[exercise.id] = newId;

          newExercises.push({
            ...exercise,
            id: newId,
            dayDate: targetDate,
            // Map sectionId to new section ID
            sectionId: exercise.sectionId ? oldToNewSectionIds[exercise.sectionId] : undefined,
          });
        });
      });
      
      // Copy supersets with new exercise IDs and section IDs
      // Clear target dates FIRST to overwrite any existing supersets
      const newSupersets: SupersetMapping = { ...supersets };
      const targetDates = targetDays.map(d => d.date);
      targetDates.forEach(date => {
        delete newSupersets[date];
      });
      
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;
        
        const targetDate = dayMapping[dayIndex];
        const sourceDateSupersets = supersets[sourceDay.date];
        
        if (sourceDateSupersets) {
          newSupersets[targetDate] = {};
          
          Object.entries(sourceDateSupersets).forEach(([sessionIndex, sessionSupersets]) => {
            newSupersets[targetDate][Number(sessionIndex)] = {};
            
            Object.entries(sessionSupersets).forEach(([oldSectionId, sectionSupersets]) => {
              // Map section ID (keep __unsectioned__ as is)
              const newSectionId = oldSectionId === '__unsectioned__' 
                ? '__unsectioned__' 
                : (oldToNewSectionIds[oldSectionId] || oldSectionId);
              
              newSupersets[targetDate][Number(sessionIndex)][newSectionId] = {};
              
              Object.entries(sectionSupersets).forEach(([supersetId, exerciseIds]) => {
                // Map old exercise IDs to new ones
                const newExerciseIds = exerciseIds
                  .map(oldId => oldToNewExerciseIds[oldId])
                  .filter(id => id !== undefined);
                
                if (newExerciseIds.length >= 2) {
                  newSupersets[targetDate][Number(sessionIndex)][newSectionId][supersetId] = newExerciseIds;
                }
              });
            });
          });
        }
      });
      
      // Copy day intensities and session structure
      sourceDays.forEach((sourceDay, dayIndex) => {
        if (dayIndex >= minDays) return;
        const targetDate = dayMapping[dayIndex];
        
        // Copy day intensity
        if (onDayIntensityChange && sourceDay.intensity) {
          onDayIntensityChange(targetDate, sourceDay.intensity);
        }
        
        // Copy session structure (sessions count and names) - only if source has sessions
        if (onUpdateTrainingDay && sourceDay.sessions && sourceDay.sessions > 0) {
          onUpdateTrainingDay(targetDate, {
            sessions: sourceDay.sessions,
            sessionNames: sourceDay.sessionNames ? [...sourceDay.sessionNames] : undefined,
          });
        }
        
        // Copy session intensities from localStorage
        const sessionsCount = sourceDay.sessions || 1;
        for (let i = 0; i < sessionsCount; i++) {
          const sourceKey = `sessionIntensity_${sourceMesocycle!.id}_${sourceDay.date}_${i}`;
          const sourceIntensity = localStorage.getItem(sourceKey);
          
          if (sourceIntensity) {
            const targetKey = `sessionIntensity_${targetMesocycle!.id}_${targetDate}_${i}`;
            localStorage.setItem(targetKey, sourceIntensity);
          }
        }
      });
      
      // Remove existing exercises and sections for target days
      // (supersets were already cleared before copying above)
      const filteredExercises = exerciseDistribution.filter(
        ex => !targetDates.includes(ex.dayDate)
      );
      const filteredSections = sessionSections.filter(
        s => !targetDates.includes(s.dayDate)
      );
      
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

      // Build the set of exercise IDs valid for the TARGET mesocycle from exerciseSelectionData.
      // Cells with no microcycleId apply to the whole mesocycle; cells with a microcycleId
      // apply only to that specific microcycle (handled per-microcycle below).
      const targetMesoValidExerciseIds = new Set<string>();
      Object.values(exerciseSelectionData).forEach(cellData => {
        if (cellData.mesocycleId !== mesocycle.id) return;
        cellData.exercises.forEach(ex => targetMesoValidExerciseIds.add(ex.exerciseId));
      });

      const newExercises: ExerciseDistribution[] = [];
      const newSections: SessionSection[] = [];
      const oldToNewExerciseIds: Record<string, string> = {};
      const oldToNewSectionIds: Record<string, string> = {};
      
      // Clear target mesocycle's supersets BEFORE copying
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
      
      const newSupersets: SupersetMapping = { ...supersets };
      targetDates.forEach(date => {
        delete newSupersets[date];
      });
      
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
        
        // STEP 1: Copy sections FIRST, building the oldToNewSectionIds mapping
        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;
          
          const targetDate = dayMapping[sourceDay.date];
          const sourceDateSections = sessionSections.filter(
            s => s.dayDate === sourceDay.date
          );
          
          sourceDateSections.forEach(section => {
            const newSectionId = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            oldToNewSectionIds[section.id] = newSectionId;
            
            newSections.push({
              ...section,
              id: newSectionId,
              dayDate: targetDate,
            });
          });
        });
        
        // STEP 2: Copy exercises AFTER, remapping sectionId using the mapping.
        // Build per-microcycle valid IDs: mesocycle-level cells apply to all microcycles;
        // microcycle-specific cells only apply to their own microcycle.
        const targetMicroValidExerciseIds = new Set<string>();
        Object.values(exerciseSelectionData).forEach(cellData => {
          if (cellData.mesocycleId !== mesocycle.id) return;
          if (cellData.microcycleId && cellData.microcycleId !== targetMicro.id) return;
          cellData.exercises.forEach(ex => targetMicroValidExerciseIds.add(ex.exerciseId));
        });

        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;

          const targetDate = dayMapping[sourceDay.date];
          const sourceDateExercises = exerciseDistribution.filter(
            ex => ex.dayDate === sourceDay.date
          );

          sourceDateExercises.forEach(exercise => {
            // Skip exercises not selected for the target mesocycle/microcycle
            if (!targetMicroValidExerciseIds.has(exercise.exerciseId)) return;

            const newId = `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            oldToNewExerciseIds[exercise.id] = newId;

            newExercises.push({
              ...exercise,
              id: newId,
              dayDate: targetDate,
              sectionId: exercise.sectionId ? oldToNewSectionIds[exercise.sectionId] : undefined,
            });
          });
        });
        
        // STEP 3: Copy supersets, remapping both exercise IDs and section IDs
        sourceDays.forEach((sourceDay, dayIndex) => {
          if (dayIndex >= minDays) return;
          
          const targetDate = dayMapping[sourceDay.date];
          const sourceDateSupersets = supersets[sourceDay.date];
          
          if (sourceDateSupersets) {
            newSupersets[targetDate] = {};
            
            Object.entries(sourceDateSupersets).forEach(([sessionIndex, sessionSupersets]) => {
              newSupersets[targetDate][Number(sessionIndex)] = {};
              
              Object.entries(sessionSupersets).forEach(([sectionId, sectionSupersets]) => {
                const newSectionId = sectionId === '__unsectioned__' 
                  ? '__unsectioned__' 
                  : (oldToNewSectionIds[sectionId] || sectionId);
                newSupersets[targetDate][Number(sessionIndex)][newSectionId] = {};
                
                Object.entries(sectionSupersets).forEach(([supersetId, exerciseIds]) => {
                  const newExerciseIds = exerciseIds
                    .map(oldId => oldToNewExerciseIds[oldId])
                    .filter(id => id !== undefined);
                  
                  if (newExerciseIds.length >= 2) {
                    newSupersets[targetDate][Number(sessionIndex)][newSectionId][supersetId] = newExerciseIds;
                  }
                });
              });
            });
          }
        });
      });
      
      // Clear target mesocycle's existing exercises and sections
      // (supersets were already cleared before copying above)
      const filteredExercises = exerciseDistribution.filter(
        ex => !targetDates.includes(ex.dayDate)
      );
      const filteredSections = sessionSections.filter(
        s => !targetDates.includes(s.dayDate)
      );
      
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
    
    // Call parent to reset session states
    onClearMicrocycle?.(microcycleId);
    
    // Update state
    onDistributionChange(filteredExercises);
    onSectionsChange(filteredSections);
    onSupersetsChange(newSupersets);
    
    toast({
      title: 'Microcycle cleared',
      description: `All sessions and content removed from ${microcycle.name}`,
    });
  };

  const handleClearMesocycle = (mesocycleId: string) => {
    const meso = allMesocycles.find(m => m.id === mesocycleId);
    if (!meso) return;
    
    // Get ALL days for ALL microcycles in this mesocycle
    const mesocycleDays = trainingDays.filter(d => 
      meso.microcycles.some(micro => micro.id === d.microcycleId)
    );
    const dayDates = mesocycleDays.map(d => d.date);
    
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
    mesocycleDays.forEach(day => {
      const sessionsCount = day.sessionNames?.length || 1;
      for (let i = 0; i < sessionsCount; i++) {
        const key = `sessionComments_${mesocycleId}_${day.date}_${i}`;
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
    // NOTE: We do NOT clear day intensities (trainingDays[].intensity or dailyIntensityData)
    mesocycleDays.forEach(day => {
      const sessionsCount = day.sessionNames?.length || 1;
      for (let i = 0; i < sessionsCount; i++) {
        const key = `sessionIntensity_${mesocycleId}_${day.date}_${i}`;
        localStorage.removeItem(key);
      }
    });
    
    // Call parent to reset session states (does NOT touch day intensities)
    onClearMesocycle?.(mesocycleId);
    
    // Update state
    onDistributionChange(filteredExercises);
    onSectionsChange(filteredSections);
    onSupersetsChange(newSupersets);
    
    toast({
      title: 'Mesocycle cleared',
      description: `All sessions and content removed from ${meso.name} (day intensities preserved)`,
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

      {/* Clear Mesocycle Confirmation Dialog */}
      <AlertDialog open={!!clearingMesocycleId} onOpenChange={(open) => !open && setClearingMesocycleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Entire Mesocycle</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all exercises, sessions, sections, and comments from{' '}
              <strong>
                {clearingMesocycleId && allMesocycles.find(m => m.id === clearingMesocycleId)?.name}
              </strong>
              {' '}(all microcycles). Day intensities will be preserved. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clearingMesocycleId) {
                  handleClearMesocycle(clearingMesocycleId);
                  setClearingMesocycleId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Mesocycle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="flex h-full w-full">
        <div className="w-[15%] shrink-0 border-r">
          <ExerciseLibraryPanel
            exercisesByMethod={exercisesByMethod}
            exerciseDistribution={exerciseDistribution}
            mesocycle={mesocycle}
            methodExerciseCategories={methodExerciseCategories}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="overflow-x-auto p-4">
            <div className="w-max min-w-full">
              
              {/* Mesocycle Header */}
              <div className={cn(
                "mb-4 rounded-md border border-border pb-3 relative",
                getSubtleIntensityBg(mesocycle.intensity)
              )}>
                <div className="flex items-center justify-center px-4 py-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">
                      {mesocycle.name}
                    </h2>
                    <Badge variant="secondary" className={cn("font-semibold", getIntensityColor(mesocycle.intensity))}>
                      {formatIntensityLabel(mesocycle.intensity)}
                    </Badge>
                    <div className="flex items-center gap-1">
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
                      
                      {/* Clear Mesocycle Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                        title={`Clear all content from ${mesocycle.name} (preserves day intensities)`}
                        onClick={() => setClearingMesocycleId(mesocycle.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-center">
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
              
              {/* Microcycle Header — single-microcycle view with prev/next */}
              {selectedMicrocycleEntry && (() => {
                const [microId, { microcycle, days }] = selectedMicrocycleEntry;
                const isFirst = clampedMcIdx === 0;
                const isLast = clampedMcIdx === microcycleEntries.length - 1;
                const isVeryFirstMicrocycle = allMesocycles.findIndex(m => m.id === mesocycle.id) === 0 && isFirst;
                return (
                  <div className={cn(
                    'flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-md border border-border',
                    getSubtleIntensityBg(microcycle.intensity)
                  )}>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      disabled={isFirst} onClick={() => setSelectedMcIndex(i => Math.max(0, i - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 flex-1 justify-center">
                      <span className="font-semibold text-sm">{microcycle.name}</span>
                      <Badge variant="secondary" className={cn('font-semibold text-xs', getIntensityColor(microcycle.intensity))}>
                        {formatIntensityLabel(microcycle.intensity)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{clampedMcIdx + 1} / {microcycleEntries.length}</span>
                      {!isVeryFirstMicrocycle && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-1"
                          disabled={copyingMicrocycleId === microId}
                          title={isFirst
                            ? (() => { const pm = allMesocycles[allMesocycles.findIndex(m => m.id === mesocycle.id) - 1]; return pm ? `Copy from ${pm.microcycles[pm.microcycles.length - 1].name} (${pm.name})` : ''; })()
                            : `Copy from ${mesocycle.microcycles[clampedMcIdx - 1].name}`}
                          onClick={() => handleCopyFromPreviousMicrocycle(microId)}>
                          {copyingMicrocycleId === microId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        title={`Clear all content from ${microcycle.name}`}
                        onClick={() => setClearingMicrocycleId(microId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      disabled={isLast} onClick={() => setSelectedMcIndex(i => Math.min(microcycleEntries.length - 1, i + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}

              {/* Day Columns — only selected microcycle */}
              <div className="flex gap-4">
                {selectedMicrocycleEntry && (() => {
                  const [, { days }] = selectedMicrocycleEntry;
                  return (
                    <div className="flex gap-4">
                      {days.map((day) => {
                        // Off days always have 0 sessions regardless of stored session count
                        const sessionsCount = day.intensity === 'off' ? 0 : (day.sessions ?? 1);
                        
                        // Safety check
                        if (!day || !day.date) {
                          console.error('EnhancedExerciseDistribution: Invalid day object', day);
                          return null;
                        }
                        
                        const hasTest = (day.testNames?.length ?? 0) > 0;
                        const hasEvent = (day.eventNames?.length ?? 0) > 0;
                        const hasBoth = hasTest && hasEvent;
                        return (
                          <div key={day.date} className={cn(
                            'flex flex-col w-80 rounded-sm',
                            hasBoth ? 'border-l-2 border-l-purple-400 pl-2' :
                            hasTest  ? 'border-l-2 border-l-amber-400 pl-2' :
                            hasEvent ? 'border-l-2 border-l-blue-400 pl-2' : ''
                          )}>
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

                            {/* Test / Event strip */}
                            {(hasTest || hasEvent) && (
                              <div className={cn(
                                'flex flex-wrap gap-2 px-2 py-1 mb-1 rounded text-xs',
                                hasBoth ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800' :
                                hasTest  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' :
                                'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
                              )}>
                                {hasTest && (
                                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                                    <Trophy className="h-3 w-3 shrink-0" />
                                    {day.testNames!.join(' · ')}
                                  </span>
                                )}
                                {hasEvent && (
                                  <span className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium">
                                    <CalendarIcon className="h-3 w-3 shrink-0" />
                                    {day.eventNames!.join(' · ')}
                                  </span>
                                )}
                              </div>
                            )}

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

                                const sessionKey = `${day.date}_${sessionIndex}`;
                                const sessionMethods = dayMethodAssignments?.[sessionKey] ?? [];
                                const methodMatchState: 'match' | 'no-match' | 'neutral' =
                                  draggingMethodId
                                    ? (sessionMethods.length > 0
                                        ? (sessionMethods.includes(draggingMethodId) ? 'match' : 'no-match')
                                        : 'neutral')
                                    : 'neutral';

                                return (
                                  <SessionColumnView
                                    key={`${day.date}-${sessionIndex}`}
                                    day={day}
                                    sessionIndex={sessionIndex}
                                    methodMatchState={methodMatchState}
                                    assignedMethods={sessionMethods}
                                    onAddExerciseInline={(sectionId) => {
                                      if (sessionMethods.length === 1) {
                                        // Case A: exactly one method — assign automatically
                                        setInlinePicker({ dayDate: day.date, sessionIndex, sectionId, methodId: sessionMethods[0] });
                                      } else if (sessionMethods.length > 1) {
                                        // Case B: multiple methods — let coach choose
                                        setMethodSelectorPicker({ dayDate: day.date, sessionIndex, sectionId, methods: sessionMethods });
                                      } else {
                                        // No methods assigned — open picker without method context
                                        setInlinePicker({ dayDate: day.date, sessionIndex, sectionId });
                                      }
                                    }}
                                    onAddCircuitInline={(sectionId) => {
                                      setCircuitPicker({ dayDate: day.date, sessionIndex, sectionId });
                                    }}
                                    onEditCircuit={(distributionId) => {
                                      setCircuitEditId(distributionId);
                                    }}
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
                                    copiedSection={copiedSection}
                                    onCopySection={onCopySection}
                                    onPasteSection={onPasteSection}
                                    copiedSession={copiedSession}
                                    onCopySession={onCopySession}
                                    onMoveSessionUp={handleMoveSessionUpLocal}
                                    onMoveSessionDown={handleMoveSessionDownLocal}
                                    onExerciseNotesChange={handleExerciseNotesChange}
                                    onReorderSection={handleSectionReorder}
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
                              
                              {copiedSession && (
                                <Button
                                  onClick={() => onPasteSession?.(day.date)}
                                  className="w-full mt-2"
                                  variant="default"
                                  size="sm"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Paste Session ({copiedSession.exercises.length} exercise{copiedSession.exercises.length !== 1 ? 's' : ''})
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </DragDropContext>

    {/* Method selector dialog (Case B: multiple methods on session) */}
    <Dialog
      open={!!methodSelectorPicker}
      onOpenChange={(open) => { if (!open) setMethodSelectorPicker(null); }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add exercise to which method?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          {methodSelectorPicker?.methods.map(methodId => (
            <Button
              key={methodId}
              variant="outline"
              className="justify-start text-left h-auto py-2.5 px-3 whitespace-normal"
              onClick={() => {
                const { dayDate, sessionIndex, sectionId } = methodSelectorPicker!;
                setMethodSelectorPicker(null);
                setInlinePicker({ dayDate, sessionIndex, sectionId, methodId });
              }}
            >
              <span className="text-sm leading-snug">{displayMethodLabel(methodId)}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>

    {/* Inline exercise picker dialog */}
    {inlinePicker && (
      <ExerciseLibraryPopup
        isOpen={true}
        onClose={() => setInlinePicker(null)}
        onSelectExercises={handleInlineAddExercises}
        selectedExerciseIds={exerciseDistribution
          .filter(ex => ex.dayDate === inlinePicker.dayDate && ex.sessionIndex === inlinePicker.sessionIndex)
          .map(ex => ex.exerciseId)}
        onExerciseCreated={(ex) => handleInlineAddExercises([ex])}
      />
    )}

    {/* Circuit picker dialog */}
    <Dialog open={!!circuitPicker} onOpenChange={(open) => { if (!open) setCircuitPicker(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-primary" />
            Add Circuit
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Create new circuit button — always visible */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setCircuitBuilderOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create New Circuit…
          </Button>

          {libraries.filter(lib => (lib.circuits?.length ?? 0) > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No saved circuits yet. Use "Create New Circuit" above to build one.
            </p>
          ) : (
            libraries
              .filter(lib => (lib.circuits?.length ?? 0) > 0)
              .map(lib => (
                <div key={lib.id}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{lib.name}</p>
                  <div className="space-y-1.5">
                    {lib.circuits!.map(circuit => (
                      <button
                        key={circuit.id}
                        onClick={() => handleCircuitPickerAdd(circuit, lib.id)}
                        className="w-full text-left rounded-md border bg-card hover:bg-accent hover:border-primary/40 transition-colors px-3 py-2.5 group"
                      >
                        <div className="flex items-center gap-2">
                          <Recycle className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium flex-1 truncate">{circuit.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 ml-5">
                          {circuit.exercises.length} exercises
                          {circuit.restBetweenRounds ? ` · ${circuit.restBetweenRounds}s / ${circuit.restBetweenExercises}s` : ''}
                          {circuit.comments && (
                            <span className="ml-1 italic truncate">· {circuit.comments}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Circuit builder — standalone mode, opened from the circuit picker (create new) */}
    <CircuitBuilderDialog
      isOpen={circuitBuilderOpen}
      onClose={() => setCircuitBuilderOpen(false)}
      onCircuitCreated={(newCircuit, savedToLibraryId) => {
        setCircuitBuilderOpen(false);
        handleCircuitPickerAdd(newCircuit, savedToLibraryId ?? '');
      }}
    />

    {/* Circuit editor — opened by clicking a circuit card in Exercise Distribution */}
    {(() => {
      if (!circuitEditId) return null;
      const entry = exerciseDistribution.find(ex => ex.id === circuitEditId);
      if (!entry) return null;
      const circuitForEdit: import('@/contexts/CustomLibrariesContext').Circuit = {
        id: entry.circuitId ?? entry.exerciseId,
        name: entry.exerciseName,
        exercises: entry.circuitExercises ?? [],
        restBetweenRounds: entry.circuitRestBetweenRounds ?? '60',
        restBetweenExercises: entry.circuitRestBetweenExercises ?? '15',
        comments: entry.circuitComments,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      return (
        <CircuitBuilderDialog
          isOpen={true}
          onClose={() => setCircuitEditId(null)}
          circuit={circuitForEdit}
          onCircuitCreated={(updatedCircuit, savedToLibraryId) => {
            // Update the embedded circuit data in exerciseDistribution
            const updated = exerciseDistribution.map(ex =>
              ex.id === circuitEditId
                ? {
                    ...ex,
                    exerciseName: updatedCircuit.name,
                    circuitRestBetweenRounds: updatedCircuit.restBetweenRounds,
                    circuitRestBetweenExercises: updatedCircuit.restBetweenExercises,
                    circuitComments: updatedCircuit.comments,
                    circuitExercises: updatedCircuit.exercises,
                    ...(savedToLibraryId
                      ? { circuitLibraryId: savedToLibraryId, circuitId: updatedCircuit.id }
                      : {}),
                  }
                : ex
            );
            onDistributionChange(updated);
            setCircuitEditId(null);
          }}
        />
      );
    })()}
    </>
  );
}
