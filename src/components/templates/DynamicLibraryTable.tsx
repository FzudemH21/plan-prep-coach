import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, MoreHorizontal, Filter, RotateCcw, FileText, Upload, Download, GripVertical, Recycle } from 'lucide-react';
import { toCSV, downloadCSV } from '@/utils/csvUtils';
import { useCustomLibraries, CustomLibrary, CustomExercise, LibraryColumn, BulkImportPayload } from '@/hooks/useCustomLibraries';
import type { Circuit } from '@/contexts/CustomLibrariesContext';
import { CircuitBuilderDialog } from './CircuitBuilderDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CustomLibraryColumnFilter } from './CustomLibraryColumnFilter';
import { ColumnDeleteDialog } from '@/components/shared/ColumnDeleteDialog';
import { ColumnRenameDialog } from '@/components/shared/ColumnRenameDialog';
import { ExerciseDetailDialog } from '@/components/shared/ExerciseDetailDialog';
import { BulkImportDialog } from './BulkImportDialog';

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

interface FilterState {
  searchTerm: string;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc' | null;
}

interface RenameColumnDialog {
  isOpen: boolean;
  columnId: string;
  currentName: string;
  currentType: 'text' | 'select' | 'textarea';
  currentOptions: string[];
}

interface DeleteColumnDialog {
  isOpen: boolean;
  columnId: string;
  columnName: string;
}

interface ExerciseDetailState {
  isOpen: boolean;
  exercise: CustomExercise | null;
}

