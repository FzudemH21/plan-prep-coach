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
      
      // Add grouped microcycles
      mesocycleGroups.forEach(group => {
        if (group.microcycleIds.length > 1) {
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
        } else if (group.microcycleIds.length === 1) {
          // Single microcycle in a group (shouldn't happen, but handle it)
          const microcycleId = group.microcycleIds[0];
          const microcycle = meso.microcycles.find(m => m.id === microcycleId);
          columns.push({
            type: 'microcycle' as const,
            mesocycleId: meso.id,
            mesocycleName: meso.name,
            microcycleId,
            microcycleName: microcycle?.name || `Week ${microcycleId}`,
            id: microcycleId,
            colSpan: 1
          });
        }
      });

      // Add ungrouped microcycles
      meso.microcycles.forEach(micro => {
        if (!groupedMicrocycles.has(micro.id)) {
          columns.push({
            type: 'microcycle' as const,
            mesocycleId: meso.id,
            mesocycleName: meso.name,
            microcycleId: micro.id,
            microcycleName: micro.name,
            id: micro.id,
            colSpan: 1
          });
        }
      });

      return columns;
    }).flat();
  }, [mesocycles, planningState]);

  // Get mesocycle color based on index
  const getMesocycleColorClass = (mesocycleIndex: number, isLight: boolean = false) => {
    const colorIndex = (mesocycleIndex % 8) + 1;
    return isLight ? `bg-mesocycle-${colorIndex}-light` : `bg-mesocycle-${colorIndex}`;
  };

  // Create mesocycle header structure for two-row headers
  const mesocycleHeaders = useMemo(() => {
    const headers: Array<{
      mesocycleId: string;
      mesocycleName: string;
      colSpan: number;
      colorClass: string;
    }> = [];

    mesocycles.forEach((meso, index) => {
      const isSplit = planningState.splitStates[meso.id] || false;
      const colSpan = isSplit ? meso.microcycles.length : 1;
      
      headers.push({
        mesocycleId: meso.id,
        mesocycleName: meso.name,
        colSpan,
        colorClass: getMesocycleColorClass(index)
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
    const group: MicrocycleGroup = {
      id: groupId,
      mesocycleId,
      microcycleIds,
      name: `Group ${Object.keys(planningState.microcycleGroups).length + 1}`
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
                          className="h-6 px-2 text-mesocycle-foreground hover:bg-black/10"
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
                  const mesocycleIndex = mesocycles.findIndex(m => m.id === column.mesocycleId);
                  const isLight = column.type !== 'mesocycle';
                  const colorClass = getMesocycleColorClass(mesocycleIndex, isLight);
                  
                  return (
                    <TableHead 
                      key={column.id} 
                      className={cn(
                        "text-center min-w-[200px] border-r border-border",
                        colorClass,
                        column.type === 'mesocycle' ? "text-mesocycle-foreground font-semibold" : "text-foreground"
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
                            className="h-6 px-2 text-mesocycle-foreground hover:bg-black/10"
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
                      const mesocycleIndex = mesocycles.findIndex(m => m.id === column.mesocycleId);
                      const isLight = column.type !== 'mesocycle';
                      const colorClass = getMesocycleColorClass(mesocycleIndex, isLight);
                      
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
                        const mesocycleIndex = mesocycles.findIndex(m => m.id === column.mesocycleId);
                        const isLight = column.type !== 'mesocycle';
                        const colorClass = getMesocycleColorClass(mesocycleIndex, isLight);
                        
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