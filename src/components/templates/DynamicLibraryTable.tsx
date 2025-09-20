import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Plus, Trash2, Edit2, MoreHorizontal } from 'lucide-react';
import { useCustomLibraries, CustomLibrary, CustomExercise, LibraryColumn } from '@/hooks/useCustomLibraries';
import { useToast } from '@/hooks/use-toast';

interface DynamicLibraryTableProps {
  library: CustomLibrary;
}

interface EditingCell {
  exerciseId: string;
  columnId: string;
  value: string;
}

interface NewColumnDialog {
  isOpen: boolean;
  name: string;
  type: 'text' | 'select' | 'textarea';
  options: string;
  required: boolean;
}

export function DynamicLibraryTable({ library }: DynamicLibraryTableProps) {
  const { 
    addExerciseToLibrary, 
    updateExerciseInLibrary, 
    deleteExerciseFromLibrary,
    addColumnToLibrary,
    updateColumnInLibrary,
    deleteColumnFromLibrary
  } = useCustomLibraries();
  const { toast } = useToast();
  
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [newColumnDialog, setNewColumnDialog] = useState<NewColumnDialog>({
    isOpen: false,
    name: '',
    type: 'text',
    options: '',
    required: false
  });

  const handleCellEdit = (exerciseId: string, columnId: string, value: string) => {
    const exercise = library.exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      updateExerciseInLibrary(library.id, exerciseId, {
        data: { ...exercise.data, [columnId]: value }
      });
    }
    setEditingCell(null);
  };

  const handleAddExercise = () => {
    const newExerciseData: Record<string, any> = {};
    library.columns.forEach(col => {
      newExerciseData[col.id] = col.required && col.type === 'text' ? 'New Exercise' : '';
    });

    addExerciseToLibrary(library.id, { data: newExerciseData });
    toast({ title: "Success", description: "Exercise added successfully" });
  };

  const handleDeleteExercise = (exerciseId: string) => {
    deleteExerciseFromLibrary(library.id, exerciseId);
    toast({ title: "Success", description: "Exercise deleted successfully" });
  };

  const handleAddColumn = () => {
    const options = newColumnDialog.type === 'select' 
      ? newColumnDialog.options.split(',').map(opt => opt.trim()).filter(Boolean)
      : undefined;

    addColumnToLibrary(library.id, {
      name: newColumnDialog.name,
      type: newColumnDialog.type,
      required: newColumnDialog.required,
      options
    });

    setNewColumnDialog({
      isOpen: false,
      name: '',
      type: 'text',
      options: '',
      required: false
    });

    toast({ title: "Success", description: "Column added successfully" });
  };

  const handleRenameColumn = (columnId: string, newName: string) => {
    updateColumnInLibrary(library.id, columnId, { name: newName });
    toast({ title: "Success", description: "Column renamed successfully" });
  };

  const handleDeleteColumn = (columnId: string) => {
    const column = library.columns.find(col => col.id === columnId);
    if (column?.required) {
      toast({ 
        title: "Error", 
        description: "Cannot delete required columns",
        variant: "destructive"
      });
      return;
    }

    deleteColumnFromLibrary(library.id, columnId);
    toast({ title: "Success", description: "Column deleted successfully" });
  };

  const renderCell = (exercise: CustomExercise, column: LibraryColumn) => {
    const value = exercise.data[column.id] || '';
    const isEditing = editingCell?.exerciseId === exercise.id && editingCell?.columnId === column.id;

    if (isEditing) {
      if (column.type === 'textarea') {
        return (
          <Textarea
            value={editingCell.value}
            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={() => handleCellEdit(exercise.id, column.id, editingCell.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleCellEdit(exercise.id, column.id, editingCell.value);
              }
              if (e.key === 'Escape') {
                setEditingCell(null);
              }
            }}
            autoFocus
            className="min-h-[60px]"
          />
        );
      }

      if (column.type === 'select' && column.options) {
        return (
          <Select 
            value={editingCell.value} 
            onValueChange={(value) => handleCellEdit(exercise.id, column.id, value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select...</SelectItem>
              {column.options.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      return (
        <Input
          value={editingCell.value}
          onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
          onBlur={() => handleCellEdit(exercise.id, column.id, editingCell.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(exercise.id, column.id, editingCell.value);
            }
            if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
          autoFocus
        />
      );
    }

    return (
      <div
        className="cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[24px]"
        onClick={() => setEditingCell({ exerciseId: exercise.id, columnId: column.id, value })}
      >
        {value || <span className="text-muted-foreground italic">Click to edit</span>}
      </div>
    );
  };

  const renderColumnHeader = (column: LibraryColumn) => {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TableHead className="cursor-pointer relative group">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {column.name}
                {column.required && <span className="text-destructive ml-1">*</span>}
              </span>
              <MoreHorizontal className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </TableHead>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem 
            onClick={() => {
              const newName = prompt('Enter new column name:', column.name);
              if (newName && newName !== column.name) {
                handleRenameColumn(column.id, newName);
              }
            }}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Rename Column
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => setNewColumnDialog({ ...newColumnDialog, isOpen: true })}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </ContextMenuItem>
          {!column.required && (
            <ContextMenuItem 
              onClick={() => {
                if (confirm(`Are you sure you want to delete the "${column.name}" column?`)) {
                  handleDeleteColumn(column.id);
                }
              }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Column
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button onClick={handleAddExercise} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Exercise
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {library.exercises.length} exercises
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {library.columns.map(column => renderColumnHeader(column))}
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {library.exercises.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={library.columns.length + 1} className="text-center py-12 text-muted-foreground">
                    No exercises found. Click "Add Exercise" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                library.exercises.map(exercise => (
                  <TableRow key={exercise.id}>
                    {library.columns.map(column => (
                      <TableCell key={column.id}>
                        {renderCell(exercise, column)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={newColumnDialog.isOpen} onOpenChange={(open) => setNewColumnDialog({ ...newColumnDialog, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Column Name</label>
              <Input
                value={newColumnDialog.name}
                onChange={(e) => setNewColumnDialog({ ...newColumnDialog, name: e.target.value })}
                placeholder="Enter column name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Column Type</label>
              <Select 
                value={newColumnDialog.type} 
                onValueChange={(value: 'text' | 'select' | 'textarea') => 
                  setNewColumnDialog({ ...newColumnDialog, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="textarea">Long Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newColumnDialog.type === 'select' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Options (comma-separated)</label>
                <Textarea
                  value={newColumnDialog.options}
                  onChange={(e) => setNewColumnDialog({ ...newColumnDialog, options: e.target.value })}
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="required"
                checked={newColumnDialog.required}
                onChange={(e) => setNewColumnDialog({ ...newColumnDialog, required: e.target.checked })}
              />
              <label htmlFor="required" className="text-sm">Required field</label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setNewColumnDialog({ ...newColumnDialog, isOpen: false })}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddColumn}
              disabled={!newColumnDialog.name.trim()}
            >
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}