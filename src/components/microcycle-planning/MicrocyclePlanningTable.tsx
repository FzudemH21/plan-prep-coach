import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Link, Unlink } from 'lucide-react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { useToolboxData } from '@/hooks/useToolboxData';
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
  const [planningState, setPlanningState] = useState<MicrocyclePlanningState>({
    cellData: {},
    splitStates: {},
    microcycleGroups: {}
  });

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
    return mesocycles.map(meso => {
      const isSplit = planningState.splitStates[meso.id] || false;
      
      if (!isSplit) {
        return {
          type: 'mesocycle' as const,
          mesocycleId: meso.id,
          mesocycleName: meso.name,
          id: meso.id,
          colSpan: 1
        };
      }

      // Find groups for this mesocycle
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

  mesocycles.forEach((meso) => {
    const isSplit = planningState.splitStates[meso.id] || false;

    let colSpan = 1;
    if (isSplit) {
      const mesocycleGroups = Object.values(planningState.microcycleGroups)
        .filter(group => group.mesocycleId === meso.id);
      const groupedIds = new Set(mesocycleGroups.flatMap(g => g.microcycleIds));
      const ungroupedCount = meso.microcycles.filter(m => !groupedIds.has(m.id)).length;
      colSpan = mesocycleGroups.length + ungroupedCount;
      if (colSpan === 0) colSpan = 1;
    }
    
    headers.push({
      mesocycleId: meso.id,
      mesocycleName: meso.name,
      colSpan,
      colorClass: getIntensityColor(meso.intensity)
    });
  });

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

// Helpers to manage linking microcycles
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
  return !isMicrocycleGrouped(mesocycleId, microcycleId) && !isMicrocycleGrouped(mesocycleId, nextId);
};

const linkWithNext = (mesocycleId: string, microcycleId: string) => {
  const meso = mesocycles.find(m => m.id === mesocycleId);
  if (!meso) return;
  const idx = meso.microcycles.findIndex(m => m.id === microcycleId);
  if (idx === -1 || idx === meso.microcycles.length - 1) return;
  const nextId = meso.microcycles[idx + 1].id;
  if (!canLinkWithNext(mesocycleId, microcycleId)) return;
  createMicrocycleGroup([microcycleId, nextId], mesocycleId);
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
          <Table>
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
      </CardContent>
    </Card>
  );
}