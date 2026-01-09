import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import { ToolboxEntry } from '@/types/toolbox';

interface DraggableParameterListProps {
  parameters: ToolboxEntry[];
  onReorder: (parameters: ToolboxEntry[]) => void;
  onEditParameter: (parameter: ToolboxEntry) => void;
  onDeleteParameter: (parameterId: string) => void;
}

export function DraggableParameterList({ parameters, onReorder, onEditParameter, onDeleteParameter }: DraggableParameterListProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(parameters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorder(items);
  };

  return (
    <div className="space-y-3">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="parameters">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {parameters.map((parameter, index) => (
                <Draggable key={parameter.id} draggableId={parameter.id} index={index}>
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`p-3 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{parameter.parameterName}</div>
                            <div className="text-sm text-muted-foreground">
                              {parameter.parameterType}
                              {parameter.options && parameter.options.length > 0 && (
                                <span className="ml-2">
                                  Options: {parameter.options.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditParameter(parameter)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteParameter(parameter.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}