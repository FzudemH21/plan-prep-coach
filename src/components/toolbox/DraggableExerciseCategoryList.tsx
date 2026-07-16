import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { GripVertical, Trash2, Pencil, Check, X } from 'lucide-react';

interface DraggableExerciseCategoryListProps {
  categories: string[];
  onReorder: (categories: string[]) => void;
  onDeleteCategory: (category: string) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
}

export function DraggableExerciseCategoryList({
  categories,
  onReorder,
  onDeleteCategory,
  onRenameCategory,
}: DraggableExerciseCategoryListProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onReorder(items);
  };

  const startEdit = (category: string) => {
    setEditingCategory(category);
    setEditInput(category);
  };

  const commitEdit = () => {
    if (editingCategory && editInput.trim() && editInput.trim() !== editingCategory) {
      onRenameCategory?.(editingCategory, editInput.trim());
    }
    setEditingCategory(null);
  };

  return (
    <div className="space-y-3">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="exercise-categories">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {categories.map((category, index) => (
                <Draggable key={category} draggableId={category} index={index}>
                  {(provided, snapshot) => {
                    const card = (
                      <Card
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-3 mb-2 ${snapshot.isDragging ? 'shadow-lg bg-background' : ''}`}
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
                              {editingCategory === category ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    className="h-7 py-0 px-2 text-sm"
                                    value={editInput}
                                    onChange={(e) => setEditInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') commitEdit();
                                      else if (e.key === 'Escape') setEditingCategory(null);
                                    }}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={commitEdit}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCategory(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="font-medium">{category}</div>
                              )}
                            </div>
                          </div>
                          {editingCategory !== category && (
                            <div className="flex items-center gap-1">
                              {onRenameCategory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEdit(category)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteCategory(category)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                    return snapshot.isDragging ? createPortal(card, document.body) : card;
                  }}
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
