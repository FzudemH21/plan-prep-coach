import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight, Link, Unlink } from 'lucide-react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { useToolboxData } from '@/hooks/useToolboxData';
import { useAthleticismData } from '@/hooks/useAthleticismData';
import { ExerciseSelectionCell } from './ExerciseSelectionCell';
import { 
  TrainingMethodWithCategories,
  CellData, 
  MicrocyclePlanningState,
  MicrocycleGroup
} from '@/types/microcycle-planning';
import { cn } from '@/lib/utils';

interface MicrocyclePlanningTableProps {
  mesocycles: ExtendedMesocycle[];
  selectedMethods?: string[];
}

export function MicrocyclePlanningTable({ mesocycles, selectedMethods = [] }: MicrocyclePlanningTableProps) {
  const { data: toolboxData } = useToolboxData();
  const { data: athleticismData } = useAthleticismData();
  const [planningState, setPlanningState] = useState<MicrocyclePlanningState>({
    cellData: {},
    splitStates: {},
    microcycleGroups: {}
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

  // Get training methods with their exercise categories
  const trainingMethods: TrainingMethodWithCategories[] = useMemo(() => {
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
          name: methodName,
          categories: []
        });
      }
      
      const method = methodsMap.get(methodName)!;
      if (entry.exerciseCategories?.length) {
        entry.exerciseCategories.forEach(category => {
          if (!method.categories.includes(category)) {
            method.categories.push(category);
          }
        });
      }
    });
    
    return Array.from(methodsMap.values());
  }, [toolboxData, selectedMethods]);

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
    setPlanningState(prev => ({
      ...prev,
      splitStates: {
        ...prev.splitStates,
        [mesocycleId]: !prev.splitStates[mesocycleId]
      }
    }));
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

const updateCellData = (cellId: string, newData: Partial<CellData>) => {
  setPlanningState(prev => ({
    ...prev,
    cellData: {
      ...prev.cellData,
      [cellId]: {
        ...prev.cellData[cellId],
        ...newData
      }
    }
  }));
};
  const getCellId = (methodId: string, categoryName: string | undefined, columnId: string) => {
    return `${methodId}-${categoryName || 'main'}-${columnId}`;
  };

  const getCellData = (methodId: string, categoryName: string | undefined, columnId: string): CellData => {
    const cellId = getCellId(methodId, categoryName, columnId);
    return planningState.cellData[cellId] || {
      methodId,
      categoryName,
      mesocycleId: columnId,
      exercises: []
    };
  };

  return (
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
                  <TableHead className="w-64 sticky left-0 bg-background z-10 border-r-2 border-border">
                    Training Methods
                  </TableHead>
                  {mesocycleHeaders.map((header) => (
                    <TableHead
                      key={header.mesocycleId}
                      colSpan={header.colSpan}
                      className={cn(
                        "text-center font-semibold text-mesocycle-foreground border-r-2 border-border",
                        header.colorClass
                      )}
                    >
                      <div className="flex items-center justify-center gap-2 py-1">
                        <span>{header.mesocycleName}</span>
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
                    </TableHead>
                  ))}
                </TableRow>
              )}
              
              {/* Second row - Individual columns */}
              <TableRow>
                <TableHead className="w-64 sticky left-0 bg-background z-10 border-r-2 border-border">
                  {!hasSplitMesocycles && "Training Methods"}
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
                        "text-center min-w-[200px] border-r border-border",
                        colorClass,
                        column.type === 'mesocycle' ? "text-foreground font-semibold" : "text-foreground"
                      )}
                    >
                       <div className="flex flex-col items-center gap-2 py-2">
                         <span className="font-medium">
                           {column.type === 'mesocycle' && column.mesocycleName}
                           {column.type === 'microcycle' && column.microcycleName}
                           {column.type === 'microcycle-group' && column.groupName}
                         </span>
                         
                         {/* Sub-goals display for mesocycles */}
                         {column.type === 'mesocycle' && mesocycle?.allocatedSubGoals && mesocycle.allocatedSubGoals.length > 0 && (
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
              {trainingMethods.map((method) => (
                <React.Fragment key={method.id}>
                  {/* Main method row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background z-10 border-r-2 border-border">
                      <div className="space-y-1">
                        <div className="font-semibold">{method.name}</div>
                        {method.categories.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Categories: {method.categories.join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {columnStructure.map((column) => {
                      // Skip link areas for table cells
                      if (column.type === 'link-area') {
                        return (
                          <TableCell 
                            key={`${method.id}-${column.id}`} 
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
                          key={`${method.id}-${column.id}`} 
                          className={cn("p-2 border-r border-border", colorClass)}
                        >
                          <ExerciseSelectionCell
                            cellData={getCellData(method.id, undefined, column.id)}
                            onUpdate={(newData) => updateCellData(getCellId(method.id, undefined, column.id), newData)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* Category rows */}
                  {method.categories.map((categoryName) => (
                    <TableRow key={`${method.id}-${categoryName}`}>
                      <TableCell className="font-medium pl-8 sticky left-0 bg-background z-10 border-r-2 border-border">
                        <div className="text-sm text-muted-foreground">
                          {categoryName}
                        </div>
                      </TableCell>
                      {columnStructure.map((column) => {
                        // Skip link areas for table cells
                        if (column.type === 'link-area') {
                          return (
                            <TableCell 
                              key={`${method.id}-${categoryName}-${column.id}`} 
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
                            key={`${method.id}-${categoryName}-${column.id}`} 
                            className={cn("p-2 border-r border-border", colorClass)}
                          >
                            <ExerciseSelectionCell
                              cellData={getCellData(method.id, categoryName, column.id)}
                              onUpdate={(newData) => updateCellData(getCellId(method.id, categoryName, column.id), newData)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}