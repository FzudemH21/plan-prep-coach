import React, { useState, useRef, useEffect } from 'react';
import { ExerciseEntry, FilterState, TableColumn } from '@/types/exercises';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, Plus, Trash2, X, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ColumnFilter } from './ColumnFilter';

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
    if (e.key === 'Enter' && !e.shiftKey) {
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

interface EditableTableProps {
  exercises: ExerciseEntry[];
  onUpdateExercise: (id: string, updates: Partial<ExerciseEntry>) => void;
  onDeleteExercise: (id: string) => void;
  onAddExercise: () => void;
  filterState: FilterState;
  onFilterChange: (filterState: FilterState) => void;
}

const EditableTable: React.FC<EditableTableProps> = ({
  exercises,
  onUpdateExercise,
  onDeleteExercise,
  onAddExercise,
  filterState,
  onFilterChange
}) => {
  const columns: TableColumn[] = [
    { key: 'übungsname', label: 'Übungsname', type: 'text' },
    { key: 'akzentuierteKörperregion', label: 'Akzentuierte Körperregion', type: 'select', options: ['Unterkörper', 'Oberkörper', 'Ganzkörper', 'Rumpf', 'Schulter'] },
    { key: 'dominantesBewegungsmuster', label: 'Dominantes Bewegungsmuster', type: 'select', options: ['Hinge', 'Squat', 'Vertical Pull', 'Vertical Push', 'Horizontal Pull', 'Horizontal Push', '-', 'x'] },
    { key: 'forcesActingOnSpine', label: 'Forces Acting on Spine', type: 'select', options: ['Compression', 'Shear', 'Distraction', 'Rotation', 'Torque', 'Multi', 'Shear/Compression', 'Shear/Rotation', 'Shear/Distraction'] },
    { key: 'übungsausführung', label: 'Übungsausführung', type: 'select', options: ['isometrisch', 'dynamisch', 'ballistisch', 'quasi-isometrisch'] },
    { key: 'trunkTrainingFramework', label: 'Trunk Training Framework', type: 'text' },
    { key: 'mainMovementPlane', label: 'Main Movement Plane', type: 'select', options: ['Sagittal', 'Frontal', 'Transversal', 'Sagittal/Frontal', 'Sagittal/Transversal', 'Frontal/Transversal'] },
    { key: 'level', label: 'Level', type: 'text' },
    { key: 'artDesWiderstandes', label: 'Art des Widerstandes', type: 'select', options: ['Körpergewicht', 'Kurzhantel', 'Langhantel', 'Kettlebell', 'Kabelzug', 'Maschine', 'Medizinball', 'Sonstiges', 'Partner', 'Prowler', 'Safety Squat Bar', 'Trap Bar'] },
    { key: 'stand', label: 'Stand', type: 'select', options: ['bilateral', 'unilateral', 'x', 'sitting', 'liegend', 'kneeling', 'half-kneeling', 'staggered', 'prone', 'supine', 'gehend', 'quadruped', 'unimanual', 'bimanual'] },
    { key: 'variationen', label: 'Variationen', type: 'multiline' }
  ];

  const handleSort = (columnKey: keyof ExerciseEntry) => {
    const newDirection = filterState.sortColumn === columnKey && filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    onFilterChange({
      ...filterState,
      sortColumn: columnKey,
      sortDirection: newDirection
    });
  };

  const handleColumnFilter = (columnKey: keyof ExerciseEntry, values: string[]) => {
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
  };

  const clearAllFilters = () => {
    onFilterChange({
      ...filterState,
      search: '',
      columnFilters: {},
    });
  };

  const hasActiveFilters = filterState.search || Object.keys(filterState.columnFilters).length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Compact Search and Actions Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Globale Suche..."
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
              Filter zurücksetzen
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {exercises.length} Übungen
          </span>
          <Button onClick={onAddExercise} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Hinzufügen
          </Button>
        </div>
      </div>

      {/* Scrollable Table */}
      <div className="flex-1 overflow-auto">
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
                      className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort(column.key)}
                    >
                      <span className="truncate">{column.label}</span>
                      {filterState.sortColumn === column.key && (
                        filterState.sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        )
                      )}
                    </div>
                    <ColumnFilter
                      column={column}
                      allData={exercises}
                      selectedValues={filterState.columnFilters[column.key] || []}
                      onSelectionChange={(values) => handleColumnFilter(column.key, values)}
                    />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border w-20 text-xs">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((exercise, index) => (
              <tr key={exercise.id} className="border-b hover:bg-muted/25 transition-colors">
                {columns.map(column => (
                  <td key={column.key} className="border-r border-border p-1 align-top min-w-[120px]">
                    <EditableCell
                      value={exercise[column.key]}
                      onChange={(value) => onUpdateExercise(exercise.id, { [column.key]: value } as Partial<ExerciseEntry>)}
                      column={column}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteExercise(exercise.id)}
                    className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {exercises.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Keine Übungen gefunden</p>
            <p className="text-sm">Passen Sie Ihre Filter an oder fügen Sie eine neue Übung hinzu.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableTable;