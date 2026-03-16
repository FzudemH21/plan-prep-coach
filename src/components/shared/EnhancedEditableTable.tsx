import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Search, ChevronUp, ChevronDown, Plus, Trash2, X, Filter, MoreHorizontal, Edit, Columns } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ColumnRenameDialog } from '@/components/shared/ColumnRenameDialog';
import { ColumnDeleteDialog } from '@/components/shared/ColumnDeleteDialog';
import { ColumnFilter as ExerciseColumnFilter } from '@/components/exercises/ColumnFilter';
import { PlyometricsColumnFilter } from '@/components/plyometrics/PlyometricsColumnFilter';

// Generic interfaces for column management
export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'multiline' | 'select';
  options?: string[];
  required?: boolean;
}

export interface ColumnManagementProps {
  columns: TableColumn[];
  onAddColumn: (column: Omit<TableColumn, 'key'>) => void;
  onUpdateColumn: (key: string, updates: Partial<TableColumn>) => void;
  onDeleteColumn: (key: string) => void;
  onReorderColumns?: (columns: TableColumn[]) => void;
}

interface FilterState {
  search: string;
  columnFilters: Record<string, string[]>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  column: TableColumn;
  onBlur?: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onChange, column, onBlur }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && column.type !== 'multiline') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (column.type === 'multiline') {
      return (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="min-h-[80px] resize-none"
        />
      );
    }

    if (column.type === 'select' && column.options) {
      return (
        <Select value={localValue} onValueChange={(value) => { setLocalValue(value); onChange(value); setIsEditing(false); }}>
          <SelectTrigger>
            <SelectValue />
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
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div 
      onClick={handleEdit}
      className="min-h-[40px] p-2 cursor-pointer hover:bg-muted/50 transition-colors border-transparent border rounded"
    >
      {value || <span className="text-muted-foreground italic">Click to edit</span>}
    </div>
  );
};

