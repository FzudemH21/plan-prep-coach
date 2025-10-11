import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight, Link, Unlink, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ExtendedMesocycle } from '@/features/planner/types';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { useToast } from '@/hooks/use-toast';
import { ExerciseSelectionCell } from './ExerciseSelectionCell';
import { ExerciseCopyDialog } from './ExerciseCopyDialog';
import { 
  TrainingMethodWithCategories,
  MethodCategory,
  CellData, 
  MicrocyclePlanningState,
  MicrocycleGroup
} from '@/types/microcycle-planning';
import { cn } from '@/lib/utils';
import { getParametersForMethod, MethodParameter } from '@/data/methodParameters';

interface MicrocyclePlanningTableProps {
  mesocycles: ExtendedMesocycle[];
  selectedMethods?: string[];
  parameterValues?: Record<string, Record<number, Record<string, Record<number, Record<string, string | number>>>>>;
  methodParametersMap?: Record<string, Array<{
    name: string;
    type: string;
    options: string[];
    isQuantitative: boolean;
    isQualitative: boolean;
  }>>;
  onExerciseSelectionChange?: (cellData: Record<string, CellData>) => void;
}

export function MicrocyclePlanningTable({ mesocycles, selectedMethods = [], parameterValues = {}, methodParametersMap = {}, onExerciseSelectionChange }: MicrocyclePlanningTableProps) {
  const { data: toolboxData } = useToolboxData();
  const { data: athleticismData } = useAthleticismData();
  const { toast } = useToast();
  const [planningState, setPlanningState] = useState<MicrocyclePlanningState>({
    cellData: {},
    splitStates: {},
    microcycleGroups: {}
  });

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('microcyclePlanningState');
    if (savedState) {
      setPlanningState(JSON.parse(savedState));
    }
  }, []);

  // Save state to localStorage and notify parent whenever it changes
  useEffect(() => {
    if (Object.keys(planningState.cellData).length > 0) {
      localStorage.setItem('microcyclePlanningState', JSON.stringify(planningState));
      onExerciseSelectionChange?.(planningState.cellData);
    }
  }, [planningState, onExerciseSelectionChange]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [copyDialogState, setCopyDialogState] = useState<{
    isOpen: boolean;
    methodId: string;
    categoryName: string | undefined;
    targetColumnId: string;
  }>({
    isOpen: false,
    methodId: '',
    categoryName: undefined,
    targetColumnId: '',
  });

  const [clearMesocycleDialogState, setClearMesocycleDialogState] = useState<{
    isOpen: boolean;
    mesocycleId: string;
    mesocycleName: string;
  }>({
    isOpen: false,
    mesocycleId: '',
    mesocycleName: '',
  });

  // Helper function for string normalization
  const normalizeForComparison = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Helper function to get methods with loading recommendations for a specific sub-goal
  const getMethodsWithRecommendationsForSubGoal = useMemo(() => {
    return (subGoal: string) => {
      if (!athleticismData?.entries) return [];
      
      const methodsWithRecommendations: Array<{
        method: string;
        recommendations: Record<string, any>;
      }> = [];

      // Find all athleticism entries that match this sub-goal
      athleticismData.entries.forEach(entry => {
        const formattedSubGoal = `${entry.overarchingGoal} - ${entry.subGoal}`;
        if (normalizeForComparison(formattedSubGoal) === normalizeForComparison(subGoal)) {
          // Add all methods from this entry with their recommendations
          entry.mappedMethods.forEach(method => {
            const recommendations = entry.loadingRecommendations[method] || {};
            
            // Check if we already have this method, if so merge recommendations
            const existingMethod = methodsWithRecommendations.find(m => m.method === method);
            if (existingMethod) {
              // Merge recommendations (keep existing if there's a conflict)
              Object.entries(recommendations).forEach(([key, value]) => {
                if (!existingMethod.recommendations[key]) {
                  existingMethod.recommendations[key] = value;
                }
              });
            } else {
              methodsWithRecommendations.push({
                method,
                recommendations
              });
            }
          });
        }
      });

      return methodsWithRecommendations;
    };
  }, [athleticismData]);

  // Helper function to format loading recommendations into readable text
  const formatLoadingRecommendations = (recommendations: Record<string, any>): string => {
    if (!recommendations || Object.keys(recommendations).length === 0) {
      return "No specific recommendations available";
    }

    const formatValue = (key: string, value: any): string => {
      if (typeof value === 'object' && value !== null) {
        // Handle nested objects like 'Modes' in Isometrics
        if (key === 'Modes') {
          const modeStrings = Object.entries(value).map(([modeName, modeParams]: [string, any]) => {
            const modeParamStrings = Object.entries(modeParams).map(([paramKey, paramValue]) => 
              `${paramKey}: ${paramValue}`
            ).join(', ');
            return `${modeName} (${modeParamStrings})`;
          });
          return modeStrings.join('; ');
        }
        // Handle other nested objects
        return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
      }
      return String(value);
    };

    const parts: string[] = [];
    Object.entries(recommendations).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${key}: ${formatValue(key, value)}`);
      }
    });
    
    return parts.length > 0 ? parts.join('. ') : "No specific recommendations available";
  };
  
  // Helper function to get all parameter values for a specific microcycle
  const getMicrocycleParameters = useCallback((mesocycleId: string, microcycleIndex: number) => {
    if (!parameterValues) return [];
    
    const methodsData: Array<{
      methodName: string;
      parameters: Array<{
        name: string;
        value: string | number;
        unit?: string;
        sessionIndex?: number;
      }>;
      hasMultipleSessions: boolean;
    }> = [];
    
    // Get all methods allocated to this mesocycle
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    if (!mesocycle) return [];
    
    const allocatedMethods = selectedMethods.filter(method => {
      // Check if this method is allocated to this mesocycle via its sub-goals
      if (!mesocycle.allocatedSubGoals) return false;
      
      // Try to find this method in athleticism data for any of the allocated sub-goals
      return mesocycle.allocatedSubGoals.some(subGoal => {
        if (!athleticismData?.entries) return false;
        
        return athleticismData.entries.some(entry => {
          const formattedSubGoal = `${entry.overarchingGoal} - ${entry.subGoal}`;
          if (normalizeForComparison(formattedSubGoal) !== normalizeForComparison(subGoal)) {
            return false;
          }
          return entry.mappedMethods.includes(method);
        });
      });
    });
    
    // For each allocated method, get its parameters
    allocatedMethods.forEach(methodName => {
      const methodParams = parameterValues[mesocycleId]?.[microcycleIndex]?.[methodName];
      if (!methodParams) return;
      
      const paramDefinitions = getParametersForMethod(methodName);
      const hasMultipleSessions = Object.keys(methodParams).length > 1;
      
      // Get method parameters from methodParametersMap to access options
      const methodParamDefs = methodParametersMap[methodName] || [];
      
      const parameters: Array<{
        name: string;
        value: string | number;
        unit?: string;
        sessionIndex?: number;
      }> = [];
      
      // Iterate through sessions
      Object.entries(methodParams).forEach(([sessionIndex, params]) => {
        Object.entries(params).forEach(([paramName, value]) => {
          if (value) {
            // Try to find parameter definition from methodParametersMap
            const paramDef = methodParamDefs.find(p => p.name === paramName);
            let unit: string | undefined;
            
            // ONLY extract units for quantitative parameters
            // For qualitative parameters, the value already contains the selected option
            if (paramDef?.isQuantitative) {
              if (paramDef?.options && paramDef.options.length > 0) {
                // For quantitative params with options, first option is likely the unit
                unit = paramDef.options[0];
              } else if (toolboxData?.entries) {
                // Fallback: try to extract unit from original toolbox data parameter name
                const toolboxEntry = toolboxData.entries.find(entry => {
                  const entryKey = `${entry.category}${entry.subCategory ? ` - ${entry.subCategory}` : ''}`;
                  return (normalizeForComparison(entryKey) === normalizeForComparison(methodName) ||
                          normalizeForComparison(entry.parameter) === normalizeForComparison(methodName)) &&
                         (entry.parameterName === paramName || entry.parameter.split('[')[0].trim() === paramName);
                });
                if (toolboxEntry?.parameter) {
                  const unitMatch = toolboxEntry.parameter.match(/\[([^\]]+)\]/);
                  if (unitMatch) {
                    unit = unitMatch[1];
                  }
                }
              }
            }
            // For qualitative parameters (isQualitative === true), we intentionally leave unit as undefined
            
            parameters.push({
              name: paramName,
              value: value,
              unit: unit,
              sessionIndex: hasMultipleSessions ? parseInt(sessionIndex) : undefined
            });
          }
        });
      });
      
      if (parameters.length > 0) {
        methodsData.push({
          methodName,
          parameters,
          hasMultipleSessions
        });
      }
    });
    
    return methodsData;
  }, [parameterValues, mesocycles, selectedMethods, athleticismData, methodParametersMap, toolboxData]);

  // Helper functions (moved before useMemos that use them)
  const isMicrocycleGrouped = (mesocycleId: string, microcycleId: string) => {
    return Object.values(planningState.microcycleGroups).some(
      g => g.mesocycleId === mesocycleId && g.microcycleIds.includes(microcycleId)
    );
  };

  const canLinkWithNext = (mesocycleId: string, microcycleId: string) => {
    const meso = mesocycles.find(m => m.id === mesocycleId);
    if (!meso) return false;
    const idx = meso.microcycles.findIndex(m => m.id === microcycleId);
    if (idx === -1 || idx === meso.microcycles.length - 1) return false;
    const nextId = meso.microcycles[idx + 1].id;
    
    // Check if current microcycle is already in a group
    const currentGroup = Object.values(planningState.microcycleGroups).find(
      g => g.mesocycleId === mesocycleId && g.microcycleIds.includes(microcycleId)
    );
    
    // If current is in a group and group already has 3 microcycles, can't link
    if (currentGroup && currentGroup.microcycleIds.length >= 3) return false;
    
    // If next microcycle is already in a different group, can't link
    const nextGroup = Object.values(planningState.microcycleGroups).find(
      g => g.mesocycleId === mesocycleId && g.microcycleIds.includes(nextId)
    );
    if (nextGroup && (!currentGroup || nextGroup.id !== currentGroup.id)) return false;
    
    return true;
  };

  // Get training methods grouped by main category for hierarchical display
  const hierarchicalMethods = useMemo(() => {
    if (!toolboxData?.entries) return [];
    
    const methodsMap = new Map<string, TrainingMethodWithCategories>();
    
    toolboxData.entries.forEach(entry => {
      const methodName = `${entry.category} - ${entry.subCategory}`;
      
      // Check if this toolbox method matches any of the selected methods
      const isMethodSelected = selectedMethods.some(selectedMethod => {
        // Try exact match first
        if (selectedMethod === methodName) return true;
        
        // Try partial matches for cases where naming might differ
        const selectedNormalized = selectedMethod.toLowerCase().replace(/[^a-z0-9]/g, '');
        const methodNormalized = methodName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        return selectedNormalized.includes(methodNormalized) || 
               methodNormalized.includes(selectedNormalized);
      });
      
      if (!isMethodSelected) return;
      
      if (!methodsMap.has(methodName)) {
        methodsMap.set(methodName, {
          id: methodName,
          name: entry.subCategory, // Only show subcategory name in rows
          categories: []
        });
      }
      
      const method = methodsMap.get(methodName)!;
      method.mainCategory = entry.category; // Store main category for grouping
      
      if (entry.exerciseCategories?.length) {
        entry.exerciseCategories.forEach(category => {
          if (!method.categories.includes(category)) {
            method.categories.push(category);
          }
        });
      }
    });
    
    // Group methods by main category
    const categoryGroups = new Map<string, MethodCategory>();
    
    Array.from(methodsMap.values()).forEach(method => {
      const mainCategory = method.mainCategory || 'Other';
      
      if (!categoryGroups.has(mainCategory)) {
        categoryGroups.set(mainCategory, {
          categoryName: mainCategory,
          methods: []
        });
      }
      
      categoryGroups.get(mainCategory)!.methods.push(method);
    });
    
    // Sort categories and methods within categories
    const sortedCategories = Array.from(categoryGroups.values()).sort((a, b) => 
      a.categoryName.localeCompare(b.categoryName)
    );
    
    sortedCategories.forEach(category => {
      category.methods.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return sortedCategories;
  }, [toolboxData, selectedMethods]);

  // Initialize expanded categories with all categories expanded
  React.useEffect(() => {
    const allCategories = new Set(hierarchicalMethods.map(cat => cat.categoryName));
    setExpandedCategories(allCategories);
  }, [hierarchicalMethods]);

  const toggleCategoryExpansion = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Generate column structure for table headers
  const columnStructure = useMemo(() => {
    const hasSplit = Object.values(planningState.splitStates).some(isSplit => isSplit);
    
    return mesocycles.map(meso => {
      const isSplit = planningState.splitStates[meso.id] || false;
      
      // If no mesocycles are split, show all mesocycles as columns
      if (!hasSplit) {
        return [{
          type: 'mesocycle' as const,
          mesocycleId: meso.id,
          mesocycleName: meso.name,
          id: meso.id,
          colSpan: 1
        }];
      }
      
      // If this mesocycle is not split, show it as a single column
      if (!isSplit) {
        return [{
          type: 'mesocycle' as const,
          mesocycleId: meso.id,
          mesocycleName: meso.name,
          id: meso.id,
          colSpan: 1
        }];
      }

      // Find groups for this split mesocycle
      const mesocycleGroups = Object.values(planningState.microcycleGroups)
        .filter(group => group.mesocycleId === meso.id);

      const groupedMicrocycles = new Set(
        mesocycleGroups.flatMap(group => group.microcycleIds)
      );

      const columns = [];
      
      // Process microcycles in chronological order
      meso.microcycles.forEach((micro, index) => {
        // Check if this microcycle is part of a group
        const group = mesocycleGroups.find(g => g.microcycleIds.includes(micro.id));
        
        if (group && group.microcycleIds.length > 1) {
          // Only add the group once (at the first microcycle's position)
          const firstMicrocycleId = group.microcycleIds
            .map(id => ({ id, index: meso.microcycles.findIndex(m => m.id === id) }))
            .sort((a, b) => a.index - b.index)[0].id;
            
          if (micro.id === firstMicrocycleId) {
            columns.push({
              type: 'microcycle-group' as const,
              mesocycleId: meso.id,
              mesocycleName: meso.name,
              groupId: group.id,
              groupName: group.name,
              microcycleIds: group.microcycleIds,
              id: group.id,
              colSpan: 1
            });
            
            // Add link area after group if it has fewer than 3 microcycles and can extend
            const lastMicrocycleInGroup = group.microcycleIds
              .map(id => ({ id, index: meso.microcycles.findIndex(m => m.id === id) }))
              .sort((a, b) => b.index - a.index)[0];
              
            if (group.microcycleIds.length < 3 && 
                lastMicrocycleInGroup.index < meso.microcycles.length - 1 &&
                canLinkWithNext(meso.id, lastMicrocycleInGroup.id)) {
              columns.push({
                type: 'link-area' as const,
                mesocycleId: meso.id,
                mesocycleName: meso.name,
                microcycleId: lastMicrocycleInGroup.id,
                nextMicrocycleId: meso.microcycles[lastMicrocycleInGroup.index + 1].id,
                id: `link-${lastMicrocycleInGroup.id}-${meso.microcycles[lastMicrocycleInGroup.index + 1].id}`,
                colSpan: 1
              });
            }
          }
          // Skip individual microcycles that are part of this group
        } else if (!group) {
          // Add ungrouped microcycles
          columns.push({
            type: 'microcycle' as const,
            mesocycleId: meso.id,
            mesocycleName: meso.name,
            microcycleId: micro.id,
            microcycleName: micro.name,
            id: micro.id,
            colSpan: 1
          });
          
          // Add link area after this microcycle (if not the last one and can link)
          if (index < meso.microcycles.length - 1 && canLinkWithNext(meso.id, micro.id)) {
            columns.push({
              type: 'link-area' as const,
              mesocycleId: meso.id,
              mesocycleName: meso.name,
              microcycleId: micro.id,
              nextMicrocycleId: meso.microcycles[index + 1].id,
              id: `link-${micro.id}-${meso.microcycles[index + 1].id}`,
              colSpan: 1
            });
          }
        }
      });

      return columns;
    }).flat();
  }, [mesocycles, planningState]);

// Get intensity-based color for mesocycles and microcycles
const getIntensityColor = (intensity: string, isLight: boolean = false, isGroup: boolean = false) => {
  // Use neutral colors for grouped microcycles
  if (isGroup) {
    return 'bg-muted/20 text-foreground';
  }
  
  const suffix = isLight ? '-light' : '';
  const colors: Record<string, string> = {
    'off': `bg-intensity-off${suffix} text-foreground`,
    'deload': `bg-intensity-deload${suffix} text-foreground`,
    'easy': `bg-intensity-easy${suffix} text-foreground`,
    'easy-moderate': `bg-intensity-easy-moderate${suffix} text-foreground`,
    'moderate': `bg-intensity-moderate${suffix} text-foreground`,
    'moderate-hard': `bg-intensity-moderate-hard${suffix} text-foreground`,
    'hard': `bg-intensity-hard${suffix} text-foreground`,
    'extremely-hard': `bg-intensity-extremely-hard${suffix} text-foreground`,
  };
  return colors[intensity] || 'bg-muted text-muted-foreground';
};
  // Create mesocycle header structure for two-row headers
const mesocycleHeaders = useMemo(() => {
  const headers: Array<{
    mesocycleId: string;
    mesocycleName: string;
    colSpan: number;
    colorClass: string;
  }> = [];

  for (const meso of mesocycles) {
    const isSplit = planningState.splitStates[meso.id] || false;
    let colSpan = 1;
    
    if (isSplit) {
      const mesocycleGroups = Object.values(planningState.microcycleGroups)
        .filter(group => group.mesocycleId === meso.id);
      const groupedIds = new Set();
      
      // Collect grouped microcycle IDs
      for (const group of mesocycleGroups) {
        for (const id of group.microcycleIds) {
          groupedIds.add(id);
        }
      }
      
      const ungroupedMicrocycles = meso.microcycles.filter(m => !groupedIds.has(m.id));
      
      // Count link areas between ungrouped microcycles
      let linkAreasCount = 0;
      ungroupedMicrocycles.forEach((micro, index) => {
        if (index < ungroupedMicrocycles.length - 1 && canLinkWithNext(meso.id, micro.id)) {
          linkAreasCount++;
        }
      });
      
      colSpan = mesocycleGroups.length + ungroupedMicrocycles.length + linkAreasCount;
      if (colSpan === 0) colSpan = 1;
    }
    
    headers.push({
      mesocycleId: meso.id,
      mesocycleName: meso.name,
      colSpan,
      colorClass: getIntensityColor(meso.intensity)
    });
  }

  return headers;
}, [mesocycles, planningState]);

  // Check if any mesocycle is split (determines if we need two header rows)
  const hasSplitMesocycles = Object.values(planningState.splitStates).some(isSplit => isSplit);

  const toggleMesocycleSplit = (mesocycleId: string) => {
    setPlanningState(prev => {
      const willBeSplit = !prev.splitStates[mesocycleId];
      const mesocycle = mesocycles.find(m => m.id === mesocycleId);

      let newCellData = { ...prev.cellData };

      // If we're splitting (going from unsplit to split), copy exercises to all microcycles
      if (willBeSplit && mesocycle) {
        Object.entries(prev.cellData).forEach(([cellId, cellData]) => {
          const isMesocycleLevel = !cellData.microcycleId;
          const matchesMesoProp = cellData.mesocycleId === mesocycleId;
          const matchesByKey = cellId.endsWith(`-${mesocycleId}`);
          if (isMesocycleLevel && (matchesMesoProp || matchesByKey) && cellData.exercises.length > 0) {
            // Clone exercises to each microcycle using proper getCellId
            mesocycle.microcycles.forEach(microcycle => {
              const microcycleCellId = getCellId(cellData.methodId, cellData.categoryName, microcycle.id);
              const existingTarget = newCellData[microcycleCellId];

              // Only create if target doesn't exist or has no exercises (don't overwrite user's data)
              if (!existingTarget || (existingTarget.exercises?.length ?? 0) === 0) {
                newCellData[microcycleCellId] = {
                  methodId: cellData.methodId,
                  categoryName: cellData.categoryName,
                  mesocycleId: mesocycle.id,
                  microcycleId: microcycle.id,
                  exercises: cellData.exercises.map(ex => ({ ...ex })),
                };
              }
            });
          }
        });
      }

      return {
        ...prev,
        cellData: newCellData,
        splitStates: {
          ...prev.splitStates,
          [mesocycleId]: willBeSplit,
        },
      };
    });
  };

  const createMicrocycleGroup = (microcycleIds: string[], mesocycleId: string) => {
    const groupId = `group-${Date.now()}`;
    
    // Get microcycle names for group naming
    const mesocycle = mesocycles.find(m => m.id === mesocycleId);
    const microcycleNames = microcycleIds
      .map(id => mesocycle?.microcycles.find(m => m.id === id)?.name)
      .filter(Boolean)
      .join(' & ');
    
    const group: MicrocycleGroup = {
      id: groupId,
      mesocycleId,
      microcycleIds,
      name: microcycleNames || `Group ${Object.keys(planningState.microcycleGroups).length + 1}`
    };

    setPlanningState(prev => ({
      ...prev,
      microcycleGroups: {
        ...prev.microcycleGroups,
        [groupId]: group
      }
    }));
  };

  const unlinkMicrocycles = (groupId: string) => {
    setPlanningState(prev => {
      const { [groupId]: removed, ...remainingGroups } = prev.microcycleGroups;
      return {
        ...prev,
        microcycleGroups: remainingGroups
      };
    });
  };

  const linkWithNext = (mesocycleId: string, microcycleId: string) => {
    const meso = mesocycles.find(m => m.id === mesocycleId);
    if (!meso) return;
    const idx = meso.microcycles.findIndex(m => m.id === microcycleId);
    if (idx === -1 || idx === meso.microcycles.length - 1) return;
    const nextId = meso.microcycles[idx + 1].id;
    if (!canLinkWithNext(mesocycleId, microcycleId)) return;
    
    // Check if current microcycle is already in a group
    const existingGroup = Object.values(planningState.microcycleGroups).find(
      g => g.mesocycleId === mesocycleId && g.microcycleIds.includes(microcycleId)
    );
    
    if (existingGroup) {
      // Extend existing group by adding the next microcycle
      const updatedGroup = {
        ...existingGroup,
        microcycleIds: [...existingGroup.microcycleIds, nextId],
        name: existingGroup.microcycleIds
          .concat(nextId)
          .map(id => meso.microcycles.find(m => m.id === id)?.name)
          .filter(Boolean)
          .join(' & ')
      };
      
      setPlanningState(prev => ({
        ...prev,
        microcycleGroups: {
          ...prev.microcycleGroups,
          [existingGroup.id]: updatedGroup
        }
      }));
    } else {
      // Create new group with current and next microcycles
      createMicrocycleGroup([microcycleId, nextId], mesocycleId);
    }
  };

const updateCellData = (
  cellId: string,
  newData: Partial<CellData>,
  context?: { methodId: string; categoryName?: string; columnId: string }
) => {
  setPlanningState(prev => {
    const existingCell = prev.cellData[cellId];

    if (!existingCell) {
      // Use explicit context to avoid brittle parsing
      const methodId = context?.methodId;
      const categoryName = context?.categoryName;
      const columnId = context?.columnId;

      // Fallback: best-effort inference when context is missing (legacy safety)
      let inferredMethodId = methodId;
      let inferredCategoryName = categoryName;
      let inferredColumnId = columnId;

      if (!inferredMethodId || !inferredColumnId) {
        const lastDash = cellId.lastIndexOf("-");
        inferredColumnId = cellId.slice(lastDash + 1);
        const prefix = cellId.slice(0, lastDash);
        const secondLastDash = prefix.lastIndexOf("-");
        if (secondLastDash !== -1) {
          inferredMethodId = prefix.slice(0, secondLastDash);
          const cat = prefix.slice(secondLastDash + 1);
          inferredCategoryName = cat === "main" ? undefined : cat;
        }
      }

      // Determine mesocycle vs microcycle by scanning mesocycles
      let mesocycleId: string = inferredColumnId!;
      let microcycleId: string | undefined = undefined;
      for (const meso of mesocycles) {
        const micro = meso.microcycles.find(m => m.id === inferredColumnId);
        if (micro) {
          mesocycleId = meso.id;
          microcycleId = micro.id;
          break;
        }
      }

      return {
        ...prev,
        cellData: {
          ...prev.cellData,
          [cellId]: {
            methodId: inferredMethodId!,
            categoryName: inferredCategoryName,
            mesocycleId,
            microcycleId,
            exercises: [],
            ...newData,
          },
        },
      };
    }

    // Cell exists, update it and backfill missing metadata if necessary
    return {
      ...prev,
      cellData: {
        ...prev.cellData,
        [cellId]: (() => {
          // Infer values when missing (migration safety)
          const lastDash = cellId.lastIndexOf("-");
          const inferredColumnId = (context?.columnId) ?? cellId.slice(lastDash + 1);
          const prefix = cellId.slice(0, lastDash);
          const secondLastDash = prefix.lastIndexOf("-");
          const inferredMethodId = (context?.methodId) ?? (secondLastDash !== -1 ? prefix.slice(0, secondLastDash) : existingCell.methodId);
          const catToken = secondLastDash !== -1 ? prefix.slice(secondLastDash + 1) : undefined;
          const inferredCategoryName = context?.categoryName ?? (catToken === "main" ? undefined : catToken);

          let mesoId = existingCell.mesocycleId;
          let microId = existingCell.microcycleId;
          if (!mesoId) {
            mesoId = inferredColumnId;
            for (const meso of mesocycles) {
              const micro = meso.microcycles.find(m => m.id === inferredColumnId);
              if (micro) {
                mesoId = meso.id;
                microId = micro.id;
                break;
              }
            }
          }

          return {
            methodId: existingCell.methodId ?? inferredMethodId!,
            categoryName: existingCell.categoryName ?? inferredCategoryName,
            mesocycleId: mesoId!,
            microcycleId: microId,
            exercises: existingCell.exercises,
            ...newData,
          } as CellData;
        })(),
      },
    };
  });
};
  const getCellId = (methodId: string, categoryName: string | undefined, columnId: string) => {
    return `${methodId}-${categoryName || 'main'}-${columnId}`;
  };

  const getCellData = (methodId: string, categoryName: string | undefined, columnId: string): CellData => {
    const cellId = getCellId(methodId, categoryName, columnId);
    const existing = planningState.cellData[cellId];
    if (existing) return existing;

    // Determine mesocycle vs microcycle by scanning mesocycles
    let mesoId: string = columnId;
    let microId: string | undefined = undefined;
    for (const meso of mesocycles) {
      const micro = meso.microcycles.find(m => m.id === columnId);
      if (micro) {
        mesoId = meso.id;
        microId = micro.id;
        break;
      }
    }

    return {
      methodId,
      categoryName,
      mesocycleId: mesoId,
      microcycleId: microId,
      exercises: [],
    };
  };

  // Check if there are previous columns (show copy button for all columns except first)
  const hasPreviousExercisesInMethod = (
    methodId: string, 
    categoryName: string | undefined, 
    currentColumnIndex: number
  ): boolean => {
    // Show copy button for all columns except the first one
    return currentColumnIndex > 0;
  };

  // Copy exercises from previous column or open dialog
  const copyExercisesWithinMethod = (
    methodId: string, 
    categoryName: string | undefined, 
    targetColumnId: string
  ) => {
    const targetColumnIndex = columnStructure.findIndex(col => col.id === targetColumnId);
    if (targetColumnIndex === -1) return;

    // Find the most recent previous column with exercises
    let sourceColumnId: string | null = null;
    for (let i = targetColumnIndex - 1; i >= 0; i--) {
      const column = columnStructure[i];
      if (column.type === 'link-area') continue;
      
      const cellId = getCellId(methodId, categoryName, column.id);
      const cell = planningState.cellData[cellId];
      
      if (cell && cell.exercises.length > 0) {
        sourceColumnId = column.id;
        break;
      }
    }

    if (sourceColumnId) {
      // Copy exercises immediately
      const sourceCellId = getCellId(methodId, categoryName, sourceColumnId);
      const sourceCell = planningState.cellData[sourceCellId];
      
      if (sourceCell && sourceCell.exercises.length > 0) {
        const targetCellId = getCellId(methodId, categoryName, targetColumnId);
        
        // Create new exercise selections with new IDs
        const copiedExercises = sourceCell.exercises.map(ex => ({
          ...ex,
          id: `${ex.exerciseId}-${Date.now()}-${Math.random()}`
        }));
        
        updateCellData(
          targetCellId,
          { exercises: copiedExercises },
          { methodId, categoryName, columnId: targetColumnId }
        );

        // Get column labels for toast
        const sourceColumn = columnStructure.find(col => col.id === sourceColumnId);
        const targetColumn = columnStructure.find(col => col.id === targetColumnId);
        
        let sourceLabel = '';
        let targetLabel = '';
        
        if (sourceColumn) {
          if (sourceColumn.type === 'mesocycle') {
            sourceLabel = sourceColumn.mesocycleName;
          } else if (sourceColumn.type === 'microcycle') {
            sourceLabel = `${sourceColumn.mesocycleName} - ${sourceColumn.microcycleName}`;
          } else if (sourceColumn.type === 'microcycle-group') {
            sourceLabel = `${sourceColumn.mesocycleName} - ${sourceColumn.groupName}`;
          }
        }
        
        if (targetColumn) {
          if (targetColumn.type === 'mesocycle') {
            targetLabel = targetColumn.mesocycleName;
          } else if (targetColumn.type === 'microcycle') {
            targetLabel = `${targetColumn.mesocycleName} - ${targetColumn.microcycleName}`;
          } else if (targetColumn.type === 'microcycle-group') {
            targetLabel = `${targetColumn.mesocycleName} - ${targetColumn.groupName}`;
          }
        }

        toast({
          title: 'Exercises copied',
          description: `Copied ${copiedExercises.length} exercise${copiedExercises.length !== 1 ? 's' : ''} from ${sourceLabel} to ${targetLabel}`,
        });
      }
    } else {
      // No previous exercises found, open dialog for manual selection
      toast({
        title: 'Select source column',
        description: 'Choose a column to copy exercises from',
      });
      
      setCopyDialogState({
        isOpen: true,
        methodId,
        categoryName,
        targetColumnId,
      });
    }
  };

  // Handle copy from dialog selection
  const handleCopyFromDialog = (sourceColumnId: string) => {
    const { methodId, categoryName, targetColumnId } = copyDialogState;
    
    const sourceCellId = getCellId(methodId, categoryName, sourceColumnId);
    const sourceCell = planningState.cellData[sourceCellId];
    
    if (sourceCell && sourceCell.exercises.length > 0) {
      const targetCellId = getCellId(methodId, categoryName, targetColumnId);
      
      // Create new exercise selections with new IDs
      const copiedExercises = sourceCell.exercises.map(ex => ({
        ...ex,
        id: `${ex.exerciseId}-${Date.now()}-${Math.random()}`
      }));
      
      updateCellData(
        targetCellId,
        { exercises: copiedExercises },
        { methodId, categoryName, columnId: targetColumnId }
      );

      // Get column labels for toast
      const sourceColumn = columnStructure.find(col => col.id === sourceColumnId);
      const targetColumn = columnStructure.find(col => col.id === targetColumnId);
      
      let sourceLabel = '';
      let targetLabel = '';
      
      if (sourceColumn) {
        if (sourceColumn.type === 'mesocycle') {
          sourceLabel = sourceColumn.mesocycleName;
        } else if (sourceColumn.type === 'microcycle') {
          sourceLabel = `${sourceColumn.mesocycleName} - ${sourceColumn.microcycleName}`;
        } else if (sourceColumn.type === 'microcycle-group') {
          sourceLabel = `${sourceColumn.mesocycleName} - ${sourceColumn.groupName}`;
        }
      }
      
      if (targetColumn) {
        if (targetColumn.type === 'mesocycle') {
          targetLabel = targetColumn.mesocycleName;
        } else if (targetColumn.type === 'microcycle') {
          targetLabel = `${targetColumn.mesocycleName} - ${targetColumn.microcycleName}`;
        } else if (targetColumn.type === 'microcycle-group') {
          targetLabel = `${targetColumn.mesocycleName} - ${targetColumn.groupName}`;
        }
      }

      toast({
        title: 'Exercises copied',
        description: `Copied ${copiedExercises.length} exercise${copiedExercises.length !== 1 ? 's' : ''} from ${sourceLabel} to ${targetLabel}`,
      });
    }
  };

  // Clear exercises for a specific mesocycle
  const handleClearMesocycleExercises = useCallback((mesocycleId: string) => {
    const newCellData = { ...planningState.cellData };
    
    // Remove all cell data entries for this mesocycle
    Object.keys(newCellData).forEach(cellId => {
      if (newCellData[cellId].mesocycleId === mesocycleId) {
        delete newCellData[cellId];
      }
    });

    setPlanningState(prev => ({
      ...prev,
      cellData: newCellData
    }));

    setClearMesocycleDialogState({ isOpen: false, mesocycleId: '', mesocycleName: '' });

    toast({
      title: "Mesocycle exercises cleared",
      description: `All exercise selections for ${clearMesocycleDialogState.mesocycleName} have been cleared.`,
    });
  }, [planningState.cellData, clearMesocycleDialogState.mesocycleName, toast]);

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Microcycle Exercise Planning</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <Table className="min-w-[1200px]">
            <TableHeader>
              {/* First row - Mesocycle headers (only when there are split mesocycles) */}
              {hasSplitMesocycles && (
                <TableRow>
                  <TableHead className="w-64 sticky left-0 bg-background z-20 border-r-2 border-border">
                    Method
                  </TableHead>
                  {mesocycleHeaders.map((header) => {
                    const mesocycle = mesocycles.find(m => m.id === header.mesocycleId);
                    return (
                      <TableHead
                        key={header.mesocycleId}
                        colSpan={header.colSpan}
                        className={cn(
                          "text-center font-semibold text-mesocycle-foreground border-r-2 border-border",
                          header.colorClass
                        )}
                      >
                        <div className="flex flex-col items-center gap-2 py-2">
                          <div className="flex items-center gap-2">
                            <span>{header.mesocycleName}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setClearMesocycleDialogState({
                                  isOpen: true,
                                  mesocycleId: header.mesocycleId,
                                  mesocycleName: header.mesocycleName
                                })}
                                className="h-6 px-2 text-foreground hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleMesocycleSplit(header.mesocycleId)}
                                className="h-6 px-2 text-foreground hover:bg-black/10"
                              >
                                <ChevronDown className="h-3 w-3" />
                                Collapse
                              </Button>
                            </div>
                          </div>
                          
                          {/* Sub-goals display for split mesocycles */}
                          {mesocycle?.allocatedSubGoals && mesocycle.allocatedSubGoals.length > 0 && (
                            <div className="space-y-1 w-full">
                              <span className="text-xs font-medium text-muted-foreground">Sub-Goals:</span>
                              <ul className="space-y-1">
                                {mesocycle.allocatedSubGoals.map((subGoal) => {
                                  const methodsWithRecs = getMethodsWithRecommendationsForSubGoal(subGoal);
                                  
                                  return (
                                    <li key={subGoal} className="text-xs">
                                      <Popover>
                                        <PopoverTrigger
                                          className="flex items-start gap-1 text-left hover:text-primary transition-colors cursor-pointer w-full"
                                        >
                                          <span className="text-primary">•</span>
                                          <span className="text-foreground leading-tight text-xs">{subGoal}</span>
                                        </PopoverTrigger>
                                        <PopoverContent 
                                          className="w-[800px] max-w-[95vw] z-[100]" 
                                          align="start"
                                          side="bottom"
                                          sideOffset={5}
                                        >
                                          <div className="space-y-2">
                                            <h4 className="font-semibold text-sm text-foreground">{subGoal}</h4>
                                            {methodsWithRecs.length > 0 ? (
                                              <div className="space-y-2">
                                                {methodsWithRecs.map(({ method, recommendations }) => (
                                                  <div key={method} className="text-xs border-l-2 border-primary/30 pl-3">
                                                    <div className="font-medium text-primary mb-1">{method}</div>
                                                    <div className="text-muted-foreground leading-relaxed">
                                                      {formatLoadingRecommendations(recommendations)}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="text-xs text-muted-foreground italic">
                                                No methods available for this sub-goal
                                              </div>
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              )}
              
              {/* Second row - Individual columns */}
              <TableRow>
                  <TableHead className="w-64 sticky left-0 bg-background z-20 border-r-2 border-border">
                    {!hasSplitMesocycles ? "Method" : null}
                  </TableHead>
                {columnStructure.map((column, index) => {
                  const mesocycle = mesocycles.find(m => m.id === column.mesocycleId);
                  let intensity = mesocycle?.intensity || 'moderate';
                  let isLight = false;
                  let isGroup = false;
                  
                  // Handle different column types
                  if (column.type === 'microcycle' && mesocycle) {
                    const microcycle = mesocycle.microcycles.find(m => m.id === column.microcycleId);
                    if (microcycle) {
                      intensity = microcycle.intensity;
                      isLight = true; // Make microcycles lighter than mesocycles
                    }
                  } else if (column.type === 'microcycle-group') {
                    isGroup = true; // Use neutral color for groups
                  } else if (column.type === 'link-area') {
                    // Link areas should be transparent/minimal
                    return (
                      <TableHead 
                        key={column.id} 
                        className="text-center w-12 border-r border-border bg-muted/10"
                      >
                        <div className="flex items-center justify-center py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => linkWithNext(column.mesocycleId, column.microcycleId!)}
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableHead>
                    );
                  }
                  
                  const colorClass = getIntensityColor(intensity, isLight, isGroup);
                  
                  return (
                    <TableHead 
                      key={column.id} 
                      className={cn(
                        "text-center min-w-[200px] min-h-[120px] border-r border-border",
                        colorClass,
                        column.type === 'mesocycle' ? "text-foreground font-semibold" : "text-foreground"
                      )}
                    >
                       <div className="flex flex-col items-center gap-2 py-2">
                         {/* Title line: show microcycle/group names; only show mesocycle name here when no split headers are shown */}
                         {column.type === 'microcycle' && (
                           <Popover>
                             <PopoverTrigger className="font-medium hover:text-primary transition-colors cursor-pointer">
                               {column.microcycleName}
                             </PopoverTrigger>
                             <PopoverContent 
                               className="w-[800px] max-w-[95vw] z-[100]" 
                               align="start"
                               side="bottom"
                               sideOffset={5}
                             >
                               <div className="space-y-3">
                                 <h4 className="font-semibold text-sm text-foreground">
                                   {column.mesocycleName} - {column.microcycleName}
                                 </h4>
                                 <p className="text-xs text-muted-foreground">
                                   Method Periodization Parameters
                                 </p>
                                 {(() => {
                                   const microcycleIndex = mesocycles
                                     .find(m => m.id === column.mesocycleId)
                                     ?.microcycles.findIndex(mc => mc.id === column.microcycleId);
                                   
                                   if (microcycleIndex === undefined || microcycleIndex === -1) {
                                     return (
                                       <div className="text-xs text-muted-foreground italic">
                                         No parameter data available
                                       </div>
                                     );
                                   }
                                   
                                   const methodsData = getMicrocycleParameters(column.mesocycleId, microcycleIndex);
                                   
                                   if (methodsData.length === 0) {
                                     return (
                                       <div className="text-xs text-muted-foreground italic">
                                         No parameters configured for this microcycle
                                       </div>
                                     );
                                   }
                                   
                                   return (
                                     <div className="space-y-3">
                                       {methodsData.map(({ methodName, parameters, hasMultipleSessions }) => (
                                         <div key={methodName} className="border-l-2 border-primary/30 pl-3">
                                           <div className="font-medium text-primary mb-2 text-sm">
                                             {methodName}
                                           </div>
                                           
                                           {hasMultipleSessions ? (
                                             // Group by session
                                             (() => {
                                               const sessionGroups = parameters.reduce((acc, param) => {
                                                 const sessionIdx = param.sessionIndex ?? 0;
                                                 if (!acc[sessionIdx]) acc[sessionIdx] = [];
                                                 acc[sessionIdx].push(param);
                                                 return acc;
                                               }, {} as Record<number, typeof parameters>);
                                               
                                               return Object.entries(sessionGroups).map(([sessionIdx, params]) => (
                                                 <div key={sessionIdx} className="mb-2">
                                                   <div className="text-xs font-medium text-muted-foreground mb-1">
                                                     Session {parseInt(sessionIdx) + 1}:
                                                   </div>
                                                   <div className="text-xs text-foreground/90 leading-relaxed">
                                                     {params.map((param, idx) => (
                                                       <span key={param.name}>
                                                         {idx > 0 && ', '}
                                                         <span className="font-medium">{param.name}</span>
                                                         {': '}
                                                         {param.value}
                                                         {param.unit && ` ${param.unit}`}
                                                       </span>
                                                     ))}
                                                   </div>
                                                 </div>
                                               ));
                                             })()
                                           ) : (
                                             // Single session view
                                             <div className="text-xs text-foreground/90 leading-relaxed">
                                               {parameters.map((param, idx) => (
                                                 <span key={param.name}>
                                                   {idx > 0 && ', '}
                                                   <span className="font-medium">{param.name}</span>
                                                   {': '}
                                                   {param.value}
                                                   {param.unit && ` ${param.unit}`}
                                                 </span>
                                               ))}
                                             </div>
                                           )}
                                         </div>
                                       ))}
                                     </div>
                                   );
                                 })()}
                               </div>
                             </PopoverContent>
                           </Popover>
                         )}
                         {column.type === 'microcycle-group' && (
                           <span className="font-medium">{column.groupName}</span>
                         )}
                          {column.type === 'mesocycle' && !hasSplitMesocycles && (
                            <div className="flex items-center gap-2 w-full">
                              <span className="font-medium">{column.mesocycleName}</span>
                              <div className="flex items-center gap-1 ml-auto">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setClearMesocycleDialogState({
                                    isOpen: true,
                                    mesocycleId: column.mesocycleId,
                                    mesocycleName: column.mesocycleName
                                  })}
                                  className="h-6 px-2 text-foreground hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Clear
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleMesocycleSplit(column.mesocycleId)}
                                  className="h-6 px-2"
                                >
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Split
                                </Button>
                              </div>
                            </div>
                          )}
                         
                         {/* Sub-goals display only when not using split headers */}
                         {column.type === 'mesocycle' && !hasSplitMesocycles && mesocycle?.allocatedSubGoals && mesocycle.allocatedSubGoals.length > 0 && (
                           <div className="space-y-1 w-full">
                             <span className="text-xs font-medium text-muted-foreground">Sub-Goals:</span>
                             <ul className="space-y-1">
                               {mesocycle.allocatedSubGoals.map((subGoal) => {
                                 const methodsWithRecs = getMethodsWithRecommendationsForSubGoal(subGoal);
                                 
                                 return (
                                   <li key={subGoal} className="text-xs">
                                     <Popover>
                                       <PopoverTrigger
                                         className="flex items-start gap-1 text-left hover:text-primary transition-colors cursor-pointer w-full"
                                       >
                                         <span className="text-primary">•</span>
                                         <span className="text-foreground leading-tight text-xs">{subGoal}</span>
                                       </PopoverTrigger>
                                       <PopoverContent 
                                         className="w-[800px] max-w-[95vw] z-[100]" 
                                         align="start"
                                         side="bottom"
                                         sideOffset={5}
                                       >
                                         <div className="space-y-2">
                                           <h4 className="font-semibold text-sm text-foreground">{subGoal}</h4>
                                           {methodsWithRecs.length > 0 ? (
                                             <div className="space-y-2">
                                               {methodsWithRecs.map(({ method, recommendations }) => (
                                                 <div key={method} className="text-xs border-l-2 border-primary/30 pl-3">
                                                   <div className="font-medium text-primary mb-1">{method}</div>
                                                   <div className="text-muted-foreground leading-relaxed">
                                                     {formatLoadingRecommendations(recommendations)}
                                                   </div>
                                                 </div>
                                               ))}
                                             </div>
                                           ) : (
                                             <div className="text-xs text-muted-foreground italic">
                                               No methods available for this sub-goal
                                             </div>
                                           )}
                                         </div>
                                       </PopoverContent>
                                     </Popover>
                                   </li>
                                 );
                               })}
                             </ul>
                           </div>
                         )}
                        
                        {/* Split/Unlink actions */}
                        {column.type === 'mesocycle' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMesocycleSplit(column.mesocycleId)}
                            className="h-6 px-2 text-foreground hover:bg-black/10"
                          >
                            <ChevronRight className="h-3 w-3" />
                            Split
                          </Button>
                        )}
                        
                        {column.type === 'microcycle-group' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkMicrocycles(column.groupId)}
                            className="h-6 px-2 hover:bg-black/10"
                          >
                            <Unlink className="h-3 w-3" />
                            Unlink
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hierarchicalMethods.map((categoryGroup) => (
                <React.Fragment key={categoryGroup.categoryName}>
                  {/* Category Header Row */}
                  <TableRow className="bg-muted hover:bg-muted/80">
                    <TableCell 
                      colSpan={1} 
                      className="sticky left-0 bg-muted z-20 border-r-2 border-border py-3"
                    >
                      <Button
                        variant="ghost"
                        onClick={() => toggleCategoryExpansion(categoryGroup.categoryName)}
                        className="flex items-center gap-2 p-2 h-auto font-semibold text-foreground hover:bg-muted/50 w-full justify-start"
                      >
                        {expandedCategories.has(categoryGroup.categoryName) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {categoryGroup.categoryName}
                        <span className="text-muted-foreground text-sm">({categoryGroup.methods.length})</span>
                      </Button>
                    </TableCell>
                    {columnStructure.map((column) => (
                      <TableCell 
                        key={`${categoryGroup.categoryName}-header-${column.id}`}
                        className="bg-muted border-r border-border py-3"
                      >
                        {/* Empty header cells for category row */}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Method Rows (only show if category is expanded) */}
                  {expandedCategories.has(categoryGroup.categoryName) && categoryGroup.methods.map((method) => (
                    <React.Fragment key={method.id}>
                      {method.categories.length === 0 ? (
                        // If no exercise categories, render one row for the method itself
                        <TableRow key={`${method.id}-main`}>
                          <TableCell className="sticky left-0 bg-background z-15 border-r-2 border-border w-64 pl-8 py-3">
                            <div className="font-medium text-foreground">{method.name}</div>
                          </TableCell>
                          {columnStructure.map((column) => {
                            // Skip link areas for table cells
                            if (column.type === 'link-area') {
                              return (
                                <TableCell 
                                  key={`${method.id}-main-${column.id}`} 
                                  className="p-2 border-r border-border bg-muted/5 w-12"
                                >
                                  {/* Empty cell for link area */}
                                </TableCell>
                              );
                            }
                            
                            const mesocycle = mesocycles.find(m => m.id === column.mesocycleId);
                            let intensity = mesocycle?.intensity || 'moderate';
                            let isLight = false;
                            let isGroup = false;
                            
                            // For individual microcycles, use their specific intensity
                            if (column.type === 'microcycle' && mesocycle) {
                              const microcycle = mesocycle.microcycles.find(m => m.id === column.microcycleId);
                              if (microcycle) {
                                intensity = microcycle.intensity;
                                isLight = true; // Make microcycles lighter than mesocycles
                              }
                            } else if (column.type === 'microcycle-group') {
                              isGroup = true; // Use neutral color for groups
                            }
                            
                            const colorClass = getIntensityColor(intensity, isLight, isGroup);
                            
                            return (
                              <TableCell 
                                key={`${method.id}-main-${column.id}`} 
                                className={cn("p-2 border-r border-border", colorClass)}
                              >
                                 <ExerciseSelectionCell
                                   cellData={getCellData(method.id, undefined, column.id)}
                                   onUpdate={(newData) =>
                                     updateCellData(
                                       getCellId(method.id, undefined, column.id),
                                       newData,
                                       { methodId: method.id, categoryName: undefined, columnId: column.id }
                                     )
                                   }
                                   onCopy={() => copyExercisesWithinMethod(method.id, undefined, column.id)}
                                   hasPreviousExercises={hasPreviousExercisesInMethod(method.id, undefined, columnStructure.findIndex(col => col.id === column.id))}
                                 />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ) : (
                        // Render exercise category rows with method name spanning
                          <> 
                          <TableRow key={`${method.id}-header`}>
                            <TableCell className="sticky left-0 bg-background z-15 border-r-2 border-border w-64 pl-8 py-3">
                              <div className="font-medium text-foreground">{method.name}</div>
                            </TableCell>
                            {columnStructure.map((column) => {
                              if (column.type === 'link-area') {
                                return (
                                  <TableCell
                                    key={`${method.id}-header-${column.id}`}
                                    className="p-2 border-r border-border bg-muted/5 w-12"
                                  />
                                );
                              }
                              // Placeholder cells to maintain grid alignment
                              return (
                                <TableCell
                                  key={`${method.id}-header-${column.id}`}
                                  className="p-2 border-r border-border bg-muted/5"
                                />
                              );
                            })}
                          </TableRow>
                          {method.categories.map((categoryName) => (
                            <TableRow key={`${method.id}-${categoryName}`}>
                              <TableCell className="sticky left-0 bg-background z-15 border-r-2 border-border w-64 pl-12 py-3">
                                <div className="text-sm text-muted-foreground">{categoryName}</div>
                              </TableCell>
                              {columnStructure.map((column) => {
                                // Skip link areas for table cells
                                if (column.type === 'link-area') {
                                  return (
                                    <TableCell
                                      key={`${method.id}-${categoryName}-${column.id}`}
                                      className="p-2 border-r border-border bg-muted/5 w-12"
                                    />
                                  );
                                }

                                const mesocycle = mesocycles.find(m => m.id === column.mesocycleId);
                                let intensity = mesocycle?.intensity || 'moderate';
                                let isLight = false;
                                let isGroup = false;

                                if (column.type === 'microcycle' && mesocycle) {
                                  const microcycle = mesocycle.microcycles.find(m => m.id === column.microcycleId);
                                  if (microcycle) {
                                    intensity = microcycle.intensity;
                                    isLight = true;
                                  }
                                } else if (column.type === 'microcycle-group') {
                                  isGroup = true;
                                }

                                const colorClass = getIntensityColor(intensity, isLight, isGroup);

                                return (
                                  <TableCell
                                    key={`${method.id}-${categoryName}-${column.id}`}
                                    className={cn("p-2 border-r border-border", colorClass)}
                                  >
                                    <ExerciseSelectionCell
                                      cellData={getCellData(method.id, categoryName, column.id)}
                                      onUpdate={(newData) =>
                                        updateCellData(
                                          getCellId(method.id, categoryName, column.id),
                                          newData,
                                          { methodId: method.id, categoryName, columnId: column.id }
                                        )
                                      }
                                      onCopy={() => copyExercisesWithinMethod(method.id, categoryName, column.id)}
                                      hasPreviousExercises={hasPreviousExercisesInMethod(method.id, categoryName, columnStructure.findIndex(col => col.id === column.id))}
                                    />
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>

    <ExerciseCopyDialog
      isOpen={copyDialogState.isOpen}
      onClose={() => setCopyDialogState({ ...copyDialogState, isOpen: false })}
      onConfirm={handleCopyFromDialog}
      methodId={copyDialogState.methodId}
      categoryName={copyDialogState.categoryName}
      targetColumnId={copyDialogState.targetColumnId}
      mesocycles={mesocycles}
      cellData={planningState.cellData}
      columnStructure={columnStructure}
      getCellId={getCellId}
    />

    {/* Clear Mesocycle Exercises Confirmation Dialog */}
    <AlertDialog 
      open={clearMesocycleDialogState.isOpen} 
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setClearMesocycleDialogState({ isOpen: false, mesocycleId: '', mesocycleName: '' });
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear exercises for {clearMesocycleDialogState.mesocycleName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear all exercise selections for {clearMesocycleDialogState.mesocycleName} across all methods and microcycles. 
            Exercise selections in other mesocycles will remain intact. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleClearMesocycleExercises(clearMesocycleDialogState.mesocycleId)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Mesocycle Exercises
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}