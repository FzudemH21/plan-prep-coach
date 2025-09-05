import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link2, Unlink, Split, Merge } from 'lucide-react';
import { ExtendedMesocycle } from '@/features/planner/types';
import { useToolboxData } from '@/hooks/useToolboxData';
import { 
  MicrocyclePlanningState, 
  TrainingMethodWithCategories,
  MicrocycleGroup,
  CellData
} from '@/types/microcycle-planning';
import { ExerciseSelectionCell } from './ExerciseSelectionCell';
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
  const trainingMethods: TrainingMethodWithCategories[] = React.useMemo(() => {
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

  // Generate column structure based on split states
  const columnStructure = React.useMemo(() => {
    const columns: Array<{
      id: string;
      type: 'mesocycle' | 'microcycle';
      mesocycleId: string;
      microcycleId?: string;
      name: string;
      isLinked?: boolean;
      groupId?: string;
    }> = [];

    mesocycles.forEach(mesocycle => {
      const isSplit = planningState.splitStates[mesocycle.id];
      
      if (!isSplit) {
        columns.push({
          id: mesocycle.id,
          type: 'mesocycle',
          mesocycleId: mesocycle.id,
          name: mesocycle.name
        });
      } else {
        // Add microcycle columns
        mesocycle.microcycles.forEach((microcycle, index) => {
          const groupId = Object.values(planningState.microcycleGroups)
            .find(group => group.microcycleIds.includes(microcycle.id))?.id;
          
          columns.push({
            id: microcycle.id,
            type: 'microcycle',
            mesocycleId: mesocycle.id,
            microcycleId: microcycle.id,
            name: microcycle.name,
            isLinked: !!groupId,
            groupId
          });
        });
      }
    });

    return columns;
  }, [mesocycles, planningState.splitStates, planningState.microcycleGroups]);

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
              <TableRow>
                <TableHead className="sticky left-0 bg-background min-w-[200px]">
                  Training Method
                </TableHead>
                {columnStructure.map((column, index) => (
                  <TableHead key={column.id} className="text-center min-w-[150px]">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs">{column.name}</span>
                        {column.type === 'mesocycle' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleMesocycleSplit(column.mesocycleId)}
                            className="h-6 w-6 p-0"
                          >
                            <Split className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      {column.type === 'microcycle' && (
                        <div className="flex items-center justify-center gap-1">
                          {index > 0 && columnStructure[index - 1].type === 'microcycle' && 
                           columnStructure[index - 1].mesocycleId === column.mesocycleId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const prevColumn = columnStructure[index - 1];
                                if (column.isLinked && prevColumn.groupId === column.groupId) {
                                  unlinkMicrocycles(column.groupId!);
                                } else {
                                  createMicrocycleGroup([prevColumn.id, column.id], column.mesocycleId);
                                }
                              }}
                              className="h-4 w-4 p-0"
                            >
                              {column.isLinked && 
                               columnStructure[index - 1].groupId === column.groupId ? (
                                <Unlink className="h-2 w-2" />
                              ) : (
                                <Link2 className="h-2 w-2" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingMethods.map((method) => {
                const rows = method.categories.length > 0 
                  ? method.categories.map(category => ({ method, category }))
                  : [{ method, category: undefined }];

                return rows.map(({ method: currentMethod, category }, rowIndex) => (
                  <TableRow key={`${currentMethod.id}-${category || 'main'}`}>
                    <TableCell className="sticky left-0 bg-background">
                      <div className="space-y-1">
                        {rowIndex === 0 && (
                          <div className="font-medium text-sm">
                            {currentMethod.name}
                          </div>
                        )}
                        {category && (
                          <Badge variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {columnStructure.map((column) => (
                      <TableCell key={column.id} className="p-2">
                        <ExerciseSelectionCell
                          cellData={getCellData(currentMethod.id, category, column.id)}
                          onUpdate={(newData) => 
                            updateCellData(
                              getCellId(currentMethod.id, category, column.id), 
                              newData
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}