interface ColumnFilterProps {
  column: TableColumn;
  allData: Record<string, any>[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

const ColumnFilter: React.FC<ColumnFilterProps> = ({ column, allData, selectedValues, onSelectionChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const uniqueValues = Array.from(new Set(
    allData.map(item => item[column.key]).filter(Boolean)
  )).sort();

  const handleValueToggle = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newValues);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 ${selectedValues.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Filter: {column.label}</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {uniqueValues.map(value => (
            <div key={value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedValues.includes(value)}
                onChange={() => handleValueToggle(value)}
                className="rounded"
              />
              <span className="text-sm">{value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface NewColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (column: Omit<TableColumn, 'key'>) => void;
}

const NewColumnDialog: React.FC<NewColumnDialogProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'multiline' | 'select'>('text');
  const [options, setOptions] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newColumn: Omit<TableColumn, 'key'> = {
      label: name.trim(),
      type,
      ...(type === 'select' && options.trim() && {
        options: options.split(',').map(opt => opt.trim()).filter(Boolean)
      })
    };

    onAdd(newColumn);
    setName('');
    setType('text');
    setOptions('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="column-name">Column Name</Label>
            <Input
              id="column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter column name"
            />
          </div>
          
          <div>
            <Label htmlFor="column-type">Column Type</Label>
            <Select value={type} onValueChange={(value: 'text' | 'multiline' | 'select') => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="multiline">Multiline Text</SelectItem>
                <SelectItem value="select">Select (Dropdown)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'select' && (
            <div>
              <Label htmlFor="column-options">Options (comma-separated)</Label>
              <Input
                id="column-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          )}


          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add Column
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface EnhancedEditableTableProps<T extends Record<string, any>> {
  data: T[];
  columns: TableColumn[];
  onUpdateEntry: (id: string, updates: Partial<T>) => void;
  onDeleteEntry: (id: string) => void;
  onAddEntry: () => void;
  filterState: FilterState;
  onFilterChange: (filterState: FilterState) => void;
  columnManagement?: ColumnManagementProps;
  idField?: keyof T;
  dataType?: 'exercise' | 'plyometrics' | 'default';
}

function EnhancedEditableTable<T extends Record<string, any>>({
  data,
  columns,
  onUpdateEntry,
  onDeleteEntry,
  onAddEntry,
  filterState,
  onFilterChange,
  columnManagement,
  idField = 'id',
  dataType = 'default'
}: EnhancedEditableTableProps<T>) {
  const { toast } = useToast();
  const [showNewColumnDialog, setShowNewColumnDialog] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; columnKey: string; currentName: string }>({
    isOpen: false,
    columnKey: '',
    currentName: ''
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; columnKey: string; columnName: string }>({
    isOpen: false,
    columnKey: '',
    columnName: ''
  });

  const handleSort = useCallback((columnKey: string) => {
    const newDirection = filterState.sortColumn === columnKey && filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    onFilterChange({
      ...filterState,
      sortColumn: columnKey,
      sortDirection: newDirection
    });
  }, [filterState, onFilterChange]);

  const handleColumnFilter = useCallback((columnKey: string, values: string[]) => {
    const newColumnFilters = { ...filterState.columnFilters };
    if (values.length === 0) {
      delete newColumnFilters[columnKey];
    } else {
      newColumnFilters[columnKey] = values;
    }
    onFilterChange({
      ...filterState,
      columnFilters: newColumnFilters,
    });
  }, [filterState, onFilterChange]);

  const handleColumnSort = useCallback((columnKey: string, direction: 'asc' | 'desc') => {
    onFilterChange({
      ...filterState,
      sortColumn: columnKey,
      sortDirection: direction
    });
  }, [filterState, onFilterChange]);

  const renderColumnFilter = (column: TableColumn) => {
    const selectedValues = filterState.columnFilters[column.key] || [];
    const onSelectionChange = (values: string[]) => handleColumnFilter(column.key, values);
    
    if (dataType === 'exercise') {
      return (
        <ExerciseColumnFilter
          column={column}
          allData={data as any}
          selectedValues={selectedValues}
          onSelectionChange={onSelectionChange}
          onSortChange={handleColumnSort}
        />
      );
    } else if (dataType === 'plyometrics') {
      return (
        <PlyometricsColumnFilter
          column={column}
          allData={data as any}
          selectedValues={selectedValues}
          onSelectionChange={onSelectionChange}
          onSortChange={handleColumnSort}
        />
      );
    } else {
      // Fallback to basic ColumnFilter
      return (
        <ColumnFilter
          column={column}
          allData={data}
          selectedValues={selectedValues}
          onSelectionChange={onSelectionChange}
        />
      );
    }
  };

  const clearAllFilters = useCallback(() => {
    onFilterChange({
      ...filterState,
      search: '',
      columnFilters: {},
    });
  }, [filterState, onFilterChange]);

  const handleDeleteColumn = useCallback(() => {
    if (!columnManagement) return;

    columnManagement.onDeleteColumn(deleteDialog.columnKey);
    toast({
      title: "Column Deleted",
      description: `Column "${deleteDialog.columnName}" has been deleted.`
    });
    setDeleteDialog({ isOpen: false, columnKey: '', columnName: '' });
  }, [columnManagement, deleteDialog, toast]);

  const handleRenameColumn = useCallback((newLabel: string) => {
    if (!columnManagement) return;

    columnManagement.onUpdateColumn(renameDialog.columnKey, { label: newLabel });
    toast({
      title: "Column Renamed",
      description: `Column renamed to "${newLabel}".`
    });
    setRenameDialog({ isOpen: false, columnKey: '', currentName: '' });
  }, [columnManagement, renameDialog, toast]);

  const openRenameDialog = useCallback((columnKey: string, currentName: string) => {
    setRenameDialog({ isOpen: true, columnKey, currentName });
  }, []);

  const openDeleteDialog = useCallback((columnKey: string, columnName: string) => {
    setDeleteDialog({ isOpen: true, columnKey, columnName });
  }, []);

  const hasActiveFilters = filterState.search || Object.keys(filterState.columnFilters).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search and Actions Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Global search..."
              value={filterState.search}
              onChange={(e) => onFilterChange({ ...filterState, search: e.target.value })}
              className="h-8 w-48"
            />
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {data.length} entries
          </span>
          
          {columnManagement && (
            <Button
              onClick={() => setShowNewColumnDialog(true)}
              size="sm"
              variant="outline"
            >
              <Columns className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          )}
          
          <Button onClick={onAddEntry} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="max-h-[60vh] overflow-x-auto overflow-y-auto border rounded-lg" style={{scrollbarWidth: 'thin'}}>
        <table className="w-full min-w-[1400px] border-collapse">
          {/* Sticky Header */}
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border text-xs"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div 
                      className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors flex-1"
                      onClick={() => handleSort(column.key)}
                    >
                      {columnManagement ? (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <span className="truncate">{column.label}</span>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onSelect={() => { setTimeout(() => openRenameDialog(column.key, column.label), 0); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Rename Column
                            </ContextMenuItem>
                            <ContextMenuItem 
                              onSelect={() => { setTimeout(() => openDeleteDialog(column.key, column.label), 0); }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Column
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ) : (
                        <span className="truncate">{column.label}</span>
                      )}
                      
                      {filterState.sortColumn === column.key && (
                        filterState.sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        )
                      )}
                    </div>
                    
                    {renderColumnFilter(column)}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border w-20 text-xs">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => (
              <tr key={entry[idField]} className="border-b hover:bg-muted/25 transition-colors">
                {columns.map(column => (
                  <td key={column.key} className="border-r border-border p-1 align-top min-w-[120px]">
                    <EditableCell
                      value={entry[column.key] || ''}
                      onChange={(value) => onUpdateEntry(entry[idField], { [column.key]: value } as Partial<T>)}
                      column={column}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEntry(entry[idField])}
                    className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">No entries found</p>
            <p className="text-sm">Adjust your filters or add a new entry.</p>
          </div>
        )}
      </div>

      {/* New Column Dialog */}
      {columnManagement && (
        <NewColumnDialog
          isOpen={showNewColumnDialog}
          onClose={() => setShowNewColumnDialog(false)}
          onAdd={columnManagement.onAddColumn}
        />
      )}

      {/* Rename Column Dialog */}
      <ColumnRenameDialog
        isOpen={renameDialog.isOpen}
        onClose={() => setRenameDialog({ isOpen: false, columnKey: '', currentName: '' })}
        onRename={handleRenameColumn}
        currentName={renameDialog.currentName}
      />

      {/* Delete Column Dialog */}
      <ColumnDeleteDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, columnKey: '', columnName: '' })}
        onConfirm={handleDeleteColumn}
        columnName={deleteDialog.columnName}
      />
    </div>
  );
}

export default EnhancedEditableTable;