export function DynamicLibraryTable({ library }: DynamicLibraryTableProps) {
  const {
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
    addColumnToLibrary,
    updateColumnInLibrary,
    deleteColumnFromLibrary,
    reorderColumnsInLibrary,
    bulkImportToLibrary,
    deleteCircuitFromLibrary,
  } = useCustomLibraries();
  const { toast } = useToast();

  // Ensure library has proper structure with defaults
  const safeLibrary = {
    ...library,
    columns: library.columns?.length
      ? library.columns
      : [{ id: 'exercise', name: 'Exercise', type: 'text' as const, required: true }],
    exercises: library.exercises || []
  };
  
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterState, setFilterState] = useState<FilterState>({
    searchTerm: '',
    sortColumn: null,
    sortDirection: null
  });
  const [renameDialog, setRenameDialog] = useState<RenameColumnDialog>({
    isOpen: false,
    columnId: '',
    currentName: '',
    currentType: 'text',
    currentOptions: []
  });
  const [deleteDialog, setDeleteDialog] = useState<DeleteColumnDialog>({
    isOpen: false,
    columnId: '',
    columnName: ''
  });
  const [newColumnDialog, setNewColumnDialog] = useState<NewColumnDialog>({
    isOpen: false,
    name: '',
    type: 'text',
    options: '',
    required: false
  });
  const [detailDialog, setDetailDialog] = useState<ExerciseDetailState>({
    isOpen: false,
    exercise: null
  });
  const [isCreatingNewExercise, setIsCreatingNewExercise] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [circuitBuilderOpen, setCircuitBuilderOpen] = useState(false);
  const [editingCircuit, setEditingCircuit] = useState<Circuit | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'exercises' | 'circuits'>('exercises');

  const handleBulkImport = (
    rows: Array<Record<string, string>>,
    newColumnDefs: Array<Omit<LibraryColumn, 'id'>>,
    nameColumnLabel: string,
    existingColumnRoleUpdates: Array<{ id: string; role: 'video' | 'description' }> = [],
  ) => {
    // Assign deterministic ids to new columns so exercise rows can reference them.
    const baseTs = Date.now();
    const newColumns: LibraryColumn[] = newColumnDefs.map((col, index) => ({
      ...col,
      id: `column_${baseTs + index}`,
    }));

    // Remap "__new__<headerName>" interim keys in rows to the real column ids.
    const nameToId: Record<string, string> = {};
    newColumns.forEach(col => { nameToId[col.name] = col.id; });

    const exercises: Array<Omit<CustomExercise, 'id'>> = rows.map(row => {
      const data: Record<string, string> = {};
      let description: string | undefined;
      let videoUrl: string | undefined;
      Object.entries(row).forEach(([key, value]) => {
        if (key.startsWith('__new__')) {
          const colName = key.slice(7);
          const realId = nameToId[colName];
          if (realId) data[realId] = value;
        } else if (key === 'description') {
          description = value || undefined;
        } else if (key === 'videoUrl') {
          videoUrl = value || undefined;
        } else {
          data[key] = value;
        }
      });
      return { data, ...(description && { description }), ...(videoUrl && { videoUrl }) };
    });

    // Rename the first (name) column atomically inside the bulk import if the CSV
    // used a different label — doing it as a separate updateColumnInLibrary call
    // would read stale state and overwrite the just-imported exercises.
    const firstColumn = safeLibrary.columns[0];
    const firstColumnRename =
      firstColumn && nameColumnLabel && nameColumnLabel !== firstColumn.name
        ? { id: firstColumn.id, name: nameColumnLabel }
        : undefined;

    const payload: BulkImportPayload = { newColumns, exercises, firstColumnRename, columnRoleUpdates: existingColumnRoleUpdates };
    bulkImportToLibrary(library.id, payload);

    toast({
      title: "Import complete",
      description: `${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} imported successfully${newColumns.length > 0 ? ` (${newColumns.length} new column${newColumns.length !== 1 ? 's' : ''} created)` : ''}.`,
    });
  };

  const handleExportCSV = () => {
    const cols = safeLibrary.columns;
    const headers = cols.map(c => c.name);
    const rows = safeLibrary.exercises.map(ex =>
      cols.map(col => {
        if (col.role === 'video') return ex.videoUrl ?? '';
        if (col.role === 'description') return ex.description ?? '';
        return String(ex.data?.[col.id] ?? '');
      })
    );
    downloadCSV(`${safeLibrary.name}.csv`, toCSV(headers, rows));
    toast({ title: 'Exported', description: `${safeLibrary.exercises.length} exercises saved as CSV.` });
  };

  const handleCellEdit = (exerciseId: string, columnId: string, value: string) => {
    const exercise = safeLibrary.exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      if (columnId === 'description') {
        // Description is a special field on the exercise, not stored in data
        updateExerciseInLibrary(library.id, exerciseId, {
          description: value || undefined,
        });
      } else {
        updateExerciseInLibrary(library.id, exerciseId, {
          data: { ...(exercise.data || {}), [columnId]: value },
        });
      }
    }
    setEditingCell(null);
  };

  const handleAddExercise = () => {
    // Open the create dialog instead of adding a blank row
    setIsCreatingNewExercise(true);
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

  const handleRenameColumn = (newName: string, newType: 'text' | 'select' | 'textarea', newOptions: string[]) => {
    updateColumnInLibrary(library.id, renameDialog.columnId, {
      name: newName,
      type: newType,
      options: newType === 'select' ? newOptions : undefined,
    });
    toast({ title: "Success", description: "Column updated successfully" });
    setRenameDialog({ isOpen: false, columnId: '', currentName: '', currentType: 'text', currentOptions: [] });
  };

  const handleRenameDialogClose = () => {
    setRenameDialog({ isOpen: false, columnId: '', currentName: '', currentType: 'text', currentOptions: [] });
  };

  const handleDeleteColumn = () => {
    deleteColumnFromLibrary(library.id, deleteDialog.columnId);
    toast({ title: "Success", description: "Column deleted successfully" });
    setDeleteDialog({ isOpen: false, columnId: '', columnName: '' });
  };

  // Filter and sort exercises
  const filteredAndSortedExercises = useMemo(() => {
    let filtered = safeLibrary.exercises;

    // Apply search filter
    if (filterState.searchTerm) {
      const searchLower = filterState.searchTerm.toLowerCase();
      filtered = filtered.filter(exercise => {
        return safeLibrary.columns.some(column => {
          const value = exercise.data[column.id] || '';
          return value.toString().toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply sorting
    if (filterState.sortColumn && filterState.sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a.data[filterState.sortColumn!] || '';
        const bValue = b.data[filterState.sortColumn!] || '';
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return filterState.sortDirection === 'desc' ? -comparison : comparison;
      });
    } else {
      // Default sort by first column
      const firstColumn = safeLibrary.columns[0];
      if (firstColumn) {
        filtered = [...filtered].sort((a, b) => {
          const aValue = a.data[firstColumn.id] || '';
          const bValue = b.data[firstColumn.id] || '';
          return aValue.toString().localeCompare(bValue.toString());
        });
      }
    }

    return filtered;
  }, [safeLibrary.exercises, safeLibrary.columns, filterState]);

  const handleFilterChange = (column: string, searchTerm: string) => {
    setFilterState(prev => ({ ...prev, searchTerm }));
  };

  const handleSortChange = (column: string, direction: 'asc' | 'desc' | null) => {
    setFilterState(prev => ({
      ...prev,
      sortColumn: direction ? column : null,
      sortDirection: direction
    }));
  };

  const handleResetFilters = () => {
    setFilterState({
      searchTerm: '',
      sortColumn: null,
      sortDirection: null
    });
    setSelectedIds([]);
  };

  const renderCell = (exercise: CustomExercise, column: LibraryColumn, isFirstColumn: boolean) => {
    // 'description' is stored as a special field (exercise.description), not in exercise.data
    const value =
      column.id === 'description'
        ? (exercise.description ?? (exercise.data || {})['description'] ?? '')
        : (exercise.data || {})[column.id] || '';
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
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
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

    // First column (exercise name) is clickable to open detail dialog
    if (isFirstColumn) {
      return (
        <div className="flex items-center gap-2">
          <button
            className="text-left font-medium text-primary hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setDetailDialog({ isOpen: true, exercise });
            }}
          >
            {value || 'Unnamed Exercise'}
          </button>
          <button
            className="p-1 rounded hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              setEditingCell({ exerciseId: exercise.id, columnId: column.id, value });
            }}
            title="Edit name"
          >
            <Edit2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
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

  const handleColumnDrop = (targetColumnId: string) => {
    if (!draggedColId || draggedColId === targetColumnId) return;
    const cols = safeLibrary.columns;
    const draggedIdx = cols.findIndex(c => c.id === draggedColId);
    const targetIdx = cols.findIndex(c => c.id === targetColumnId);
    // Both must be non-first columns
    if (draggedIdx <= 0 || targetIdx <= 0) return;
    const newOrder = [...cols];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, removed);
    reorderColumnsInLibrary(library.id, newOrder.map(c => c.id));
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const renderColumnHeader = (column: LibraryColumn, isFirstColumn: boolean = false) => {
    const isDragging = draggedColId === column.id;
    const isDragOver = !isFirstColumn && dragOverColId === column.id;

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TableHead
            className={cn(
              "cursor-pointer relative group bg-background select-none",
              isDragging && "opacity-40",
              isDragOver && "border-l-2 border-primary bg-primary/5"
            )}
            draggable={!isFirstColumn}
            onDragStart={!isFirstColumn ? (e) => {
              e.dataTransfer.effectAllowed = 'move';
              setDraggedColId(column.id);
            } : undefined}
            onDragOver={!isFirstColumn ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (draggedColId && draggedColId !== column.id) {
                setDragOverColId(column.id);
              }
            } : undefined}
            onDragLeave={!isFirstColumn ? () => setDragOverColId(null) : undefined}
            onDrop={!isFirstColumn ? (e) => {
              e.preventDefault();
              handleColumnDrop(column.id);
            } : undefined}
            onDragEnd={() => {
              setDraggedColId(null);
              setDragOverColId(null);
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {!isFirstColumn && (
                  <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                )}
                <span className="font-medium">{column.name}</span>
              </div>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <CustomLibraryColumnFilter
                  column={column.id}
                  searchTerm={filterState.sortColumn === column.id ? filterState.searchTerm : ''}
                  onSearchChange={(value) => handleFilterChange(column.id, value)}
                  onSortChange={(direction) => handleSortChange(column.id, direction)}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  exercises={safeLibrary.exercises}
                  sortDirection={filterState.sortColumn === column.id ? filterState.sortDirection : null}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-accent transition-colors" onClick={e => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setTimeout(() => setRenameDialog({ isOpen: true, columnId: column.id, currentName: column.name, currentType: column.type, currentOptions: column.options ?? [] }), 0)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Column
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTimeout(() => setNewColumnDialog({ ...newColumnDialog, isOpen: true }), 0)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Column
                    </DropdownMenuItem>
                    {!isFirstColumn && (
                      <DropdownMenuItem
                        onSelect={() => setTimeout(() => setDeleteDialog({ isOpen: true, columnId: column.id, columnName: column.name }), 0)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Column
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </TableHead>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            key={`rename-${column.id}`}
            onSelect={() => {
              setTimeout(() => {
                setRenameDialog({
                  isOpen: true,
                  columnId: column.id,
                  currentName: column.name,
                  currentType: column.type,
                  currentOptions: column.options ?? [],
                });
              }, 0);
            }}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Column
          </ContextMenuItem>
          <ContextMenuItem
            key={`add-${column.id}`}
            onSelect={() => {
              setTimeout(() => {
                setNewColumnDialog({ ...newColumnDialog, isOpen: true });
              }, 0);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Column
          </ContextMenuItem>
          {!isFirstColumn && (
            <ContextMenuItem
              key={`delete-${column.id}`}
              onSelect={() => {
                setTimeout(() => {
                  setDeleteDialog({
                    isOpen: true,
                    columnId: column.id,
                    columnName: column.name
                  });
                }, 0);
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
        {/* Tab toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('exercises')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === 'exercises'
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Exercises ({safeLibrary.exercises.length})
          </button>
          <button
            onClick={() => setActiveTab('circuits')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              activeTab === 'circuits'
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Circuits ({(library.circuits ?? []).length})
          </button>
        </div>

        {/* ── Exercises tab ── */}
        {activeTab === 'exercises' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Button onClick={handleAddExercise} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exercise
                </Button>
                <Button
                  onClick={() => setNewColumnDialog({ ...newColumnDialog, isOpen: true })}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Column
                </Button>
                <Button onClick={handleResetFilters} variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
                <Button onClick={() => setIsBulkImportOpen(true)} variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={safeLibrary.exercises.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                {filterState.searchTerm && (
                  <Badge variant="secondary" className="gap-1">
                    <Filter className="h-3 w-3" />
                    Filtered
                  </Badge>
                )}
                <span>{filteredAndSortedExercises.length} of {safeLibrary.exercises.length} exercises</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-background hover:bg-background">
                    {safeLibrary.columns.map((column, index) => renderColumnHeader(column, index === 0))}
                    <TableHead className="w-20 bg-background">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedExercises.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={safeLibrary.columns.length + 1} className="text-center py-12 text-muted-foreground">
                        {safeLibrary.exercises.length === 0
                          ? "No exercises yet. Click \"Add Exercise\" or import a file to get started."
                          : "No exercises match the current filters."
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedExercises.map(exercise => (
                      <TableRow
                        key={exercise.id}
                        className={selectedIds.includes(exercise.id) ? "bg-muted/50" : ""}
                      >
                        {safeLibrary.columns.map((column, columnIndex) => (
                          <TableCell key={column.id}>
                            {renderCell(exercise, column, columnIndex === 0)}
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
        )}

        {/* ── Circuits tab ── */}
        {activeTab === 'circuits' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {(library.circuits ?? []).length} circuit{(library.circuits ?? []).length !== 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditingCircuit(undefined); setCircuitBuilderOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Circuit
              </Button>
            </div>

            {(library.circuits ?? []).length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
                No circuits yet. Circuits group exercises into a looped sequence — great for warm-ups.
              </div>
            ) : (
              <div className="space-y-2">
                {(library.circuits ?? []).map((circuit) => (
                  <div
                    key={circuit.id}
                    className="flex items-center gap-3 px-3 py-2.5 border rounded-lg bg-card hover:bg-accent/30 transition-colors"
                  >
                    <Recycle className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{circuit.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {circuit.exercises.length} exercise{circuit.exercises.length !== 1 ? 's' : ''} · {circuit.restBetweenRounds}s between rounds · {circuit.restBetweenExercises}s between exercises
                      </p>
                      {circuit.comments && (
                        <p className="text-xs text-muted-foreground/70 italic truncate mt-0.5">{circuit.comments}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      title="Edit circuit"
                      onClick={() => { setEditingCircuit(circuit); setCircuitBuilderOpen(true); }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      title="Delete circuit"
                      onClick={() => {
                        if (confirm(`Delete circuit "${circuit.name}"?`)) {
                          deleteCircuitFromLibrary(library.id, circuit.id);
                          toast({ title: 'Circuit deleted' });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
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

      <ColumnRenameDialog
        isOpen={renameDialog.isOpen}
        onClose={handleRenameDialogClose}
        onRename={handleRenameColumn}
        currentName={renameDialog.currentName}
        currentType={renameDialog.currentType}
        currentOptions={renameDialog.currentOptions}
      />

      <ColumnDeleteDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, columnId: '', columnName: '' })}
        onConfirm={handleDeleteColumn}
        columnName={deleteDialog.columnName}
      />

      {/* Exercise Detail Dialog - Edit Mode */}
      {detailDialog.exercise && (
        <ExerciseDetailDialog
          isOpen={detailDialog.isOpen}
          onClose={() => setDetailDialog({ isOpen: false, exercise: null })}
          exerciseId={detailDialog.exercise.id}
          exerciseName={detailDialog.exercise.data[safeLibrary.columns[0]?.id] || 'Unnamed Exercise'}
          libraryId={library.id}
          readOnly={false}
          mode="edit"
          columns={safeLibrary.columns}
          exerciseData={detailDialog.exercise.data}
          videoUrl={detailDialog.exercise.videoUrl}
          description={detailDialog.exercise.description}
          onSave={(data) => {
            if (detailDialog.exercise) {
              const firstColumnId = safeLibrary.columns[0]?.id;
              updateExerciseInLibrary(library.id, detailDialog.exercise.id, {
                data: { ...data.data, ...(firstColumnId ? { [firstColumnId]: data.name } : {}) },
                videoUrl: data.videoUrl || undefined,
                description: data.description || undefined,
              });
              toast({ title: "Success", description: "Exercise updated successfully" });
            }
            // Dialog handles its own close/view-mode transition
          }}
        />
      )}

      {/* Exercise Detail Dialog - Create Mode */}
      <ExerciseDetailDialog
        isOpen={isCreatingNewExercise}
        onClose={() => setIsCreatingNewExercise(false)}
        exerciseId=""
        exerciseName=""
        libraryId={library.id}
        readOnly={false}
        mode="create"
        columns={safeLibrary.columns}
        onSave={(data) => {
          const firstColumnId = safeLibrary.columns[0]?.id;
          addExerciseToLibrary(library.id, {
            data: { ...data.data, ...(firstColumnId ? { [firstColumnId]: data.name } : {}) },
            videoUrl: data.videoUrl || undefined,
            description: data.description || undefined,
          });
          setIsCreatingNewExercise(false);
          toast({ title: "Success", description: "Exercise added successfully" });
        }}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        library={safeLibrary}
        onImport={handleBulkImport}
      />

      {/* Circuit Builder Dialog */}
      <CircuitBuilderDialog
        isOpen={circuitBuilderOpen}
        onClose={() => { setCircuitBuilderOpen(false); setEditingCircuit(undefined); }}
        libraryId={library.id}
        circuit={editingCircuit}
      />
    </>
  );
}